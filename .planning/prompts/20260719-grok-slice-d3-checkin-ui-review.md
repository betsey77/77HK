# Grok Build read-only review: Slice D3 check-in UI

Repository: `D:\work\77港话通社媒文案\77`; HEAD `a86a40f`; heavily dirty worktree. Do not edit files.

Read only:

- D3 sections in `spec/PRD.md`, `spec/SDD.md`, `spec/TEST_PLAN.md`
- `docs/plans/2026-07-19-1.1.4.5-slice-d-development-plan.md`
- `client/src/App.tsx`
- `client/src/services/api.ts`, `client/src/services/apiBase.ts`
- `client/src/context/AuthContext.tsx`
- `client/src/components/auth/AuthNoticeDialog.tsx`
- relevant `client/src/test/*.test.tsx`
- `e2e/workbench-shell-local.spec.ts`, `client/vite.e2e.config.ts`

D3 objective:

- Add a signed-in workbench check-in dialog after cloud hydration.
- On first workbench entry of each Asia/Hong_Kong date, fetch `GET /api/me/check-in` and show current server status.
- Closing stores only an account-scoped local dismissal for that Hong Kong date; next Hong Kong date shows again. Local storage never changes streak/reward/claim state.
- Show 7-day progress, today's status, lifetime reward state, subscription expiry guidance, retryable loading/error states, idempotent check-in, and pending reward claim.
- `POST /api/me/check-in` and `POST /api/me/membership-grants/:id/claim` must replace UI state only from server responses.
- Reuse existing Tailwind/lucide/dialog style; no new dependency or broad redesign. Accessible dialog, Escape/close, 44px targets, desktop and 390px without overflow.
- Because D1 Migration is unapplied, browser E2E must use the existing isolated localhost-only API mock, not the live database.

Proposed scope:

- new `client/src/services/checkInApi.ts`
- new `client/src/components/checkin/CheckInDialog.tsx`
- new focused tests for API validation, Hong Kong dismissal key, loading/error, check-in, pending/claim/applied states
- minimal mount in `client/src/App.tsx`
- extend only the check-in mock/scenario and D3 tests in `e2e/workbench-shell-local.spec.ts`

Non-goals: no Server/Migration changes, no staging/remote calls, no dependencies, no deploy, no Git action, no worktree, no broad component refactor.

Return a concise minimum component/state/API/test plan and concrete correctness risks. Prioritize dismissal semantics, server-authoritative state, auth, retry/race behavior, accessibility, mobile overflow, and E2E isolation. Stop after one answer. Do not run tests, edit files, access network, use memory, or spawn subagents.
