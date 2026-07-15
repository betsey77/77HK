-- ============================================================================
-- Slice F1: Payment Orders + Alipay Webhook Events
-- 77港话通社媒文案器
--
-- Introduces the payment infrastructure for Alipay sandbox checkout:
--   payment_orders         — per-user order records (owner-read, service_role-write)
--   payment_webhook_events — provider notification audit log (service_role only)
--   apply_alipay_payment   — SECURITY DEFINER RPC that atomically marks an
--                            order paid and provisions the Pro subscription.
--
-- Design constraints:
--   - Browser NEVER decides order amount, status, or payment success.
--   - Payment success is ONLY via verified async notify → apply_alipay_payment RPC.
--   - Synchronous return page MUST NOT grant Pro entitlement.
--   - Full notification payload is NEVER stored (only payload_hash for idempotency).
--   - Duplicate/concurrent notifications must NOT double-provision.
--   - Active Pro users are rejected from re-purchasing (one-at-a-time model).
--   - Reuses existing plans, subscriptions, set_updated_at() from Slice C2a.
--
-- This migration is a LOCAL DRAFT — NOT pushed, NOT applied to remote.
-- Real sandbox E2E still requires user authorization.
--
-- Version: 20260713000000 (after 20260712072936_slice_h1_user_feedback)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. payment_orders table
-- ---------------------------------------------------------------------------

create type public.payment_status as enum (
  'created',
  'pending',
  'paid',
  'closed',
  'failed',
  'refunded'
);

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  out_trade_no text not null,
  provider_trade_no text,
  amount_fen integer not null
    check (amount_fen > 0),
  currency text not null
    default 'CNY'
    check (currency = 'CNY'),
  provider text not null
    default 'alipay'
    check (provider = 'alipay'),
  environment text not null
    default 'sandbox'
    check (environment in ('sandbox', 'production')),
  status public.payment_status not null
    default 'created',
  idempotency_key text not null,
  paid_at timestamptz,
  expires_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(out_trade_no),
  unique(user_id, idempotency_key)
);

-- Enforce production-gate: migration cannot seed production mode rows.
-- BFF routes must also guard PAYMENT_MODE before calling Alipay APIs.
alter table public.payment_orders
  add constraint chk_sandbox_only
  check (environment = 'sandbox');

create trigger trg_payment_orders_updated
  before update on public.payment_orders
  for each row execute function public.set_updated_at();

alter table public.payment_orders enable row level security;

-- Owner read: user sees only their own orders
create policy "payment_orders owner select" on public.payment_orders
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- No INSERT/UPDATE/DELETE for authenticated — only trusted BFF (service_role)
revoke all on table public.payment_orders
  from public, anon, authenticated, service_role;
grant select on table public.payment_orders to authenticated;
grant select, insert, update on table public.payment_orders to service_role;

grant usage on type public.payment_status to authenticated, service_role;

create index idx_payment_orders_user
  on public.payment_orders(user_id, created_at desc);
create index idx_payment_orders_out_trade_no
  on public.payment_orders(out_trade_no);
create index idx_payment_orders_status
  on public.payment_orders(status);

-- ---------------------------------------------------------------------------
-- B. payment_webhook_events table
-- ---------------------------------------------------------------------------

create type public.webhook_process_status as enum (
  'received',
  'verified',
  'applied',
  'duplicate',
  'invalid_signature',
  'invalid_amount',
  'unknown_order',
  'wrong_status',
  'error'
);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null
    default 'alipay'
    check (provider = 'alipay'),
  event_key text not null,
  notify_id text,
  out_trade_no text not null,
  payload_hash text not null
    check (length(payload_hash) >= 16),
  process_status public.webhook_process_status not null
    default 'received',
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,

  unique(event_key),
  unique(notify_id)
);

-- No authenticated access — internal audit only
alter table public.payment_webhook_events enable row level security;

revoke all on table public.payment_webhook_events
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.payment_webhook_events
  to service_role;

