# Verification — Playwright runtime repair

Date: 2026-07-15
Project: `D:\work\77港话通社媒文案\77`
HEAD: `92358e297cfba8ce11cba7889e8d98ae25ea2117` (master)
Agent: Grok Build

## Verdict

**PASS (with Windows ASCII cwd requirement)**

Focused public/protected E2E ran **twice** on **Node v22.23.1**, with list reporter output, **8 passed** each time, exit 0, no leftover `@playwright/test` CLI processes from those runs.

## Root cause (proven)

| Observation | Result |
| --- | --- |
| `playwright test --list` on Chinese project path | OK |
| `chromium.launch()` + page.goto (Node 22) | OK |
| `playwright test` execute on `D:\work\77港话通…\77` | **Hang, zero reporter** (Node 26 and Node 22) |
| `playwright test` on ASCII temp/`C:\work\77hk-e2e` with junctions to monorepo `node_modules` | **8/8 pass** |
| Isolated CJS temp without monorepo | OK |
| `E2E_NO_WEBSERVER=1` vs webServer | Hang is **not** solely webServer (Codex + local) |

**Conclusion:** `@playwright/test` worker execution hangs when the **project root path contains non-ASCII characters** on this Windows host. Node 22 is still the CI-aligned runtime; path encoding is the local hang root cause. `.mjs` config remains required for Node 26 config-load hangs.

## Node install (authorized)

| Item | Value |
| --- | --- |
| Method | Official portable zip (side-by-side; did **not** replace system Node 26) |
| Version | **v22.23.1** |
| Path | `C:\Users\35308\AppData\Local\nodejs-versions\node-v22.23.1-win-x64\node.exe` |
| System default | Still `C:\Program Files\nodejs\node.exe` → v26.1.0 |
| winget `OpenJS.NodeJS.22` | Conflicted with installed OpenJS.NodeJS 26; portable used instead |
| npm / browser reinstall | **Not** performed (chromium already in `%LOCALAPPDATA%\ms-playwright`) |

## Commands (passing baseline)

```powershell
# ASCII workspace (created by scripts/e2e-public-smoke.ps1)
# C:\work\77hk-e2e  — junctions to monorepo node_modules/client/server

$env:PATH = "$env:LOCALAPPDATA\nodejs-versions\node-v22.23.1-win-x64;" + $env:PATH
$env:E2E_NO_WEBSERVER = "1"   # Vite already on :5173 (HTTP 200)
cd C:\work\77hk-e2e
node --version   # v22.23.1

node .\node_modules\@playwright\test\cli.js test `
  e2e/smoke.spec.ts e2e/public-routes.spec.ts e2e/protected-route.spec.ts `
  --config=playwright.config.mjs --project=chromium --reporter=list --workers=1
# RUN1: 8 passed (~10.8s) exit 0
# RUN2: 8 passed (~10.8s) exit 0
```

Or:

```powershell
npm run test:e2e:smoke:win:twice
```

## Results

| Run | Node | Cwd | Reporter | Passed | Exit | Elapsed |
| --- | --- | --- | --- | --- | --- | --- |
| RUN1 | v22.23.1 | `C:\work\77hk-e2e` | list | 8/8 | 0 | ~11.4s |
| RUN2 | v22.23.1 | `C:\work\77hk-e2e` | list | 8/8 | 0 | ~11.4s |

Raw logs: `run1-node22.txt`, `run2-node22.txt`, combined notes in `test-output.txt`.
Screenshots (from ASCII cwd run): `screenshots/`.

## PID hygiene

- No `@playwright/test/cli` leftover after RUN1/RUN2.
- Did not kill user Vite (`localhost:5173` stayed up).
- Earlier diagnosis left some access-denied pathless `node.exe` zombies unrelated to final runs (could not kill without elevation).

## Changes in repo

- `.nvmrc` / `.node-version` → 22
- `package.json` `engines.node` → `22.x`
- `scripts/e2e-public-smoke.ps1` + npm scripts `test:e2e:smoke:win` / `:twice`
- `playwright.config.mjs` documents Windows non-ASCII hang
- `.gitignore` includes `test-results/`
- Spec / planning status updated

## Not done

- No commit / push
- No `npm run verify` (optional; E2E baseline was the gate)
- No real Auth / workbench mock / payment
- System default Node remains 26 unless user changes PATH

## Residual risk

- Running `npx playwright test` **from the Chinese path** may still hang on Windows; use the win script or ASCII cwd.
- ASCII mirror must be refreshed when e2e/config changes (script recopies).
- Codex independent recheck should use Node 22 + `npm run test:e2e:smoke:win:twice` (or equivalent).
