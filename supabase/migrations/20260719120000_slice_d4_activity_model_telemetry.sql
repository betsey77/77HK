-- 1.1.4.5 Slice D4: private daily activity and model-attempt telemetry.
-- Local draft only. Retention cleanup and remote execution are separate gates.

-- ---------------------------------------------------------------------------
-- A. One activity record per user and Hong Kong calendar day
-- ---------------------------------------------------------------------------

create table public.app_activity_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date_hk date not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, activity_date_hk),
  check (last_seen_at >= first_seen_at)
);

create index app_activity_daily_date_user_idx
  on public.app_activity_daily(activity_date_hk, user_id);

alter table public.app_activity_daily enable row level security;

revoke all on table public.app_activity_daily
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.app_activity_daily to service_role;

comment on table public.app_activity_daily is
  'Private daily activity aggregate. Intended retention: 15 months; cleanup is not scheduled by this migration.';

create or replace function public.record_app_activity(_user_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.app_activity_daily (
    user_id,
    activity_date_hk,
    first_seen_at,
    last_seen_at
  ) values (
    _user_id,
    (statement_timestamp() at time zone 'Asia/Hong_Kong')::date,
    statement_timestamp(),
    statement_timestamp()
  )
  on conflict (user_id, activity_date_hk)
  do update set
    last_seen_at = greatest(
      public.app_activity_daily.last_seen_at,
      excluded.last_seen_at
    );
$$;

revoke all on function public.record_app_activity(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.record_app_activity(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- B. Privacy-minimal record for each real provider attempt
-- ---------------------------------------------------------------------------

create table public.model_call_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid references public.generation_jobs(id) on delete set null,
  request_id uuid not null,
  operation text not null
    check (operation in (
      'generate',
      'audit',
      're_audit',
      'score_source',
      'consumer_feedback',
      'parse_personas',
      'translate',
      'localize_selling_point',
      'apply_suggestion',
      'score_naturalness'
    )),
  provider text not null
    check (provider in ('deepseek', 'cantonese_self_hosted', 'featherless')),
  model text not null
    check (char_length(model) between 1 and 120),
  status text not null
    check (status in ('success', 'error')),
  error_class text
    check (error_class is null or error_class in (
      'timeout',
      'rate_limited',
      'authentication',
      'unavailable',
      'network',
      'invalid_response',
      'provider_error',
      'unknown'
    )),
  latency_ms integer not null
    check (latency_ms >= 0),
  attempt smallint not null
    check (attempt >= 1),
  prompt_tokens bigint
    check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens bigint
    check (completion_tokens is null or completion_tokens >= 0),
  total_tokens bigint
    check (total_tokens is null or total_tokens >= 0),
  cache_hit_tokens bigint
    check (cache_hit_tokens is null or cache_hit_tokens >= 0),
  cache_miss_tokens bigint
    check (cache_miss_tokens is null or cache_miss_tokens >= 0),
  usage_source text not null
    check (usage_source in ('provider', 'unavailable')),
  check (
    (status = 'success' and error_class is null)
    or (status = 'error' and error_class is not null)
  ),
  check (
    usage_source = 'provider'
    or (
      prompt_tokens is null
      and completion_tokens is null
      and total_tokens is null
      and cache_hit_tokens is null
      and cache_miss_tokens is null
    )
  ),
  check (
    usage_source = 'unavailable'
    or prompt_tokens is not null
    or completion_tokens is not null
    or total_tokens is not null
    or cache_hit_tokens is not null
    or cache_miss_tokens is not null
  )
);

create index model_call_logs_created_at_idx
  on public.model_call_logs(created_at desc);
create index model_call_logs_provider_model_created_idx
  on public.model_call_logs(provider, model, created_at desc);
create index model_call_logs_request_idx
  on public.model_call_logs(request_id, attempt);
create index model_call_logs_job_idx
  on public.model_call_logs(job_id)
  where job_id is not null;

alter table public.model_call_logs enable row level security;

revoke all on table public.model_call_logs
  from public, anon, authenticated, service_role;
grant select, insert on table public.model_call_logs to service_role;

comment on table public.model_call_logs is
  'Private model-attempt metrics only. Intended retention: 90 days; cleanup is not scheduled by this migration.';
