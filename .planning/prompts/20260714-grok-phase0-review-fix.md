# Phase 0 Codex review fix — minimal scope

在 `D:\work\77港话通社媒文案\77` 只修复以下两个已确认问题，不扩大范围：

1. `e2e/smoke.spec.ts` 当前声称前端不可达会自动 skip，但 `page.goto()` 在连接拒绝时会先抛错。Smoke 门禁应真实失败而不是伪装跳过：删除该误导性 skip 分支，保留最小公开首页断言，并同步更新 `docs/release/2026-07-14-playwright-smoke-plan.md` 与 Phase 0 evidence 中的说明。不要安装 Playwright 浏览器；只运行 `npx playwright test --list --config=playwright.config.ts` 验证 harness 可发现测试。
2. `docs/release/2026-07-14-phase0-worktree-commit-plan.md` 的 Group B 仍引用旧文件名 `20260714000000/000001`，改成工作区当前真实文件名 `20260714052140_w2_case_library.sql` 与 `20260714052414_harden_w2_case_library_function.sql`，不要改变 SQL。

约束：
- 不改任何产品业务代码、支付代码、Supabase SQL 语义、package 依赖或 lockfile。
- 不执行安装、部署、git commit/push、Supabase remote 写入。
- 不读取或输出真实密钥。
- 完成后列出实际改动文件与 `playwright --list` 结果，然后停止。
