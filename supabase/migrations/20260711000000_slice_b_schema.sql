-- ============================================================================
-- Slice B: Supabase Auth + profiles/user_roles/audit_log schema
-- 77港话通社媒文案器 — public registration, no email domain whitelist
-- Browser roles are read-only. Role changes and audit writes must go through
-- the trusted BFF using the server-only service role.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('user', 'admin', 'super_admin');

create type public.profile_status as enum ('active', 'suspended', 'deletion_pending', 'deleted');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- profiles — extends auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  status profile_status not null default 'active',
  deletion_requested_at timestamptz,
  purge_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- user_roles — separate table for role assignments
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

-- audit_log — append-only admin action log
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid references auth.users(id) on delete set null,
  actor_role public.app_role,
  action text not null,
  entity text,
  entity_id uuid,
  reason text,
  diff jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Check the calling user's own role. Do not accept an arbitrary user id: these
-- helpers are exposed to authenticated requests for use inside RLS policies.
create or replace function public.has_role(_role public.app_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = _role
  );
$$;

create or replace function public.has_any_role(_roles public.app_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = any(_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- Trigger functions
-- ---------------------------------------------------------------------------

-- auto-set updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- auto-create profile + default role on auth.users insert
-- (public registration — no email domain whitelist)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.user_roles (user_id, role)
  values (new.id, 'user'::public.app_role);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS — enable on all three tables
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- profiles policies
-- ---------------------------------------------------------------------------

create policy "profiles self read" on public.profiles
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy "profiles self update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- user_roles policies
-- ---------------------------------------------------------------------------

create policy "roles self read" on public.user_roles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.has_any_role(array['admin', 'super_admin']::public.app_role[]))
  );

-- ---------------------------------------------------------------------------
-- audit_log policies
-- ---------------------------------------------------------------------------

create policy "audit admin read" on public.audit_log
  for select to authenticated
  using ((select public.has_any_role(array['admin', 'super_admin']::public.app_role[])));

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------

-- Explicit table privileges. RLS controls rows; grants control which operations
-- are available at all. Browser clients cannot insert/update/delete roles or
-- write/alter audit records.
revoke all on table public.profiles, public.user_roles, public.audit_log from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;
grant select on table public.user_roles to authenticated;
grant select on table public.audit_log to authenticated;

grant select, insert, update, delete on table public.profiles, public.user_roles, public.audit_log to service_role;
grant usage on type public.app_role, public.profile_status to authenticated, service_role;

-- SECURITY DEFINER trigger / helper functions — revoke defaults first.
revoke all on function public.has_role(public.app_role) from public, anon, authenticated;
grant execute on function public.has_role(public.app_role) to authenticated, service_role;

revoke all on function public.has_any_role(public.app_role[]) from public, anon, authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated, service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index idx_profiles_status on public.profiles(status);
create index idx_profiles_deletion on public.profiles(deletion_requested_at) where deletion_requested_at is not null;
create index idx_user_roles_user on public.user_roles(user_id);
create index idx_user_roles_role on public.user_roles(role);
create index idx_audit_actor on public.audit_log(actor);
create index idx_audit_created_at on public.audit_log(created_at desc);
create index idx_audit_entity on public.audit_log(entity, entity_id);
