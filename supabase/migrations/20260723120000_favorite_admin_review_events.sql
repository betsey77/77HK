-- Append-only admin review history (current state remains favorite_admin_reviews 1:1).
-- Local migration only. Do NOT apply to remote without explicit user authorization.
--
-- Goal: keep every admin save / clear / content-invalidation snapshot queryable in
-- Supabase even after adopted overwrites or review rows are deleted.
-- Empty note is allowed for adopted and changes_requested.

-- Allow empty note on current-state table as well (product: 允许空 note).
alter table public.favorite_admin_reviews
  drop constraint if exists favorite_admin_reviews_changes_note_required;

-- ============================================================
-- A. History table (append-only)
-- ============================================================

create table if not exists public.favorite_admin_review_events (
  id uuid primary key default gen_random_uuid(),
  favorite_id uuid not null references public.favorites (id) on delete cascade,
  content_revision integer null,
  reviewer_id uuid null references auth.users (id) on delete set null,
  event_type text not null
    check (event_type in ('save', 'clear', 'invalidated_by_edit')),
  review_status text null
    check (
      review_status is null
      or review_status in ('adopted', 'changes_requested')
    ),
  note text null,
  annotations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint favorite_admin_review_events_annotations_shape check (
    jsonb_typeof(annotations) = 'array'
    and jsonb_array_length(annotations) <= 50
    and octet_length(annotations::text) <= 65536
  ),
  constraint favorite_admin_review_events_note_len check (
    note is null or char_length(note) <= 2000
  )
);

create index if not exists idx_fav_admin_review_events_favorite_created
  on public.favorite_admin_review_events (favorite_id, created_at desc);

create index if not exists idx_fav_admin_review_events_created
  on public.favorite_admin_review_events (created_at desc);

create index if not exists idx_fav_admin_review_events_reviewer
  on public.favorite_admin_review_events (reviewer_id)
  where reviewer_id is not null;

comment on table public.favorite_admin_review_events is
  'Append-only admin review snapshots. Current UX state stays in favorite_admin_reviews.';

alter table public.favorite_admin_review_events enable row level security;

-- No authenticated/anon policies: not exposed via user JWT API.
-- Supabase dashboard / service_role can still read (service_role bypasses RLS).
revoke all on table public.favorite_admin_review_events from public, anon, authenticated;
grant select on table public.favorite_admin_review_events to service_role;
-- Inserts only via security definer RPC/trigger (table owner).

-- ============================================================
-- B. Helper: snapshot current review row before wipe (if any)
-- ============================================================

