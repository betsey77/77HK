# Grok Build 交接：完全本地的已登录工作台壳层 Smoke

日期：2026-07-15
项目：77 港话通社媒文案
仓库：`D:\work\77港话通社媒文案\77`
GitHub：`betsey77/77HK`

## 前置验收

Windows E2E harness hardening 已由 Codex 独立通过：

- `-SelfTest` PASS：普通目录、错误 junction、无标记根目录均 fail-closed。
- `-Twice` PASS：public/protected E2E 8/8 ×2，Node 22.23.1，正常退出。
- 5 张截图已写入仓库 `docs/evidence/2026-07-15/e2e-harness-hardening/screenshots/`。
- `git diff --check` 通过，无残留 Playwright CLI。

当前可信入口：

- `.planning/prompts/20260715-213500-codex-review.md`
- `docs/evidence/2026-07-15/e2e-harness-hardening/verification.md`

## 下一任务

建立真正隔离的已登录工作台壳层浏览器 smoke。任务入口：

`D:\work\77港话通社媒文案\77\.planning\prompts\20260715-214500-grok-local-workbench-shell-smoke.md`

这是测试基础设施任务，不是登录功能开发。它只能证明本地 mock 下真实 React App 的 `/app` 壳层可组合、加载与响应；它不能证明真实 Supabase 登录、JWT、RLS、管理员权限、额度或支付正确。

## 不可违反的安全规则

- 不访问 `.env` 或任何生产 Supabase 标识、token、Cookie、密钥。
- 不使用 `e2e/user-authored-review-queue.spec.ts` 现有的历史 localStorage project-ref 伪会话。
- 不连接任何非 localhost/127.0.0.1 网络；E2E 必须在 browser context 中断言该规则。
- 不改真实 AuthContext、Supabase client、client/server 业务功能、RLS 或 Migration。
- 不安装依赖、Node、浏览器或工具；不部署、不提交、不推送、不创建 worktree。
- 不删除用户 Vite、浏览器或工作目录；新的 ASCII 镜像必须独立并 fail-closed。

## 设计方向

现有 `client/src/test/slice-a.test.tsx` 已展示了如何在 Vitest 中 mock `supabase`。浏览器 E2E 不应通过 localStorage 注入真实格式的 Supabase session；应使用 E2E 专用 Vite 配置，在模块解析层替换真实 AuthContext 与 Supabase service。

必须保证：

1. 正常 Vite/生产 build 不会加载 mock。
2. mock user 是虚构的 `.invalid` 地址，不能被任何服务接受。
3. 所有意外 Supabase/外网调用硬失败。
4. `/api/**` 只以固定最小 DTO 支持壳层初始加载。
5. 独立端口与 ASCII 根目录不会干扰用户现有 Vite `:5173`。

## Grok 完成后回传

提供新生成的 `.planning/prompts/*-codex-review.md` 路径，以及：

- `docs/evidence/2026-07-15/workbench-shell-local-smoke/verification.md`
- `test-output.txt`
- 本切片截图目录
- 最终 `git status --short`

Codex 会独立复跑两次，检查 browser 外网阻断、mock 的生产隔离、证据和进程回收；通过后才进入真实 Auth/RLS 或商业路径的下一规划。
