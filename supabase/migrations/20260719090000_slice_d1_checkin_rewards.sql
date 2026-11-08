-- 1.1.4.5 Slice D1: daily check-ins and one lifetime 30-day Pro reward.
--
-- Product rules confirmed 2026-07-19:
--   - Seven consecutive Asia/Hong_Kong dates earn one reward per account.
--   - A user without a currently valid Pro receives a fresh fixed 30-day Pro
--     period immediately with quota_used reset to 0.
--   - A currently valid Pro receives a pending grant and may claim it only
--     after that Pro period is no longer valid.
--
-- This migration intentionally does not touch usage_ledger or the existing
-- quota/payment RPCs. Browser roles can read only their own safe rows; all
-- mutations are service-role-only through the two invoker RPCs below.

-- ---------------------------------------------------------------------------
-- A. Minimal records and owner-only reads
-- ---------------------------------------------------------------------------

create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date_hk date not null,
  streak_count integer not null
    check (streak_count >= 1),
  streak_started_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, checkin_date_hk),
  constraint daily_checkins_streak_dates_valid
    check (streak_started_on <= checkin_date_hk)
);

create table public.membership_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'checkin_7day'
    check (source = 'checkin_7day'),
  source_ref text not null,
  duration_days integer not null default 30
    check (duration_days = 30),
  status text not null default 'pending'
    check (status in ('pending', 'applied')),
  applied_at timestamptz null,
  subscription_id uuid null
    references public.subscriptions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, source),
  constraint membership_grants_application_consistent check (
    (status = 'pending' and applied_at is null)
    or (status = 'applied' and applied_at is not null)
  )
);

alter table public.daily_checkins enable row level security;
alter table public.membership_grants enable row level security;

create policy "daily_checkins owner select"
  on public.daily_checkins
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "membership_grants owner select"
  on public.membership_grants
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.daily_checkins
  from public, anon, authenticated, service_role;
revoke all on table public.membership_grants
  from public, anon, authenticated, service_role;

grant select on table public.daily_checkins to authenticated;
grant select on table public.membership_grants to authenticated;
grant select, insert on table public.daily_checkins to service_role;
grant select, insert, update on table public.membership_grants to service_role;

-- ---------------------------------------------------------------------------
-- B. Apply today's check-in and create/apply the lifetime reward atomically
-- ---------------------------------------------------------------------------

create or replace function public.apply_daily_checkin(
  _user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _now timestamptz := statement_timestamp();
  _today_hk date := (pg_catalog.timezone('Asia/Hong_Kong', _now))::date;
  _subscription_id uuid;
  _plan_name text;
  _subscription_status text;
  _period_start timestamptz;
  _period_end timestamptz;
  _last_date date;
  _last_streak_count integer;
  _last_streak_started_on date;
  _checkin_id uuid;
  _streak_count integer;
  _streak_started_on date;
  _grant_id uuid;
  _grant_status text;
  _grant_applied_at timestamptz;
  _pro_plan_id uuid;
  _active_pro boolean;
  _reward_earned boolean := false;
begin
  -- Fixed order for every D1 mutation:
  -- per-user advisory lock -> subscription row -> check-in/grant writes.
  -- The advisory lock serialises D1 calls; the subscription lock also
  -- serialises membership changes with quota and payment functions.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('slice_d1_checkin:' || _user_id::text, 0)
  );

  select s.id, p.name, s.status, s.current_period_start, s.current_period_end
  into _subscription_id, _plan_name, _subscription_status, _period_start, _period_end
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.user_id = _user_id
  for update of s;

  if not found then
    raise exception 'subscription_not_found' using errcode = 'P0001';
  end if;

  -- Same-day retries return the existing state without advancing the streak.
  select d.id, d.streak_count, d.streak_started_on
  into _checkin_id, _streak_count, _streak_started_on
  from public.daily_checkins d
  where user_id = _user_id
    and checkin_date_hk = _today_hk;

  if found then
    select g.id, g.status, g.applied_at
    into _grant_id, _grant_status, _grant_applied_at
    from public.membership_grants g
    where g.user_id = _user_id
      and g.source = 'checkin_7day';

    return jsonb_build_object(
      'checkin_id', _checkin_id,
      'checkin_date_hk', _today_hk,
      'checked_in_today', true,
      'streak_count', _streak_count,
      'streak_started_on', _streak_started_on,
      'reward_earned', false,
      'grant_id', _grant_id,
      'grant_status', _grant_status,
      'grant_applied_at', _grant_applied_at,
      'subscription_expires_at', _period_end
    );
  end if;

  select d.checkin_date_hk, d.streak_count, d.streak_started_on
  into _last_date, _last_streak_count, _last_streak_started_on
  from public.daily_checkins d
  where d.user_id = _user_id
    and d.checkin_date_hk < _today_hk
  order by d.checkin_date_hk desc
  limit 1;

  if _last_date = _today_hk - 1 then
    _streak_count := _last_streak_count + 1;
    _streak_started_on := _last_streak_started_on;
  else
    _streak_count := 1;
    _streak_started_on := _today_hk;
  end if;

  insert into public.daily_checkins (
    user_id,
    checkin_date_hk,
    streak_count,
    streak_started_on
  ) values (
    _user_id,
    _today_hk,
    _streak_count,
    _streak_started_on
  )
  on conflict (user_id, checkin_date_hk) do nothing
  returning id into _checkin_id;

  -- The advisory lock should make this conflict path unreachable in normal
  -- operation, but keep the RPC idempotent if a row already exists.
  if _checkin_id is null then
    select d.id, d.streak_count, d.streak_started_on
    into _checkin_id, _streak_count, _streak_started_on
    from public.daily_checkins d
    where d.user_id = _user_id
      and d.checkin_date_hk = _today_hk;
  end if;

  if _streak_count >= 7 then
    select g.id, g.status, g.applied_at
    into _grant_id, _grant_status, _grant_applied_at
    from public.membership_grants g
    where g.user_id = _user_id
      and g.source = 'checkin_7day';

    if not found then
      _active_pro := (
        _plan_name = 'Pro'
        and _subscription_status = 'active'
        and _period_start <= _now
        and _period_end > _now
      );

      select p.id
      into _pro_plan_id
      from public.plans p
      where p.name = 'Pro';

      if not found then
        raise exception 'pro_plan_not_found' using errcode = 'P0001';
      end if;

      insert into public.membership_grants (
        user_id,
        source,
        source_ref,
        duration_days,
        status
      ) values (
        _user_id,
        'checkin_7day',
        _streak_started_on::text,
        30,
        'pending'
      )
      on conflict (user_id, source) do nothing
      returning id, status, applied_at
      into _grant_id, _grant_status, _grant_applied_at;

      if _grant_id is not null then
        _reward_earned := true;

        if not _active_pro then
          update public.subscriptions
          set plan_id = _pro_plan_id,
              status = 'active',
              quota_used = 0,
              current_period_start = _now,
              current_period_end = _now + interval '30 days',
              updated_at = _now
          where id = _subscription_id;

          _period_end := _now + interval '30 days';

          update public.membership_grants
          set status = 'applied',
              applied_at = _now,
              subscription_id = _subscription_id
          where id = _grant_id
          returning status, applied_at
          into _grant_status, _grant_applied_at;
        end if;
      else
        select g.id, g.status, g.applied_at
        into _grant_id, _grant_status, _grant_applied_at
        from public.membership_grants g
        where g.user_id = _user_id
          and g.source = 'checkin_7day';
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'checkin_id', _checkin_id,
    'checkin_date_hk', _today_hk,
    'checked_in_today', true,
    'streak_count', _streak_count,
    'streak_started_on', _streak_started_on,
    'reward_earned', _reward_earned,
    'grant_id', _grant_id,
    'grant_status', _grant_status,
    'grant_applied_at', _grant_applied_at,
    'subscription_expires_at', _period_end
  );
