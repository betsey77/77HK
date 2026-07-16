# Verification — Playwright Runner 稳定化与公开页面冒烟

Date: 2026-07-15
Project: `D:\work\77港话通社媒文案\77`
Executor: Grok Build (resume from Codex session handoff)

## Starting baseline

| Item | Value |
| --- | --- |
| Branch | `master` |
| HEAD | `92358e2` |
| Initial dirty | only untracked handoff/prompt docs from Codex |
| Node | v26.1.0 |
| npm | 11.13.0 |
| @playwright/test | 1.61.1 |

## Problem reproduction

1. `npx playwright test --list --config=playwright.config.ts` returned quickly (OK).
2. `npx playwright test e2e/smoke.spec.ts --config=playwright.config.ts` produced **zero reporter output** and did not exit for >90s (runner hang).
3. Minimal `playwright-core` `chromium.launch()` + `page.goto(http://localhost:5173)` succeeded in ~2s.
4. Homepage product code no longer uses `[data-reveal]`; it uses `.panel-in` / `.is-in`. The old smoke selector would time out once the runner actually executed.

## Root causes

1. **Config loader hang (primary):** With Node 26 + root `"type": "module"`, loading **`playwright.config.ts`** caused `@playwright/test` to hang before any list reporter output. Switching to **`playwright.config.mjs`** restored normal startup.
2. **Stale selector:** Smoke scroll test waited for `[data-reveal]` which marketing page no longer mounts.
3. **Secondary flake:** After class `is-in`, CSS opacity transition could leave one node at opacity 0 for a short time; assertion tightened to wait for opacity > 0.5.
4. **Secondary hang mode:** Concurrent/abandoned Playwright node processes (from interrupted hangs) could leave subsequent runs stuck with no output until those processes were killed. Not a product bug; operational hygiene.

## Changes (in scope)

| File | Change |
| --- | --- |
| `playwright.config.mjs` | **New** primary config: baseURL, Chromium, webServer + `reuseExistingServer`, `E2E_BASE_URL`, optional `E2E_NO_WEBSERVER=1` |
| `playwright.config.ts` | **Removed** (hung under Node 26 ESM) |
| `package.json` | `test:e2e:smoke` → `--config=playwright.config.mjs` |
| `e2e/smoke.spec.ts` | `.panel-in` / `is-in` + opacity settle wait |
| `e2e/public-routes.spec.ts` | **New** `/`, `/pricing`, `/login` desktop+mobile smoke + screenshots |
| `e2e/protected-route.spec.ts` | **New** unauthenticated `/app` → `/login?next=/app` |

## Explicitly deferred

- Workbench **authenticated** shell smoke with isolated mock auth: **deferred**. Existing `e2e/user-authored-review-queue.spec.ts` seeds a historical Supabase project-ref localStorage key and is **not** treated as real Auth/RLS evidence. Adding a new local mock that reuses production project identifiers was refused per handoff.
- Real login, RLS, admin review, quota, subscription, payment E2E.
- Full browser matrix (Chromium only).

## Commands and results

| Command | Exit | Result |
| --- | --- | --- |
| `node .../cli.js test --list --config=playwright.config.mjs` | 0 | 10 tests / 4 files discovered |
| focused: smoke + public-routes + protected-route | 0 | **8 passed (16.5s)** |
| smoke with default webServer (reuse existing 5173) | 0 | **2 passed (6.0s)** |
| `npm run verify` | 0 | client 400/400, server 571/571, typecheck, build, audit 0 vulns |

No remote network requests were made by the focused public/protected tests beyond local Vite (`localhost:5173`). Login page may load public assets; no credentials were submitted.

## Screenshots

Directory: `docs/evidence/2026-07-15/playwright-runner-public-smoke/screenshots/`

- `home-desktop.png`
- `home-mobile-390.png`
- `pricing-desktop.png`
- `pricing-mobile-390.png`
- `login-desktop.png`

## Covered behaviors

- `/` loads and shows product chrome; scroll reveals `.panel-in` → `is-in` with visible opacity.
- `/pricing` loads plan area (Free/Pro/团队); no user-facing `\bMOCK\b` string.
- `/login` shows email/password and sign-in control.
- Unauthenticated `/app` redirects to `/login` with `next` decoding to `/app`.
- Desktop + mobile viewports for key public pages.

## Not covered

- Authenticated workbench shell (deferred).
- Real Supabase Auth / RLS / billing / admin review queue.
- Firefox/WebKit.

## Residual risks

- On Node 26, do **not** reintroduce TypeScript Playwright config without validating `--list` + one test exit.
- Kill abandoned Playwright CLI processes if a run is interrupted, before re-running.
- If webServer ever blocks cold-start port bind, use `E2E_NO_WEBSERVER=1` with a pre-started `npm run dev:client`.

## Forbidden actions (confirmed not done)

- No `git reset/clean/checkout`, no worktree, no commit/push.
- No dependency/browser install.
- No deploy, migration, real DB write, real payment.
- No `.env` secret read/write into evidence.
