# Grok Build 执行 Prompt：完全本地的已登录工作台壳层 Smoke

项目：`D:\work\77港话通社媒文案\77`
仓库：`betsey77/77HK`
基线：`master` / `92358e2`，Dirty Worktree 必须完整保留。

本任务只建立一个完全本地、隔离的已登录工作台壳层浏览器 smoke。它验证 React 工作台组合、加载完成、主要区域可见和基础响应式；它绝不是 Supabase Auth、JWT、RLS、管理员权限、额度或支付的验收。

先阅读：

1. `README.md`
2. `AGENTS.md`、`CLAUDE.md`（如存在）
3. `.planning/status.md`
4. `.planning/context_pack.md`
5. `.planning/prompts/20260715-213500-codex-review.md`
6. `docs/handoff/2026-07-15-grok-local-workbench-shell-smoke-handoff.md`
7. `client/src/App.tsx`
8. `client/src/context/AuthContext.tsx`
9. `client/src/services/supabase.ts`
10. `client/vite.config.ts`
11. `client/src/test/slice-a.test.tsx`
12. `scripts/e2e-public-smoke.ps1`
13. `e2e/public-routes.spec.ts`

## 已验证前提

- Windows 中文项目根路径直接执行 Playwright worker 会挂起。
- Node `v22.23.1` + ASCII `C:\work\77hk-e2e` 镜像已通过 `scripts/e2e-public-smoke.ps1 -SelfTest` 与 `-Twice`（public/protected 8/8 ×2）。
- E2E harness 已 fail-closed 处理 junction，并能把截图/输出写回仓库 evidence。
- 历史 `e2e/user-authored-review-queue.spec.ts` 使用包含生产 project ref 的 localStorage 伪会话；**禁止复制、调用或把它作为本任务证据。**

## 唯一目标

在独立 E2E Vite 模式中，以本地固定的模拟认证状态运行真实 `App` 的 `/app` 路由，证明工作台壳层能完成加载，并在桌面和移动视口显示关键工作区区域。全流程不得产生任何非 localhost 网络请求。

完成后立即停止，不扩展到真实登录、用户数据、生成、收藏、审核、额度、订阅或支付。

## 严格安全边界

- 不得读取、打印、复制或修改 `.env`、真实 Supabase URL、publishable key、project ref、token、Cookie 或任何密钥。
- 不得连接 Supabase、Express、模型服务、支付服务或任意非 `localhost`/`127.0.0.1` 地址；Playwright 必须拦截并记录所有非本地请求，出现即失败。
- 不得写入 localStorage 的 `sb-*` token，不得伪造 JWT，不得使用现有 `user-authored-review-queue.spec.ts`。
- 只允许虚构、非敏感、不可被服务器接受的 fixture 身份，例如 `e2e-local-user` / `e2e@example.invalid`；它不能通过真实身份验证。
- 不得修改生产 AuthContext、真实 Supabase client、RLS、服务端、Migration、支付、额度或管理员角色行为。
- 不得安装依赖/浏览器/Node/工具；不得部署、commit、push、创建 Git worktree、reset、clean 或删除用户文件。
- 任何需要真实项目标识、远程网络或生产 Auth 代码改造的方案都必须停止并记录阻塞，不得绕过边界。

## 允许修改范围

- `client/vite.e2e.config.ts`（新增，仅 E2E Vite 配置）
- `client/src/e2e/**`（新增，本地 mock/fixture，不能被普通生产 Vite 引用）
- `e2e/workbench-shell-local.spec.ts`（新增）
- `playwright.workbench-local.config.mjs`（新增，如有必要）
- `scripts/e2e-workbench-shell.ps1`（新增，复用现有 ASCII harness 的安全原则）
- `package.json`
- `.gitignore`
- `scripts/verify/commands.md`
- `spec/SDD.md`、`spec/TEST_PLAN.md`、`spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`
- `.planning/progress.md`、`.planning/loop_log.md`、`.planning/status.md`、`.planning/context_pack.md`
- `docs/evidence/2026-07-15/workbench-shell-local-smoke/**`
- `.planning/prompts/*-codex-review.md`

若确实需要改动范围外文件，停止并说明。

## 实现要求

### 1. 独立 E2E Vite 模式

