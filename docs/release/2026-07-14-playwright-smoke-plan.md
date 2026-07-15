# Playwright Smoke Plan（Phase 0 索引）

权威内容见：

- `docs/evidence/2026-07-14/phase0-production-baseline/playwright-smoke-plan.md`
- 配置：`playwright.config.ts`
- Smoke：`e2e/smoke.spec.ts`
- 命令：`npm run test:e2e:smoke`

## 行为约定（Phase 0）

- 仅公开首页最小断言：`/` 返回 HTTP &lt; 500，`body` 可见且非空。
- **不**在前端不可达时 `test.skip`。`page.goto()` 连接拒绝或 5xx 时 smoke **真实失败**，作为门禁信号。
- 跑 smoke 前需先启动前端：`npm run dev:client`（或 `E2E_BASE_URL` 指向可达实例）。
- 仅校验 harness 可发现测试时：`npx playwright test --list --config=playwright.config.ts`（无需安装浏览器）。

完整业务 E2E 范围见 `docs/release/2026-07-14-production-launch-plan-v2.md` §Phase 2。本轮仅公开页 smoke 骨架。
