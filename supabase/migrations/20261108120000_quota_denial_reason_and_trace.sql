-- ============================================================================
-- 2026-11-08 quota denial reasons + trace correlation
--
-- Purpose
--   The 2026-11-08 incident: every Pro generation returned HTTP 402
--   QUOTA_EXHAUSTED, but reserve_quota returns bare NULL, so neither the job,
--   the ledger, nor the bad-case review pack could distinguish:
--     no subscription / inactive / period not started / paid period expired /
--     quota actually exhausted.
--   This migration is ADDITIVE and backward compatible:
--     - v1 reserve_quota is untouched (old deployments keep working);
--     - reserve_quota_v2 returns a structured reason and is opt-in;
--     - denial events, trace_id columns and model-call fields are nullable.
--
-- Rollout order (see docs/plans/2026-11-08-trace-and-quota-observability.md):
--   1. apply this migration;
--   2. deploy the API that calls reserve_quota_v2 and writes trace_id;
--   3. backfill is optional (historical rows stay NULL by design).
--
-- Reversibility: additive only. To roll back, stop writing first, then drop the
-- new function/table/columns in a separate forward-fix migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. Trace correlation id
-- ---------------------------------------------------------------------------
alter table public.generation_jobs
  add column if not exists trace_id uuid;

alter table public.model_call_logs
  add column if not exists trace_id uuid;

alter table public.bad_case_review_packs
  add column if not exists trace_id uuid;

create index if not exists idx_generation_jobs_trace_id
  on public.generation_jobs(trace_id)
  where trace_id is not null;

create index if not exists idx_model_call_logs_trace_id
  on public.model_call_logs(trace_id)
  where trace_id is not null;

create index if not exists idx_bad_case_review_packs_trace_id
  on public.bad_case_review_packs(trace_id)
  where trace_id is not null;

-- ---------------------------------------------------------------------------
-- B. Model call evidence for attribution
--   http_status / finish_reason separate a provider-side failure from a
--   schema/parse failure; request_hash and prompt_version make a bad case
--   reproducible without storing raw prompts; is_fallback marks retries.
-- ---------------------------------------------------------------------------
alter table public.model_call_logs
  add column if not exists http_status integer;

alter table public.model_call_logs
  add column if not exists finish_reason text;

alter table public.model_call_logs
  add column if not exists request_hash text;

alter table public.model_call_logs
  add column if not exists prompt_version text;

alter table public.model_call_logs
  add column if not exists is_fallback boolean not null default false;

-- ---------------------------------------------------------------------------
-- C. Quota denial evidence (append-only)
--   Written by the BFF when reserve_quota_v2 denies a request, before any model
--   call. No user content is stored here.
-- ---------------------------------------------------------------------------
create table if not exists public.quota_denial_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid null references public.generation_jobs(id) on delete set null,
  trace_id uuid null,
  reason text not null check (reason in (
    'no_subscription',
    'inactive_subscription',
    'period_not_started',
    'period_expired',
    'quota_exhausted'
  )),
  plan_name text null,
  period_end timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.quota_denial_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'quota_denial_events'
      and policyname = 'quota denial owner select'
  ) then
    create policy "quota denial owner select" on public.quota_denial_events
      for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end
$$;

revoke all on table public.quota_denial_events
  from public, anon, authenticated, service_role;
grant select on table public.quota_denial_events to authenticated;
grant select, insert on table public.quota_denial_events to service_role;

create index if not exists idx_quota_denial_events_user_created
  on public.quota_denial_events(user_id, created_at desc);

create index if not exists idx_quota_denial_events_reason_created
  on public.quota_denial_events(reason, created_at desc);

