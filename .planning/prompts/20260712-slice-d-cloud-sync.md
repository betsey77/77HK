# Slice D：收藏 / 品牌 / 保存配置云同步（Claude Code Agent Teams 执行单）

你在仓库 `D:\work\77港话通社媒文案\77` 工作。先读 `README.md`、`AGENTS.md`、`CLAUDE.md`、`.planning/status.md`、`.planning/context_pack.md`、`spec/PRD.md`、`spec/SDD.md`、`spec/TEST_PLAN.md`、`spec/ACCEPTANCE.md`，再动代码。

## 已完成基线（不得降级或重做）

- Slice B：真实 Supabase Auth、邮箱确认、profiles/roles/RLS。
- Slice C1：generation_jobs、历史、软删除。
- Slice C2b：可信服务端写入与额度闭环已远端通过。
- 远端 Migration history 当前为 5/5，最新 `20260712000000`。
- 套餐配置：Free = 每 7 天 20 次完整成功生成；Pro = ¥19/月、400 次。
- 当前自动化：Server 156/156、Client 53/53，双端 build 通过。
- 本地运行：前端 `http://localhost:5175`，服务端 `:3001`。
- 已修复跨账号本地泄漏：`hk-cantonese-bookmarks/settings/configs:${userId}` 按 Supabase user.id 隔离；旧无 owner 的全局 key 保留但不读取。
- 右上角已有“复原配置”，默认：结构化关、自由度 1、粤语 4、中英 1、无目标用户。

## 本轮唯一目标

完成 Slice D：让收藏、当前品牌资料、保存配置在同一账号跨浏览器/设备同步，同时保持离线/失败时的账户级 localStorage 回退；严格证明 User A 无法读取或修改 User B 数据。

不要进入支付、支付宝、订单、管理后台、套餐功能阉割、生产部署、SSE 或 Prompt 重构。

## 用户已授权

- 可使用 Claude Code Agent Teams 和 `--dangerously-skip-permissions`。
- 可为本 Slice 新建并推送一条**只创建 Slice D 数据结构/策略、无删除和无破坏性数据改写**的 Supabase Migration。
- 可运行 linked CLI 的 dry-run、push、advisors 和事务回滚验收。
- 不允许：删除用户文件/既有业务数据、修改旧 Migration、git reset/checkout、git commit/push、生产部署、支付操作、读取或打印任何 secret。
- 服务端 secret 位于仓库外；本轮无需读取 `D:\API\Supabase\77\SUPABASE_SECRET_KEY.txt`。不得运行会枚举 API key 的命令。

## Agent Teams 组织

使用 Agent Teams 并行，但**不要创建 git worktree**（当前仓库有大量用户未提交改动）。Leader 先声明文件所有权，避免多人编辑同一文件：

1. Database agent：只拥有新 Migration 和 Migration 静态测试建议。
2. Backend agent：只拥有 Slice D service/routes/backend tests。
3. Frontend agent：只拥有 cloud-sync service/UI/前端 tests；不要直接改共享 `AppContext.tsx`。
4. Leader：独占 `AppContext.tsx`、`App.tsx`、`server/src/app.ts`、共享 types、文档、最终集成与远端 push。
5. Review agent：最后只读审计 RLS、BOLA/overposting、同步竞态、数据丢失和测试真实性。

如 Team 能力不可用，改为顺序执行；不要因此扩大范围。最多 3 轮修复，同一问题连续 2 轮无进展即停止。

## 数据与权限设计（最小 MVP）

新建一条按时间排序、不可修改既有 Migration 的 SQL，至少覆盖：

### `favorites`

- `id uuid` 主键；`owner_id uuid references auth.users on delete cascade`。
- `client_id text`：沿用现有本地 bookmark id；`unique(owner_id, client_id)`，用于幂等导入。
- 保存现有 `BookmarkedCopy` 必需字段：variant、content、source、settings、variant metadata、scores、consumer feedback、notes、rating、favorite reason、reason tags、saved_at、created_at、updated_at。
- 文本长度、rating 1–5、JSON 类型等合理 CHECK；不存任意 owner/role/plan 字段。

### `saved_configs`

- owner、client_id、name、完整 config JSON、created/updated；`unique(owner_id, client_id)`。
- 仍保留 `MAX_SAVED_CONFIGS = 20` 的服务端校验；不能只靠 UI。

### `brand_profiles`

