# Grok Build read-only review: 1.1.4.5 Slice D check-in and reward

Repository: `D:\work\77港话通社媒文案\77`, branch `master`, HEAD `a86a40f`, very dirty worktree. Every existing change belongs to the user.

This is architecture/spec review only. Do not modify, create, or delete files. Do not run tests, install, deploy, migrate, connect to Supabase, use web search, spawn subagents, create a worktree, or run Git write/destructive commands.

Read only:

- `spec/PRD.md` lines around the 2026-07-18 Slice D check-in requirements
- `spec/SDD.md` Slice D section
- `spec/TEST_PLAN.md` Slice D section
- `supabase/migrations/20260712000000_slice_c2a_trusted_write_quota.sql`
- `supabase/migrations/20260713000000_slice_f1_payment_sandbox.sql` lines 275-360
- `server/src/services/quotaService.ts`
- `server/src/routes/billing.ts`

Review goal: design a minimal, transaction-safe 7-day Hong Kong-date check-in reward that cannot duplicate grants or let the browser mutate subscriptions. Pay special attention to the existing coupling between `subscriptions.current_period_*`, `quota_used`, and the Pro plan quota. Explain why simply extending an existing Pro subscription can delay quota renewal.

Compare these policies for a user who already has active Pro on day 7:

1. extend current Pro immediately;
2. create a pending reward that can be claimed only after active Pro ends;
3. another simpler safe policy if clearly better.

Return only a concise review with:

1. recommended product policy and tradeoff;
2. exact tables/constraints/statuses;
3. RPC transaction steps and lock order;
4. RLS/grant boundaries;
5. idempotency/concurrency invariants;
6. API/UI contract;
7. test matrix;
8. migration risks and rollback/forward-fix notes;
9. unresolved decisions that must block coding.

Stop after the review. Do not change the repository.
