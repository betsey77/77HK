# 1.1.4.5 Slice D4 telemetry contracts verification

Date: 2026-07-19  
Scope: local-only activity/model telemetry schema and writer contracts  
Evidence level: strict (privacy, trusted database writes and future model telemetry)

## Result

Slice D4 is complete locally. It adds an unapplied Migration draft for daily activity and model-attempt metrics plus the minimum server writer contract needed by D5.

- `app_activity_daily` has one row per user/Hong Kong day. `record_app_activity(uuid)` derives the date inside PostgreSQL and is executable only by `service_role`.
- `model_call_logs` stores only opaque IDs, operation/provider/model, status/error class, latency/attempt and nullable official Token usage.
- Authenticated/anonymous roles receive no table or RPC privilege.
- Runtime validation rejects unknown keys before opening the trusted Supabase client. Prompt, response, raw error, email, JWT, API key and secret-shaped keys cannot enter the insert payload.
- `usage_source=unavailable` keeps all Token fields null. Provider usage requires at least one Token field in both TypeScript and SQL.
- Model-log database errors, synchronous adapter failures and the 400ms timeout return `false`; invalid programmer input throws explicitly.

## TDD evidence

The first focused run failed because the new Migration and service did not exist. After the minimum implementation:

```text
npx vitest run src/__tests__/slice-d4-telemetry-migration.test.ts src/__tests__/telemetryService.test.ts
Test Files  2 passed (2)
Tests       18 passed (18)
```

All local Migration contracts:

```text
Test Files  10 passed (10)
Tests       61 passed (61)
```

Full Server regression:

```text
Test Files  45 passed (45)
Tests       658 passed (658)
```

`npm run typecheck:server` and `npm run build:server` both exited 0.

## Grok Build review

- First call stopped because the local OIDC token had expired; no files changed.
- After the user reauthenticated, a four-turn review hit its configured turn cap without a final answer; no files changed.
- A shorter bounded final review completed successfully and reported no blocking correctness/security defects.
- Its suggestion to align SQL with the runtime rule that provider usage cannot have every Token field null was applied and reverified.
- The optional unique telemetry-attempt key was deferred to D5, where request/fallback attempt numbering will be defined.

## Boundaries

- `20260719090000_slice_d1_checkin_rewards.sql` and `20260719120000_slice_d4_activity_model_telemetry.sql` remain unapplied.
- No Supabase dry-run/push, database or staging write, cleanup job, real provider call, D5 instrumentation, deployment, installation, commit, push, reset, clean or worktree action occurred.
- Static/Mock contracts do not prove live PostgreSQL RLS/RPC behavior; that remains the separately authorized D7 slice.
