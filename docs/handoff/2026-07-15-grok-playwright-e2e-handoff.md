# Grok Build 交接：Playwright Runner 与公开页面冒烟测试

日期：2026-07-15
项目：77 港话通社媒文案
仓库：`D:\work\77港话通社媒文案\77`
GitHub：`betsey77/77HK`

## 交接目的

下一小步可以交给 Grok Build：先解决本地 Playwright runner 偶发无输出挂起的问题，再建立公开页面和未登录路由保护的可信冒烟测试基线。

本次不是完整 E2E，也不进入部署、数据库迁移、支付或真实身份测试。完成该小切片后必须停止，并把证据和状态交回 Codex 独立复验。

执行 prompt：

`D:\work\77港话通社媒文案\77\.planning\prompts\20260715-grok-playwright-runner-public-smoke.md`

## 当前 Git 基线

- 分支：`master`
- HEAD：`92358e2`，`docs: record successful phase0 CI verification`
- `origin/master`：已知与 `92358e2` 一致
- 最近已完成：Phase 0 CI/Supabase 只读基线与 GitHub Actions 验证
- 已知最新成功 GitHub Actions run：`29403273367`
- 创建本交接文档前工作区为 clean；本交接和 prompt 会成为新的未提交文档改动，Grok 必须保留

禁止 reset、clean、checkout 回滚或另建 worktree。Grok 不得 commit/push。

## 当前 Playwright 状态

### 已存在配置

`playwright.config.ts` 当前包含：

- `testDir: './e2e'`
- Chromium Desktop Chrome 项目
- 本地默认 `baseURL: http://localhost:5173`
- CI 单 worker、首次重试 trace、失败截图
- 尚无 Playwright `webServer` 生命周期配置

### 已存在测试

`e2e/smoke.spec.ts`：

- 检查公开首页 HTTP/body
- 检查首页分段滚动揭示
- 前端不可访问时要求硬失败，不允许 skip
- 当前依赖开发者事先启动前端服务

`e2e/user-authored-review-queue.spec.ts`：

- 使用路由 mock 和 localStorage auth 模拟
- 覆盖用户自建表单与管理员待审核队列
- 其中 auth 模拟带有历史项目标识耦合，不应视为真实登录、RLS 或生产验收证据

### 已知历史结果

- 2026-07-14：安装 Chromium 后，公开首页 smoke 曾通过，结果为 `1/1`，约 `3.6s`。
- 2026-07-15：功能 E2E、单测试调试和既有 smoke 均出现 runner 启动后无输出、长时间不退出的现象；连续 3 次后按停止规则终止。
- R2 最终由用户人工验收通过。此前无头浏览器曾遇到远程 Supabase Auth `ERR_CONNECTION_CLOSED` 和交互选择问题，因此不能把该环境结果混同为本地 runner 可靠性。

## 本次范围

1. 定位测试发现、浏览器启动、前端服务等待或 teardown 中的真实挂起位置。
2. 用最小配置稳定 Playwright 的 server lifecycle，优先采用原生 `webServer` 与 HTTP ready 检测。
3. 保留并稳定现有首页 smoke。
4. 增加 `/`、`/pricing`、`/login` 的基础冒烟覆盖。
5. 验证未登录访问 `/app` 的登录跳转和回跳意图。
6. 仅在完全本地隔离、无真实凭据和无远程 Supabase 请求时，才允许增加工作台壳层 smoke；否则记录延期。
7. 更新测试计划、验收记录、状态、证据和新的 Codex 复验 prompt。

## 明确排除

- 不开发新的用户功能或 UI。
- 不改真实额度、Pro 250、团队版月费或支付逻辑。
- 不创建或推送 Supabase Migration。
- 不测试真实支付、真实订单、真实账号或真实数据库写入。
- 不部署，不创建 staging。
- 不安装依赖、浏览器或工具。
- 不提交、不推送。
- 不把 mock auth 测试包装成真实 Auth/RLS 验收。

## Grok 必须回写的文档

完成后，Grok 必须至少提供：

- `docs/evidence/2026-07-15/playwright-runner-public-smoke/verification.md`
- `docs/evidence/2026-07-15/playwright-runner-public-smoke/test-output.txt`
- `docs/evidence/2026-07-15/playwright-runner-public-smoke/screenshots/`
- 更新后的 `spec/TEST_PLAN.md`
- 更新后的 `spec/ACCEPTANCE.md`
- 更新后的 `spec/CHANGELOG.md`
- 更新后的 `.planning/progress.md`
- 更新后的 `.planning/loop_log.md`
- 更新后的 `.planning/status.md`
- 更新后的 `.planning/context_pack.md`
- 新建 `.planning/prompts/YYYYMMDD-HHMMSS-codex-review.md`

如 runner 架构发生变化，还需同步 `spec/SDD.md`；如验证命令变化，还需同步 `scripts/verify/commands.md`。

## 交回 Codex 的材料

用户完成 Grok Build 操作后，只需告诉 Codex“Grok 已完成，请验收”，并提供 Grok 最终回复或新的 `*-codex-review.md` 路径。Codex与用户共用同一工作区，可直接读取其他证据。

为避免遗漏，回传信息应包含：

1. Grok 最终完成/阻塞状态。
2. 新生成的 `.planning/prompts/*-codex-review.md` 完整路径。
3. `verification.md` 与 `test-output.txt` 路径。
4. 截图目录路径。
5. 最终 `git status --short`。
6. Grok 是否执行过安装、远程写入、部署、commit 或 push；预期答案均为“否”。

## Codex 后续验收标准

Codex 收到回传后将独立检查：

- 工作区改动是否严格限定在本切片。
- 是否存在秘密、真实 token、生产项目标识、新依赖、`test.only` 或不合理 `test.skip`。
- runner 是否能列出测试、启动、输出结果并正常退出。
- 公开路由和未登录保护断言是否真实反映现有产品行为。
- 桌面与移动截图是否无明显溢出和遮挡。
- focused Playwright 命令与 `npm run verify` 是否可复跑。
- 状态文档是否区分 local/mock 证据与仍待 staging/真实身份验证的范围。

Codex 验收通过后，才决定是否授权下一小步或 Git commit/push。

## 推荐运行方式

在 PowerShell 中从仓库根目录运行 Grok Build，并把上述 prompt 文件作为输入。不要增加 `--worktree` 或自动提交参数。

如果本机 Grok CLI 支持 `--prompt-file`，可使用类似命令：

```powershell
grok --cwd 'D:\work\77港话通社媒文案\77' --no-subagents --disable-web-search --permission-mode acceptEdits --max-turns 20 --prompt-file 'D:\work\77港话通社媒文案\77\.planning\prompts\20260715-grok-playwright-runner-public-smoke.md'
```

如果该版本不支持某个参数，先运行 `grok --help`，只调整 CLI 参数，不修改 prompt 中的范围和安全边界。
