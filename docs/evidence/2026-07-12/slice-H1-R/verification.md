# Slice H1-R Verification — 2026-07-12

## Summary

Slice H1-R: Feedback security fixes + Workbench session restore + History load. All local verification passes.

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| Server (all) | 282/282 | ✅ PASS |
| Client (all) | 170/170 | ✅ PASS |
| Server TS --noEmit | 0 errors | ✅ PASS |
| Client TS --noEmit | 0 errors | ✅ PASS |
| SendKey secret scan | 0 real keys | ✅ PASS |

## A. H1 Service-side & Migration Fixes

### A1: Migration filename
- `20260712143000_slice_h1_user_feedback.sql` — valid 14-digit version
- All references in `.planning/`, `spec/`, `docs/evidence/` updated
- Zero `XXXXXX` references remaining (except in this task's prompt source)

### A2: SendKey parser
- Case-insensitive: `SendKey=`, `SERVERCHAN_SENDKEY=`, `sendkey=`
- Raw key support (no assignment prefix)
- Paired quote stripping (`"value"`, `'value'`)
- Multi-line → fail closed
- Unknown assignment name → fail closed
- 10 new tests covering all parser scenarios (28 total notifier tests)

### A3: Trusted client for notify updates
- `feedbackService.createFeedback` accepts injectable `trustedClientFactory`
- Insert/read uses user client + RLS
- Notify status update uses `getTrustedSupabase` / service_role
- Checks `{ error }` from update; on failure keeps `notify_status='pending'`
- Feedback body always returns 201 regardless of notify outcome
- Route passes `getTrustedSupabase` as factory (returns undefined on config error)
- 5 new tests: error keeps pending, throw keeps pending, success updates, no-trusted keeps pending

### A4: 20/hour rate limit
- Migration: `private.check_feedback_rate_limit()` trigger with `pg_advisory_xact_lock`
- Before-insert trigger guards against direct Data API bypass
- BFF maps `RATE_LIMIT` DB error → HTTP 429
- 13 migration static tests verify trigger, grants, RLS, constraints

### A5: Migration permission hardening
- `authenticated`: only `SELECT, INSERT` (no update, delete)
- `service_role`: full CRUD
- Admin select uses hardened `private.has_any_role(['admin', 'super_admin'])`
- Removed redundant `idx_user_feedback_type` and duplicate `(owner_id, created_at)` index
- Rate-limit trigger is `SECURITY DEFINER` with explicit `set search_path = ''`

### A6: FeedbackCenter accessibility
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="feedback-dialog-title"`
- Close button receives initial focus on open
- Escape key closes dialog
- Tab focus trap (cycle between first and last focusable)
- Focus restores to trigger element on close
- Type selector: `role="radiogroup"` + `role="radio"` with `aria-checked`
- Submit result: `role="status"` (success) / `role="alert"` (error)
- Backdrop: `aria-hidden="true"`
- 5 new accessibility tests verify all behaviors

### A7: Error user semantics
- 429 → "反馈次数已达上限，请稍后再试"
- 5xx → "服务暂时不可用，请稍后再试"
- Network error → "网络连接失败，请检查网络后重试"
- Other errors → mapped to Chinese user-friendly messages

## B. Workbench Session Restore

### B1: sessionStorage snapshot helper
- `client/src/services/workbenchSnapshot.ts` — centralized helper
- Key: `hk-cantonese-workbench:{ownerId}` — account-isolated
- Only stores: source, settings, diagnosis, variants, audit, enhancement, generationEngine, scores, consumerFeedback, variantMeta, modifiedVariants, activeTab, uiState
- Never stores: tokens, email, bookmarks, savedConfigs, secrets

### B2: AppProvider restore
- `createInitialState` checks sessionStorage on mount
- Only restores when `snapshot.uiState === 'success'`
- Schema-validated: corrupt JSON → graceful fallback to clean state

### B3: Auto-save
- `useEffect` in AppProvider saves to sessionStorage on every state change
- `RESET` action clears sessionStorage snapshot
- `RESTORE_SNAPSHOT` action for programmatic restore (used by history load)

### B4: Account isolation
- Key contains `ownerId` — User A never reads User B's snapshot
- Test setup clears sessionStorage before each test

## C. History Load to Workbench

### C1: "载入工作台" button
- HistoryDetailPage shows button only for completed jobs with diagnosis+variants+audit
- Failed/pending/processing jobs show non-loadable reason
- Missing core results show specific reason (e.g., "缺少诊断结果，无法载入")

### C2: Snapshot conversion
- `buildWorkbenchSnapshotFromHistory` builds `WorkbenchSnapshot` from actual job fields
- Preserves historical platform, tone, input language, generation controls, brand fields and result payloads instead of applying hard-coded defaults
- Writes to owner-scoped sessionStorage
- Navigates to `/app` where AppProvider restores the snapshot

### C3: Non-null safety
- Uses `?? null` for potentially undefined job fields
- `isJobLoadable` validates required fields before showing button
- No non-null assertions

### C4: Navigation safety
- Navigation from `/app` → `/app/history` → back to `/app` preserves results
- `createInitialState` restores from sessionStorage on each /app mount
- Test setup clears sessionStorage between tests to prevent cross-test leakage

## Migration Status

- File: `supabase/migrations/20260712072936_slice_h1_user_feedback.sql`
- Status: **APPLIED TO REMOTE via authenticated Supabase MCP**
- Remote migration: `20260712072936 slice_h1_user_feedback`
- Dry-run: attempted once with `npx supabase db push --dry-run`; no migration was applied, but remote Postgres TLS negotiation returned EOF, so SQL preflight remains inconclusive

## Commands Verified

```bash
# Server
cd server && npx tsc --noEmit  # 0 errors
cd server && npx vitest run    # 282/282 pass

# Client
cd client && npx tsc --noEmit  # 0 errors
cd client && npx vitest run    # 170/170 pass
```

## Independent Review Addendum

- Corrected stale admin policy reference from dropped `public.has_any_role` to `private.has_any_role`; static regression test rejects the public helper.
- Added real history-to-workbench mapping tests, corrupt snapshot rejection and owner-isolation coverage.
- Added shared brand asset `client/public/brand/77-logo.png`; workbench Header and marketing Header render the same asset.
- Client production build passed (1693 modules). Existing bundle-size warning remains non-blocking.
- Server production build passed. Repository and client bundle secret scans found zero real key hits.
- Local app (`:5173`) and API (`:3001`) returned HTTP 200 during verification.

## Authorized Migration Push Attempt — 2026-07-12

- User explicitly authorized pushing H1 Migration.
- Original local migration confirmed before MCP application: `20260712143000_slice_h1_user_feedback.sql`.
- SHA-256: `A62919EC50E885C91CBCFED35146D3A4DB16C2BB2D0C9B1BFC4F5FEFFE3D4CDC`.
- `npx supabase migration list` failed before reading remote versions with `LegacyDbConnectError`.
- `npx supabase db push` failed while connecting to `db.qiotocumkbwckiezuptr.supabase.co` with TLS EOF.
- The CLI never reached migration confirmation/application output; no remote change is evidenced.
- Stopped after two consecutive connection failures. No secret, connection string, token or feedback body was logged.

## Supabase MCP Migration Application — 2026-07-12

- User explicitly authorized switching to authenticated Supabase MCP.
- `apply_migration` returned `success: true` for project `qiotocumkbwckiezuptr`.
- Supabase registered migration `20260712072936 slice_h1_user_feedback`; the local migration filename was aligned to that remote version to prevent future CLI drift.
- Remote metadata verification:
  - `public.user_feedback` exists and RLS is enabled.
  - Policies: owner select, owner insert, admin/super_admin select through `private.has_any_role`.
  - Triggers: updated-at and owner-scoped 20/hour rate limiter.
  - `authenticated`: SELECT + INSERT only.
  - `service_role`: SELECT + INSERT + UPDATE + DELETE.
  - Rate-limit helper is SECURITY DEFINER with empty search_path.
  - Table contained zero rows at verification time; no feedback body was read.
- Security advisor reported no new H1-specific security warning. Existing project warnings remain for the intentional soft-delete RPC and disabled leaked-password protection.
- Performance advisor reported a non-blocking warning for two permissive authenticated SELECT policies on `user_feedback`; consolidating them requires a separate follow-up migration.
- No real ServerChan message was sent.
- Post-alignment local regression: migration static checks 13/13 passed; server TypeScript check and production build passed.