end;
$$;

revoke all on function public.apply_daily_checkin(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_daily_checkin(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- C. Claim a pending reward after the current Pro period is no longer valid
-- ---------------------------------------------------------------------------

create or replace function public.claim_checkin_membership_grant(
  _user_id uuid,
  _grant_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _now timestamptz := statement_timestamp();
  _subscription_id uuid;
  _plan_name text;
  _subscription_status text;
  _period_start timestamptz;
  _period_end timestamptz;
  _grant_status text;
  _grant_applied_at timestamptz;
  _pro_plan_id uuid;
  _active_pro boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('slice_d1_checkin:' || _user_id::text, 0)
  );

  -- Keep the same lock order as apply_daily_checkin: subscription before grant.
  select s.id, p.name, s.status, s.current_period_start, s.current_period_end
  into _subscription_id, _plan_name, _subscription_status, _period_start, _period_end
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.user_id = _user_id
  for update of s;

  if not found then
    raise exception 'subscription_not_found' using errcode = 'P0001';
  end if;

  select g.status, g.applied_at
  into _grant_status, _grant_applied_at
  from public.membership_grants g
  where g.id = _grant_id
    and g.user_id = _user_id
    and g.source = 'checkin_7day'
  for update of g;

  if not found then
    return jsonb_build_object(
      'success', false,
      'reason', 'not_found'
    );
  end if;

  if _grant_status = 'applied' then
    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'grant_id', _grant_id,
      'grant_status', _grant_status,
      'grant_applied_at', _grant_applied_at,
      'subscription_id', _subscription_id,
      'subscription_expires_at', _period_end
    );
  end if;

  _active_pro := (
    _plan_name = 'Pro'
    and _subscription_status = 'active'
    and _period_start <= _now
    and _period_end > _now
  );

  if _active_pro then
    return jsonb_build_object(
      'success', false,
      'reason', 'active_pro',
      'grant_id', _grant_id,
      'grant_status', _grant_status,
      'subscription_expires_at', _period_end
    );
  end if;

  select p.id
  into _pro_plan_id
  from public.plans p
  where p.name = 'Pro';

  if not found then
    raise exception 'pro_plan_not_found' using errcode = 'P0001';
  end if;

  update public.subscriptions
  set plan_id = _pro_plan_id,
      status = 'active',
      quota_used = 0,
      current_period_start = _now,
      current_period_end = _now + interval '30 days',
      updated_at = _now
  where id = _subscription_id;

  update public.membership_grants
  set status = 'applied',
      applied_at = _now,
      subscription_id = _subscription_id
  where id = _grant_id
    and status = 'pending'
  returning status, applied_at
  into _grant_status, _grant_applied_at;

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'grant_id', _grant_id,
    'grant_status', _grant_status,
    'grant_applied_at', _grant_applied_at,
    'subscription_id', _subscription_id,
    'subscription_expires_at', _now + interval '30 days'
  );
end;
$$;

revoke all on function public.claim_checkin_membership_grant(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_checkin_membership_grant(uuid, uuid) to service_role;
