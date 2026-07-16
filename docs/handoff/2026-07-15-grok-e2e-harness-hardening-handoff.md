# Grok Build 交接：Windows E2E Harness 安全收口

日期：2026-07-15
项目：77 港话通社媒文案
仓库：`D:\work\77港话通社媒文案\77`
GitHub：`betsey77/77HK`

## 当前验收结论

Playwright 运行时修复已通过 Codex 独立复验：现有 Node `v22.23.1` 下，通过 `scripts/e2e-public-smoke.ps1 -Twice` 在 `C:\work\77hk-e2e` ASCII 镜像目录执行，两次均为 8/8 通过、约 11.1 秒、正常退出，无残留 Playwright CLI。

上一轮的证据和交接仍可查阅，但当前可信基线是：

- `.planning/prompts/20260715-204700-codex-review.md`
- `docs/evidence/2026-07-15/playwright-runtime-repair/verification.md`

## 为什么还要做一个 E2E 工具切片

当前脚本可用，但尚未足够安全和可追溯：

1. 它会对镜像目录中已有的 `client`、`server`、`node_modules` 调用 `rmdir`，没有先验证对象是指向当前仓库的 junction。
2. 公开页测试的截图使用相对路径，在 ASCII 镜像中运行时会生成在 `C:\work\77hk-e2e\docs\...`，而非仓库的本切片 evidence 目录。当前仓库截图是人工/此前产物，不能保证与每次脚本运行一致。

下一小切片只收口这两个问题。它不开发业务界面，不碰真实认证。

## 任务入口

`D:\work\77港话通社媒文案\77\.planning\prompts\20260715-211500-grok-e2e-harness-hardening.md`

## 既有环境事实

- Windows 系统默认 Node 可仍为 v26；测试脚本自动优先使用便携 Node 22.23.1。
- 中文项目根目录直接执行 Playwright worker 会无输出挂起；ASCII `C:\work\77hk-e2e` 是为本测试准备的镜像目录。
- 当前镜像的 `node_modules`、`client`、`server` 已确认是指向当前仓库对应目录的 Junction；不能把这个事实泛化到其他路径。
- `localhost:5173` 当前可访问。默认脚本依赖本地 Vite 已启动，不得停止用户的 Vite。
- `git diff --check` 已通过；工作区仍是未提交状态，必须保留。

## 禁止事项

- 不安装 Node、浏览器、npm 依赖或工具。
- 不 delete/reset/clean/worktree/commit/push。
- 不部署、不迁移、不操作 Supabase 远端、不真实登录、不支付。
- 不读取或写入 `.env`、token、Cookie、密钥、生产 project ref。
- 不修改 `client/`、`server/` 业务功能、Auth、RLS 或价格/额度逻辑。

## 通过后的后续顺序

1. 本切片：安全 junction 处理、仓库 evidence 回写、Node 22 两次 E2E 回归。
2. 下一切片：先设计并评审“完全本地隔离的已登录工作台壳层”测试策略；不得复用 `e2e/user-authored-review-queue.spec.ts` 的历史 project-ref localStorage 伪会话。
3. 再回到真实 Supabase Auth/RLS、额度、订阅和支付等严格安全切片；这些需要单独授权和远端验证。

## 完成后交回 Codex

提供新的 `.planning/prompts/*-codex-review.md` 路径，以及：

- `docs/evidence/2026-07-15/e2e-harness-hardening/verification.md`
- `test-output.txt`
- 本切片截图目录
- 最终 `git status --short`

Codex 会独立检查 junction fail-closed 逻辑、仓库 evidence 回写和两次 E2E 结果后，再决定是否进入本地工作台壳层测试设计。