- MVP 每用户一个当前品牌资料：`unique(owner_id)`；brand name、product name、red lines、created/updated。
- 这不是多品牌管理；多品牌留到后续。不要凭空加团队/组织模型。

三表全部：RLS 开启；anon 无权限；authenticated 仅本人 SELECT/INSERT/UPDATE/DELETE；service_role 明确最小权限；owner_id 不可通过更新改成别人。为 owner 查询/唯一约束添加必要索引，避免重复索引。

## API 边界

使用现有 Express + `requireAuth` + user-scoped Supabase client；不信任 body 中的 user_id/owner_id。

提供最小清晰接口（命名可微调，但必须统一并写 SDD）：

- `GET /api/sync/bootstrap`：一次返回本人的 favorites、savedConfigs、brandProfile。
- 收藏 upsert/delete；保存配置 upsert/delete；品牌资料 upsert。
- `POST /api/sync/import`：批量导入，按 `(owner_id, client_id)` 幂等 upsert；重复执行不增行。

所有写入做长度、枚举、数组、JSON、rating、最多数量、overposting 校验；错误响应不泄露 SQL/表/策略/密钥。不得用 service role 替普通用户绕过 RLS。

## 客户端同步规则

1. 登录后先用当前 `user.id` 读取账户级 local cache，再请求云端 bootstrap。
2. 已归属当前 user.id 的 namespaced local 数据可自动幂等导入；云端与本地按 `client_id` 合并，不能把云端数据覆盖丢失。
3. 旧全局 key（无 `:${userId}`）归属不明：**绝不自动导入**。如检测到，显示明确提示和“导入到当前账号”按钮；用户点击确认后才调用 import。导入成功写用户级 marker，但不要删除旧 key。
4. 收藏/配置/品牌写入采用本地立即可见 + 云端同步；失败时保留本地、展示非阻断“仅保存在本机/重试”状态，不伪装成功。
5. 同一账号新挂载/另一设备只靠云端即可恢复；不同账号不能看到彼此数据。
6. 云端未完成 hydration 前避免把空本地状态反向覆盖云端。
7. 保留当前 `RESTORE_DEFAULT_GENERATION_SETTINGS` 行为。
8. 本 Slice 不做套餐功能限制：Free 仍可体验收藏、消费者模拟与灵感面板；feature entitlement 另切片决定。

## TDD 与严格验收

先写失败测试，再实现。至少覆盖：

- 缺 token / 非法 token 401。
- User A bootstrap/CRUD 不可读写 User B。
- body 伪造 owner_id 被忽略或拒绝。
- import 连续执行两次行数不增加；同 client_id 更新而非复制。
- 配置超过 20、超长文本、非法 rating/variant/JSON 被拒绝。
- 删除只影响本人目标；不存在/别人目标不泄露存在性。
- 云端 hydration 不会被初始空状态覆盖。
- namespaced local 自动导入；旧 global key 必须点击确认；失败保留本地并可重试。
- 同账号跨挂载恢复；不同账号隔离。
- Slice A/B/C 与刚新增的 53 个客户端测试全部回归。

完成本地红→绿后：

1. Client/Server 全量 Vitest、TypeScript、build。
2. `git diff --check`；确认无 secret/真实 token/邮箱写入证据。
3. `supabase db push --dry-run` 必须只显示一条 Slice D Migration。
4. Database + Review agent 通过后才 push。
5. 远端验证 Migration history；security/performance advisors。
6. 用 `BEGIN ... ROLLBACK`、两个现有测试用户的 UUID 在 SQL 内部完成 RLS/幂等/跨用户测试；输出不得出现 UUID、邮箱或 token。
7. 重启本地应用，保存浏览器/接口可核验说明；若无法自动完成真实双浏览器登录，明确列为人工项，不得伪造。

## 文档与停止条件

更新：`spec/PRD.md`、`spec/SDD.md`、`spec/TEST_PLAN.md`、`spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`、`.planning/task_plan.md`、`.planning/progress.md`、`.planning/findings.md`、`.planning/status.md`，证据写入 `docs/evidence/2026-07-12/slice-D-cloud-sync/`。

本 Slice 达标后立即停止并输出：Agent Teams 分工、Migration、改动文件、测试计数、远端事务/RLS结果、本地 URL、已知限制、是否需要用户手动核验。不要自动进入 Slice E 支付 Mock。
