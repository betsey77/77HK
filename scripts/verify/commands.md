# Verification Commands

Generated: 2026-07-14  
Project: `D:\work\77港话通社媒文案\77`

## 原则

1. **安装与构建分离**：`build` 脚本内不得执行 `npm ci` / `npm install`。
2. 先装依赖，再 test → typecheck → build → audit。
3. 高风险（db push / 部署 / 支付生产）不在本文件默认命令内。

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

# 7. Optional public homepage smoke (requires dev:client on :5173)
npm run test:e2e:smoke
```

## 2026-07-14 local-vercel-readiness extras

```powershell
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
