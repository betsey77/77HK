-- ============================================================================
-- R1: review_group + favorite_admin_reviews + service-role review RPC
-- 77港话通社媒文案器
--
-- Local migration only. Do NOT push without explicit user authorization.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. profiles.review_group
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists review_group text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_review_group_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_review_group_format
      check (
        review_group is null
        or review_group ~ '^[a-z0-9][a-z0-9_-]{0,31}$'
      );
  end if;
end
$$;

create index if not exists idx_profiles_review_group
  on public.profiles (review_group)
  where review_group is not null;

-- Keep browser UPDATE column grants narrow: users still cannot set review_group.
-- (existing grant update (display_name, avatar_url) is unchanged)

-- ---------------------------------------------------------------------------
-- B. favorite_admin_reviews
-- ---------------------------------------------------------------------------

create table if not exists public.favorite_admin_reviews (
  favorite_id uuid primary key references public.favorites(id) on delete cascade,
  -- nullable + on delete set null: account purge must not be blocked by historical reviews
  reviewer_id uuid null references auth.users(id) on delete set null,
  review_status text not null
    check (review_status in ('adopted', 'changes_requested')),
  note text null
    check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint favorite_admin_reviews_changes_note_required check (
    review_status <> 'changes_requested'
    or (note is not null and length(btrim(note)) > 0)
  )
);

drop trigger if exists trg_favorite_admin_reviews_updated on public.favorite_admin_reviews;
create trigger trg_favorite_admin_reviews_updated
  before update on public.favorite_admin_reviews
  for each row execute function public.set_updated_at();

alter table public.favorite_admin_reviews enable row level security;

-- Indexes for list/filter queries (PK covers favorite_id)
create index if not exists idx_favorite_admin_reviews_status
  on public.favorite_admin_reviews (review_status);

create index if not exists idx_favorite_admin_reviews_updated
  on public.favorite_admin_reviews (updated_at desc);

create index if not exists idx_favorite_admin_reviews_reviewer
  on public.favorite_admin_reviews (reviewer_id);

-- ---------------------------------------------------------------------------
-- C. private helpers for RLS (fixed empty search_path)
-- Only same_nonnull_review_group: do NOT expose a helper that accepts arbitrary user ids.
-- ---------------------------------------------------------------------------

create or replace function private.same_nonnull_review_group(_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles actor
    join public.profiles owner on owner.id = _owner_id
    where actor.id = (select auth.uid())
      and actor.review_group is not null
      and owner.review_group is not null
      and actor.review_group = owner.review_group
  );
$$;

revoke all on function private.same_nonnull_review_group(uuid) from public, anon, authenticated;
grant execute on function private.same_nonnull_review_group(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- D. RLS policies on favorite_admin_reviews
-- ---------------------------------------------------------------------------

drop policy if exists "favorite_admin_reviews owner select" on public.favorite_admin_reviews;
create policy "favorite_admin_reviews owner select"
  on public.favorite_admin_reviews
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.favorites f
      where f.id = favorite_id
        and f.owner_id = (select auth.uid())
    )
  );

