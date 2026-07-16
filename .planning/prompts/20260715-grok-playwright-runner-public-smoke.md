# Grok Build 执行 Prompt：Playwright Runner 稳定化与公开页面冒烟测试

你正在维护项目：

- 仓库：`D:\work\77港话通社媒文案\77`
- GitHub：`betsey77/77HK`
- 当前基线提交：`92358e2`
- 当前分支：`master`
- 已知远端基线：`origin/master` 与 `92358e2` 一致

请先完整阅读以下文件，再开始任何修改：

1. `README.md`
2. `AGENTS.md`（如果存在）
3. `.planning/status.md`
4. `.planning/context_pack.md`
5. `docs/handoff/2026-07-15-grok-playwright-e2e-handoff.md`
6. `playwright.config.ts`
7. `e2e/smoke.spec.ts`
8. `e2e/user-authored-review-queue.spec.ts`
9. `docs/release/2026-07-14-playwright-smoke-plan.md`
10. `docs/evidence/2026-07-15/user-authored-review-queue/verification.md`

## 工作方式与硬性边界

- 保持现有 Dirty Worktree，先执行并记录 `git status --short`，不得覆盖、回滚或格式化与本任务无关的用户改动。
- 禁止执行 `git reset`、`git clean`、`git checkout --`，禁止新建 Git worktree。
- 不得提交或推送 Git；不得创建 PR、Tag 或 Release。
- 不得部署，不得创建 staging，不得修改或推送 Supabase Migration。
- 不得写入真实数据库、调用真实支付、创建真实订单、修改真实用户额度或订阅。
- 不得读取、显示或写入 `.env` 中的密钥；不得把 token、真实凭据或生产项目标识写进测试和证据。
- 不得安装依赖、浏览器或新工具。如果发现缺少依赖或 Playwright 浏览器，立即停止并在交接状态中写明需用户授权。
- 不得使用子代理，不得使用新的 worktree。
- 不要用增加超时时间、`test.skip`、吞掉错误、伪造响应结果等方式制造“通过”。
- 同一问题最多尝试 3 次；连续 2 轮没有新证据或范围没有缩小，立即停止并记录阻塞原因。

## 本次唯一目标

稳定本地 Playwright runner 的启动、服务等待和退出流程，并建立一个可信、可重复的小范围冒烟测试基线：

1. Playwright 可以列出测试，不在 runner 启动阶段无输出挂起。
2. 公开首页现有 smoke 测试可重复通过，并继续在前端不可访问时明确失败。
3. 覆盖 `/`、`/pricing`、`/login` 的基本页面加载和关键可见元素。
4. 覆盖未登录访问 `/app` 时的保护行为，验证进入登录流程并保留回跳意图。
5. 如且仅如现有代码可在完全隔离、无真实凭据、无远程 Supabase 请求的前提下建立轻量 mock auth fixture，再增加一条工作台壳层冒烟测试；否则必须明确标记为“等待 staging/测试身份后补充”，不得伪造为已验收。
6. 留下可由 Codex 独立复跑和审阅的测试命令、原始输出、截图、状态和交接文档。

完成以上范围后立即停止，不要继续 Phase 2 的其他功能开发。

## 非目标

- 不实现新产品功能。
- 不修改首页、登录页、工作台或管理员端的视觉设计。
- 不修复与 Playwright runner/本次冒烟测试无直接关系的问题。
- 不覆盖真实登录、RLS、管理员审核、审核通知、额度、订阅或支付的端到端验收。
- 不把 `e2e/user-authored-review-queue.spec.ts` 中现存的本地 token 模拟当作真实 Auth/RLS 证据。
- 不扩大到全浏览器矩阵；本次只要求 Chromium。

## 允许修改的文件范围

优先只修改或新增以下文件：

- `playwright.config.ts`
- `e2e/smoke.spec.ts`
- `e2e/public-routes.spec.ts`（需要时新增）
- `e2e/protected-route.spec.ts`（需要时新增）
- `e2e/fixtures/**`（仅在隔离 mock auth 确有必要时）
- `scripts/verify/commands.md`（命令发生变化时）
- `spec/TEST_PLAN.md`
- `spec/ACCEPTANCE.md`
- `spec/CHANGELOG.md`
- `spec/SDD.md`（仅当 runner 架构发生变化时）
- `docs/release/2026-07-14-playwright-smoke-plan.md`
- `docs/evidence/2026-07-15/playwright-runner-public-smoke/**`
- `.planning/progress.md`
- `.planning/loop_log.md`
- `.planning/status.md`
- `.planning/context_pack.md`
- `.planning/prompts/*-codex-review.md`

如确实必须修改范围外文件，先停止，说明原因和最小修改方案，等待用户决定。

## 执行顺序

### 1. 建立只读诊断基线

先记录以下信息，不修改代码：

```powershell
git status --short
git rev-parse --short HEAD
node --version
npm --version
npx playwright --version
npx playwright test --list --config=playwright.config.ts
```

检查已有 `localhost:5173` 服务是否可访问，并阅读当前 npm scripts。不要因为已经有服务就假设测试生命周期可靠。

### 2. 定位 runner 挂起位置

用最小命令逐层定位：测试发现、浏览器启动、前端服务等待、单测试执行、退出回收。每条诊断命令都要有明确超时；禁止无限等待。

重点验证：

