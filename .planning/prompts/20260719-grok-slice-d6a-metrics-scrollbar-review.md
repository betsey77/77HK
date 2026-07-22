# Grok Build read-only review: D6a metrics overview + workbench scrollbar

Repository: `D:\work\77港话通社媒文案\77`

The checkout is intentionally very dirty. Treat every existing change as user-owned. Do not edit any file, do not create a worktree, and do not run reset/clean/checkout, deployment, database migration/dry-run/push, commit, push, installation, or real model/API calls. Do not read or print secrets.

Read only the minimum relevant files:

- `README.md`
- `.planning/status.md`
- `docs/plans/2026-07-19-1.1.4.5-slice-d-development-plan.md`
- `spec/PRD.md`, `spec/SDD.md`, `spec/TEST_PLAN.md` Slice D sections
- `server/src/routes/admin.ts`
- `server/src/services/adminService.ts`
- `server/src/middleware/admin.ts`
- `supabase/migrations/20260719120000_slice_d4_activity_model_telemetry.sql`
- `supabase/migrations/20260719090000_slice_d1_checkin_rewards.sql`
- `supabase/migrations/20260712000000_slice_c2a_trusted_write_quota.sql`
- `client/src/index.css`, `client/src/App.tsx`, `client/src/components/layout/ThreePanel.tsx`

## Objective

Review the smallest safe D6a implementation for `GET /api/admin/metrics/overview?from=&to=` and a separate surgical workbench scrollbar visual fix.

D6a requirements:

- Date-only `from`/`to`, default ending today in Hong Kong, inclusive, maximum 90 days.
- DAU = `to` Hong Kong day, WAU = inclusive rolling 7 days ending `to`, MAU = inclusive rolling 30 days ending `to`.
- Ordinary `admin` must have a non-empty current `profiles.review_group` and see only owners currently in that group. `super_admin` sees global aggregates.
- Membership grants come from `membership_grants`; quota consumption comes from `usage_ledger` terminal `consume`; remaining quota comes from current active `subscriptions` plus `plans`.
- No second ledger, no prompt/response/error/user/email/JWT/key in response.
- D1/D4 migrations remain unapplied; D6a must be locally testable with mocks and must not claim live DB proof.
- Do not reuse the existing global `/api/admin/stats` implementation for ordinary-admin metrics.

Scrollbar requirements:

- The current Windows/Chromium native vertical scrollbar is a bright white strip inside the dark workbench.
- Keep it visible and operable, but use a transparent/dark track, muted rounded thumb, subtle hover, and a coherent light-theme override.
- Prefer a scoped workbench utility/class instead of changing public marketing/auth/admin scrollbars globally unless the current structure proves that global scope is safer.
- No dependency, layout refactor, or hidden scrollbar.

## Requested output

Return a concise implementation review only:

1. recommended D6a response contract and date validation behavior;
2. exact group/global query strategy and fail-closed behavior for missing review group;
3. privacy/performance traps in a no-new-Migration implementation;
4. smallest file/test scope;
5. recommended scoped scrollbar selector/tokens and accessibility considerations;
6. any blocking issue.

Stop after the review. Do not modify files.