drop policy if exists "favorite_admin_reviews admin select" on public.favorite_admin_reviews;
create policy "favorite_admin_reviews admin select"
  on public.favorite_admin_reviews
  for select
  to authenticated
  using (
    (select private.has_any_role(array['super_admin']::public.app_role[]))
    or (
      (select private.has_any_role(array['admin']::public.app_role[]))
      and exists (
        select 1
        from public.favorites f
        where f.id = favorite_id
          and (select private.same_nonnull_review_group(f.owner_id))
      )
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated → browser cannot write reviews.

revoke all on table public.favorite_admin_reviews from public, anon, authenticated, service_role;
grant select on table public.favorite_admin_reviews to authenticated;
grant select, insert, update, delete on table public.favorite_admin_reviews to service_role;

-- ---------------------------------------------------------------------------
-- E. Atomic service-role-only RPC: write/clear review + audit_log
-- ---------------------------------------------------------------------------

create or replace function public.admin_update_favorite_review(
  _actor_id uuid,
  _favorite_id uuid,
  _status text,
  _note text default null
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
  _is_super boolean := false;
  _old_status text;
  _old_note text;
  _old_note_len integer := 0;
  _new_note text;
  _new_note_len integer := 0;
  _action_kind text;
begin
  if _actor_id is null or _favorite_id is null then
    raise exception 'invalid_args' using errcode = '22023';
  end if;

  -- Resolve actor highest role from user_roles (never trust client metadata)
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

  _is_super := (_actor_role = 'super_admin');

  select f.owner_id into _owner_id
  from public.favorites f
  where f.id = _favorite_id;

  if _owner_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select p.review_group into _actor_group
  from public.profiles p
  where p.id = _actor_id;

  select p.review_group into _owner_group
  from public.profiles p
  where p.id = _owner_id;

  if not _is_super then
    -- Ordinary admin: both groups must be non-null and equal
    if _actor_group is null
       or _owner_group is null
       or _actor_group <> _owner_group then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;

  select r.review_status, r.note
  into _old_status, _old_note
  from public.favorite_admin_reviews r
  where r.favorite_id = _favorite_id;

  if found then
    _old_note_len := coalesce(char_length(_old_note), 0);
  end if;

  -- status null → clear review
  if _status is null then
    delete from public.favorite_admin_reviews
    where favorite_id = _favorite_id;
    _action_kind := 'clear';
    _new_note_len := 0;

    insert into public.audit_log (
      actor, actor_role, action, entity, entity_id, reason, diff, request_id, created_at
    ) values (
      _actor_id,
      _actor_role,
      'admin_update_favorite_review',
      'favorite_admin_reviews',
      _favorite_id,
      null,
      jsonb_build_object(
        'kind', _action_kind,
        'old_status', _old_status,
        'new_status', null,
        'old_note_length', _old_note_len,
        'new_note_length', 0
      ),
      null,
      now()
    );

    return jsonb_build_object(
      'ok', true,
      'favoriteId', _favorite_id,
      'reviewStatus', null,
      'reviewNote', null,
      'reviewUpdatedAt', null
    );
  end if;

  if _status not in ('adopted', 'changes_requested') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  -- Normalize note: trim; empty → null
  if _note is null then
    _new_note := null;
  else
    _new_note := btrim(_note);
    if _new_note = '' then
      _new_note := null;
    end if;
  end if;

  if char_length(coalesce(_new_note, '')) > 2000 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;

  if _status = 'changes_requested' and _new_note is null then
    raise exception 'note_required' using errcode = '22023';
  end if;

  _new_note_len := coalesce(char_length(_new_note), 0);
  _action_kind := case when _old_status is null then 'create' else 'update' end;

  insert into public.favorite_admin_reviews (
    favorite_id, reviewer_id, review_status, note, created_at, updated_at
  ) values (
    _favorite_id, _actor_id, _status, _new_note, now(), now()
  )
  on conflict (favorite_id) do update set
    reviewer_id = excluded.reviewer_id,
    review_status = excluded.review_status,
    note = excluded.note,
    updated_at = now();

  insert into public.audit_log (
    actor, actor_role, action, entity, entity_id, reason, diff, request_id, created_at
  ) values (
    _actor_id,
    _actor_role,
    'admin_update_favorite_review',
    'favorite_admin_reviews',
    _favorite_id,
    null,
    jsonb_build_object(
      'kind', _action_kind,
      'old_status', _old_status,
      'new_status', _status,
      'old_note_length', _old_note_len,
      'new_note_length', _new_note_len
    ),
    null,
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'favoriteId', _favorite_id,
    'reviewStatus', _status,
    'reviewNote', _new_note,
    'reviewUpdatedAt', now()
  );
end;
$$;

revoke all on function public.admin_update_favorite_review(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_update_favorite_review(uuid, uuid, text, text)
  to service_role;