create or replace function private.archive_favorite_admin_review(
  _favorite_id uuid,
  _event_type text,
  _actor_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _rev integer;
  _r record;
begin
  if _favorite_id is null then
    return;
  end if;
  if _event_type not in ('save', 'clear', 'invalidated_by_edit') then
    raise exception 'invalid_event_type' using errcode = '22023';
  end if;

  select f.content_revision into _rev
  from public.favorites f
  where f.id = _favorite_id;

  select
    r.reviewer_id,
    r.review_status,
    r.note,
    r.annotations
  into _r
  from public.favorite_admin_reviews r
  where r.favorite_id = _favorite_id;

  if not found then
    return;
  end if;

  insert into public.favorite_admin_review_events (
    favorite_id,
    content_revision,
    reviewer_id,
    event_type,
    review_status,
    note,
    annotations,
    created_at
  ) values (
    _favorite_id,
    _rev,
    coalesce(_actor_id, _r.reviewer_id),
    _event_type,
    _r.review_status,
    _r.note,
    coalesce(_r.annotations, '[]'::jsonb),
    now()
  );
end;
$$;

revoke all on function private.archive_favorite_admin_review(uuid, text, uuid)
  from public, anon, authenticated;

-- ============================================================
-- C. Content / metadata change: archive then delete current review
--     (replaces 20260715121000 body; keep same trigger name)
-- ============================================================

create or replace function public.reset_favorite_review_on_content_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _content_changed boolean;
  _review_metadata_changed boolean;
  _review_requested_started boolean;
begin
  if tg_op = 'INSERT' then
    if new.review_requested then
      new.review_requested_at := now();
    else
      new.review_requested_at := null;
    end if;
    return new;
  end if;

  _content_changed := old.content is distinct from new.content;
  _review_metadata_changed :=
    old.settings->>'brandName' is distinct from new.settings->>'brandName'
    or old.settings->>'copyType' is distinct from new.settings->>'copyType'
    or old.settings->>'customCopyType' is distinct from new.settings->>'customCopyType'
    or old.settings->>'publishPlatform' is distinct from new.settings->>'publishPlatform';
  _review_requested_started :=
    old.review_requested is distinct from new.review_requested
    and new.review_requested;

  if _content_changed then
    new.content_revision := old.content_revision + 1;
    new.content_edited_at := now();
  else
    new.content_revision := old.content_revision;
    new.content_edited_at := old.content_edited_at;
  end if;

  if old.review_requested is distinct from new.review_requested then
    if new.review_requested then
      new.review_requested_at := now();
    else
      new.review_requested_at := null;
    end if;
  elsif new.review_requested and (_content_changed or _review_metadata_changed) then
    new.review_requested_at := now();
  elsif new.review_requested then
    new.review_requested_at := old.review_requested_at;
  else
    new.review_requested_at := null;
  end if;

  if _content_changed or _review_metadata_changed or _review_requested_started then
    -- Preserve prior admin advice before wiping current 1:1 row.
    perform private.archive_favorite_admin_review(old.id, 'invalidated_by_edit', null);
    delete from public.favorite_admin_reviews
    where favorite_id = old.id;
  end if;

  return new;
end;
$$;

revoke all on function public.reset_favorite_review_on_content_change()
  from public, anon, authenticated;

drop trigger if exists trg_favorites_content_review_reset on public.favorites;
create trigger trg_favorites_content_review_reset
  before insert or update on public.favorites
  for each row execute function public.reset_favorite_review_on_content_change();

-- ============================================================
-- D. admin_save_favorite_review: append history on save/clear
--     Empty note allowed for adopted and changes_requested.
-- ============================================================

create or replace function public.admin_save_favorite_review(
  _actor_id uuid,
  _favorite_id uuid,
  _status text,
  _note text default null,
  _annotations jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _actor_role text;
  _actor_group text;
  _owner_id uuid;
  _owner_group text;
  _content text;
  _content_revision integer;
  _new_note text;
  _old_status text;
  _old_note text;
  _old_annotation_count integer := 0;
  _annotation_count integer := 0;
  _item jsonb;
  _start integer;
  _end integer;
  _last_end integer := 0;
  _quoted text;
  _annotation_note text;
  _action_kind text;
begin
  if _actor_id is null or _favorite_id is null then
    raise exception 'invalid_args' using errcode = '22023';
  end if;

  select case
    when bool_or(r.role = 'super_admin') then 'super_admin'
    when bool_or(r.role = 'admin') then 'admin'
    else null
  end
  into _actor_role
  from public.user_roles r
  where r.user_id = _actor_id
    and r.role in ('admin', 'super_admin');

  if _actor_role is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select f.owner_id, f.content, f.content_revision
  into _owner_id, _content, _content_revision
  from public.favorites f
  where f.id = _favorite_id;

  if _owner_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select p.review_group into _actor_group
  from public.profiles p where p.id = _actor_id;
  select p.review_group into _owner_group
  from public.profiles p where p.id = _owner_id;

  if _actor_role <> 'super_admin' and (
    _actor_group is null or _owner_group is null or _actor_group <> _owner_group
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select r.review_status, r.note, jsonb_array_length(r.annotations)
  into _old_status, _old_note, _old_annotation_count
  from public.favorite_admin_reviews r
  where r.favorite_id = _favorite_id;

  -- ---- clear current review ----
  if _status is null then
    if _annotations is not null and _annotations <> '[]'::jsonb then
      raise exception 'annotations_require_status' using errcode = '22023';
    end if;

    -- Snapshot current row (if any) as clear event, then delete.
    perform private.archive_favorite_admin_review(_favorite_id, 'clear', _actor_id);
    delete from public.favorite_admin_reviews where favorite_id = _favorite_id;

    insert into public.audit_log (
      actor, actor_role, action, entity, entity_id, reason, diff, request_id, created_at
    ) values (
      _actor_id, _actor_role::public.app_role, 'admin_save_favorite_review',
      'favorite_admin_reviews', _favorite_id, null,
      jsonb_build_object(
        'kind', 'clear', 'old_status', _old_status, 'new_status', null,
        'old_note_length', coalesce(char_length(_old_note), 0), 'new_note_length', 0,
        'old_annotation_count', coalesce(_old_annotation_count, 0), 'new_annotation_count', 0
      ), null, now()
    );
    return jsonb_build_object(
      'ok', true, 'favoriteId', _favorite_id, 'reviewStatus', null,
      'reviewNote', null, 'reviewUpdatedAt', null, 'annotations', '[]'::jsonb
    );
  end if;

  if _status not in ('adopted', 'changes_requested') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  -- Empty note allowed for both adopted and changes_requested.
  _new_note := nullif(btrim(coalesce(_note, '')), '');
  if char_length(coalesce(_new_note, '')) > 2000 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;

  _annotations := coalesce(_annotations, '[]'::jsonb);
  if jsonb_typeof(_annotations) <> 'array'
     or jsonb_array_length(_annotations) > 50
     or octet_length(_annotations::text) > 65536 then
    raise exception 'invalid_annotations' using errcode = '22023';
  end if;

  for _item in select value from jsonb_array_elements(_annotations)
  loop
    if jsonb_typeof(_item) <> 'object'
       or coalesce(_item->>'id', '') = ''
       or char_length(_item->>'id') > 100
       or coalesce(_item->>'startOffset', '') !~ '^[0-9]+$'
       or coalesce(_item->>'endOffset', '') !~ '^[0-9]+$' then
      raise exception 'invalid_annotation' using errcode = '22023';
    end if;
    _start := (_item->>'startOffset')::integer;
    _end := (_item->>'endOffset')::integer;
    _quoted := coalesce(_item->>'quotedText', '');
    _annotation_note := btrim(coalesce(_item->>'note', ''));
    if _start < _last_end or _end <= _start or _end > char_length(_content)
       or char_length(_quoted) > 1000 or _annotation_note = ''
       or char_length(_annotation_note) > 1000
       or substring(_content from _start + 1 for _end - _start) <> _quoted then
      raise exception 'invalid_annotation' using errcode = '22023';
    end if;
    _last_end := _end;
    _annotation_count := _annotation_count + 1;
  end loop;

  _action_kind := case when _old_status is null then 'create' else 'update' end;

  -- Current 1:1 row (UX state)
  insert into public.favorite_admin_reviews (
    favorite_id, reviewer_id, review_status, note, annotations, created_at, updated_at
  ) values (
    _favorite_id, _actor_id, _status, _new_note, _annotations, now(), now()
  )
  on conflict (favorite_id) do update set
    reviewer_id = excluded.reviewer_id,
    review_status = excluded.review_status,
    note = excluded.note,
    annotations = excluded.annotations,
    updated_at = now();

  -- Append-only history of the NEW snapshot (survives later overwrite/delete)
  insert into public.favorite_admin_review_events (
    favorite_id,
    content_revision,
    reviewer_id,
    event_type,
    review_status,
    note,
    annotations,
    created_at
  ) values (
    _favorite_id,
    _content_revision,
    _actor_id,
    'save',
    _status,
    _new_note,
    _annotations,
    now()
  );

  insert into public.audit_log (
    actor, actor_role, action, entity, entity_id, reason, diff, request_id, created_at
  ) values (
    _actor_id, _actor_role::public.app_role, 'admin_save_favorite_review',
    'favorite_admin_reviews', _favorite_id, null,
    jsonb_build_object(
      'kind', _action_kind,
      'old_status', _old_status, 'new_status', _status,
      'old_note_length', coalesce(char_length(_old_note), 0),
      'new_note_length', coalesce(char_length(_new_note), 0),
      'old_annotation_count', coalesce(_old_annotation_count, 0),
      'new_annotation_count', _annotation_count,
      'history_appended', true
    ), null, now()
  );

  return jsonb_build_object(
    'ok', true, 'favoriteId', _favorite_id, 'reviewStatus', _status,
    'reviewNote', _new_note, 'reviewUpdatedAt', now(), 'annotations', _annotations
  );
end;
$$;

revoke all on function public.admin_save_favorite_review(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_save_favorite_review(uuid, uuid, text, text, jsonb)
  to service_role;
