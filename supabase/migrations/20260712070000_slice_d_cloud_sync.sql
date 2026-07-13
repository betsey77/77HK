-- ============================================================================
-- Slice D: Cloud sync — favorites, saved_configs, brand_profiles
-- 77港话通社媒文案器
--
-- Provides cross-device persistence for user bookmarks, generation configs,
-- and a single brand profile. All tables are owner-RLS protected:
--   anon          — no access
--   authenticated — only own rows
--   service_role  — minimal grants for trusted BFF writes
--
-- MVP scope: one brand profile per user (unique owner_id).
-- Multi-brand management is deferred to a later slice.
--
-- Version: 20260712070000 (after 20260712000000_slice_c2a_trusted_write_quota)
-- ============================================================================

-- ============================================================================
-- A. favorites table
-- ============================================================================
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null
    check (length(client_id) > 0 and length(client_id) <= 256),
  variant_key text not null
    check (variant_key in ('standardHK', 'lightCantonese', 'ig', 'facebook', 'shorts')),
  content text not null
    check (length(content) > 0 and length(content) <= 5000),
  source text not null
    check (length(source) > 0 and length(source) <= 5000),
  settings jsonb not null
    check (jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 1048576),
  variant_meta jsonb
    check (variant_meta is null or (jsonb_typeof(variant_meta) = 'object' and octet_length(variant_meta::text) <= 1048576)),
  scores jsonb
    check (scores is null or (jsonb_typeof(scores) = 'object' and octet_length(scores::text) <= 1048576)),
  consumer_feedback jsonb
    check (consumer_feedback is null or (jsonb_typeof(consumer_feedback) = 'array' and octet_length(consumer_feedback::text) <= 1048576)),
  notes text
    check (notes is null or length(notes) <= 2000),
  rating integer
    check (rating is null or (rating >= 1 and rating <= 5)),
  favorite_reason text
    check (favorite_reason is null or length(favorite_reason) <= 1000),
  reason_tags varchar(100)[] not null default '{}'
    check (cardinality(reason_tags) <= 20 and array_position(reason_tags, ''::varchar) is null),
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, client_id)
);

create trigger trg_favorites_updated
  before update on public.favorites
  for each row execute function public.set_updated_at();

alter table public.favorites enable row level security;

create policy "favorites owner select" on public.favorites
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "favorites owner insert" on public.favorites
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "favorites owner update" on public.favorites
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "favorites owner delete" on public.favorites
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.favorites from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.favorites to authenticated;
grant select, insert, update, delete on table public.favorites to service_role;

-- UNIQUE(owner_id, client_id) already provides an index for owner+client lookups.
-- Only additional index needed: sorted queries by saved_at.
create index idx_favorites_owner_saved on public.favorites(owner_id, saved_at desc);

-- ============================================================================
-- B. saved_configs table
-- ============================================================================
create table public.saved_configs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null
    check (length(client_id) > 0 and length(client_id) <= 256),
  name text not null
    check (length(name) > 0 and length(name) <= 200),
  config jsonb not null
    check (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 1048576),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, client_id)
);

create trigger trg_saved_configs_updated
  before update on public.saved_configs
  for each row execute function public.set_updated_at();

alter table public.saved_configs enable row level security;

create policy "saved_configs owner select" on public.saved_configs
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "saved_configs owner insert" on public.saved_configs
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "saved_configs owner update" on public.saved_configs
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "saved_configs owner delete" on public.saved_configs
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.saved_configs from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.saved_configs to authenticated;
grant select, insert, update, delete on table public.saved_configs to service_role;

-- ============================================================================
-- Atomic 20-config limit trigger
--
-- Uses pg_advisory_xact_lock to serialize per-owner inserts, preventing
-- concurrent bypass. Upserts of existing (owner_id, client_id) pairs are
-- always allowed (the conflict is resolved to UPDATE by the upsert).
-- ============================================================================
create or replace function public.check_config_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _existing_id uuid;
  _current_count integer;
  _lock_key bigint;
begin
  _lock_key := ('x' || substr(replace(new.owner_id::text, '-', ''), 1, 16))::bit(64)::bigint;
  perform pg_advisory_xact_lock(_lock_key);

  -- Existing (owner_id, client_id) upserts are always allowed
  select id into _existing_id
  from public.saved_configs
  where owner_id = new.owner_id and client_id = new.client_id;

  if found then
    return new;
  end if;

  select count(*) into _current_count
  from public.saved_configs
  where owner_id = new.owner_id;

  if _current_count >= 20 then
    raise exception 'config_limit_exceeded'
      using errcode = '23US1';
  end if;

  return new;
end;
$$;

revoke all on function public.check_config_limit()
  from public, anon, authenticated, service_role;

create trigger trg_config_limit
  before insert on public.saved_configs
  for each row execute function public.check_config_limit();

-- ============================================================================
-- C. brand_profiles table
-- ============================================================================
create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_name text
    check (brand_name is null or length(brand_name) <= 200),
  product_name text
    check (product_name is null or length(product_name) <= 200),
  brand_red_lines text
    check (brand_red_lines is null or length(brand_red_lines) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id)
);

create trigger trg_brand_profiles_updated
  before update on public.brand_profiles
  for each row execute function public.set_updated_at();

alter table public.brand_profiles enable row level security;

create policy "brand_profiles owner select" on public.brand_profiles
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "brand_profiles owner insert" on public.brand_profiles
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "brand_profiles owner update" on public.brand_profiles
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "brand_profiles owner delete" on public.brand_profiles
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.brand_profiles from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.brand_profiles to authenticated;
grant select, insert, update, delete on table public.brand_profiles to service_role;

notify pgrst, 'reload schema';
