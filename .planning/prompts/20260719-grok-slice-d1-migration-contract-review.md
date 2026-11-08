# Grok Build read-only review: 1.1.4.5 Slice D1 check-in/reward Migration

Repository: `D:\work\77港话通社媒文案\77`

Read only these files/domains:

- `docs/plans/2026-07-19-1.1.4.5-slice-d-development-plan.md`
- `spec/PRD.md` Slice D section
- `spec/SDD.md` Slice D section
- `spec/TEST_PLAN.md` Slice D section
- `supabase/migrations/20260712000000_slice_c2a_trusted_write_quota.sql`
- `supabase/migrations/20260713000000_slice_f1_payment_sandbox.sql`
- `supabase/migrations/20260715113350_pro_250_quota.sql`
- existing migration contract tests under `server/src/__tests__/`

Confirmed product rules:

1. Seven consecutive Hong Kong natural days grants a fixed 30-day Pro reward once per account lifetime.
2. Free/no currently valid Pro applies the reward immediately with a new Pro period and `quota_used=0`.
3. Currently valid Pro creates a pending reward; it can be manually claimed only after there is no valid Pro.
4. Browser roles cannot write check-ins, grants, subscriptions, or call mutation RPCs. BFF/service_role is the only writer.
5. This is a local Migration draft only. No database push, remote call, deployment, dependency install, Git action, or file edit.

Proposed minimum SQL:

- `daily_checkins`: user/date HK uniqueness, streak count/start key, owner SELECT RLS.
- `membership_grants`: source `checkin_7day`, fixed 30 days, pending/applied, unique `(user_id, source)`, owner SELECT RLS.
- service-role-only invoker RPC `apply_daily_checkin(user_id)` using HK server date, per-user transaction advisory lock, idempotent same-day response, streak reset/increment, and day-7 grant.
- service-role-only invoker RPC `claim_checkin_membership_grant(user_id, grant_id)`; active Pro stays pending; otherwise upsert subscription to fixed 30 days and reset `quota_used=0`.
- existing `subscriptions` row exists for every user and is locked before reward application; existing `usage_ledger` is untouched.

Return a compact review only:

1. SQL/RLS/GRANT/security-definer/search_path risks.
2. Concurrency or deadlock risks with existing quota/payment functions.
3. Minimum contract-test assertions that would catch unsafe regressions.
4. Any simplification needed before implementation.

Do not edit files. Do not run tests. Stop after one review.
