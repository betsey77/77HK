# Verification — E2E harness hardening

Date: 2026-07-15
Project: `D:\work\77港话通社媒文案\77`
HEAD baseline: `92358e297cfba8ce11cba7889e8d98ae25ea2117` (master, dirty worktree preserved)

## Verdict

**PASS**

Windows ASCII-cwd Playwright harness is fail-closed for junctions, writes screenshots into the **repo** evidence tree, and completed focused public/protected E2E **8/8 ×2** on Node **v22.23.1**.

## What changed

| Area | Behavior |
| --- | --- |
| Junction remove | Only if path is Directory Junction **and** target equals this repo's `node_modules` / `client` / `server` |
| Plain dir / wrong target | **REFUSE** (no `rmdir`, no recursive delete) |
| ASCII root | Marker `.77hk-e2e-harness-marker`; reclaim unmarked root only when ≥1 proven correct junction |
| Screenshots | `E2E_SCREENSHOT_DIR` → `docs/evidence/2026-07-15/e2e-harness-hardening/screenshots/` |
| Node | Must be 22.x; portable default under `%LOCALAPPDATA%\nodejs-versions\node-v22.23.1-win-x64` |
| Frontend | Default: require `http://localhost:5173`; does not kill user Vite |
| Browsers | `-InstallBrowsers` **removed** |

## Commands

```powershell
cd D:\work\77港话通社媒文案\77
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\e2e-public-smoke.ps1 -SelfTest
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\e2e-public-smoke.ps1 -Twice
git diff --check
git status --short
```

## Results

### SelfTest (fail-closed, non-destructive)

- Refuse plain directory (not junction) — OK, path retained
- Refuse mismatched junction target — OK, link retained, target intact
- Remove matching junction — OK, target directory retained
- Refuse unmarked ASCII root without proven junctions — OK

### Focused E2E ×2

| Run | Node | Exit | Result | Elapsed |
| --- | --- | --- | --- | --- |
| RUN1 | v22.23.1 | 0 | **8 passed** | ~11.4s |
| RUN2 | v22.23.1 | 0 | **8 passed** | ~11.3s |

Node path: `C:\Users\35308\AppData\Local\nodejs-versions\node-v22.23.1-win-x64\node.exe`
ASCII cwd: `C:\work\77hk-e2e`
No leftover `@playwright/test/cli` PIDs after runs.

### Screenshots in repo

`docs/evidence/2026-07-15/e2e-harness-hardening/screenshots/`

- home-desktop.png
- home-mobile-390.png
- pricing-desktop.png
- pricing-mobile-390.png
- login-desktop.png

### Logs

`docs/evidence/2026-07-15/e2e-harness-hardening/test-output.txt`

## Explicitly not done

- No npm/Node/browser install
- No commit/push/deploy/migration
- No real Auth/RLS/payment
- No `client/` / `server/` business changes
- No `npm run verify` full gate
