-- ============================================================================
-- 2.1 Slice E2: Bad Case review pack local data layer
-- Tables: generation_artifact_snapshots, bad_case_review_packs,
--         bad_case_findings, bad_case_review_events
-- Local draft only. DO NOT apply remotely until authorized.
-- No cleanup cron. Browser roles have zero direct access.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. generation_artifact_snapshots — one sealed manifest per generation job
-- ---------------------------------------------------------------------------

create table public.generation_artifact_snapshots (
  id uuid primary key default gen_random_uuid(),
  generation_job_id uuid not null references public.generation_jobs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  prompt_manifest jsonb not null,
  rule_manifest jsonb not null,
  knowledge_manifest jsonb not null,
  model_policy_manifest jsonb not null,
  schema_version integer not null default 1
    check (schema_version >= 1),
  content_hash text not null
    check (char_length(content_hash) between 16 and 128),
  availability text not null
    check (availability in ('captured', 'legacy_unavailable')),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (generation_job_id),
  check (jsonb_typeof(prompt_manifest) = 'object' and octet_length(prompt_manifest::text) <= 262144),
  check (jsonb_typeof(rule_manifest) = 'object' and octet_length(rule_manifest::text) <= 262144),
  check (jsonb_typeof(knowledge_manifest) = 'object' and octet_length(knowledge_manifest::text) <= 262144),
  check (
    jsonb_typeof(model_policy_manifest) = 'object'
    and octet_length(model_policy_manifest::text) <= 262144
  )
);

create index generation_artifact_snapshots_owner_captured_idx
  on public.generation_artifact_snapshots(owner_id, captured_at desc);

alter table public.generation_artifact_snapshots enable row level security;

revoke all on table public.generation_artifact_snapshots
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.generation_artifact_snapshots to service_role;

comment on table public.generation_artifact_snapshots is
  'Allowlisted generation-time Prompt/Rules/Knowledge/ModelPolicy manifests only. No rendered prompts, bodies, secrets, or CoT.';

-- ---------------------------------------------------------------------------
-- 2. bad_case_review_packs — at most one primary pack per generation job
-- ---------------------------------------------------------------------------