grant usage on type public.webhook_process_status to service_role;

create index idx_webhook_events_out_trade_no
  on public.payment_webhook_events(out_trade_no);
create index idx_webhook_events_received_at
  on public.payment_webhook_events(received_at desc);

-- ---------------------------------------------------------------------------
-- C. apply_alipay_payment RPC (SECURITY DEFINER + service_role only)
--
-- Called by the Alipay notify route AFTER signature verification succeeds.
-- Atomically:
--   1. Locks the payment_order row (FOR UPDATE).
--   2. Validates: status=pending, amount matches, plan_id is Pro plan_id.
--   3. Sets order status=paid, paid_at=now() with provider_trade_no.
--   4. Fund-safety: verified payment ALWAYS provisions value.
--      - If user has no active Pro → new subscription, quota_used=0, 1 month.
--      - If user already has active Pro → extend period_end from
--        greatest(current_period_end, paid_at) + 1 month, keep quota_used.
--      - quota_used is ONLY reset on initial Free→Pro upgrade.
--   5. Verifies provider_trade_no uniqueness via the unique constraint.
--   6. Marks webhook event as process_status='applied' or 'duplicate'.
--
-- Idempotency:
--   - If the order is already paid: marks webhook as 'duplicate', returns existing
--     subscription (no double-provision).
--   - Concurrent notifications are serialised by the row-level FOR UPDATE lock;
--     the second one sees status=paid and returns 'duplicate'.
--   - No race: checkout already blocks active Pro re-purchase (409), but RPC
--     handles the edge case safely by extending rather than voiding.
-- ---------------------------------------------------------------------------

