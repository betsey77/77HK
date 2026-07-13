-- ============================================================================
-- Slice C2a: Trusted write path, usage quota, plans & subscriptions
-- 77港话通社媒文案器
--
-- Fixes the security debt from C1 where `grant update on generation_jobs to
-- authenticated` allowed browser JWT to directly mutate job status/results.
-- Replaces direct UPDATE with service_role-only table write grants; BFF
-- enforces ownership via WHERE clause.
--
-- Also introduces the quota & subscription model:
--   plans        — product catalogue (public read for is_public rows)
--   subscriptions — per-user plan assignment (owner read, BFF write)
--   usage_ledger  — append-only event log (owner read, BFF write)
--                   Each event is one immutable row. Terminal events
--                   (consume/release) reference their parent reserve via
--                   reservation_id. At most one terminal event per reservation.
--
-- Atomic invariants enforced by PostgreSQL RPC functions (service_role only):
--   reserve_quota  — FOR UPDATE lock subscription, check balance, insert
--                    reserve event, atomically increment quota_used
--   consume_quota  — FOR UPDATE lock subscription, verify state, insert
--                    terminal consume event (append-only)
--   release_quota  — FOR UPDATE lock subscription, verify state, insert
--                    terminal release event, atomically decrement quota_used
--
-- All functions accept explicit _user_id (service_role has no auth.uid()).
-- BFF validates JWT via requireAuth middleware, extracts userId from verified
-- token, and passes it to these functions.
--
-- Version: 20260712000000 (after 20260711223000_fix_generation_soft_delete)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. New enum
-- ---------------------------------------------------------------------------
create type public.usage_event_type as enum (
  'reserve',
  'consume',
  'release',
  'adjustment'
);

-- ---------------------------------------------------------------------------
-- B. plans table and initial catalogue
-- ---------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,               -- stable product name
  price_fen integer not null check (price_fen >= 0), -- RMB, stored in fen
  quota_per_cycle integer not null check (quota_per_cycle >= 0),
  period_unit text not null
    check (period_unit in ('week', 'month')),
  period_count integer not null
    check (period_count > 0),
  features jsonb not null default '{}'::jsonb
    check (jsonb_typeof(features) = 'object'),
  is_public boolean not null default false, -- client-readable rows
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_plans_updated
  before update on public.plans
  for each row execute function public.set_updated_at();

alter table public.plans enable row level security;

-- Public catalogue read: only explicitly published plans are visible.
create policy "plans public read" on public.plans
  for select to anon, authenticated
  using (is_public = true);

revoke all on table public.plans from public, anon, authenticated, service_role;
grant select on table public.plans to anon, authenticated;
grant select, insert, update on table public.plans to service_role;

-- Product values explicitly approved for the beta. ON CONFLICT makes the
-- catalogue deterministic if this SQL is replayed in an ephemeral database.
insert into public.plans (
  name,
  price_fen,
  quota_per_cycle,
  period_unit,
  period_count,
  features,
  is_public
)
values
  ('Free', 0, 20, 'week', 1, '{}'::jsonb, true),
  ('Pro', 1900, 400, 'month', 1, '{}'::jsonb, true)
on conflict (name) do update
set price_fen = excluded.price_fen,
    quota_per_cycle = excluded.quota_per_cycle,
    period_unit = excluded.period_unit,
    period_count = excluded.period_count,
    features = excluded.features,
    is_public = excluded.is_public;

-- ---------------------------------------------------------------------------
-- C. subscriptions table
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null default 'active'
    check (status in ('active', 'expired', 'cancelled')),
  quota_used integer not null default 0
    check (quota_used >= 0),                  -- denormalized: consumed this cycle
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)                            -- one subscription per user
);

-- Derive a new subscription's period from its plan. Months are calendar
-- months, not an approximation such as 30 days.
create or replace function public.set_subscription_period()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _period_unit text;
  _period_count integer;
