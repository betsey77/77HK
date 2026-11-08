# Review Notification Visible Polling Slice C verification

Date: 2026-07-18

## Scope

- Refresh administrator pending-review summaries every 15 seconds while the page is visible.
- Refresh an owner-only review-result version every 15 seconds, and run the existing full owner bootstrap only when that version changes.
- Pause timers while hidden, refresh immediately on focus/visibility return, and back off failures at 15/30/60 seconds.
- Preserve existing review-result and administrator-summary deduplication.
- No Realtime, database change, Migration, deployment, commit, push, reset, clean, or worktree creation.

## Security boundary

- `GET /api/sync/review-result-summary` requires authentication.
- The service first selects only favorite IDs matching the authenticated `owner_id`, then obtains the latest review `updated_at` only for those IDs.
- The summary returns no brand, copy, email, review body, or administrator-group count. It does not reuse the broader administrator review-group scope.

## Automated verification

- Fake-clock client tests cover visible 15-second polling, hidden pause, immediate focus/visibility refresh, 15/30/60-second failure backoff, success reset, and unmount cleanup.
- User notification regression proves a later cloud refresh is rescanned and notified; API tests prove the request is pinned to the expected owner session.
- Server tests cover anonymous 401, latest timestamp, explicit owner filtering, favorite-ID constrained review lookup, and the no-favorites fast path.
- Final full verification: Client 422/422 in 44 files; Server 609/609 in 40 files; both typechecks and production builds passed; both dependency audits found 0 vulnerabilities.
- Isolated Playwright: 8/8 twice, with 15 desktop/mobile screenshots and localhost-only network enforcement. The user review case advances a fake clock by 15 seconds and observes the later review without a page reload.

## Runtime checks

- `http://localhost:5173/app`: HTTP 200.
- `http://localhost:3001/api/health`: HTTP 200.
- Anonymous `GET /api/sync/review-result-summary`: HTTP 401.

## Evidence

- Full verification output: `../slice-05/test-output.txt`
- Playwright output: `test-output.txt`
- User adopted desktop: `screenshots/review-result-adopted-desktop-1440-local-mock.png`
- User changes-requested mobile: `screenshots/review-result-changes-mobile-390-local-mock.png`
- Administrator reminder desktop: `screenshots/admin-pending-reminder-desktop-1440-local-mock.png`
- Administrator queue mobile: `screenshots/admin-pending-queue-mobile-390-local-mock.png`

## Result and residual risk

- Done locally: the Slice C 0-15 second visible-page contract is implemented and strictly automated.
- Browser evidence uses isolated Auth/Supabase fixtures; it does not replace a live two-session staging timing check. No schema change is needed for this slice.