-- ---------------------------------------------------------------------------
-- D. reserve_quota_v2 — same accounting as v1, with a machine-readable reason
--
--   Success: { reserved: true, reservation_id, user_id, subscription_id,
--              amount, idempotency_key }
--   Denial : { reserved: false, reason: <one of the five reasons>, plan_name,
--              period_end }
--
--   Accounting invariants are identical to v1:
--     - one reserve row per (user_id, idempotency_key), FOR UPDATE serialised;
--     - Free renews lazily, paid plans never auto-renew;
--     - quota_used is incremented in the same transaction as the ledger insert.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_quota_v2(
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
  _subscription_status text;
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
  -- 0. Idempotency: an existing reservation always wins, as in v1.
  select id, user_id, subscription_id, amount, idempotency_key
  into _existing
  from public.usage_ledger
  where user_id = _user_id
    and idempotency_key = _idempotency_key
    and event_type = 'reserve';

  if found then
    return jsonb_build_object(
      'reserved', true,
      'reservation_id', _existing.id,
      'user_id', _existing.user_id,
      'subscription_id', _existing.subscription_id,
      'amount', _existing.amount,
      'idempotency_key', _existing.idempotency_key
    );
  end if;

  -- 1. Lock the user's subscription (regardless of state) so a denial can be
  -- explained without a second, racy read.
  select
    s.id,
    s.status,
    s.quota_used,
    s.current_period_start,
    s.current_period_end,
    p.name,
    p.quota_per_cycle,
    p.period_unit,
    p.period_count
  into
    _subscription_id,
    _subscription_status,
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
  for update of s
  for share of p;

  if not found then
    return jsonb_build_object('reserved', false, 'reason', 'no_subscription');
  end if;

  if _subscription_status <> 'active' then
    return jsonb_build_object(
      'reserved', false,
      'reason', 'inactive_subscription',
      'plan_name', _plan_name,
      'period_end', _period_end
    );
  end if;

  if _period_start > now() then
    return jsonb_build_object(
      'reserved', false,
      'reason', 'period_not_started',
      'plan_name', _plan_name,
      'period_end', _period_end
    );
  end if;

  -- 2. Same lazy-renewal rule as v1: only Free renews; an expired paid plan is
  -- an explicit denial, not a silent NULL.
  if _period_end <= now() then
    if _plan_name <> 'Free' then
      return jsonb_build_object(
        'reserved', false,
        'reason', 'period_expired',
        'plan_name', _plan_name,
        'period_end', _period_end
      );
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

  -- 3. Quota check after any Free renewal.
  if _quota_used >= _quota_limit then
    return jsonb_build_object(
      'reserved', false,
      'reason', 'quota_exhausted',
      'plan_name', _plan_name,
      'period_end', _period_end
    );
  end if;

  -- 4. Insert the reserve event (same idempotency contract as v1).
  insert into public.usage_ledger (
    user_id, subscription_id, event_type, amount,
    idempotency_key
  ) values (
    _user_id, _subscription_id, 'reserve', 1, _idempotency_key
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into _ledger_id;

  if _ledger_id is null then
    select id, user_id, subscription_id, amount, idempotency_key
    into _existing
    from public.usage_ledger
    where user_id = _user_id
      and idempotency_key = _idempotency_key
      and event_type = 'reserve';

    if found then
      return jsonb_build_object(
        'reserved', true,
        'reservation_id', _existing.id,
        'user_id', _existing.user_id,
        'subscription_id', _existing.subscription_id,
        'amount', _existing.amount,
        'idempotency_key', _existing.idempotency_key
      );
    end if;
    return jsonb_build_object('reserved', false, 'reason', 'quota_exhausted');
  end if;

  -- 5. Increment usage in the same transaction.
  update public.subscriptions
  set quota_used = quota_used + 1,
      updated_at = now()
  where id = _subscription_id;

  return jsonb_build_object(
    'reserved', true,
    'reservation_id', _ledger_id,
    'user_id', _user_id,
    'subscription_id', _subscription_id,
    'amount', 1,
    'idempotency_key', _idempotency_key
  );
end;
$$;

revoke all on function public.reserve_quota_v2(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reserve_quota_v2(uuid, text) to service_role;

comment on function public.reserve_quota_v2(uuid, text) is
  'Reserve one quota unit; returns {reserved,reason,...} so denials are observable. v1 remains for compatibility.';
comment on table public.quota_denial_events is
  'Append-only evidence for reserve_quota_v2 denials; no user content.';
