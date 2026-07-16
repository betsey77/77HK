# Verification: local workbench shell smoke (mock auth)

Date: 2026-07-15
Project: 77 港话通社媒文案
Slice: fully local authenticated **shell** smoke — **not** real Auth / JWT / RLS / quota / payment.

## Status: PASS (local)

| Check | Result |
| --- | --- |
| Node | v22.23.1 (`%LOCALAPPDATA%\nodejs-versions\node-v22.23.1-win-x64\node.exe`) |
| SelfTest | PASS (fixtures local-only; fail-closed ASCII root; network guard present) |
| RUN1 | **2 passed** (~4.5s), exit 0 |
| RUN2 | **2 passed** (~3.6s), exit 0 |
| Non-localhost requests | asserted empty each test |
| Screenshots in repo | desktop 1440 + mobile 390 |
| Residual vite.e2e / playwright CLI | none after script finally block |
| `git diff --check` | exit 0 (no trailing whitespace failures) |

## What this proves

- Real React `App` `/app` route composes under **E2E-only** Auth + Supabase fixtures.
- Shell finishes cloud-sync hydration with **Playwright-mocked** `/api/**` (localhost only).
- Header / left input / center empty result / right audit / footer visible.
- Desktop 1440×900 and mobile 390×844: no horizontal overflow; primary chrome visible.
- Production `client/vite.config.ts` and real `AuthContext` / `supabase` modules are **not** modified.

## What this does **not** prove

- Real Supabase login, JWT validity, RLS, admin roles, entitlements semantics, generation, favorites review, or payment.

## Isolation design

| Layer | Mechanism |
| --- | --- |
| Auth / Supabase | `client/vite.e2e.config.ts` resolve plugin + alias → `client/src/e2e/*.fixture.*` |
| Production Vite | Unchanged; does not load fixtures |
| Network | Playwright `page.route`: non-localhost `abort` + record; fail if any |
| `/api/**` | Fixed minimal DTO only (bootstrap, entitlements, inspiration, case-library, …) |
| Identity | `e2e-local-user` / `e2e@example.invalid` — not a real server credential |
| Port | E2E Vite `127.0.0.1:5184` strictPort (does not touch user `:5173`) |
| Playwright cwd | ASCII `C:\work\77hk-workbench-e2e` (fail-closed junctions) |
| Vite cwd | **Real** repo `client/` path — required on Windows so non-ASCII monorepo paths resolve |

## Root cause of earlier blank page

Launching Vite with working directory = ASCII junction whose target contains Chinese path segments corrupted Vite’s resolved module ids (`main.tsx` 404). Fix: start Vite from the real `client` directory; keep Playwright on ASCII cwd.

## Commands

```powershell
cd D:\work\77港话通社媒文案\77
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\e2e-workbench-shell.ps1 -SelfTest
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\e2e-workbench-shell.ps1 -Twice
git diff --check
```

## Artifacts

- `test-output.txt` (RUN1 + RUN2 raw)
- `screenshots/workbench-shell-desktop-1440-local-mock.png`
- `screenshots/workbench-shell-mobile-390-local-mock.png`

## Files touched (this slice)

- `client/vite.e2e.config.ts` (new)
- `client/src/e2e/authContext.fixture.tsx` (new)
- `client/src/e2e/supabase.fixture.ts` (new)
- `e2e/workbench-shell-local.spec.ts` (new)
- `playwright.workbench-local.config.mjs` (new)
- `scripts/e2e-workbench-shell.ps1` (new)
- `package.json` scripts only
- docs / `.planning` / `spec/*` evidence sync

**No** production AuthContext / supabase client / server / migration / `.env` changes.
**No** commit / push / install / deploy.
