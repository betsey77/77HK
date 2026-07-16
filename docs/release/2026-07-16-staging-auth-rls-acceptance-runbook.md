# Staging Auth / RLS 验收运行手册

日期：2026-07-16

状态：已完成。最终结果与脱敏证据见 `docs/evidence/2026-07-16/staging-auth-rls/`。

## 目标

在一个全新、与现有业务库隔离的 Supabase staging 项目中，从零重放仓库 Migration，并用真实邮箱会话验证：

- 注册、邮箱确认、登录、退出和密码重置；
- owner 数据隔离与普通用户不可自赋管理员/套餐；
- 管理员 `review_group` 隔离；
- 用户审核结果提醒与管理员待审核提醒；
- 浏览器只使用 publishable key，`SUPABASE_SECRET_KEY` 只进入服务端。

## 明确不做

- 不对现有项目 `qiotocumkbwckiezuptr` 执行 `db reset`、重放或测试数据写入；
- 不复制现有业务用户、订单、收藏或生成记录到 staging；
- 不部署 preview，不测试支付宝沙箱，不配置生产域名；
- 不把数据库密码、Access Token、Secret key、JWT、邮箱密码写入仓库、聊天、日志或截图；staging Project Ref 是公开标识，可以提供给 Codex 以确认目标；
- 不把本地 fixture E2E 当作真实 Auth/RLS 证据。

## 当前本地基线

- 分支：`master`；Git 基线已推送至 `origin/master`。
- Node：22.x。
- Supabase CLI：根项目 devDependency `2.109.1`。
- Migration：18 个，范围 `20260711000000` 至 `20260716142256`。
- 本地工作台隔离 E2E：6/6，连续两轮；仅 mock Auth/Supabase。
- 本地 Supabase 容器未启动；当前机器没有可用 Docker Desktop。

## 第一阶段：需要用户在 Supabase Dashboard 完成

### 1. 创建隔离项目

1. 在 Supabase Dashboard 新建项目，建议名称：`77HK-staging`。
2. 必须是空白新项目，不要复用现有业务项目或已经手工建过相同表的项目。
3. 设置一个独立数据库密码，并保存到本机密码管理器。
4. 可以把 staging Project Ref 发给 Codex；不要发送数据库密码、Access Token、Secret key 或任何其他 secret。

### 2. 配置 Auth URL

在 `Authentication -> URL Configuration` 设置：

- Site URL：`http://localhost:5173`
- Redirect URLs：
  - `http://localhost:5173/auth/callback`
  - `http://localhost:5173/reset-password`
  - `http://127.0.0.1:5173/auth/callback`
  - `http://127.0.0.1:5173/reset-password`

保持邮箱注册与邮箱确认开启。当前阶段使用精确 URL，不添加宽泛生产通配符。Supabase 官方说明 Site URL 会作为没有显式 `redirectTo` 时的默认地址，并直接影响确认邮件和密码重置。

### 3. 在本机配置环境变量

只在本机创建或更新以下忽略文件，不提交：

`client/.env`

```dotenv
VITE_SUPABASE_URL=https://<staging-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<staging-publishable-key>
```

`server/.env`

```dotenv
SUPABASE_URL=https://<staging-project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<staging-publishable-key>
SUPABASE_SECRET_KEY_FILE=C:\Users\<your-user>\.secrets\77hk-staging-supabase-secret.env
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

外部 secret 文件（仓库之外）：

```dotenv
SUPABASE_SECRET_KEY=<staging-secret-key>
```

规则：

- `VITE_*` 中只能放浏览器可见的 URL 和 publishable key；
- Secret key 只能放仓库外的 secret 文件，`server/.env` 只保存绝对文件指针，不能放进 `client/.env`；
- 数据库密码只用于 Supabase CLI 连接，不写进上述应用环境变量；
- 截图、测试日志和 evidence 必须遮盖邮箱、token、cookie 和密钥；Project Ref 可记录，但必须明确标注为 staging，避免误操作现有业务项目。

## 第二阶段：需用户明确授权后由 Codex 执行

以下每个写操作都以 staging Project Ref 为目标；执行前先打印目标的脱敏标识并再次确认不是现有业务项目。

### 1. 连接与 dry-run

```powershell
npx supabase --version
npx supabase link --project-ref <STAGING_PROJECT_REF>
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

