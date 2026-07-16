# Grok Build 执行 Prompt：修复 Playwright 本地运行时基线

项目目录：`D:\work\77港话通社媒文案\77`
仓库：`betsey77/77HK`
分支与提交基线：`master` / `92358e2`

本任务是对上一轮 Playwright 冒烟测试的返工验收，不开发任何产品功能。请先阅读：

1. `README.md`
2. `AGENTS.md` 与 `CLAUDE.md`（如存在）
3. `.planning/status.md`
4. `.planning/context_pack.md`
5. `.planning/prompts/20260715-180200-codex-review.md`
6. `docs/handoff/2026-07-15-grok-playwright-runtime-repair-handoff.md`
7. `playwright.config.mjs`
8. `e2e/smoke.spec.ts`
9. `e2e/public-routes.spec.ts`
10. `e2e/protected-route.spec.ts`
11. `.github/workflows/ci.yml`
12. `scripts/verify/commands.md`

## Codex 独立验收失败事实

不要把上一轮报告当成通过结论。Codex 在当前工作区独立复验得到：

- `npx playwright test --list --config=playwright.config.mjs`：成功，4 秒内列出 10 条测试。
- `npx playwright test e2e/smoke.spec.ts e2e/public-routes.spec.ts e2e/protected-route.spec.ts --config=playwright.config.mjs --project=chromium --reporter=list`：64 秒无 reporter 输出后超时。
- 当前 `localhost:5173` 返回 HTTP 200。
- 用 `E2E_NO_WEBSERVER=1` 禁用 Playwright 自动起 Vite 后，同一 focused 测试仍无输出；因此不能把问题归因于 `webServer`。
- 中断时确实会留下 Playwright CLI 子进程；Codex 只终止了自己启动的精确 PID。
- 当前本机唯一可见 Node 为 `v26.1.0`，而 `.github/workflows/ci.yml` 已固定 `node-version: 22`。

这说明 `.mjs` 配置迁移本身不足以满足“runner 已稳定”的验收条件。Node 26 与 Playwright 执行阶段的兼容性是高优先级假设，但尚未被证实为唯一根因。

## 本次唯一目标

建立一个可验证的本地 Playwright 运行时基线，并使 focused public/protected E2E 在该基线上两次连续完成、产生 reporter 输出、正常退出且不遗留本任务启动的 Playwright 进程。

优先将本地运行时与 CI 的 Node 22 对齐。完成后立即停止，不进入真实 Auth、RLS、工作台、额度、支付或管理员功能。

## 高风险边界

- 保留所有现有 Dirty Worktree 改动。先记录 `git status --short`；不得 reset、clean、checkout 回滚、删除用户文件或建立 worktree。
- 禁止安装、下载或切换 Node、Playwright 浏览器、npm 依赖或其他工具。特别禁止 `npx -p node@22`、`npm install`、`playwright install` 等会下载内容的命令。
- 禁止部署、Migration、Supabase 远端读写、支付、真实登录、真实用户数据、commit、push、PR 或 Release。
- 不读取、输出或修改 `.env`、token、Cookie、密钥或生产 project ref。
- 不得将 timeout 放大、添加 `test.skip`/`test.only`、吞掉超时或伪造通过来掩盖挂起。
- 不得终止用户现有 Vite、浏览器或其他开发进程。只可终止本次命令明确启动并可追溯的 Playwright 进程，须记录 PID 与原因。
- 同一验证路径最多 3 次；连续 2 轮没有新证据时停止并写明阻塞。

## 允许的文件范围

- `.nvmrc` 或 `.node-version`（需要时新增，记录 Node 22）
- `package.json`（仅 `engines` 或 E2E script/命令澄清）
- `.gitignore`（仅加入 `test-results/`，不得删除现有规则）
- `playwright.config.mjs`
- `e2e/smoke.spec.ts`
- `e2e/public-routes.spec.ts`
- `e2e/protected-route.spec.ts`
- `README.md`
- `scripts/verify/commands.md`
- `spec/SDD.md`、`spec/TEST_PLAN.md`、`spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`
- `.planning/progress.md`、`.planning/loop_log.md`、`.planning/status.md`、`.planning/context_pack.md`
- `docs/evidence/2026-07-15/playwright-runtime-repair/**`
- `.planning/prompts/*-codex-review.md`

范围外改动先停止并说明原因，等待用户决定。

## 执行步骤

### 1. 运行时盘点（只读）

记录以下信息：

```powershell
git status --short
node --version
where.exe node
Get-Command nvm, fnm, volta -ErrorAction SilentlyContinue
npx playwright --version
npx playwright test --list --config=playwright.config.mjs
```

