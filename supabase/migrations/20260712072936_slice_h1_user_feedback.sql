-- ============================================================================
-- Slice H1-R: User feedback center + Server酱 notification
-- 77港话通社媒文案器
--
-- Provides a user_feedback table for collecting user suggestions, bug reports,
-- and experience feedback. Owner-RLS protected with rate limiting.
--
-- RLS design:
--   anon          — no access
--   authenticated — SELECT + INSERT own rows only (cannot write notify_*)
--   admin/super_admin — SELECT all rows (via private.has_any_role helper)
--   service_role  — full access (SELECT/INSERT/UPDATE/DELETE, bypasses RLS)
--
-- Rate limit: max 20 feedback per user per rolling 1 hour.
-- Enforced by trigger + advisory transaction lock so even direct Data API
-- cannot bypass. BFF maps the DB error to HTTP 429.
--
-- Version: 20260712072936_slice_h1_user_feedback
-- Status: APPLIED TO REMOTE via authenticated Supabase MCP on 2026-07-12.
-- Previous remote latest: 20260712070000 (Slice D cloud sync)
-- ============================================================================

-- ============================================================================
-- A. Rate-limit helper function
-- ============================================================================
create or replace function private.check_feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_lock_key bigint;
begin
  -- Advisory lock scoped to this owner to prevent concurrent insert races.
  -- Uses the low 53 bits of owner_id (uuid → bigint via hashtext).
  -- Different owners never contend; same owner serializes on this lock.
  v_lock_key := ('x' || substr(replace(new.owner_id::text, '-', ''), 1, 13))::bit(52)::bigint;
  perform pg_advisory_xact_lock(v_lock_key);

  select count(*)::int into v_count
  from public.user_feedback
  where owner_id = new.owner_id
    and created_at > now() - interval '1 hour';

  if v_count >= 20 then
    raise exception 'RATE_LIMIT: max 20 feedback per hour per user'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- ============================================================================
-- B. user_feedback table
-- ============================================================================
create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null
    check (type in ('feature_request', 'bug_report', 'user_experience', 'other')),
  title text not null
    check (length(title) > 0 and length(title) <= 200),
  content text not null
    check (length(content) > 0 and length(content) <= 5000),
  metadata jsonb
    check (metadata is null or (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192)),

  -- Notification tracking (only service_role can write)
  notify_status text not null default 'pending'
    check (notify_status in ('pending', 'sent', 'failed')),
  notify_attempts integer not null default 0
    check (notify_attempts >= 0 and notify_attempts <= 100),
  notify_last_error text
    check (notify_last_error is null or length(notify_last_error) <= 500),
  notified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Indexes ────────────────────────────────────────────────────

-- Primary query pattern: owner-scoped lookup sorted by recency
create index if not exists idx_user_feedback_owner_created
  on public.user_feedback (owner_id, created_at desc);

-- Rate-limit enforcement: fast count of recent rows per owner
-- (consolidates with the primary index — same leading column owner_id)
-- NOT adding a separate (owner_id, created_at) index since the composite
-- desc index already serves count queries on owner_id.

-- ── Triggers ───────────────────────────────────────────────────

-- updated_at auto-set
create trigger trg_user_feedback_updated
  before update on public.user_feedback
  for each row execute function public.set_updated_at();

-- Rate-limit: before-insert trigger enforces 20/hour per owner
create trigger trg_user_feedback_rate_limit
  before insert on public.user_feedback
  for each row execute function private.check_feedback_rate_limit();

-- ── RLS ────────────────────────────────────────────────────────

alter table public.user_feedback enable row level security;

-- Owner: select own rows
create policy "feedback owner select" on public.user_feedback
  for select to authenticated
  using ((select auth.uid()) = owner_id);

-- Owner: insert own rows (cannot set notify fields — WITH CHECK guards defaults)
create policy "feedback owner insert" on public.user_feedback
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and notify_status = 'pending'
    and notify_attempts = 0
    and notify_last_error is null
    and notified_at is null
  );

-- Admin / super_admin: select all rows via existing role helper
create policy "feedback admin select" on public.user_feedback
  for select to authenticated
  using (
    (select auth.uid()) = owner_id
    or (select private.has_any_role(array['admin', 'super_admin']::public.app_role[]))
  );

-- ── Grants ─────────────────────────────────────────────────────

revoke all on table public.user_feedback from public, anon, authenticated, service_role;

-- Authenticated users: insert + select own (RLS enforces ownership)
grant select, insert on table public.user_feedback to authenticated;

-- Service role: full access (for notification status updates)
grant select, insert, update, delete on table public.user_feedback to service_role;

-- ============================================================================
-- End of Slice H1-R migration
-- ============================================================================
