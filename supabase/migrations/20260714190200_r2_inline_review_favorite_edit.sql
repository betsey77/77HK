-- R2/R2.1: inline review annotations + owner favorite content editing.
-- Local migration only. Do NOT push without explicit user authorization.

alter table public.favorites
  add column if not exists content_revision integer not null default 1,
  add column if not exists content_edited_at timestamptz null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'favorites_content_revision_positive'
      and conrelid = 'public.favorites'::regclass
  ) then
    alter table public.favorites
      add constraint favorites_content_revision_positive check (content_revision >= 1);
  end if;
end
$$;

alter table public.favorite_admin_reviews
  add column if not exists annotations jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'favorite_admin_reviews_annotations_shape'
      and conrelid = 'public.favorite_admin_reviews'::regclass
  ) then
    alter table public.favorite_admin_reviews
      add constraint favorite_admin_reviews_annotations_shape check (
        jsonb_typeof(annotations) = 'array'
        and jsonb_array_length(annotations) <= 50
        and octet_length(annotations::text) <= 65536
      );
  end if;
end
$$;

-- Enforce review invalidation for every real content update, including generic
-- owner upserts. Metadata is database-owned and cannot be forged by clients.
create or replace function public.reset_favorite_review_on_content_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.content is distinct from new.content then
    new.content_revision := old.content_revision + 1;
    new.content_edited_at := now();
    delete from public.favorite_admin_reviews
    where favorite_id = old.id;
  else
    new.content_revision := old.content_revision;
    new.content_edited_at := old.content_edited_at;
  end if;
  return new;
end;
$$;

revoke all on function public.reset_favorite_review_on_content_change()
  from public, anon, authenticated;

drop trigger if exists trg_favorites_content_review_reset on public.favorites;
create trigger trg_favorites_content_review_reset
  before update on public.favorites
  for each row execute function public.reset_favorite_review_on_content_change();

-- New RPC preserves the old R1/R1.1 function for deployed callers while
-- atomically saving whole-copy review, inline annotations and the audit entry.
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

  select f.owner_id, f.content
  into _owner_id, _content
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

  if _status is null then
    if _annotations is not null and _annotations <> '[]'::jsonb then
      raise exception 'annotations_require_status' using errcode = '22023';
    end if;
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

  _new_note := nullif(btrim(coalesce(_note, '')), '');
  if char_length(coalesce(_new_note, '')) > 2000 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;
  if _status = 'changes_requested' and _new_note is null then
    raise exception 'note_required' using errcode = '22023';
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

  insert into public.audit_log (
    actor, actor_role, action, entity, entity_id, reason, diff, request_id, created_at
  ) values (
    _actor_id, _actor_role::public.app_role, 'admin_save_favorite_review',
    'favorite_admin_reviews', _favorite_id, null,
    jsonb_build_object(
      'kind', case when _old_status is null then 'create' else 'update' end,
      'old_status', _old_status, 'new_status', _status,
      'old_note_length', coalesce(char_length(_old_note), 0),
      'new_note_length', coalesce(char_length(_new_note), 0),
      'old_annotation_count', coalesce(_old_annotation_count, 0),
      'new_annotation_count', _annotation_count
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

