# R1 — 审核分组 + 管理员收藏批注同步（本地增量开发）

## 目标

在现有 `D:\work\77港话通社媒文案\77` 中增量完成：

1. 普通管理员只能查看、复制、审核和批注与自己 `review_group` 相同的用户收藏；`super_admin` 可跨组。
2. 管理员可把收藏标记为「已采纳」或「需修改」，并填写最多 2000 字修改建议。
3. 审核状态和意见会随收藏云端 bootstrap 返回给收藏所属用户，并在收藏卡片上高亮显示；用户不可修改管理员审核字段。
4. 官网增加提示：「团队需要管理员审核功能？请联系产品开发：TEL：18595680518」，电话号码使用 `tel:` 链接。
5. 提供面向非技术用户的 Supabase Dashboard 分组说明：如何在 Table Editor 修改 `profiles.review_group`，以及如何在 SQL Editor 按邮箱分配用户组和管理员角色。

## 必须遵守

- 先阅读 `README.md`、`spec/PRD.md`、`spec/SDD.md`、`spec/TEST_PLAN.md`、`spec/ACCEPTANCE.md`、`.planning/status.md`，再修改。
- 先向 PRD/SDD/TEST_PLAN 追加本切片规格，再写失败测试，再实现；只追加/修订相关小节，不删除旧规格。
- 只做本任务；不重构工作台、不改端口、不替换路由、不删除现有功能。
- 保留亮色橙色、暗色荧光绿、现有 Logo、shadcn 风格、支付、Prompt 注入、收藏/历史、登录和首页现有行为。
- 不读取、打印、修改 `.env` 或任何密钥。
- 不执行 `supabase db push`、MCP migration、远端 SQL、部署、支付或角色写入；只创建本地 Migration 文件和文档。
- 不运行 git reset/checkout/clean/stash/rebase/commit/push/worktree；工作区已有大量用户改动，必须保留。
- 不使用子代理。每个变更都必须能追溯到本任务。
- 当前 server 管理接口使用 `service_role`，会绕过 RLS：服务端业务查询必须显式重复同组校验，不能只依赖 RLS。

## 已确认的产品规则

- 每个普通用户和普通管理员最多一个审核组，格式为小写字母/数字开头，后续可含小写字母、数字、`_`、`-`，最长 32 字符，例如 `group1`。
- `review_group IS NULL` 表示未分组。未分组普通管理员不得看到任何用户收藏，也不得审核；未分组用户的收藏只有 `super_admin` 可处理。
- 普通管理员只处理同组用户收藏；`super_admin` 可查看和处理所有组及未分组用户。
- 分组边界本切片仅应用于「用户收藏」列表、搜索、详情、复制和审核写入；不要擅自改变管理员其它统计页。
- 审核状态：`adopted`（已采纳）或 `changes_requested`（需修改）。允许清除审核，回到未审核；`changes_requested` 必须有非空意见；`adopted` 意见可选。
- 审核意见最多 2000 字；前后空白规范化；空字符串写为 null。
- 用户收藏卡只读展示：已采纳使用正向高亮；需修改使用醒目警示高亮；显示「管理员审核意见」和更新时间。用户不应看到管理员邮箱、角色或内部组名。
- 无实时订阅要求；用户刷新/重新 bootstrap 后看到最新审核即可。

## 数据库设计（本地 Migration）

创建一个时间戳晚于现有 `20260714052414` 的本地 migration，例如 `supabase/migrations/20260714190000_review_groups_admin_notes.sql`：

### 1. profiles.review_group

- `ALTER TABLE public.profiles ADD COLUMN review_group text NULL`。
- CHECK：null 或符合 `^[a-z0-9][a-z0-9_-]{0,31}$`。
- 为 `review_group` 建索引。
- 不扩大浏览器端 profiles UPDATE 列权限；用户不能编辑自己的 review_group。

### 2. public.favorite_admin_reviews