begin
  if new.current_period_end is not null then
    return new;
  end if;

  select p.period_unit, p.period_count
  into _period_unit, _period_count
  from public.plans p
  where p.id = new.plan_id;

  if not found then
    raise exception 'plan not found for subscription';
  end if;

  new.current_period_start := coalesce(new.current_period_start, now());
  new.current_period_end := case _period_unit
    when 'week' then new.current_period_start + (_period_count * interval '1 week')
    when 'month' then new.current_period_start + (_period_count * interval '1 month')
  end;

  return new;
end;
$$;

revoke all on function public.set_subscription_period()
  from public, anon, authenticated, service_role;

create trigger trg_subscriptions_period
  before insert on public.subscriptions
  for each row execute function public.set_subscription_period();

create trigger trg_subscriptions_updated
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

-- Owner read: user sees only their own subscription
create policy "subs owner select" on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- No INSERT/UPDATE/DELETE for authenticated — only trusted BFF (service_role)
revoke all on table public.subscriptions from public, anon, authenticated, service_role;
grant select on table public.subscriptions to authenticated;
grant select, insert, update on table public.subscriptions to service_role;

-- ---------------------------------------------------------------------------
-- D. usage_ledger table (append-only)
-- ---------------------------------------------------------------------------
create table public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id),
  event_type public.usage_event_type not null,
  amount integer not null check (amount > 0),   -- always positive
  idempotency_key text not null,
  reservation_id uuid references public.usage_ledger(id),
    -- NULL for reserve events; points to parent reserve for consume/release
  reference_id text,                             -- e.g. generation job id
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),   -- extra context
  created_at timestamptz not null default now(),
  unique(user_id, idempotency_key),              -- idempotency: one event per user per key
  -- Terminal events must reference a parent reservation and cannot duplicate
  constraint chk_event_reservation_shape check (
    (event_type in ('consume', 'release') and reservation_id is not null)
    or (event_type in ('reserve', 'adjustment') and reservation_id is null)
  )
);

-- At most one terminal event per reservation (consume XOR release, not both)
create unique index idx_ledger_one_terminal_per_reservation
  on public.usage_ledger(reservation_id)
  where reservation_id is not null;

alter table public.usage_ledger enable row level security;

-- Owner read: user sees only their own ledger entries
create policy "ledger owner select" on public.usage_ledger
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Append-only: authenticated can only SELECT. INSERT is service_role only.
-- No UPDATE/DELETE grants — this is an append-only ledger.
revoke all on table public.usage_ledger
  from public, anon, authenticated, service_role;
grant select on table public.usage_ledger to authenticated;
grant select, insert on table public.usage_ledger to service_role;

grant usage on type public.usage_event_type to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Indexes for usage_ledger
-- ---------------------------------------------------------------------------
create index idx_ledger_user_created
  on public.usage_ledger(user_id, created_at desc);
create index idx_ledger_subscription
  on public.usage_ledger(subscription_id);
create index idx_ledger_idempotency
  on public.usage_ledger(user_id, idempotency_key);
create index idx_ledger_reservation
  on public.usage_ledger(reservation_id);

-- ---------------------------------------------------------------------------
-- Indexes for subscriptions
-- ---------------------------------------------------------------------------
create index idx_subscriptions_user
  on public.subscriptions(user_id);
create index idx_subscriptions_plan
  on public.subscriptions(plan_id);
create index idx_subscriptions_status
  on public.subscriptions(status);

-- ============================================================================
-- E. generation_jobs security hardening
-- ============================================================================

-- 1. Browser clients can only read their own jobs. Creation and state changes
--    must pass through the trusted BFF.
revoke insert, update on table public.generation_jobs from authenticated;

-- 2. Drop the old宽松 UPDATE policy (browser JWT could mutate anything)
drop policy if exists "jobs owner update" on public.generation_jobs;
drop policy if exists "jobs owner insert" on public.generation_jobs;

