# Playwright 最小 Smoke Harness（Phase 0）

## 目标

- 建立浏览器自动化工程骨架，消除「仓库无 Playwright」阻断（计划 B3 的前置）。
- **本轮不扩展** Auth / 工作台生成 / 额度 / 支付 / 管理员完整 E2E（留给 Phase 2）。

## 已添加

| 路径 | 作用 |
| --- | --- |
| `@playwright/test`（根 devDependency） | 测试运行器 |
| `playwright.config.ts` | Chromium 单项目；`baseURL` 默认 `http://localhost:5173` |
| `e2e/smoke.spec.ts` | 首页 HTTP &lt; 500 + `body` 可见且非空；**不可达时真实失败** |
| `npm run test:e2e:smoke` | 入口脚本 |

## 门禁语义（Codex review fix）

- **不**使用「前端不可达则 skip」分支：`page.goto()` 在连接拒绝时会先抛错，伪 skip 既达不到、也会把门禁伪装成绿色。
- 前端未启动 / baseURL 不可达 / HTTP ≥ 500 → smoke **FAIL**（正确门禁行为）。
- 仅验证 harness 能否发现测试（不装浏览器、不启动前端）：

```powershell
npx playwright test --list --config=playwright.config.ts
```

## 本地运行

```powershell
# 1) 依赖（已在 Phase 0 lockfile）
npm run install:all

# 2) 首次安装浏览器二进制（体积较大，按需执行；CI 可缓存）
npx playwright install chromium

# 3) 启动前端（另一终端）— 必选；否则 smoke 应失败
npm run dev:client

# 4) smoke
npm run test:e2e:smoke
```

环境变量：

- `E2E_BASE_URL` — 覆盖默认 baseURL（`playwright.config.ts` 默认 `http://localhost:5173`）

## Phase 2 扩展清单（勿在 Phase 0 实现）

见 `docs/release/2026-07-14-production-launch-plan-v2.md` §Phase 2：

- 公开页与 next 回跳  
- Auth 全路径  
- 工作台五平台与收藏/历史  
- Free/Pro 容量  
- RLS 双用户  
- 管理员权限矩阵  
- 支付回跳与幂等（沙箱）

## 成本

- 依赖：dev only，不影响 production audit。  
- 浏览器下载：本机/CI 磁盘与时间成本；不购买付费服务。  
- Free 层：无额外 SaaS 费用。
