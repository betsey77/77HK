# Grok Build 执行 Prompt：Windows E2E 镜像安全收口与证据回写

项目：`D:\work\77港话通社媒文案\77`
仓库：`betsey77/77HK`
基线：`master` / `92358e2`，工作区有未提交改动，必须保留。

先阅读：

1. `README.md`
2. `AGENTS.md`、`CLAUDE.md`（如存在）
3. `.planning/status.md`
4. `.planning/context_pack.md`
5. `.planning/prompts/20260715-204700-codex-review.md`
6. `docs/handoff/2026-07-15-grok-e2e-harness-hardening-handoff.md`
7. `scripts/e2e-public-smoke.ps1`
8. `e2e/public-routes.spec.ts`
9. `playwright.config.mjs`
10. `scripts/verify/commands.md`

## 已由 Codex 独立确认的基线

以下事实可作为前提，但仍需在修改后复跑：

- 在当前 Windows 机器上，中文项目路径直接执行 Playwright worker 会无输出挂起。
- 使用现有 Node `v22.23.1` 与 ASCII 镜像 `C:\work\77hk-e2e`，focused public/protected E2E 已由 Codex 独立连续通过两次：每次 `8 passed`，约 11.1 秒，正常退出。
- `git diff --check` 当前通过，且无残留 `@playwright/test` CLI 进程。
- `scripts/e2e-public-smoke.ps1` 目前能工作，但有两个必须收口的问题：
  1. 它对已有 `client`/`server`/`node_modules` 路径直接调用 `rmdir`，没有先验证其确为指向本仓库的 junction；必须改成 fail-closed。
  2. `e2e/public-routes.spec.ts` 的截图以相对路径写入镜像目录，不会自动回写仓库的 evidence 目录；需要让本次运行的截图可追溯地保存在仓库证据中。

## 本次唯一目标

把 Windows ASCII-cwd Playwright 工具收口为一个安全、可重复、证据落在仓库内的本地测试工具。完成后立即停止；不实现任何新产品功能。

## 严格边界

- 保留所有当前 Dirty Worktree 改动；先记录 `git status --short`。
- 禁止 `git reset`、`git clean`、`git checkout --`、删除用户文件、创建 Git worktree、commit 或 push。
- 禁止安装/下载 Node、npm 依赖、Playwright 浏览器或任何工具。移除自动浏览器安装入口；未来安装必须由独立用户授权流程处理。
- 禁止部署、Supabase Migration、真实数据库读写、真实登录、支付、额度或管理员功能开发。
- 禁止读取、打印或写入 `.env`、token、Cookie、密钥或生产 project ref。
- 不得修改 `client/`、`server/` 业务实现或 Auth/RLS 行为。
- 同一失败最多尝试 3 次；连续 2 轮无新证据时停止并记录。

## 允许修改范围

- `scripts/e2e-public-smoke.ps1`
- `e2e/public-routes.spec.ts`
- `package.json`
- `.gitignore`
- `scripts/verify/commands.md`
- `spec/TEST_PLAN.md`
- `spec/ACCEPTANCE.md`
- `spec/CHANGELOG.md`
- `.planning/progress.md`
- `.planning/loop_log.md`
- `.planning/status.md`
- `.planning/context_pack.md`
- `docs/evidence/2026-07-15/e2e-harness-hardening/**`
- `.planning/prompts/*-codex-review.md`

若需要触及范围外文件，停止并向用户说明。

## 必须实现

### 1. Junction fail-closed

重写镜像目录处理逻辑，使其满足：

- 对 `node_modules`、`client`、`server`：只有当现有路径明确是 **Junction**，且目标精确解析为本仓库对应目录时，才可移除并重建该 junction。
- 若路径是普通目录、普通文件、符号链接、目标不一致或解析失败：立即 throw，绝不调用 `rmdir`、`Remove-Item` 或覆盖。
- 对 ASCII 根目录：若要复用既有目录，必须通过一个明确的本工具标记文件和预期目录结构验证；无法证明归属时停止并要求用户手动选择新的空目录。
- 新建根目录仅允许在不存在的路径创建；不可清空已有目录。
- 禁止使用带 `/s` 的 `rmdir`，禁止递归删除。

### 2. 仓库证据回写

- 让 `e2e/public-routes.spec.ts` 支持一个明确的 E2E 截图目录环境变量；未设置时保持现有仓库相对默认路径。
- Windows 脚本运行时，把该变量设置为仓库内本切片 evidence 的绝对截图目录，例如 `docs/evidence/2026-07-15/e2e-harness-hardening/screenshots/`。
- 截图文件名应保留 route + viewport 信息；不得覆盖用户此前 evidence，使用本切片自己的目录。
- focused run 的原始终端输出也应保存至本切片 `test-output.txt`，并保留最终通过/失败事实。

### 3. 运行前条件与脚本边界

- Node 必须为现有 Node 22.x；不是 22 则立即失败并输出清晰提示。
- 默认模式下，用一次本地 HTTP 请求确认 `http://localhost:5173` 可访问；不可访问时直接失败，提示启动 `npm run dev:client`，不要悄悄改成远程 URL。
- 保留显式 `-WithWebServer` 选项仅在安全且必要时；不得因为这个任务触发或杀掉用户的 Vite。
- 移除 `-InstallBrowsers` 参数和所有浏览器安装逻辑。
- 继续支持一次与 `-Twice` 两次运行；每一次结束后只读核对本次启动的 Playwright CLI 是否退出。

## 验收命令

使用已有 Node 22，至少执行：

```powershell
& .\scripts\e2e-public-smoke.ps1 -Twice
git diff --check
git status --short
```

并证实：

1. 两次均有 list reporter 输出、各 8/8 通过并正常退出。
2. 仓库内 `docs/evidence/2026-07-15/e2e-harness-hardening/screenshots/` 出现本次生成的桌面和移动截图。
3. `test-output.txt` 保留两次原始输出摘要或完整脱敏输出。
4. 对一个临时普通目录或目标不匹配的 junction 的安全行为，应通过**非破坏性单元化/函数级验证或 dry-run**证明会拒绝，而不是实际删除任何用户路径。
5. 无残留本次启动的 Playwright CLI 进程。

不要跑真实 Auth/RLS/支付测试，不要以截图代替行为断言。

## 必须更新的交接材料

创建：

- `docs/evidence/2026-07-15/e2e-harness-hardening/verification.md`
- `docs/evidence/2026-07-15/e2e-harness-hardening/test-output.txt`
- `docs/evidence/2026-07-15/e2e-harness-hardening/screenshots/`
- `.planning/prompts/YYYYMMDD-HHMMSS-codex-review.md`

并更新 TEST_PLAN、ACCEPTANCE、CHANGELOG、planning 状态/进度/context。新的 Codex review 必须列出：精确改动、Node 路径、两次结果、截图路径、安全拒绝测试、残留进程结果，以及未做的真实 Auth/RLS/支付/部署/commit/push。

完成后立即停止。最终回复仅列：完成状态、改动文件、测试结果、证据路径、Codex review 路径和阻塞事项。
