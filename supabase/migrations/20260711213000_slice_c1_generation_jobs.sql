-- ============================================================================
-- Slice C1: generation_jobs — task ownership, history, soft delete, idempotency
-- 77港话通社媒文案器
-- DO NOT apply to remote until authorized. Admin-only for now: this is a draft
-- for local review. All RLS is owner-scoped; browser cannot escalate.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
create type public.generation_status as enum (
  'pending',
  'processing',
  'completed',
  'failed'
);

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  status public.generation_status not null default 'pending',

  -- Input / brief snapshot (subset of GenerateRequest for history replay)
  source text not null,
  platform text not null default 'all',
  tone text not null default '穩妥',
  cantonese_level smallint not null default 2 check (cantonese_level between 0 and 5),
  english_mixing_level smallint not null default 1 check (english_mixing_level between 0 and 5),
  creativity_level smallint not null default 2 check (creativity_level between 0 and 4),
  input_language text not null default 'mandarin',
  brand_name text,
  product_name text,
  brand_red_lines text,
  brief jsonb,  -- full GenerateRequest snapshot for audit/replay

  -- Generation results (null until processing completes)
  variants jsonb,           -- Variants { standardHK, lightCantonese, ig, facebook, shorts }
  variant_meta jsonb,       -- Record<string, VariantMeta>
  diagnosis jsonb,          -- Diagnosis { hasSimplifiedChars, mainlandPhrases, issues, … }
  audit jsonb,              -- Audit { thermometer, issues, replacements, risks, … }
  scores jsonb,             -- { generated: AuditScores, source: AuditScores | null }
  consumer_feedback jsonb,  -- ConsumerFeedback[]
  generation_engine text,   -- 'self-hosted-cantonese' | 'deepseek' | 'rules'

  -- Error (only populated when status = 'failed')
  error_message text,
  error_code text,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,  -- soft delete

  -- Idempotency: one job per owner per idempotency key
  unique(owner_id, idempotency_key)
);

-- ---------------------------------------------------------------------------
-- Trigger — auto-set updated_at
-- ---------------------------------------------------------------------------
create trigger trg_generation_jobs_updated
  before update on public.generation_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — enable
-- ---------------------------------------------------------------------------
alter table public.generation_jobs enable row level security;

-- SELECT: owner sees own non-deleted jobs
create policy "jobs owner select" on public.generation_jobs
  for select to authenticated
  using (
    (select auth.uid()) = owner_id
    and deleted_at is null
  );

-- INSERT: only as self
create policy "jobs owner insert" on public.generation_jobs
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
  );

-- UPDATE: owner can update own jobs (status changes, soft delete)
create policy "jobs owner update" on public.generation_jobs
  for update to authenticated
  using (
    (select auth.uid()) = owner_id
  )
  with check (
    (select auth.uid()) = owner_id
  );

-- DELETE: disallowed — use soft delete (set deleted_at via UPDATE) instead.
-- No delete policy is created. Hard deletes are service_role only.

-- ---------------------------------------------------------------------------
-- Privileges — browser cannot hard-delete or escalate
-- ---------------------------------------------------------------------------
revoke all on table public.generation_jobs from anon, authenticated;
grant select, insert, update on table public.generation_jobs to authenticated;
grant select, insert, update, delete on table public.generation_jobs to service_role;
grant usage on type public.generation_status to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_jobs_owner_created
  on public.generation_jobs(owner_id, created_at desc);
create index idx_jobs_owner_status
  on public.generation_jobs(owner_id, status);
create index idx_jobs_deleted
  on public.generation_jobs(deleted_at)
  where deleted_at is not null;