- 新建显式 E2E Vite 配置或等价隔离入口；常规 `client/vite.config.ts` 与生产 build 不得加载 E2E mock。
- 仅在该 E2E 配置内，将真实 AuthContext 和 Supabase service 替换为本地 fixture。优先用 Vite resolve plugin/alias 在模块解析阶段替换，不在真实业务模块中加入 `if (E2E)` 分支。
- fixture 必须完整满足当前 `App` 和其直接依赖使用的最小接口，但不得包含真实 URL、token 或 project ref。
- fixture 的 auth state 必须是已确认邮箱的本地用户；`logout` 只改变 fixture 内存状态，不发网络。
- `supabase` fixture 只提供所需最小本地方法；意外调用必须抛出带有明确“E2E local fixture”信息的错误，不能降级为远程请求。
- E2E Vite server 使用单独端口，例如 `5174`，并用 `--strictPort`；不得停止或重用用户正在运行的 `5173` Vite。

### 2. API 和网络封锁

- Playwright 在创建页面前注册 context route：允许 `localhost`/`127.0.0.1` 的静态资源与 E2E Vite 请求；`/api/**` 仅返回最小固定 mock 数据；所有其他 host 立即 `abort` 并记录到数组。
- 测试结束必须断言非本地请求数组为空。
- Mock API 不得接收或生成真实 bearer token，不得把用户 fixture 发送给服务器。
- 如初始工作台需要 cloud sync、entitlement 或其他 `/api` 响应，按当前 UI 所需的最小 DTO mock；不测试该 API 的真实授权语义。

### 3. 工作台壳层测试

新建 `e2e/workbench-shell-local.spec.ts`，至少覆盖：

1. `/app` 在本地 mock auth 下不跳转 `/login`，并在有限等待内结束初始加载。
2. Header、工作台左侧输入区、中心结果区、右侧审计/辅助区以及 Footer 的稳定可见信号存在。先从现有语义化角色、label、testid 或稳定文字选择器中选择；不要为测试随意给生产组件补 data-testid。
3. 桌面 `1440×900` 与移动 `390×844` 都无水平溢出，主操作控件可见。
4. 用本切片 evidence 目录保存桌面与移动截图。
5. 明确证明这是 `local mock shell`，不是对真实认证、RLS 或业务数据的成功声明。

### 4. Windows 脚本

- 新脚本必须遵循 `scripts/e2e-public-smoke.ps1` 的 Node 22、ASCII cwd 和 fail-closed 思路，但不得复制危险的删除逻辑。
- 不得删除、复用或扰动用户的 `C:\work\77hk-e2e` 公共镜像；优先使用独立的 ASCII 根目录，例如 `C:\work\77hk-workbench-e2e`，并使用同样的 marker/junction 安全检查。
- 脚本必须有一次和 `-Twice` 两次模式，并将终端输出与截图写入 `docs/evidence/2026-07-15/workbench-shell-local-smoke/`。
- 在启动独立 5174 E2E Vite 前确认端口可用；若占用则失败提示，不可结束其他进程或自动换端口。
- 测试完成后脚本只回收它自身启动的 Vite/Playwright 进程，并证明没有残留。

## 验收命令

根据实际脚本名称，至少提供并执行等价于：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\e2e-workbench-shell.ps1 -SelfTest
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\e2e-workbench-shell.ps1 -Twice
git diff --check
```

通过标准：

- SelfTest 覆盖 fixture 不含生产标识、远程网络拦截和 ASCII 根目录安全拒绝。
- 两次工作台 shell E2E 均通过、有 reporter 输出、正常退出。
- 每次都断言无非本地网络请求。
- 仓库 evidence 中有新的桌面/移动截图和原始输出。
- 默认开发/生产 Vite 配置和真实 Auth/RLS 行为没有变更。

## 必须回写

创建：

- `docs/evidence/2026-07-15/workbench-shell-local-smoke/verification.md`
- `docs/evidence/2026-07-15/workbench-shell-local-smoke/test-output.txt`
- `docs/evidence/2026-07-15/workbench-shell-local-smoke/screenshots/`
- `.planning/prompts/YYYYMMDD-HHMMSS-codex-review.md`

同步更新相关 TEST_PLAN、SDD、ACCEPTANCE、CHANGELOG、planning 状态和 context。Codex review 文件必须明确写出：mock 边界、网络断言、两次结果、截图路径、未覆盖的真实 Auth/RLS/支付，以及所有实际改动文件。

完成后立即停止。最终回复仅列完成状态、改动文件、测试结果、证据路径、Codex review 路径和阻塞事项。