-- 3. Replace C1's broad service-role grant with the exact BFF write surface.
revoke all on table public.generation_jobs from service_role;
grant select, insert, update on table public.generation_jobs to service_role;
--
--    NOTE: No SECURITY DEFINER functions are created for job state transitions.
--    The BFF directly UPDATEs generation_jobs via the trusted service_role client
--    with owner_id in the WHERE clause, which is sufficient since only the BFF
--    holds the service_role secret key. This avoids the auth.uid() = null problem
--    that occurs when calling SECURITY DEFINER functions with service_role.

-- ============================================================================
-- F. Signup provisioning and existing-user backfill
-- ============================================================================

-- Preserve Slice B's profile + role provisioning and add the Free
-- subscription in the same auth.users trigger transaction.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _free_plan_id uuid;
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'user'::public.app_role);

  select p.id
  into _free_plan_id
  from public.plans p
  where p.name = 'Free';

  if not found then
    raise exception 'Free plan is not configured';
  end if;

  -- trg_subscriptions_period derives a seven-day period from the seeded plan.
  insert into public.subscriptions (user_id, plan_id)
  values (new.id, _free_plan_id);

  return new;
end;
$$;

revoke all on function public.handle_new_user()
  from public, anon, authenticated;

-- Users created before C2a did not receive subscriptions. Do not overwrite a
-- subscription if a trusted process already assigned one during migration.
insert into public.subscriptions (user_id, plan_id)
select u.id, p.id
from auth.users u
cross join public.plans p
where p.name = 'Free'
on conflict (user_id) do nothing;

