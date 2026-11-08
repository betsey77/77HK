# Verification Commands

Generated: 2026-07-14
Project: `D:\work\77港话通社媒文案\77`

## 原则

1. **安装与构建分离**：`build` 脚本内不得执行 `npm ci` / `npm install`。
2. 先装依赖，再 test → typecheck → build → audit。
3. 高风险（db push / 部署 / 支付生产）不在本文件默认命令内。

## 2026-07-19 - 1.1.4.5 Slice D6c

```powershell
cd server
npx vitest run src/__tests__/admin-model-metrics.test.ts src/__tests__/admin-bad-case-detail-route.test.ts
cd ..\client
npx vitest run src/test/admin-metrics-api.test.ts src/test/slice-d6b-admin-metrics-panel.test.tsx src/test/slice-d6c-bad-case-detail.test.tsx
cd ..
npm run test
npm run typecheck
npm run build
npm run audit:prod
npm run audit:all
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/e2e-workbench-shell.ps1 -SelfTest
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/e2e-workbench-shell.ps1 -Twice -EvidenceDir "D:\work\77港话通社媒文案\77\docs\evidence\2026-07-19\slice-d6c-bad-case-detail"
```

- 浏览器证据仍为 localhost fixture；D4 未迁移时真实模型日志不可用，不得把 fixture 结果描述为真实 DB/RLS/审计验收。
- 部署准备按 `docs/release/2026-07-19-github-vercel-update-runbook.md`；Migration、commit/push、Vercel Preview/Production 都需逐项授权。

## 2026-07-19 - 1.1.4.5 Slice D4

```powershell
cd server
npx vitest run src/__tests__/slice-d4-telemetry-migration.test.ts src/__tests__/telemetryService.test.ts
$tests = Get-ChildItem -LiteralPath src/__tests__ -Filter '*migration.test.ts' | ForEach-Object { $_.FullName }
npx vitest run $tests
cd ..
npm run test:server
npm run typecheck:server
npm run build:server
```

- D4 Migration 仅为本地草案；禁止把这些静态/Mock 合同测试替换为未经授权的 `db push`、远端写入或清理任务。

## 2026-07-19 - 1.1.4.5 Slice D3

```powershell
# 聚焦与影响面客户端合同
cd client
npx vitest run src/test/check-in-api.test.ts src/test/slice-d3-check-in.test.tsx
npx vitest run src/test/check-in-api.test.ts src/test/slice-d3-check-in.test.tsx src/test/slice-cloud-sync-focus-refresh.test.tsx src/test/slice-review-notification-polling.test.tsx src/test/slice-a.test.tsx
npx vitest run
npm run build

# 返回仓库根目录；先验证 fail-closed harness，再隔离双跑
cd ..
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/e2e-workbench-shell.ps1 -SelfTest
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/e2e-workbench-shell.ps1 -Twice -EvidenceDir "D:\work\77港话通社媒文案\77\docs\evidence\2026-07-19\slice-d3-checkin-ui"
```

- 浏览器验收只使用 fixture Auth 和 localhost API mock，不证明真实 Supabase/RLS/RPC。
- D1 Migration 未应用；禁止把本地 UI 验证替换为未经授权的远端写入、部署或 Migration 操作。

## 2026-07-19 - 1.1.4.5 Slice D1

```powershell
# 聚焦 Migration 合同
cd server
npx vitest run src/__tests__/slice-d1-checkin-rewards-migration.test.ts

# 所有 Migration 合同
$tests = Get-ChildItem -LiteralPath src/__tests__ -Filter '*migration.test.ts' | ForEach-Object { $_.FullName }
npx vitest run $tests

# 完整 Server 回归、类型检查和构建
cd ..
npm run test:server
npm run typecheck:server
npm run build:server
```

- 本切片禁止把上述静态验证替换为未经授权的 `supabase db push`、`migration repair` 或远端写入。
- `supabase db push --dry-run`、真实 RLS/并发/Advisor 留到单独授权的 D7。

## 推荐顺序（Phase 0 / CI）