通过条件：

- 远端起始 Migration history 为空；
- dry-run 只列出仓库中的 18 个 Migration，顺序与文件名一致；
- 不出现生产 Project Ref；
- 不执行 `migration repair`，不修改既有 Migration 文件。

### 2. Migration 重放

必须在 dry-run 清单复核后，再由用户明确回复“确认向 `<staging 标识>` 重放 18 个 Migration”。之后才执行：

```powershell
npx supabase db push --linked
npx supabase migration list --linked
```

若 push 超时或返回不明确，先只读检查 migration history，不盲目重试。

### 3. 重放后安全检查

- 所有 exposed `public` 表启用 RLS；
- `anon` 无业务表数据权限；
- `authenticated` 权限与 owner/review-group policy 同时存在；
- 所有 `SECURITY DEFINER` 函数固定 `search_path`、内部校验调用者，并撤销不需要的 `PUBLIC` EXECUTE；
- service-role-only RPC 不可由 `anon` / `authenticated` 调用；
- Security Advisor 不新增本切片警告。

## 第三阶段：真实账号验收矩阵

建议准备四个专用测试账号，不使用真实客户邮箱：

| 账号 | 角色 | 分组 | 用途 |
| --- | --- | --- | --- |
| User A | user | group-a | owner 数据、提交审核、接收审核结果 |
| User B | user | group-b | 跨 owner 隔离 |
| Admin A | admin | group-a | 同组待审与审核 |
| Admin B | admin | group-b | 跨组隔离 |

管理员角色与分组只能通过受信任的管理方式设置，不允许注册参数或浏览器请求自赋角色。

| 编号 | 验收项 | 通过条件 |
| --- | --- | --- |
| S1 | 从零重放 | 18 个 local/remote Migration version 完全一致 |
| S2 | 邮箱 Auth | 注册、确认、登录、退出、重置成功；错误密码和失效会话失败关闭 |
| S3 | 角色安全 | 新注册账号固定为 user/free，不能自赋 admin/Pro |
| S4 | owner RLS | User A 无法读取或修改 User B 的 profile、任务、收藏、品牌和配置 |
| S5 | 工作台 | 登录后生成、历史、收藏和云同步均绑定当前 owner |
| S6 | review-group RLS | Admin A 只看到 group-a 待审；Admin B 看不到 group-a 数量和正文 |
| S7 | 用户提醒 | 审核通过/需修改显示正确品牌文案，去重有效，新审核可再次提醒并定位收藏 |
| S8 | 管理员提醒 | 新待审出现右下角提醒；稍后与立刻审核均正确，审核后计数下降 |
| S9 | API 拒绝 | 未登录、普通用户、跨组管理员访问受限 API 均返回拒绝且不泄露记录存在性 |
| S10 | Secret 边界 | 浏览器 bundle、Network、日志和 evidence 中无 Secret key、数据库密码或 JWT |

## 证据要求

证据目录：`docs/evidence/2026-07-16/staging-auth-rls/`

- `verification.md`：环境边界、Migration 版本、账号角色矩阵和最终结论；
- `test-output.txt`：脱敏命令结果；
- `screenshots/`：桌面 1440px 与手机 390px 的关键流程；
- 不保存确认邮件完整链接、Access Token、Refresh Token、cookie、密钥或数据库连接串。

## 立即停止条件

- 目标 Project Ref 等于现有业务项目；
- 远端空白项目已有未知 schema 或 Migration history；
- dry-run 数量不是 18 或顺序不一致；
- 需要修改历史 Migration、执行 `migration repair` 或删除远端对象；
- 命令结果无法判断 Migration 是否已应用；
- 任何测试可能访问或修改真实业务数据。

## 权威参考

- Supabase Managing Environments：<https://supabase.com/docs/guides/deployment/managing-environments>
- Supabase Auth Redirect URLs：<https://supabase.com/docs/guides/auth/redirect-urls>
- 项目验收：`spec/ACCEPTANCE.md`
- 项目测试计划：`spec/TEST_PLAN.md`
- 环境变量契约：`.env.example`