- `--list` 是否快速返回。
- Chromium 是否已可用；如果缺失，不自行安装。
- 现有首页 smoke 在显式 `--reporter=list` 下是否开始输出并正常结束。
- 挂起是 Playwright 本身、Vite server、页面导航、浏览器进程还是 teardown 导致。
- 是否存在孤立的 Node/Vite/Chromium 进程。只可终止由本次测试明确启动的进程，不得批量结束用户其他进程。

### 3. 最小化修复测试生命周期

优先采用 Playwright 原生 `webServer` 和 URL 就绪检测，确保：

- 本地开发可复用已存在的前端服务。
- 没有服务时可由测试配置确定性启动前端。
- CI 不依赖人工提前启动服务。
- 使用 HTTP 就绪检测，不使用固定 sleep。
- 前端不可访问时测试硬失败，不静默跳过。
- 测试结束后由 Playwright 正确回收自己启动的服务。
- 支持 `E2E_BASE_URL` 覆盖，默认仍为 `http://localhost:5173`。

先根据当前 `package.json` 和 `client/package.json` 确认正确命令，再写配置；不要猜测参数转发方式。

### 4. 增加有限冒烟覆盖

测试必须以稳定的产品行为为断言，不要依赖易变文案全文或像素级布局：

- `/`：页面可访问，主内容存在，保留现有分段滚动揭示断言。
- `/pricing`：页面可访问，核心价格方案区域可见，不出现面向用户的 mock 标记。
- `/login`：页面可访问，登录入口/表单可见。
- `/app` 未登录：进入登录流程，并保留返回 `/app` 的意图；按现有路由实现断言，不改变产品行为来迁就测试。
- 至少验证一个桌面视口和一个移动视口的关键公开页面，避免文字溢出或关键控件不可见。

工作台已登录态只允许使用完全本地、无生产项目标识、无真实网络调用的隔离 fixture。若这会迫使你改业务 Auth 代码或写入真实 Supabase project ref，立即放弃该子项并记录延期理由。

### 5. 质量验证

至少执行并保存以下结果：

```powershell
npx playwright test --list --config=playwright.config.ts
npx playwright test e2e/smoke.spec.ts --config=playwright.config.ts --project=chromium --reporter=list
npx playwright test e2e/public-routes.spec.ts e2e/protected-route.spec.ts --config=playwright.config.ts --project=chromium --reporter=list
npm run verify
git diff --check
git status --short
```

如果实际文件名不同，请在证据中写出准确命令。不要为了满足命令而创建没有价值的空文件。

若任一命令失败：保留真实失败结果，分析是否在本次范围内；最多修复 3 次。范围外失败不得顺手大改，只记录阻塞。

## 必须产出的证据与状态文件

请创建并填写：

1. `docs/evidence/2026-07-15/playwright-runner-public-smoke/verification.md`
   - 起始提交和起始 `git status`
   - 问题复现方式与根因
   - 修改摘要和设计理由
   - 每条测试命令、退出码、通过/失败数量、耗时
   - 是否产生任何远程网络请求
   - 已覆盖和明确未覆盖的行为
   - 遗留风险与下一步

2. `docs/evidence/2026-07-15/playwright-runner-public-smoke/test-output.txt`
   - 保存最终 Playwright focused runs 与 `npm run verify` 的原始关键输出
   - 删除机器密钥、token、Cookie 和个人信息，但不得改写通过/失败事实

3. `docs/evidence/2026-07-15/playwright-runner-public-smoke/screenshots/`
   - 至少包含公开页面桌面和移动截图
   - 文件名明确标注路由和视口
   - 失败截图与 trace 如存在，应在 `verification.md` 标注路径

4. 更新：
   - `spec/TEST_PLAN.md`
   - `spec/ACCEPTANCE.md`
   - `spec/CHANGELOG.md`
   - `.planning/progress.md`
   - `.planning/loop_log.md`
   - `.planning/status.md`
   - `.planning/context_pack.md`

5. 新建一份 Codex 复验交接文档：
   - `.planning/prompts/YYYYMMDD-HHMMSS-codex-review.md`
   - 文件名使用实际完成时间

Codex 复验交接文档必须列出：

- 精确 HEAD、分支和 `git status --short`
- 所有修改/新增文件
- 根因和修复方式
- 所有执行命令及结果
- 证据和截图路径
- 哪些验收是 mock/local，哪些仍需 staging/真实身份
- 是否有失败、跳过、重试或残留进程
- Codex 应独立执行的最小复验命令
- 明确声明未执行部署、迁移、真实数据库写入、真实支付、commit 或 push

## 完成标准

只有同时满足以下条件，才可标记本切片完成：

- runner 不再在测试发现或启动阶段无输出挂起。
- focused Playwright tests 可重复执行并正常退出。
- 公开页面和未登录保护行为有可信断言。
- `npm run verify` 通过，或存在清晰且与本改动无关的既有阻塞证据。
- 没有 `test.only`、无不合理 `test.skip`、无硬编码秘密或生产凭据。
- 证据、状态、测试计划、验收记录和 Codex 复验 prompt 均已更新。
- 未超出本次允许范围。

完成后立即停止，不提交、不推送。最终回复只需简洁列出：完成状态、根因、修改文件、测试结果、证据路径、Codex 复验文档路径、仍需用户决定的事项。