```powershell
# 1. Install (once per clean checkout or lockfile change)
npm run install:all
# 等价：npm ci

# 2. Tests
npm run test:client
npm run test:server
# 或：npm test

# 3. Typecheck
npm run typecheck:client
npm run typecheck:server
# 或：npm run typecheck

# 4. Build (no install inside)
npm run build:client
npm run build:server
# 或：npm run build

# 5. Dependency audit
npm run audit:prod
npm run audit:all

# 6. One-shot gate
npm run verify

# 7. Public route smoke — Node 22.x (see .nvmrc / engines)
# Windows non-ASCII project roots can hang Playwright workers — use harness:
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\e2e-public-smoke.ps1 -SelfTest
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\e2e-public-smoke.ps1 -Twice
# Or: npm run test:e2e:smoke:win / test:e2e:smoke:win:twice
# Requires http://localhost:5173 unless -WithWebServer
# Screenshots land in docs/evidence/... via E2E_SCREENSHOT_DIR (repo path)
# Junction rmdir is fail-closed (only verified junctions to this repo)
npx playwright test --list --config=playwright.config.mjs
# Direct monorepo-path execute may hang on Windows non-ASCII roots — do not use for acceptance.

# 8. Local workbench shell smoke (mock Auth ONLY — not real Auth/RLS)
# Requires free port 5184; starts isolated vite.e2e.config.ts
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\e2e-workbench-shell.ps1 -SelfTest
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\e2e-workbench-shell.ps1 -Twice
# Or: npm run test:e2e:workbench:win / test:e2e:workbench:win:twice
# Evidence: docs/evidence/2026-07-15/workbench-shell-local-smoke/
```

## 2026-07-14 local-vercel-readiness extras

```powershell
# Preview configuration contract (local only; does not deploy or change remote env)
node scripts/verify/preview-readiness.mjs

# Real-model strict-mode behavior (does not call an external model)
cd server; npx vitest run src/__tests__/modelPolicy.test.ts src/__tests__/generations.test.ts src/__tests__/me.test.ts
cd ..

# Focused unit tests
cd client; npx vitest run src/test/apiBase.test.ts
cd ..\server; npx vitest run src/__tests__/cors.test.ts src/__tests__/alipayUrls.test.ts

# vercel.json parse
node -e "JSON.parse(require('fs').readFileSync('client/vercel.json','utf8')); JSON.parse(require('fs').readFileSync('server/vercel.json','utf8')); console.log('ok')"
```

## 命令表

| Purpose | Command | Required | Notes |
| --- | --- | --- | --- |
| install dependencies | `npm run install:all` | when needed | 根 workspaces `npm ci`；**不要**在 build 内重复安装 |
| client unit/behavior tests | `npm run test:client` | yes | Vitest；验收基线 353+ |
| server unit/behavior tests | `npm run test:server` | yes | Vitest；验收基线 509+ |
| client typecheck | `npm run typecheck:client` | yes | `tsc --noEmit` |
| server typecheck | `npm run typecheck:server` | yes | `tsc --noEmit` |
| client production build | `npm run build:client` | yes | Vite；不跑 npm ci |
| server production build | `npm run build:server` | yes | `tsc`；不跑 npm ci |
| full production build | `npm run build` | yes | client + server only |
| prod dependency audit | `npm run audit:prod` | yes | `--omit=dev`；无未处置 high/critical |
| full dependency audit | `npm run audit:all` | yes | 含 dev；无未处置 high/critical |
| verify gate | `npm run verify` | recommended | test + typecheck + build + both audits |
| local dev | `npm run dev` | recommended | concurrently client+server |
| Playwright smoke | `npm run test:e2e:smoke` | optional Phase 0 | 需先 `npx playwright install chromium` + 前端已启动 |
| migration list (read-only) | `npx supabase migration list --linked` | when authorized/network | 验证 W2 漂移修复；**禁止**擅自 push/repair |

## 明确禁止

| 命令 / 行为 | 原因 |
| --- | --- |
| `npm audit fix --force` | 可能升 major、破坏锁定树 |
| 在 `build` 内 `npm ci` | Windows EPERM + CI 重复安装 |
| `supabase db push` / `migration repair` 未授权 | 远端写入门禁 |
| 读取/打印 `.env` 真实密钥 | 安全门禁 |

## 验收期望（Phase 0）

- Client tests ≥ 353 passed
- Server tests ≥ 509 passed
- 双端 typecheck + build 通过
- `npm audit` 与 `npm audit --omit=dev` 均为 0 未处置 high/critical

## 2026-07-15 Phase 0 CI 基线

```powershell
# CI / Supabase 配置静态门禁
cd server
npx vitest run src/__tests__/phase0-ci-config.test.ts

# linked project Migration history，只读
cd ..
npx supabase migration list --linked
```

- 当前基线：Client 400/400，Server 571/571，双端 typecheck/build 通过，两次 audit 0 vulnerabilities。
- 当前 Migration：15/15 local/remote version 一致；禁止把只读检查替换为未授权的 `db push` 或 `migration repair`。
