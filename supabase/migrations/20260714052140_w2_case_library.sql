-- ============================================================================
-- W2: Personal case library (positive / negative examples)
-- 77港话通社媒文案器
--
-- Owner-only CRUD via RLS. Soft delete only (deleted_at).
-- No public SELECT. No admin/super_admin body access in this slice (W4).
-- No case-body prompt injection in this slice (W3).
--
-- Version: 20260714052140 (aligned to remote history; content from local 20260714000000)
-- After: 20260713000000_slice_f1_payment_sandbox
-- ============================================================================

-- ============================================================================
-- Helper: validate tags jsonb array
-- ============================================================================
create or replace function private.case_library_tags_valid(tags jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(tags) = 'array'
    and jsonb_array_length(tags) <= 8
    and not exists (
      select 1
      from jsonb_array_elements(tags) as elem(value)
      where jsonb_typeof(value) <> 'string'
         or length(value #>> '{}') < 1
         or length(value #>> '{}') > 30
    );
$$;

revoke all on function private.case_library_tags_valid(jsonb) from public, anon, authenticated;

-- ============================================================================
-- Table
-- ============================================================================
create table public.case_library_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  case_type text not null
    check (case_type in ('good', 'bad')),
  title text
    check (title is null or length(title) <= 120),
  body text not null
    check (length(body) >= 20 and length(body) <= 5000),
  reason text not null
    check (length(reason) >= 1 and length(reason) <= 500),
  tags jsonb not null default '[]'::jsonb
    check (private.case_library_tags_valid(tags)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger trg_case_library_entries_updated
  before update on public.case_library_entries
  for each row execute function public.set_updated_at();

create index idx_case_library_owner_updated
  on public.case_library_entries (owner_id, updated_at desc)
  where deleted_at is null;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.case_library_entries enable row level security;

-- Select: owner only, non-deleted
create policy "case_library owner select" on public.case_library_entries
  for select to authenticated
  using (
    (select auth.uid()) = owner_id
    and deleted_at is null
  );

-- Insert: owner only; cannot insert as soft-deleted or as another owner
create policy "case_library owner insert" on public.case_library_entries
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and deleted_at is null
  );

-- Update: owner only on non-deleted rows; cannot reassign owner
-- Soft-delete is performed by setting deleted_at (with check still requires owner_id = auth.uid())
create policy "case_library owner update" on public.case_library_entries
  for update to authenticated
  using (
    (select auth.uid()) = owner_id
    and deleted_at is null
  )
  with check (
    (select auth.uid()) = owner_id
  );

-- No physical DELETE policy for authenticated (soft-delete via UPDATE only)
-- Explicitly no public / anon policies

revoke all on table public.case_library_entries from public, anon, authenticated, service_role;
grant select, insert, update on table public.case_library_entries to authenticated;
-- No delete grant for authenticated
grant select, insert, update, delete on table public.case_library_entries to service_role;