-- ============================================================================
-- G. Atomic quota RPC functions (service_role only)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- reserve_quota: Atomically reserve one quota unit for a user.
--
-- 1. Locks the user's active subscription (FOR UPDATE).
-- 2. Checks idempotency: if a reservation with this (user_id, idempotency_key)
--    already exists, returns it.
-- 3. Checks quota_used < quota_per_cycle; returns null if exhausted.
-- 4. INSERTs a 'reserve' event into usage_ledger.
-- 5. Atomically increments subscription.quota_used.
-- 6. Returns the reservation as jsonb.
--
-- Concurrency: FOR UPDATE serialises concurrent reserves for the same user.
-- No over-selling possible.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_quota(
  _user_id uuid,
  _idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _subscription_id uuid;
  _quota_used integer;
  _period_start timestamptz;
  _period_end timestamptz;
  _plan_name text;
  _quota_limit integer;
  _period_unit text;
  _period_count integer;
  _ledger_id uuid;
  _existing record;
begin
  -- 0. Idempotency check: existing reservation for this key?
  select id, user_id, subscription_id, amount, idempotency_key
  into _existing
  from public.usage_ledger
  where user_id = _user_id
    and idempotency_key = _idempotency_key
    and event_type = 'reserve';

  if found then
    return jsonb_build_object(
      'reservation_id', _existing.id,
      'user_id', _existing.user_id,
      'subscription_id', _existing.subscription_id,
      'amount', _existing.amount,
      'idempotency_key', _existing.idempotency_key
    );
  end if;

  -- 1. Lock the active subscription and take a shared lock on its plan so
  -- quota/period configuration cannot change during this reservation.
  select
    s.id,
    s.quota_used,
    s.current_period_start,
    s.current_period_end,
    p.name,
    p.quota_per_cycle,
    p.period_unit,
    p.period_count
  into
    _subscription_id,
    _quota_used,
    _period_start,
    _period_end,
    _plan_name,
    _quota_limit,
    _period_unit,
    _period_count
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.user_id = _user_id
    and s.status = 'active'
    and s.current_period_start <= now()
  for update of s
  for share of p;

  if not found then
    return null; -- no active subscription, plan, or period has not started
  end if;

  -- 1.5 Re-check idempotency AFTER acquiring lock:
  -- A concurrent request with the same key may have inserted a reservation
  -- between our initial check (step 0) and now. If so, return the existing
  -- reservation — do NOT re-check quota (which may now appear full).
  select id, user_id, subscription_id, amount, idempotency_key
  into _existing
  from public.usage_ledger
  where user_id = _user_id
    and idempotency_key = _idempotency_key
    and event_type = 'reserve';

  if found then
    return jsonb_build_object(
      'reservation_id', _existing.id,
      'user_id', _existing.user_id,
      'subscription_id', _existing.subscription_id,
      'amount', _existing.amount,
      'idempotency_key', _existing.idempotency_key
    );
  end if;

  -- 2. A Free period renews lazily on its first request after expiry.
  -- The update is atomic because the subscription row remains locked. Paid
  -- plans never auto-renew here: an expired Pro returns null until payment
  -- provisioning explicitly starts its next calendar-month period.
  if _period_end <= now() then
    if _plan_name <> 'Free' then
      return null;
    end if;

    _period_start := now();
    _period_end := case _period_unit
      when 'week' then _period_start + (_period_count * interval '1 week')
      when 'month' then _period_start + (_period_count * interval '1 month')
    end;

    update public.subscriptions
    set quota_used = 0,
        current_period_start = _period_start,
        current_period_end = _period_end,
        updated_at = now()
    where id = _subscription_id;

    _quota_used := 0;
  end if;

  -- 3. Check plan quota after any Free-period reset.
  if _quota_used >= _quota_limit then
    return null; -- quota exhausted
  end if;

  -- 4. Insert reserve event
  insert into public.usage_ledger (
    user_id, subscription_id, event_type, amount,
    idempotency_key
  ) values (
    _user_id, _subscription_id, 'reserve', 1, _idempotency_key
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into _ledger_id;

  -- If conflict resolved to nothing (race), fetch existing
  if _ledger_id is null then
    select id, user_id, subscription_id, amount, idempotency_key
    into _existing
    from public.usage_ledger
    where user_id = _user_id
      and idempotency_key = _idempotency_key
      and event_type = 'reserve';

    if found then
      return jsonb_build_object(
        'reservation_id', _existing.id,
        'user_id', _existing.user_id,
        'subscription_id', _existing.subscription_id,
        'amount', _existing.amount,
        'idempotency_key', _existing.idempotency_key
      );
    end if;
    return null;
  end if;

  -- 5. Increment quota_used atomically within the same transaction
  update public.subscriptions
  set quota_used = quota_used + 1,
      updated_at = now()
  where id = _subscription_id;

  -- 6. Return reservation details
  return jsonb_build_object(
    'reservation_id', _ledger_id,
    'user_id', _user_id,
    'subscription_id', _subscription_id,
    'amount', 1,
    'idempotency_key', _idempotency_key
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- consume_quota: Atomically consume a reserved quota.
--
-- 1. Reads the immutable reservation and locks its subscription row.
-- 2. Verifies it belongs to _user_id and is event_type='reserve'.
-- 3. Checks no terminal event already exists for this reservation (idempotent).
-- 4. INSERTs a 'consume' terminal event (append-only, does not mutate the
--    original reserve row).
-- 5. Does NOT change quota_used (already incremented at reserve time).
-- ---------------------------------------------------------------------------
create or replace function public.consume_quota(
  _user_id uuid,
  _reservation_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _reserve record;
  _terminal_event public.usage_event_type;
begin
  -- 1. Read the immutable reservation. usage_ledger intentionally has no
  -- UPDATE privilege, so it must never be targeted by SELECT ... FOR UPDATE.
  select id, user_id, subscription_id, amount, event_type
  into _reserve
  from public.usage_ledger
  where id = _reservation_id;

  if not found then
    return false; -- reservation not found
  end if;

  if _reserve.user_id != _user_id then
    return false; -- wrong user
  end if;

  if _reserve.event_type != 'reserve' then
    return false; -- not a reserve event
  end if;

  -- Serialize reserve/consume/release transitions through the mutable
  -- subscription row. service_role has UPDATE on subscriptions, while the
  -- ledger remains strictly SELECT + INSERT (append-only).
  perform 1
  from public.subscriptions
  where id = _reserve.subscription_id
  for update;

  if not found then
    return false;
  end if;

  -- 2. After acquiring the subscription lock, re-check terminal state.
  --    Same transition (consume after consume) → true (idempotent).
  --    Opposite transition (consume after release) → false (conflict).
  select event_type into _terminal_event
  from public.usage_ledger
  where reservation_id = _reservation_id
  limit 1;

  if found then
    if _terminal_event = 'consume' then
      return true;  -- idempotent: same transition
    else
      return false; -- conflict: terminal is release, cannot consume
    end if;
  end if;

  -- 3. Insert terminal consume event (append-only)
  insert into public.usage_ledger (
    user_id, subscription_id, event_type, amount,
    idempotency_key, reservation_id
  ) values (
    _user_id, _reserve.subscription_id, 'consume', _reserve.amount,
    'consume-' || _reservation_id::text, _reservation_id
  );

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- release_quota: Atomically release a reserved quota back to the user.
--
-- 1. Reads the immutable reservation and locks its subscription row.
-- 2. Verifies it belongs to _user_id and is event_type='reserve'.
-- 3. Checks terminal event_type: same transition → true; conflict → false.
-- 4. INSERTs a 'release' terminal event (append-only).
-- 5. Atomically decrements subscription.quota_used.
-- 6. No TOCTOU fallback — if the function fails, the caller must retry.
-- ---------------------------------------------------------------------------
create or replace function public.release_quota(
  _user_id uuid,
  _reservation_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _reserve record;
  _terminal_event public.usage_event_type;
begin
  -- 1. Read the immutable reservation. usage_ledger intentionally has no
  -- UPDATE privilege, so it must never be targeted by SELECT ... FOR UPDATE.
  select id, user_id, subscription_id, amount, event_type, created_at
  into _reserve
  from public.usage_ledger
  where id = _reservation_id;

  if not found then
    return false; -- reservation not found
  end if;

  if _reserve.user_id != _user_id then
    return false; -- wrong user
  end if;

  if _reserve.event_type != 'reserve' then
    return false; -- not a reserve event
  end if;

  -- Use the same mutable lock row/order as reserve_quota and consume_quota.
  perform 1
  from public.subscriptions
  where id = _reserve.subscription_id
  for update;

  if not found then
    return false;
  end if;

  -- 2. After acquiring the subscription lock, re-check terminal state.
  --    Same transition (release after release) → true (idempotent).
  --    Opposite transition (release after consume) → false (conflict).
  select event_type into _terminal_event
  from public.usage_ledger
  where reservation_id = _reservation_id
  limit 1;

  if found then
    if _terminal_event = 'release' then
      return true;  -- idempotent: same transition
    else
      return false; -- conflict: terminal is consume, cannot release
    end if;
  end if;

  -- 3. Insert terminal release event (append-only)
  insert into public.usage_ledger (
    user_id, subscription_id, event_type, amount,
    idempotency_key, reservation_id
  ) values (
    _user_id, _reserve.subscription_id, 'release', _reserve.amount,
    'release-' || _reservation_id::text, _reservation_id
  );

  -- 4. Decrement quota_used atomically within the same transaction
  update public.subscriptions
  set quota_used = greatest(0, quota_used - _reserve.amount),
      updated_at = now()
  where id = _reserve.subscription_id
    and _reserve.created_at >= current_period_start
    and _reserve.created_at < current_period_end;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions: only service_role can execute these atomic quota functions.
-- authenticated, anon, and public are explicitly denied.
-- ---------------------------------------------------------------------------
revoke all on function public.reserve_quota(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_quota(uuid, text) to service_role;

revoke all on function public.consume_quota(uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_quota(uuid, uuid) to service_role;

revoke all on function public.release_quota(uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_quota(uuid, uuid) to service_role;

-- Make newly-created RPCs visible to PostgREST immediately after deployment.
notify pgrst, 'reload schema';