- `favorite_id uuid PRIMARY KEY REFERENCES public.favorites(id) ON DELETE CASCADE`
- `reviewer_id uuid NOT NULL REFERENCES auth.users(id)`
- `review_status text NOT NULL CHECK (review_status IN ('adopted','changes_requested'))`
- `note text NULL CHECK (char_length(note) <= 2000)`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`，复用/增加安全的 updated_at trigger。
- CHECK：`changes_requested` 时 trim 后 note 非空。
- RLS 必须开启；为 reviewer/status/updated_at 等实际查询列建必要索引，不重复主键索引。

### 3. RLS 与函数

- 收藏 owner 可 SELECT 自己收藏对应的审核结果，但不可 INSERT/UPDATE/DELETE。
- 同组 `admin` 可 SELECT；`super_admin` 可 SELECT 全部。
- 浏览器端 authenticated 不得直接写审核。
- 服务端 `service_role` 可通过一个原子 RPC 写审核/清除审核并写 `audit_log`。RPC 必须：
  - 验证传入 actor 真实拥有 admin/super_admin 角色；
  - 普通 admin 比较 actor 与 favorite owner 的非空 review_group；
  - super_admin 跨组；
  - 越权或不存在时失败；
  - 同事务 upsert/delete review + insert audit；
  - action 使用 `admin_update_favorite_review`，diff 记录旧/新状态与 note 长度，不复制完整正文和完整意见到 audit；
  - `SECURITY DEFINER SET search_path = ''`，schema-qualified 所有对象；
  - 显式 `REVOKE ALL ... FROM PUBLIC, anon, authenticated`，只 `GRANT EXECUTE ... TO service_role`。
- 若新增 private helper，同样固定空 search_path、回收 PUBLIC/anon/authenticated execute，只授予必要角色。
- RLS policy 用 `(select auth.uid())` / `(select private.helper(...))` 形式，避免每行重算；不要依赖 `user_metadata`。
- 迁移要幂等安全到合理程度，但不要用会掩盖错误的宽泛 exception swallowing。

## 服务端

### 权限与查询

- 为管理员收藏服务增加显式 actor scope：至少接收 `actorId` 和服务器验证后的 `actorRole`。
- `GET /api/admin/favorites`：普通 admin 只 count/select 同组 owner；super_admin 保持全量。搜索仍只检索元数据，绝不返回正文。
- `GET /api/admin/favorites/:id`：先验证对象在 actor scope 内；越组统一返回 404，不能先写审计、不能读取正文。范围内仍保持 exists/scope → audit → body 的 fail-closed 顺序。
- 复制仍由已授权详情响应完成，因此自然受同组约束。
- 列表/详情返回 review summary：`reviewStatus`, `reviewNote`, `reviewUpdatedAt`；不得返回 reviewer email 或组名。

### 审核写接口

- 增加 `PUT /api/admin/favorites/:id/review`（或现有风格一致的 PATCH，但只选一个）。
- body allowlist：`status: 'adopted' | 'changes_requested' | null`、`note?: string | null`。拒绝 overpost、非法状态、超长意见；`status:null` 表示清除审核。
- 调用 migration 的 service-role-only 原子 RPC；不要在 JavaScript 里分两次非事务写 review 和 audit。
- 401/403/404/400/500 使用现有通用错误策略，不暴露数据库细节；普通 admin 越组返回 404。

## 用户收藏同步

- `getBootstrap` 通过用户 JWT 和 RLS 读取自己 favorite 对应的 review；只返回 status/note/updatedAt。
- `FavoriteRecord` 与 `BookmarkedCopy` 增加只读字段，例如 `adminReview?: { status; note; updatedAt } | null`。
- `SyncFavoriteRequest` 和 favorite upsert 映射不得接受、发送或覆盖 admin review。
- 收藏卡在折叠状态也能看到高亮审核块；内容不藏在参数详情中。

## 管理后台 UI

- 收藏详情弹窗保留固定关闭、正文独立滚动、固定复制按钮。
- 在摘要/正文之后增加紧凑审核编辑区：状态按钮/选择器、意见 textarea、保存、清除。
- 保存中禁用重复提交；成功后更新详情和列表当前项；失败显示中文错误，不假装成功。
- 当前审阅状态在列表中显示中文 chip（已采纳 / 需修改 / 未审核）。
- 不增加删除收藏、改评分、批量导出等权限。

## Supabase 后台操作文档

新增 `docs/admin/review-group-management.md`，包含：

1. Table Editor：打开 `profiles`，按 display_name/email 找用户，编辑 `review_group` 为 `group1`；普通管理员本人也要填同一组。
2. Table Editor：在 `user_roles` 给管理员添加 `admin`；保留默认 `user` 角色不影响。
3. SQL Editor 提供可复制模板：
   - 按邮箱查看用户 UUID、角色和 review_group；
   - 按邮箱为用户设置/清除 review_group；
   - 按邮箱授予/撤销 admin（必须使用枚举类型、ON CONFLICT 安全；不得删除 super_admin）。
4. 风险提示：不要给前端 anon/authenticated service key；不要把 service_role 放客户端；分组变更立即影响下一次管理员请求。
5. 写清 migration 远端推送尚未执行，需项目负责人单独确认。

## 首页

在现有官网靠近套餐/FAQ 或 footer 的不突兀位置增加：

`团队需要管理员审核功能？请联系产品开发：TEL：18595680518`

电话号码使用 `href="tel:18595680518"`。保持现有页面长度和视觉，不新增大 section。

## 测试（先失败后实现）

### Migration 静态/契约测试

- profiles review_group CHECK、索引存在。
- review table/RLS/owner SELECT/同组 admin SELECT/super_admin SELECT 存在。
- authenticated 无 review 写权限。
- service RPC 只 grant service_role；PUBLIC/anon/authenticated 均 revoke。
- RPC 验证 admin 角色和同组，写 review 与 audit 在同一函数。

### Server

- admin group1 列表只返回 group1 owner，count 同样受限；越组搜索也不泄漏。
- 未分组 admin 返回空列表；super_admin 返回全部。
- group1 admin 访问 group2 favorite → 404，且 audit/body read 均未发生。
- 同组详情顺序 scope/exists → audit → body；audit 失败不读 body。
- 同组 review 写成功；changes_requested 空意见 400；超长 400；越组 404；普通用户 403；清除成功。
- review 接口调用原子 RPC，不直接从 route 分别写 review/audit。
- 列表仍不返回 content。

### Client

- admin 详情可保存已采纳/需修改，加载/成功/失败状态正确；列表 chip 更新。
- 用户收藏卡显示管理员审核意见，折叠状态可见；无 review 时不显示空框。
- favoriteRecordToBookmark 保留 review；bookmarkToSyncFavorite 不发送 review。
- 首页出现电话号码与 tel 链接。
- 既有收藏编辑、平台、评分、删除、参考案例和工作台行为不回归。

## 文档与证据

- 追加更新 `spec/PRD.md`、`spec/SDD.md`、`spec/TEST_PLAN.md`、`spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`、`docs/comprehensive-spec-v2.md`、`.planning/status.md`、`.planning/progress.md`。
- 新增 `docs/evidence/2026-07-14/review-groups-admin-notes/verification.md`，写实际命令、确切通过数量、未执行远端 migration。
- 不虚构浏览器手测、远端推送或测试结果。

## 最终验证

至少执行：

1. 新增定向 client/server/migration tests。
2. `npm run test:client`
3. `npm run test:server`
4. `npm run typecheck`
5. `npm run build`
6. 若网络/registry 可用：`npm run audit:prod`；否则如实记录。

完成后只汇报：修改文件、权限矩阵、测试确切结果、远端未推送事实、需人工确认项。不要继续做下一切片。
