# Grok Build read-only implementation review: 1.1.4.5 Slice D4

Repository: `D:\work\77港话通社媒文案\77`, branch `master`, HEAD `a86a40f`, very dirty worktree. Every existing change belongs to the user.

This is one bounded read-only implementation review. Do not modify, create, rename, or delete files. Do not install, deploy, apply or dry-run migrations, access remote databases, call model providers, use web search, spawn subagents, create a worktree, or run Git write/destructive commands.

Goal for D4 only:

- Draft a local unapplied migration for `app_activity_daily` and `model_call_logs`.
- Add the smallest server-side telemetry writer contract that D5 can call later.
- Add static migration and unit tests proving a strict allowlist and that secrets/content/raw errors cannot be persisted.

Confirmed/provisional product rules:

- Hong Kong activity windows: current day, rolling 7 days including today, rolling 30 days including today.
- Bad case later uses `generation_jobs.scores.generated.total < 50`.
- Model-call log retention is 90 days; activity daily aggregation retention is 15 months. No cleanup job is implemented in D4.
- Model logs contain no user id or review group. They may contain nullable job id and opaque request id.
- D4 does not instrument DeepSeek/Cantonese calls yet; that is D5.

Read only the relevant sections/files:

- `docs/plans/2026-07-19-1.1.4.5-slice-d-development-plan.md`
- `spec/SDD.md`, `spec/TEST_PLAN.md`
- `supabase/migrations/20260711213000_slice_c1_generation_jobs.sql`
- `supabase/migrations/20260712000000_slice_c2a_trusted_write_quota.sql`
- `supabase/migrations/20260719090000_slice_d1_checkin_rewards.sql`
- `server/src/services/trustedSupabase.ts`
- `server/src/services/generationJobsService.ts`
- representative migration contract tests under `server/src/__tests__/`

Review the proposed minimal design and return:

1. exact recommended migration filename, enums/check constraints, tables, indexes, foreign-key deletion behavior, RLS/grants and comments;
2. exact TypeScript public types and function signatures for a new telemetry service;
3. how the runtime allowlist should be implemented so unknown keys, prompt/response body, raw error, email, JWT and API keys are rejected before the Supabase call;
4. how a 250-500 ms best-effort insert timeout can be tested without unhandled rejections or timers;
5. the smallest focused test matrix and likely integration traps with the existing trusted Supabase wrapper;
6. any design defect that should block coding.

Prefer a surgical solution. Do not propose D5 instrumentation, admin APIs/UI, cleanup infrastructure, new dependencies, broad refactors, deployment or migration execution. Stop after the review.