create table public.bad_case_review_packs (
  id uuid primary key default gen_random_uuid(),
  generation_job_id uuid not null references public.generation_jobs(id) on delete cascade,
  subject_owner_id uuid not null references auth.users(id) on delete cascade,
  trigger_kind text not null
    check (trigger_kind in (
      'score_below_threshold',
      'generation_failed',
      'criteria_failed',
      'manual'
    )),
  status text not null default 'open'
    check (status in (
      'open',
      'triaging',
      'in_progress',
      'resolved',
      'wont_fix',
      'duplicate'
    )),
  owner_team text not null default 'unassigned'
    check (owner_team in (
      'content_prompt',
      'knowledge_rules',
      'model_provider',
      'backend_platform',
      'frontend_experience',
      'unassigned'
    )),
  assignee_id uuid references auth.users(id) on delete set null,
  criteria_version text not null
    check (char_length(criteria_version) between 1 and 32),
  analysis_status text not null default 'not_requested'
    check (analysis_status in (
      'not_requested',
      'pending',
      'completed',
      'analysis_unavailable'
    )),
  summary text
    check (summary is null or char_length(summary) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (generation_job_id),
  check (resolved_at is null or resolved_at >= created_at)
);

create trigger trg_bad_case_review_packs_updated
  before update on public.bad_case_review_packs
  for each row execute function public.set_updated_at();

create index bad_case_review_packs_status_created_idx
  on public.bad_case_review_packs(status, created_at desc);
create index bad_case_review_packs_owner_team_status_idx
  on public.bad_case_review_packs(owner_team, status);
create index bad_case_review_packs_subject_owner_created_idx
  on public.bad_case_review_packs(subject_owner_id, created_at desc);
create index bad_case_review_packs_trigger_kind_created_idx
  on public.bad_case_review_packs(trigger_kind, created_at desc);

alter table public.bad_case_review_packs enable row level security;

revoke all on table public.bad_case_review_packs
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.bad_case_review_packs to service_role;

comment on table public.bad_case_review_packs is
  'Primary bad-case review pack metadata. One pack per generation_job_id. service_role only.';

-- ---------------------------------------------------------------------------
-- 3. bad_case_findings
-- ---------------------------------------------------------------------------

create table public.bad_case_findings (
  id uuid primary key default gen_random_uuid(),
  review_pack_id uuid not null references public.bad_case_review_packs(id) on delete cascade,
  category text not null
    check (category in (
      'input_contract',
      'context_resolution',
      'prompt_instruction',
      'knowledge_retrieval',
      'model_transport',
      'model_output_schema',
      'content_quality',
      'compliance',
      'persistence',
      'ui_presentation',
      'evaluation_gap'
    )),
  severity text not null
    check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  confidence numeric(4, 3) not null
    check (confidence >= 0 and confidence <= 1),
  stage text
    check (stage is null or stage in (
      'request_validated',
      'context_resolved',
      'diagnose_generate',
      'audit',
      'consumer_simulation',
      'persisted',
      'unknown'
    )),
  variant_key text
    check (variant_key is null or variant_key in (
      'source',
      'standardHK',
      'lightCantonese',
      'ig',
      'facebook',
      'shorts'
    )),
  description text not null
    check (char_length(description) between 1 and 4000),
  evidence_refs jsonb not null default '[]'::jsonb,
  criterion_refs jsonb not null default '[]'::jsonb,
  artifact_refs jsonb not null default '[]'::jsonb,
  suggestion jsonb,
  recommended_owner_team text not null default 'unassigned'
    check (recommended_owner_team in (
      'content_prompt',
      'knowledge_rules',
      'model_provider',
      'backend_platform',
      'frontend_experience',
      'unassigned'
    )),
  disposition text
    check (disposition is null or disposition in (
      'confirmed',
      'false_positive',
      'accepted_risk',
      'needs_data',
      'resolved'
    )),
  reviewer_comment text
    check (reviewer_comment is null or char_length(reviewer_comment) <= 4000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(evidence_refs) = 'array' and octet_length(evidence_refs::text) <= 65536),
  check (jsonb_typeof(criterion_refs) = 'array' and octet_length(criterion_refs::text) <= 65536),
  check (jsonb_typeof(artifact_refs) = 'array' and octet_length(artifact_refs::text) <= 65536),
  check (
    suggestion is null
    or (jsonb_typeof(suggestion) = 'object' and octet_length(suggestion::text) <= 65536)
  ),
  check (
    (disposition is null and reviewed_at is null and reviewed_by is null)
    or (disposition is not null and reviewed_at is not null)
  )
);

create trigger trg_bad_case_findings_updated
  before update on public.bad_case_findings
  for each row execute function public.set_updated_at();

create index bad_case_findings_pack_idx
  on public.bad_case_findings(review_pack_id);
create index bad_case_findings_category_severity_idx
  on public.bad_case_findings(category, severity);
create index bad_case_findings_pending_disposition_idx
  on public.bad_case_findings(disposition)
  where disposition is null;

alter table public.bad_case_findings enable row level security;

revoke all on table public.bad_case_findings
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.bad_case_findings to service_role;

comment on table public.bad_case_findings is
  'Machine or human findings for a review pack. Automatic findings require evidence/criterion/artifact refs.';

-- ---------------------------------------------------------------------------
-- 4. bad_case_review_events — append-only audit trail inside the pack domain
-- ---------------------------------------------------------------------------

create table public.bad_case_review_events (
  id uuid primary key default gen_random_uuid(),
  review_pack_id uuid not null references public.bad_case_review_packs(id) on delete cascade,
  finding_id uuid references public.bad_case_findings(id) on delete set null,
  event_type text not null
    check (event_type in (
      'pack_created',
      'pack_assigned',
      'pack_status_changed',
      'analysis_requested',
      'analysis_completed',
      'analysis_failed',
      'finding_created',
      'finding_reviewed',
      'proposal_created',
      'note_added'
    )),
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text
    check (actor_role is null or actor_role in ('user', 'admin', 'super_admin', 'system')),
  from_value jsonb,
  to_value jsonb,
  reason text
    check (reason is null or char_length(reason) <= 2000),
  request_id text
    check (request_id is null or char_length(request_id) <= 128),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    from_value is null
    or (jsonb_typeof(from_value) = 'object' and octet_length(from_value::text) <= 65536)
  ),
  check (
    to_value is null
    or (jsonb_typeof(to_value) = 'object' and octet_length(to_value::text) <= 65536)
  ),
  check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 65536)
);

create index bad_case_review_events_pack_created_idx
  on public.bad_case_review_events(review_pack_id, created_at desc);
create index bad_case_review_events_finding_created_idx
  on public.bad_case_review_events(finding_id, created_at desc)
  where finding_id is not null;
create index bad_case_review_events_type_created_idx
  on public.bad_case_review_events(event_type, created_at desc);

alter table public.bad_case_review_events enable row level security;

revoke all on table public.bad_case_review_events
  from public, anon, authenticated, service_role;
grant select, insert on table public.bad_case_review_events to service_role;

comment on table public.bad_case_review_events is
  'Append-only review pack domain events. No UPDATE/DELETE grants. No secrets or sample bodies.';

