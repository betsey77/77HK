# 1.1.4.5 Slice A verification

Date: 2026-07-18  
Scope: signup confirmation, workbench viewport boundary, single-persona append, footer branding/version

## Implemented

- Successful signup opens a confirmation dialog instructing the user to open the Supabase email link, sign in, and check spam if needed.
- The authenticated workbench shell is locked to `100dvh` with overflow contained inside the application panels.
- AI persona parsing returns and appends exactly one persona without replacing existing personas.
- Footer displays `Powered by CANTONESE API` and `v1.1.4.5`.

## Local verification

- Focused client tests: 28/28 passed.
- Focused server tests: 6/6 passed.
- `npm run verify`: exit 0.
  - Client: 410/410.
  - Server: 594/594.
  - Client/server typecheck and production builds passed.
  - Production and full dependency audits: 0 vulnerabilities.
- Workbench harness self-test passed.
- Local isolated Playwright: two consecutive runs, each 7/7 passed; 13 screenshots saved.
- Desktop E2E asserts `body` and document root heights do not exceed the viewport.
- `git diff --check`: passed with existing line-ending conversion warnings only.

## Preview deployment

- API deployment `dpl_5yKcJFYvATAmxejR6X3gjMHLZ8ki`: Ready.
- API stable alias points to the new deployment.
- API `/api/health`: HTTP 200; real model and YouTube key reported configured.
- Web local Vercel build completed successfully.
- Web deployment did not complete: three attempts produced `UNKNOWN` deployments and the CLI stalled until timeout.
- The Web stable alias was deliberately not reassigned. It remains on Ready deployment `dpl_8Yn3LPjBBqtzkMFCciZ66XtF7tCd` from 2026-07-16.

## Boundary

- No database migration, remote data mutation, payment action, Git commit, or Git push.
- Do not treat the current stable Web URL as containing this Slice A UI until a new Ready deployment is assigned.