检查是否有已经安装且可切换的 Node 22。只能发现和使用现有运行时，不得下载或安装。

### 2. 决策分支

#### A. 已有 Node 22 可用

用该现有 Node 22 运行后续 E2E。可增量加入 `.nvmrc`/`.node-version` 与 `package.json.engines`，让本地基线明确对齐 CI；不要改 GitHub Actions 已有 Node 22 设置。

依次执行：

```powershell
node --version
npx playwright test --list --config=playwright.config.mjs
npx playwright test e2e/smoke.spec.ts e2e/public-routes.spec.ts e2e/protected-route.spec.ts --config=playwright.config.mjs --project=chromium --reporter=list
npx playwright test e2e/smoke.spec.ts e2e/public-routes.spec.ts e2e/protected-route.spec.ts --config=playwright.config.mjs --project=chromium --reporter=list
git diff --check
```

两次 focused run 都必须产生实际 reporter 输出、全部通过且正常退出。每次结束后只读检查本轮命令启动的 Playwright 进程是否已退出。

若仍挂起，按测试发现、配置加载、浏览器启动、页面导航和 teardown 分层定位；每次命令必须设定明确等待上限。不要因为 Node 22 也失败就继续猜测或进行大范围重写。

#### B. 没有 Node 22 可用

不要尝试安装。可以完成以下无风险整理：

- 明确记录 CI 和本地支持版本不一致的事实。
- 必要时新增 `.nvmrc` 或 `.node-version`，标记 Node 22。
- 必要时向 `package.json` 增加明确 `engines` 约束，但不能假装它会自动切换运行时。
- 若 `test-results/` 尚未忽略，可仅追加该规则到 `.gitignore`，不得删除现有目录。
- 修复本切片涉及文档中的尾随空格。

然后将状态标记为 **blocked**，并明确请求用户批准安装或提供现有 Node 22 LTS；绝不声称 Playwright 已修复或执行 `npm run verify`。

### 3. E2E 配置与进程卫生

仅在有可重复实证时修改 `playwright.config.mjs`。配置必须：

- 默认指向 `http://localhost:5173`，支持 `E2E_BASE_URL`。
- 保留前端不可访问时硬失败。
- `webServer` 与 `E2E_NO_WEBSERVER=1` 行为清晰、可记录。
- 不依赖固定 sleep。
- 不要求用户先关闭自己的 Vite。

若一次测试失败或超时，记录启动命令、PID、等待时长与清理结果；只清理本次测试启动的进程。不要把“杀进程”写成日常用户操作的成功前提。

## 验收与证据

在 `docs/evidence/2026-07-15/playwright-runtime-repair/` 写入：

- `verification.md`：起始状态、实际 Node 版本/路径、诊断结论、每个命令与退出码、是否出现无输出挂起、PID 清理记录、覆盖范围与遗留风险。
- `test-output.txt`：保留脱敏后的关键原始输出；若阻塞也必须保留失败事实。
- `screenshots/`：仅在 E2E 真正通过时保留公开页桌面/移动图；不把旧截图当成新证据。

同步更新：

- `spec/TEST_PLAN.md`
- `spec/ACCEPTANCE.md`
- `spec/CHANGELOG.md`
- `spec/SDD.md`（若运行时/配置基线变更）
- `scripts/verify/commands.md`
- `.planning/progress.md`
- `.planning/loop_log.md`
- `.planning/status.md`
- `.planning/context_pack.md`

并新建 `.planning/prompts/YYYYMMDD-HHMMSS-codex-review.md`，其中必须包含准确的：

- HEAD、完整 `git status --short`、改动文件清单。
- Node 版本及实际路径，是否存在 Node 22。
- 两次 focused E2E 的完整结果，或阻塞事实。
- 是否有本次启动的残留 Playwright PID。
- 证据路径和 Codex 最小复验命令。
- 明确声明未安装、未部署、未迁移、未真实远程写入、未 commit/push。

## 完成条件

仅在“已有 Node 22”分支下、以下条件全部满足时，才可标记完成：

1. `node --version` 为 Node 22.x。
2. 测试发现成功。
3. 同一 focused E2E 连续两次都全通过、有 reporter 输出并正常退出。
4. 不存在本任务启动后未退出的 Playwright 进程。
5. `git diff --check` 通过，且 `test-results/` 不再作为未忽略运行产物出现。
6. 证据、状态和 Codex 复验 prompt 已更新。

没有 Node 22 时，正确结果是“阻塞并请求安装授权”，不是失败后继续无限尝试，也不是伪造成功。

完成或阻塞后立即停止。最终回复只列：状态、实际 Node 版本、改动文件、命令结果、证据路径、Codex review prompt 路径、需要用户决定的事项。
