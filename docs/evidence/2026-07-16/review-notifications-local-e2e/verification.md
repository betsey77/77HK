# Review Notifications Local E2E Verification

Date: 2026-07-16

## Result

PASS for the fully local, isolated browser slice. This evidence covers UI behavior only; it does not prove real Supabase Auth, JWT, RLS, review-group isolation, Realtime, or deployment.

## Isolation

- Vite ran on `127.0.0.1:5184` with the existing E2E-only Auth and Supabase fixtures.
- Playwright ran from the Node 22 ASCII workspace `C:\work\77hk-workbench-e2e`.
- The spec blocked every non-localhost request and asserted that no blocked request occurred.
- No real project ref, hosted Supabase URL, JWT, service key, `.env`, payment, migration, or database write was used.
- The historical `e2e/user-authored-review-queue.spec.ts` fake session was not imported or reused.

## Commands And Results

```powershell
# Focused behavior tests
cd client
npx vitest run src/test/slice-user-review-result-notification.test.tsx src/test/slice-user-authored-review-queue.test.tsx
# 2 files passed; 13 tests passed

# Harness safety checks
cd ..
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\e2e-workbench-shell.ps1 -SelfTest
# PASS

# Browser slice, twice
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\e2e-workbench-shell.ps1 -Twice -EvidenceDir '.\docs\evidence\2026-07-16\review-notifications-local-e2e'
# RUN1: 6 passed
# RUN2: 6 passed
# 11 screenshots; no residual Vite or Playwright CLI process

# Full client regression
npm run test:client
# 38 files passed; 402 tests passed

npm run typecheck:client
# PASS

npm run build:client
# PASS; main entry 471.57 kB (134.77 kB gzip)
```

Raw browser output: `test-output.txt`.

## Covered Behavior

- Adopted and changes-requested user wording.
- "稍后查看" dismissal and persistence across reload.
- A newer revision/review timestamp produces a new notification.
- "立即查看" opens the favorites panel and focuses/highlights the target card.
- Admin pending reminder count, "稍后审核", and "立刻审核".
- Immediate admin navigation activates the pending filter and shows the highlighted pending row.
- Desktop 1440px and mobile 390px screenshots with document-level horizontal-overflow assertions.

## Screenshots

- `screenshots/review-result-adopted-desktop-1440-local-mock.png`
- `screenshots/review-result-changes-mobile-390-local-mock.png`
- `screenshots/review-result-immediate-favorite-desktop-1440-local-mock.png`
- `screenshots/admin-pending-reminder-desktop-1440-local-mock.png`
- `screenshots/admin-pending-queue-mobile-390-local-mock.png`

## Residual Risk

The production-shaped Auth email flow, real owner/review-group RLS, and full workflow against an isolated staging Supabase project remain separate staging acceptance tasks.