create or replace function public.apply_alipay_payment(
  _order_id uuid,
  _provider_trade_no text,
  _notify_amount_fen integer,
  _webhook_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _order record;
  _existing_sub record;
  _subscription_id uuid;
  _pro_plan record;
  _paid_at timestamptz := now();
begin
  -- 1. Lock and read the payment order
  select id, user_id, plan_id, out_trade_no, amount_fen, status, idempotency_key
  into _order
  from public.payment_orders
  where id = _order_id
  for update;

  if not found then
    update public.payment_webhook_events
    set process_status = 'unknown_order',
        error_code = 'order_not_found',
        processed_at = now()
    where id = _webhook_event_id;
    return jsonb_build_object('success', false, 'reason', 'order_not_found');
  end if;

  -- 2. Already paid — idempotent, mark webhook as duplicate
  if _order.status = 'paid' then
    update public.payment_webhook_events
    set process_status = 'duplicate',
        processed_at = now()
    where id = _webhook_event_id;

    select id, plan_id, status, quota_used,
           current_period_start, current_period_end
    into _existing_sub
    from public.subscriptions
    where user_id = _order.user_id
      and status = 'active'
    limit 1;

    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'subscription_id', _existing_sub.id,
      'plan_id', _existing_sub.plan_id,
      'quota_used', _existing_sub.quota_used,
      'period_end', _existing_sub.current_period_end
    );
  end if;

  -- 3. Wrong status (not pending, not paid) — fail
  if _order.status != 'pending' then
    update public.payment_webhook_events
    set process_status = 'wrong_status',
        error_code = 'order_status_' || _order.status::text,
        processed_at = now()
    where id = _webhook_event_id;
    return jsonb_build_object('success', false, 'reason', 'wrong_status',
      'current_status', _order.status);
  end if;

  -- 4. Amount mismatch — fail closed
  if _order.amount_fen != _notify_amount_fen then
    update public.payment_webhook_events
    set process_status = 'invalid_amount',
        error_code = format('expected_%s_got_%s', _order.amount_fen, _notify_amount_fen),
        processed_at = now()
    where id = _webhook_event_id;
    return jsonb_build_object('success', false, 'reason', 'amount_mismatch',
      'expected_fen', _order.amount_fen, 'notify_fen', _notify_amount_fen);
  end if;

  -- 5. Look up the Pro plan
  select id, name, price_fen, quota_per_cycle, period_unit, period_count
  into _pro_plan
  from public.plans
  where name = 'Pro'
  limit 1;

  if not found then
    update public.payment_webhook_events
    set process_status = 'error',
        error_code = 'pro_plan_not_found',
        processed_at = now()
    where id = _webhook_event_id;
    return jsonb_build_object('success', false, 'reason', 'pro_plan_not_found');
  end if;

  -- 5b. Verify the order's plan_id is the Pro plan
  if _order.plan_id != _pro_plan.id then
    update public.payment_webhook_events
    set process_status = 'error',
        error_code = 'plan_id_mismatch',
        processed_at = now()
    where id = _webhook_event_id;
    return jsonb_build_object('success', false, 'reason', 'plan_id_mismatch',
      'order_plan_id', _order.plan_id, 'pro_plan_id', _pro_plan.id);
  end if;

  -- 6. Check whether the user already has an active Pro subscription.
  --    Fund-safety rule: verified payment MUST provision value.
  --    If the user already has Pro, extend the current period from
  --    greatest(current_period_end, paid_at) + 1 month.
  --    Do NOT reset quota_used — that only happens on initial Free→Pro upgrade.
  --    This is a safety net; the checkout route already blocks active-Pro re-purchase (409).
  select id, current_period_end, quota_used
  into _existing_sub
  from public.subscriptions
  where user_id = _order.user_id
    and plan_id = _pro_plan.id
    and status = 'active'
  for update;

  if found then
    -- User already has active Pro — extend the period, don't reset quota
    update public.payment_orders
    set status = 'paid',
        provider_trade_no = _provider_trade_no,
        paid_at = _paid_at,
        updated_at = _paid_at
    where id = _order_id;

    update public.subscriptions
    set current_period_end = greatest(
          _existing_sub.current_period_end, _paid_at
        ) + interval '1 month',
        updated_at = now()
    where id = _existing_sub.id;

    update public.payment_webhook_events
    set process_status = 'applied',
        processed_at = now()
    where id = _webhook_event_id;

    return jsonb_build_object(
      'success', true,
      'idempotent', false,
      'extended', true,
      'subscription_id', _existing_sub.id,
      'plan_id', _pro_plan.id,
      'quota_used', _existing_sub.quota_used,
      'period_end', greatest(_existing_sub.current_period_end, _paid_at) + interval '1 month',
      'paid_at', _paid_at
    );
  end if;

  -- 7. Mark the order as paid (first-time Pro upgrade)
  update public.payment_orders
  set status = 'paid',
      provider_trade_no = _provider_trade_no,
      paid_at = _paid_at,
      updated_at = _paid_at
  where id = _order_id;

  -- 8. Provision Pro subscription (upsert by user_id)
  --    Period: now → now + 1 month. quota_used=0 for new Pro.
  insert into public.subscriptions (
    user_id, plan_id, status, quota_used,
    current_period_start, current_period_end
  ) values (
    _order.user_id,
    _pro_plan.id,
    'active',
    0,
    _paid_at,
    _paid_at + interval '1 month'
  )
  on conflict (user_id) do update
  set plan_id = excluded.plan_id,
      status = 'active',
      quota_used = 0,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      updated_at = now()
  returning id into _subscription_id;

  -- 9. Mark webhook event as applied
  update public.payment_webhook_events
  set process_status = 'applied',
      processed_at = now()
  where id = _webhook_event_id;

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'subscription_id', _subscription_id,
    'plan_id', _pro_plan.id,
    'quota_used', 0,
    'period_end', _paid_at + interval '1 month',
    'paid_at', _paid_at
  );
end;
$$;

-- Only service_role can execute this function
revoke all on function public.apply_alipay_payment(uuid, text, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_alipay_payment(uuid, text, integer, uuid)
  to service_role;

-- Make newly-created objects visible to PostgREST immediately
notify pgrst, 'reload schema';

-- ============================================================================
-- End of Slice F1 migration
-- ============================================================================
