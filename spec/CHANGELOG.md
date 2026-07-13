# CHANGELOG

## 2026-07-12 — Slice G1 最终修复（日历顺序 + Admin 审计顺序 + 客户端类型同步）

### Fixed

**F1. Admin 客户端类型与 AdminPage 完全同步后端 schema**
- `api.ts` 五类接口逐字段同步：`AdminUserOverview`（displayName/userIdPrefix/status/deletionRequestedAt）、`AdminGenerationMeta`（ownerDisplayName，移除 sourceLength）、`AdminFeedbackSummary`（ownerDisplayName/notifyStatus，移除 contentPreview）、`AdminSubscriptionOverview`（userId/userDisplayName/planName）、`AdminAuditEntry`（actor/actorRole/entity/entityId/diff/reason/requestId）
- `AdminPage.tsx` 五张表表头与单元格同频更新：不再渲染邮箱、原文长度、反馈正文预览、旧字段名
- 添加 6 项 fixture 测试 + 源码静态断言，断页面不依赖旧字段

**F2. 日历补丁移至 audit 和 consumer feedback 之前**
- `ensureCalendarCoverage` 从 `Promise.all(audit/consumerFeedback)` 之后移至 `validateDiagnoseGenerateResult` 之后、audit/consumerFeedback 之前
- `audit()` 和 `generateConsumerFeedback()` 现在使用补丁后 `validatedGen.variants`（不再用 `generateResult.variants`）
- 删除旧重复日历补丁块和"audit based on pre-patch"限制注释
- `fallbackAuditResult` 改用补丁后 `validatedGen.variants` 构建
- 后续 validation、persist、HTTP response 全部使用同一份修正后 variants
- 添加 3 项路由/静态顺序测试，防 `ensureCalendarCoverage` 再次被移到 audit 之后

**F3. 管理员正文读取必须先审计**
- 新增 `adminGenerationExists(jobId)`——仅 `select('id')`，不读正文
- detail 路由改为严格三步：exists 检查（无正文）→ audit 写入（fail-closed=500）→ detail 查询（显式 allowlist）
- audit 写入失败时 `getAdminGenerationDetail` 永不被调用
- 添加 4 项调用顺序测试：exists 先于 audit、audit 先于 detail、audit 失败阻断 detail、exists 函数不含 body 列

### Verification

- Server Vitest: **387/387 passed** (12 files, +6: 3 calendar order + 3 admin audit order)
- Client Vitest: **249/249 passed** (13 files, +6: admin fixture + static assertions)
- 双端 `tsc --noEmit` + production build 通过
- 证据路径：`server/src/routes/generate.ts`, `server/src/services/adminService.ts`, `server/src/routes/admin.ts`, `client/src/services/api.ts`, `client/src/pages/AdminPage.tsx`, `server/src/__tests__/calendar-validation.test.ts`, `server/src/__tests__/admin.test.ts`, `client/src/test/slice-g1-admin.test.tsx`

---

## 2026-07-12 — Slice G1 验收阻断修复（权威状态）

### Fixed

**A. 节日话题日历 — 五平台强制覆盖（`ensureCalendarCoverage`）**
- 原 `validateCalendarCoverage` 仅告警，用户仍收到只有 Shorts 提及节日的结果
- 新增 `ensureCalendarCoverage` 纯函数：对 `standardHK/lightCantonese/ig/facebook/shorts` 逐一检查
- 缺失平台自动追加确定性桥接句（从 event 的 `titleZh`/`angles`/`narrativeHooks` 生成）
- 已有覆盖不重复；无 event 时严格保持原结果
- 修正发生在审核结果持久化与 HTTP 返回之前，确保持久化与返回内容一致
- 零模型调用、零重试、零 quota 消费

**B. Admin API — 严格匹配 migration 真实 schema**
- `profiles` 不再伪造 `email`/`last_sign_in_at`/`deleted_at`；改为 `displayName` + 脱敏用户 ID 前缀
- `subscriptions` 使用 `user_id`（非 `owner_id`）
- `audit_log` 使用 `actor`/`actor_role`/`entity`/`entity_id`/`reason`/`diff`/`request_id`（非 `actor_id`/`resource`/`resource_id`/`metadata`）
- 移除不存在的 RPC `admin_get_user_generation_counts`；改为直接查询
- `getAdminGenerationDetail` 使用显式字段 allowlist（非 `select('*')`）；audit 写入失败则 fail-closed（返回 500）
- Feedback 默认列表禁止查询/返回 `content`；仅返回 `type`/`title`/`notify_status`/`created_at` 等元数据
- Supabase 查询 error 不再静默伪装成空数据；统一抛出 → 路由返回 500
- 新增 schema contract tests：从 `supabase/migrations` 读取真实 SQL，断言旧错误字段、`select('*')`、不存在 RPC 均会导致测试失败
- 客户端 AdminPage/API 类型同步

**C. Pricing 与安全 next 回归**
- SignupPage 现在调用 `resolveNextPath` 后才透传到 login（外链、`//evil`、路径穿越均被丢弃）
- MarketingPage nav 和 plans section 均有 `/pricing` 链接
- PricingPage Free/Pro CTA 进入真实 `/signup` 或 `/login` 流程并带 allowlist 内 next

**D. 收藏参考案例与沉淀**
- ReferenceCaseSelector 折叠状态始终显示"可用 N 条 · 已选 M/3"
- 保留云端 HYDRATE、跨账户隔离、≥4 星筛选、备注、最多 3 条选择
- 更新 ACCEPTANCE、CHANGELOG、regression_matrix

### Verification

- Server Vitest: **381/381 passed** (12 files), TS + build 通过
- Client Vitest: **243/243 passed** (13 files), TS + build 通过
- Secret scan: 0 leaks
- 证据路径：`server/src/services/calendarValidation.ts`, `server/src/routes/generate.ts`, `server/src/services/adminService.ts`, `server/src/routes/admin.ts`, `client/src/pages/SignupPage.tsx`, `server/src/__tests__/admin-schema-contract.test.ts`

---

## 2026-07-12 — Slice E：套餐/订单/支付 Mock

### Added

- **PricingPage** (`/pricing`): 公开定价页，展示 Free（¥0/7天 20次）和 Pro（¥19/月 400次）双卡对比
  - 每张卡片含：套餐名、价格、配额、功能列表、CTA 按钮、[MOCK] 标签
  - FAQ 区（5 条常见问题）
  - 遵循设计系统：暗色 emerald、亮色 orange
- **BillingPage** (`/app/billing`): 受保护结算页
  - 当前套餐卡片（名称、价格、使用进度条、周期信息）
  - 使用进度条颜色梯度：绿（<70%）→ 黄（70-90%）→ 红（>90%）
  - Free 用户"升级到 Pro" CTA + Mock 结账流程
  - 订单记录列表：加载中/空状态/错误/列表 + 订单状态标签
  - 手动刷新按钮
- **BillingResultPage** (`/billing/success`, `/billing/cancel`): 支付结果页
  - 成功/取消双模式（通过 outcome prop）
  - orderId URL 参数获取订单详情
  - 订单摘要卡片（订单号、套餐、金额、状态）
  - 返回结算页/工作台链接
- **Server MOCK API** (`server/src/routes/billing.ts`):
  - `GET /api/me/entitlements` — requireAuth，返回 Mock 套餐权益
  - `POST /api/billing/checkout` — requireAuth，创建 Mock 订单（含校验）
  - `GET /api/billing/orders` — requireAuth，用户订单列表
  - `GET /api/billing/orders/:id` — requireAuth，订单详情（owner 隔离）
  - `GET /api/billing/plans` — 公开，套餐定义
- **Slice E types**: PlanId, PlanInfo, PlanEntitlements, CheckoutRequest/Response, PaymentOrder（client + server 双向同步）
- **Client API**: getEntitlements, createCheckout, listOrders, getOrder
- **HeaderMenu**: 新增“套餐与结算”菜单项，保持工作台 Header 横排紧凑

### Security

- 所有订单/权益数据存储在进程内存（Map），不读 DB、不写 Migration
- 不调用真实支付宝、不发起真实支付
- 所有页面/API 响应含 `isMock: true` 或 `[MOCK]` 标记
- 不读取、打印或泄露任何 secret
- 结算 `planId` 使用显式运行时 allowlist；原型链键不能绕过
- 客户端提交的金额字段被忽略，订单金额始终取服务端套餐定义

### Verification

- Server Vitest: **306/306**（billing 24/24）
- Client Vitest: **198/198**
- Client/Server `tsc --noEmit` 与 production build：pass
- 证据：`docs/evidence/2026-07-12/slice-E/`

### Known Limitations

- 订单数据存储于进程内存，重启清空
- Pro 升级在 Mock 模式不改变 entitlements（仅创建订单）
- 无真实支付流程和 Alipay 沙箱回调

### Independent Review

- 使用用户上传的 77 参考图替换共享 Logo，并在官网、工作台、定价页和结算页统一裁切白边。
- 补齐 BillingPage 真实渲染、Logo 容器、原型链 planId 与服务端可信金额测试。
- 本地 Express Mock API 已启动于 `http://localhost:3001`。

## 2026-07-12 — Slice H1：用户反馈中心 + Server酱通知 + 收藏删除防误触

### Added

- **ConfirmDialog**: shadcn-like 可访问确认对话框组件
  - role="alertdialog"、aria-modal、aria-labelledby、aria-describedby
  - Escape 关闭、Tab 焦点循环、初始聚焦取消按钮
  - 危险操作用红色（bg-red-600），非危险用亮橙/暗色荧光绿
  - 可选文案摘要预览（截断 150 字符）
- **FeedbackCenter**: 用户反馈面板（HeaderMenu → 意见反馈入口）
  - 四种反馈类型：需求建议、Bug反馈、使用体验、其他
  - 标题 ≤200 字符、内容 ≤5000 字符、实时字符计数
  - 自动附带页面路径 + App 版本
  - 提交中（spinner）/ 成功（绿色）/ 错误（红色）状态
  - 我的反馈列表面板：加载中/空状态/错误/列表
- **POST /api/feedback**: requireAuth 保护，严格输入校验，持久化优先
- **GET /api/feedback**: requireAuth 保护，分页查询自有反馈
- **ServerChanNotifier**: Server酱 Turbo 通知服务
  - Notifier 接口（可注入/mock）
  - SendKey 通过 SERVERCHAN_SENDKEY_FILE 外部文件指针或直接 SERVERCHAN_SENDKEY env
  - 文件支持 raw key 或 `SERVERCHAN_SENDKEY=SCU...` 格式
  - 错误脱敏：URL/异常/文件路径绝不包含 SendKey
  - 通知失败不回滚反馈（best-effort）
  - 10 秒超时 + AbortController
- **Migration**: `20260712072936_slice_h1_user_feedback.sql`（已通过认证 Supabase MCP 应用）
  - user_feedback 表、owner RLS、admin/super_admin 可读、service_role 可更新通知状态

### Changed

- **FavoritesPanel**: 删除按钮改为先弹出确认对话框，取消不删除，确认才删除
- **HeaderMenu**: 新增"意见反馈"菜单项（MessageSquare 图标）
- **Header**: 传递 onOpenFeedback prop 到 HeaderMenu
- **App.tsx**: 集成 FeedbackCenter（与 FavoritesPanel 同级渲染），通过 authState.session.access_token 传递 JWT

### Security

- SendKey 不出现于仓库、前端 bundle、日志或错误消息
- server/.env 和 .env.example 仅保留 SERVERCHAN_SENDKEY_FILE 指针

---

## 2026-07-12 — Slice H1-R：反馈安全修复 + 工作台会话恢复 + 历史载入

### Fixed (A — H1 Server & Migration)

- **A1**: Migration 使用远端登记版本 `20260712072936`，移除 `XXXXXX` 占位符
- **A2**: SendKey 文件解析器现在大小写不敏感兼容 `SendKey=`、`SERVERCHAN_SENDKEY=`、raw key；多行或未知赋值名 fail closed；可选成对引号安全去除
- **A3**: 通知状态写回改用 `getTrustedSupabase`（service_role），检查 `{ error }`；更新失败时 `notify_status` 保持 `pending`（不伪报 sent/failed），反馈 body 始终 201
- **A4**: DB trigger `private.check_feedback_rate_limit()` 强制每用户 20 条/滚动 1 小时限流，通过 `pg_advisory_xact_lock` 原子化；BFF 映射 `RATE_LIMIT` DB 错误 → HTTP 429
- **A5**: 权限最小化：authenticated 仅 `SELECT, INSERT`（不可 update notify 字段）；admin 使用已硬化的 `private.has_any_role`；删除冗余索引
- **A6**: FeedbackCenter 补全 `role="dialog"`、`aria-modal`、`aria-labelledby`、Escape 关闭、初始焦点、Tab 焦点约束、关闭恢复焦点、radiogroup 类型选择
- **A7**: 前端错误语义用户化——429→次数上限、5xx→服务暂不可用、网络→连接失败

### Added (B — Workbench Session Restore)

- sessionStorage 工作台快照：key 含 ownerId → 账号隔离；仅存工作台字段（不含 token/邮箱/收藏/secret）
- AppProvider 初始化时安全恢复快照（schema/字段校验，坏 JSON 回退）
- 状态变化自动更新快照；`RESET` 清除快照
- 集中 helper `client/src/services/workbenchSnapshot.ts`

### Added (C — History Load to Workbench)

- HistoryDetailPage 对 completed + diagnosis/variants/audit 完整 job 增加"载入工作台"主按钮
- 转换 job 字段为合法快照 → 写入当前 owner sessionStorage → 导航到 /app
- failed/pending/processing 或缺少核心结果的 job 不显示按钮，展示不可载入原因
- 无 non-null assertion 冒充完整结果

### Changed (D — Shared Brand Logo)

- 工作台 Header 与官网 Header 共用 `/brand/77-logo.png`，替换原工作台装饰图标，并在官网原品牌位置展示同一 77 标志。

### Tests

- Server: 282/282 (+29 H1-R: 10 SendKey 解析 + 13 migration static + 6 feedback trusted)
- Client: 170/170（含快照映射、owner 隔离、坏数据拒绝与双页面 Logo 回归）
- Client production build：通过（1693 modules；保留现有 >500 kB bundle 警告）
- SendKey 零泄漏扫描通过
- 通知 URL/异常脱敏（err msg 不输出原始 fetch error）
- 数据库错误脱敏（500 统一 "Internal server error"）
- CLI 因远端 Postgres TLS EOF 无法推送；改用已认证 Supabase MCP 成功应用并完成表、RLS、策略、授权和触发器结构验收

## 2026-07-12 — UX-F1：生成进度 + Header 菜单收纳

### Added

- **GenerationProgress**: 四阶段预估进度组件（诊断原文→生成变体→质量审核→消费者反馈）
  - 每阶段 visual states: pending (灰点) / active (脉冲绿/橙) / done (✓) / failed (✕)
  - 连接线随阶段完成渐进填充
  - 暗色 emerald-400/500，亮色 orange-500/600，遵循 `docs/design-system.md`
  - 「预估」标注清晰标识模拟进度（非真实 SSE）
- **HeaderMenu**: 账户/更多下拉菜单
  - 触发：汉堡菜单图标，带 `aria-expanded`/`aria-haspopup`
  - 菜单项：用户邮箱、官网首页、复原创作配置、主题切换、退出登录
  - Escape/点击外部关闭，关闭后焦点返回触发按钮
- **Types**: `GenerationStage`、`StageProgress`、`GenerationProgress` 加入 `client/src/types/index.ts`
- **Reducer actions**: `SET_GENERATION_PROGRESS`、`ADVANCE_STAGE`、`CLEAR_PROGRESS`

### Changed

- **Header**: 低频功能收纳到 HeaderMenu
  - 保留可见：Logo/标题、历史链接、收藏库按钮、引擎状态指示器
  - 移动到菜单：官网导航、复原配置、主题切换、退出登录+邮箱
- **useGenerate**: 在 API 调用中推进模拟阶段（setTimeout），完成/失败时清理
- **ResultsPanel**: loading 状态显示 `GenerationProgress`（有 progress 数据时）否则回退到 `Spinner`

### Fixed

- **ReferenceCaseSelector 始终可见**（CR-2026-07-12-bug）: 入口始终渲染；无四星收藏时展开显示空状态说明。回归测试通过。
- **Header 信息架构收纳**（CR-2026-07-12-change）: 右上角功能横排已精简。

### Verification

- Client Vitest: **135/135 passed** (8 files, +16 slice-ux-f1)
- Client/Server `tsc --noEmit`: pass
- Client build: pass (643 KB JS, 84 KB CSS)
- Server Vitest: 209/209 (no regression)
- Dev server: `localhost:5176` — `/` and `/app` return 200
- 证据：`docs/evidence/2026-07-12/slice-ux-f1/`

### Known Limitations

- 进度阶段为模拟估算，不是真实 SSE 流式推送
- 服务端生成流水线仍为单次 API 调用；客户端通过 setTimeout 猜测阶段进展

## 2026-07-12 — Workbench usability polish

### Changed

- Generation history now has a persistent route back to the workbench.
- Bookmark notes are trimmed on save and shown in a highlighted collapsed summary.
- Reference favorite cases now default to a compact collapsible section and display saved user notes.
- Unconfirmed email signup now clears the pending auth state and shows explicit verification guidance.

### Verification

- Client Vitest: 118/118 passed.
- Client TypeScript: passed.
- Client production build: passed (1688 modules).

## 2026-07-12 — Slice D 云同步远端闭环

- 新增 Supabase 收藏、配置、品牌三表与 owner RLS。
- 接通收藏/备注/评分/删除、配置和品牌的真实云同步；使用内容快照和 owner-scoped outbox。
- 修复可信 `owner_id` 被清洗、hydration 自我取消、假重试、只比较 ID 和品牌清空不上传。
- 数据库加入原子 20 条配置上限、JSON/标签边界与直接 Data API 防绕过约束。
- Migration 已推送；远端 BEGIN/ROLLBACK 验证跨账号隔离、20 条上限与数据边界，测试数据全部回滚。
- 验证：Server 209/209；Client 113/113；双端 TypeScript 与生产 build 通过。

## 2026-07-12 — Slice D Audit Fix：8 项发布阻断修复（✅）

### Fixed (8 Blocking Issues)

1. **sanitizeOverpost 删除 owner_id** — mapper 写入 `owner_id` 后又被 sanitize 删除，导致 INSERT 违反 NOT NULL。移除所有 5 处调用。
2. **Hydration 自我取消** — effect 依赖 `state.syncStatus`，dispatch 触发 cleanup 取消请求，永久卡在 hydrating。改用 ref 状态机。
3. **Mutation 未接 reducer** — sync helpers 导出但从未调用。现在直接 import cloudSync 模块，helpers 可供 UI/outbox 使用。
4. **Bootstrap ownerId 验证** — 新增 post-query 校验，任何返回记录 ownerId 不匹配当前用户即拒绝。
5. **Legacy import 每账号一次** — 新增 `isLegacyImported(ownerId)` 检查 + 跳过按钮 + 改进提示文案。
6. **Logout 未 await** — `handleLogout` 改为 async，await `logout()` 后再跳转。
7. **Health/connectivity 泄漏** — `/api/health` 移除 proxy 值和 primary engine 名称；`/api/connectivity` 移除外部 API 探测和含 key 的 URL。
8. **JSON parser 无大小限制** — 新增 1 MiB 限制（413），非法 JSON 返回 400（不再静默改为 {}），未知异常 500。

### Migration Rewrite

- 改名 `20260712070000_slice_d_cloud_sync.sql`
- `client_id` CHECK length 1-256；`reason_tags` → `text[]` with CHECK
- 原子 20 上限触发器（`check_config_limit` + `pg_advisory_xact_lock`）
- 移除冗余索引，保留 `idx_favorites_owner_saved`
- Import batch limit: 200

### Verification

- Server 193/193 ✅ | Client 92/92 ✅ | 双端 tsc --noEmit ✅
- `supabase db push --linked --dry-run`：仅 `20260712070000_slice_d_cloud_sync.sql`

## 2026-07-12 — Slice D：收藏/品牌/配置云同步（✅）

### Added

- **Migration** `20260713000000_slice_d_cloud_sync.sql`：3 张新表 `favorites`、`saved_configs`、`brand_profiles`，全部 RLS 保护、owner-scoped、索引与约束
- **Backend service** `cloudSyncService.ts`：bootstrap、收藏/配置 CRUD、品牌资料 upsert、幂等批量导入；sanitizeOverpost 防护
- **Backend routes** `sync.ts`：7 个端点（全部 requireAuth），输入长度/枚举/rating/JSON 校验，MAX_SAVED_CONFIGS=20 守卫
- **Backend tests** `sync.test.ts`：37 个测试（auth gate 8、CRUD 12、import 4、validation 10、sanitized errors 1）
- **Frontend service** `cloudSync.ts`：17 个导出函数，API 调用 + 数据转换 + 旧全局 key 检测与计数
- **Frontend test** `slice-d.test.tsx`：39 个测试（API 12、conversion 8、legacy 10、error 4、auth 5）
- **useCloudSync hook**：hydration 编排（云端合并 + 本地自动导入 + 旧 key 检测）+ fire-and-forget 变更同步 + 非阻断错误
- **CloudSyncGate**：hydration loading 态 + 旧数据导入 banner + 同步错误提示
- **AppContext**：新增 syncStatus、syncError、legacy info 状态 + 7 个 sync action

### Verification

- Server Vitest: **193/193** (156 existing + 37 sync)
- Client Vitest: **92/92** (53 existing + 39 slice-d)
- Server `tsc --noEmit`: ✅ 0 errors
- Client `tsc --noEmit`: ✅ 0 errors
- `supabase db push --dry-run`: ✅ 仅预览 Slice D Migration
- `git diff --check`: ✅ 无空白问题
- 安全扫描：0 secrets/tokens/keys in new code

### Known Limits

- Migration 未推送（需用户授权）
- 真实双浏览器 RLS 测试需人工验证
- 云端同步是 fire-and-forget（无重试队列）

## 2026-07-12 — Slice C2b 远端额度闭环 + 账户本地数据隔离（✅）

- 已推送 `20260712000000_slice_c2a_trusted_write_quota.sql`：Free 每 7 天 20 次，Pro 每自然月 400 次 / ¥19。
- 旧账号自动补 Free 订阅；新注册账号由 `handle_new_user` 同事务创建 profile、role、subscription。
- `generation_jobs` 浏览器写权限关闭；额度 RPC 仅可信服务角色可执行；`usage_ledger` 保持只追加。
- 修复两个终审问题：ledger 无 UPDATE 权限时不再 `FOR UPDATE` 锁 ledger；旧周期 reservation 释放不再影响新周期额度。
- 远端事务回滚验收覆盖 reserve / consume / release / 幂等 / 冲突 / 跨周期；RLS 实测通过。
- 修复同浏览器切换邮箱时共享收藏：收藏、设置、保存配置按 Supabase `user.id` 分区；旧无归属 key 不自动迁移。
- 工作台右上角新增“复原配置”：结构化关、自由度 1、粤语 4、中英 1、无目标用户。
- 验证：Server 156/156、Client 53/53、双端 build 通过；本地服务已重启在 `http://localhost:5175`。

## 2026-07-11 — Slice C2a Final Fix：7 项边界修复（第三轮，✅ 本地通过）

### Fixed (7 Boundary Issues)

1. **reserve_quota 同键并发幂等边界** — FOR UPDATE 锁获取后再次查询 idempotency；并发同键第二请求不再因 quota_used 已满而返回 null
2. **consume/release terminal 冲突检测** — 查询已存在 terminal 的 event_type：同 transition→true（幂等），相反→false（冲突，如 consume-after-release）
3. **reserve_quota 有效周期校验** — 添加 `current_period_end > now()` 条件，过期订阅不可预占
4. **uncertain 202 守卫 jobId+reservation** — 仅 `uncertain && jobId && reservation` 返回 202；预占前/任务前的网络错误走普通 500，不 release（无 reservation 可释放）
5. **已停用 key 名清除** — 已停用 legacy key 精确名从源代码、测试、spec、planning、evidence-fix 全部移除；adapter 只读 `SUPABASE_SECRET_KEY`；Migration 不再提及应用环境变量
6. **显式 service_role grant** — `grant select, insert, update on public.generation_jobs to service_role`，不依赖 C1 继承
7. **未确认业务默认值移除** — plans 删 price_cny/quota_per_cycle/cycle_days default，加 CHECK（>=0；cycle_days null 或 >0）；subscriptions 加 quota_used>=0 CHECK 和 status IN 约束；不 seed

### Verification

- Server Vitest: **154/154 passed**（6 me + ~98 generations + 27 quota + ~23 migration）
- Client Vitest: **49/49 passed**
- Client `tsc --noEmit`: pass
- Server `tsc --noEmit`: pass
- Client build: pass（616 KB JS, 78 KB CSS）
- Server build: pass
- rg 已停用 key 精确名：源代码/测试/spec/planning/evidence-fix = 0；旧 slice-C2a-local 历史证据 = 不改
- 证据：`docs/evidence/2026-07-11/slice-C2a-fix/`

### Pending

- **Migration NOT pushed** — 需要用户授权 `npx supabase db push`
- **`SUPABASE_SECRET_KEY` NOT configured** — 需在 `server/.env` 中设置
- **价格/额度/周期 NOT decided** — Migration 不含业务默认值

## 2026-07-11 — Slice C2a Fix：原子 RPC + 追加账本 + 7 项阻断修复（✅ 本地通过）

### Fixed (7 Blocking Issues)

1. **reserve 非原子** → `reserve_quota` RPC: FOR UPDATE lock + balance check + INSERT + quota_used increment 在同一事务
2. **ledger 非追加** → consume/release 改为 INSERT 新 terminal 事件（`reservation_id` 自引用），永不 UPDATE/DELETE 原 reserve 行
3. **release TOCTOU fallback** → 删除 TS 端 fallback；`release_quota` RPC 原子递减 quota_used
4. **legacy key 命名** → adapter 只读取 `SUPABASE_SECRET_KEY`（adapter、测试、文档全部更新）
5. **未知超时处理** → generate.ts 区分已知业务失败（failJob + release）与不确定错误（keep processing + 202）
6. **死码 SECURITY DEFINER 函数** → 删除 complete/fail/mark 3 个含 `auth.uid()` 的 SECURITY DEFINER；BFF 用 service_role 直接 UPDATE + owner_id WHERE
7. **文档失真** → ACCEPTANCE/CHANGELOG/findings 不再声称"已知 medium 但完成"

### Added (vs original C2a)

- `usage_ledger.reservation_id` 自引用列 + `chk_terminal_has_reservation` CHECK 约束
- `idx_ledger_one_terminal_per_reservation` 部分唯一索引（每 reservation 最多一个 terminal 事件）
- `idx_ledger_reservation` 索引
- 3 个原子 RPC 函数：`reserve_quota(_user_id, _idempotency_key)`, `consume_quota(_user_id, _reservation_id)`, `release_quota(_user_id, _reservation_id)`
- 所有 RPC: SECURITY INVOKER, `search_path = ''`, 显式 `_user_id` 参数, 仅 service_role EXECUTE；现代 secret 以 service_role 执行，无需 owner 权限
- `UNCERTAIN_ERROR_PATTERNS` 分类逻辑（timeout/ECONNRESET/AbortError 等）
- SUPABASE_SECRET_KEY 仅读；legacy key 显式忽略测试

### Removed

- 3 个 SECURITY DEFINER job 函数（complete_generation_job / fail_generation_job / mark_processing_job）— 死码
- `decrement_quota_used` RPC 引用 — 已内联到 `release_quota` RPC
- quotaService 中的 TOCTOU fallback 路径（SELECT-then-UPDATE）

### Verification

- Server Vitest: **143/143 passed**（6 me + ~87 generations + 30 quota + 4 key naming + ~16 C2a migration）
- Client `tsc --noEmit`: pass
- Server `tsc --noEmit`: pass
- Client build: pass（616 KB JS, 78 KB CSS）
- Server build: pass
- 证据：`docs/evidence/2026-07-11/slice-C2a-fix/`

### Pending

- **Migration NOT pushed** — 需要用户授权 `npx supabase db push`
- **`SUPABASE_SECRET_KEY` NOT configured** — 现代密钥名，需在 `server/.env` 中设置
- **价格/额度/周期 NOT decided** — Migration 中均为默认值 0
- C2a 本地全部通过；下一步 C2b 远端应用（需用户授权 push + secret 配置）

## 2026-07-11 — Slice C1 Patch v2：Soft-Delete RLS 修复 + TOCTOU 原子硬化（独立复测 → 通过 dry-run）

### Fixed

**v1 → v2：** SECURITY DEFINER RPC 先 SELECT `owner_id` 再独立 UPDATE，两语句之间存在 TOCTOU 窗口。安全函数不应依赖先查后改。

**v2 修复：** 删除 `_owner_id` 变量和预查询，一条原子语句完成：

```sql
update public.generation_jobs
set deleted_at = now(), updated_at = now()
where id = _job_id
  and owner_id = auth.uid()
  and deleted_at is null;
return found;
```

### Verification

- Server Vitest: **65/65 passed** (+2 atomic assertions: 3-condition UPDATE WHERE, no `SELECT INTO _owner_id`)
- Client Vitest: 49/49 (no regression)
- Server tsc + build: pass
- `npx supabase db push --dry-run`: **only `20260711223000_fix_generation_soft_delete.sql`**
- 证据：`docs/evidence/2026-07-11/slice-C1-patch/`

### Pending

- **Patch migration NOT pushed.** 主 Migration `20260711213000` 已推送远端。

## 2026-07-11 — Slice C1 Patch v1：Soft-Delete RLS 修复（已被 v2 取代）

### Fixed

**远端事务验收发现：** `update generation_jobs set deleted_at=now()` 以本人 JWT 执行时失败：`42501 new row violates row-level security policy for table generation_jobs`。

**根因：** UPDATE RLS policy 的 `WITH CHECK` 在远程 Supabase 上拒绝软删除操作（NEW row 的 `deleted_at` 变更与 policy 的检查逻辑冲突）。

**修复：** 新建 `20260711223000_fix_generation_soft_delete.sql` — SECURITY DEFINER RPC 替代直接 UPDATE：

```sql
create or replace function public.soft_delete_generation_job(_job_id uuid)
returns boolean language plpgsql security definer set search_path = ''
```

- 内部强制 `auth.uid() is not null` + `owner_id = auth.uid()` + `deleted_at is null`
- 所有对象全限定名 (`public.generation_jobs`)
- REVOKE from public/anon; GRANT EXECUTE to authenticated, service_role
- `generationJobsService.softDeleteJob` 改为调用 RPC，返回 `Promise<boolean>`
- Route: false → 404（跨用户不可区分），错误 sanitised

### Verification

- Server Vitest: **63/63 passed** (+18 patch tests)
- Client Vitest: **49/49 passed** (no regression)
- Client/Server `tsc --noEmit`: pass
- Client build: pass (616 KB JS, 78 KB CSS)
- Server build: pass
- `npx supabase db push --dry-run`: **only `20260711223000_fix_generation_soft_delete.sql`** previewed
- 证据：`docs/evidence/2026-07-11/slice-C1-patch/`

### Pending

- **Patch migration NOT pushed.** Main migration `20260711213000` is already applied remotely.
- Push command: `npx supabase db push` (applies only the patch).

## 2026-07-11 — Slice C1 v4：客户端响应鉴别 + 轮询 + 重试（独立复测 → 通过）

### Fixed (1 项阻断项全部修复)

**阻断项：客户端盲 cast 导致不完整对象进入 UI**

`client/src/services/api.ts::generateCopy` 对所有 2xx 直接 cast 为 `GenerateResponse`，`useGenerate` 随后 dispatch `SET_RESULTS`。当服务端返回 202（pending/processing）或 200 `body.status='failed'` 时，缺少 `diagnosis/variants/audit` 的对象被写入 `AppState`，UI 收到不完整数据。

### Changed

1. **Discriminated response types** (`client/src/types/index.ts`) — 新增 `GenerateSuccessBody`、`GeneratePendingBody`、`GenerateFailedBody`、`GenerateApiResponse`。禁止盲 cast。
2. **`generateCopy` 重写** (`client/src/services/api.ts`)：
   - 签名改为 `(request: GenerateRequest, idempotencyKey: string)` — key 作为独立参数
   - 网络传输错误自动重试一次，**复用同一个 idempotencyKey**
   - HTTP 202 → 通过 `GET /api/generations/:id` 轮询（指数退避 1s→2s→4s→8s→16s，上限 120s）
   - HTTP 200 `body.status='failed'` → 立即抛错
   - 轮询超时 → 抛错并附带 `jobId` 供历史页恢复
   - Transient 网络错误在轮询中被吞掉，仅 job-level failed 向上抛
3. **`useGenerate` 修正** (`client/src/hooks/useGenerate.ts`)：
   - 每次用户点击生成新 key；`generateCopy` 内部重试用同 key；注释与行为一致
   - `crypto.randomUUID()` 保留 RFC 4122 v4 fallback
   - 移除未使用的 `idempotencyKeyRef`
4. **新增 11 个客户端测试** (`client/src/test/slice-c1.test.tsx`)：
   - `generateCopy` 直接测试（mock fetch）：网络重试同 key、200 failed 抛错、202 轮询 completed/failed/超时
   - `useGenerate` dispatch 测试（mock generateCopy）：SET_RESULTS 完整数据、SET_ERROR 永不触发 SET_RESULTS、key 按点击再生
   - Fake-timer 测试无 act warning
5. **文档更新** — ACCEPTANCE 新增 19 项 C1v4 标准 + 已知限制；CHANGELOG v4 条目；status/progress 更新

### Verification

- Client Vitest: **49/49 passed**（12 slice-a + 15 slice-b + 11 slice-c1 + **11 C1v4**），0 unhandled rejections
- Server Vitest: **45/45 passed**（无变化）
- Client `tsc --noEmit`: pass
- Server `tsc --noEmit`: pass
- Client build: pass（616 KB JS, 78 KB CSS）
- Server build: pass
- 证据：`docs/evidence/2026-07-11/slice-C1-v4/`

### Pending

- 远端 Migration **未推送**（`20260711213000_slice_c1_generation_jobs.sql`）
- 真实 RLS 隔离须 push 后验证
- `grant update` 风险须在 C2 引入额度前修复

## 2026-07-11 — Slice C1 v3：验收修复（独立复测 → 通过，已被 v4 取代）

### Fixed (9 项验收问题全部修复)

1. **Migration 版本排序** — 从 `20260711000001` 重命名为 `20260711213000`，晚于远端已应用的 `20260711170000_harden_role_helpers`。
2. **生成流真正接入** — `POST /api/generate` 添加 `requireAuth`，调用模型前原子创建 generation_jobs（`processing`），成功后保存完整 GenerateResponse，失败后调用 `failJob`。
3. **原子幂等** — `upsertJob` 改用 INSERT ... ON CONFLICT 模式，消除 check-then-insert 竞态。并发同 key 只创建一个 job、模型最多调用一次。
4. **重复请求行为明确** — completed→200 返回已有结果；processing/pending→202 返回可恢复状态；failed→200 返回 error+retryHint。
5. **输入验证** — source/平台/tone/参数验证（继承原有）；新增 UUID 格式、idempotencyKey 格式/长度、limit 1-100、offset ≥0。全部非法请求返回 400。
6. **PATCH 已移除** — 原 `PATCH /api/generations/:id` 可让客户端伪造任意 status/results；现返回 404。状态变迁仅通过服务端 `POST /api/generate` + `completeJob`/`failJob`。
7. **Header 历史入口 + 详情页** — Header 增加 Clock 图标"历史"链接；新增 `HistoryDetailPage`（`/app/history/:id`），展示五类结果+状态+错误+原始简报，支持返回历史列表和删除。
8. **测试不再是纯 mock service** — 服务端测试改为 mock Supabase client 的 `.from()` 层级，验证 INSERT...ON CONFLICT 原子分支、输入验证 400、重复请求语义（200/202/retryHint）。新增 10 项 Migration 静态安全断言。客户端测试新增 6 项 HistoryDetailPage 行为测试。
9. **安全风险评估** — 记录 `grant update` to `authenticated` 风险：浏览器可绕过 BFF 直接篡改自有 job 的 status/results。C1 可接受（无额度/支付消费 job status），C2 须实施 trusted-write（SECURITY DEFINER + service_role + 撤销 authenticated update）。

### Verification

- Client Vitest: **38/38 passed**（+6 slice-c1 detail page），0 act warnings
- Server Vitest: **45/45 passed**（+21 generations tests：10 migration assertions + 5 auth gate + 11 validation + 4 atomic idempotency + 6 CRUD + 2 duplicate semantics + 2 owner isolation + 1 PATCH-removed + 4 input validation）
- Client `tsc --noEmit`: pass
- Server `tsc --noEmit`: pass
- Client build: pass（615 KB JS, 78 KB CSS）
- Server build: pass
- 安全扫描：0 service_role / secret / admin bypass
- 证据：`docs/evidence/2026-07-11/slice-C1-v3/`

### Pending

- 远端 Migration **未推送**（`20260711213000_slice_c1_generation_jobs.sql`）
- 真实 RLS 隔离须 push 后验证
- `grant update` 风险须在 C2 引入额度前修复

## 2026-07-11 — Slice C1：generation_jobs + history + owner RLS（本地实现，已被 v3 取代）

### Added

- **Migration**: `20260711000001_slice_c1_generation_jobs.sql`（本地，未推送）
  - 表：`generation_jobs` — id, owner_id, idempotency_key, status enum, source, platform, tone, levels, brief(jsonb), variants(jsonb), diagnosis(jsonb), audit(jsonb), scores(jsonb), consumer_feedback(jsonb), error, timestamps, deleted_at
  - 约束：UNIQUE(owner_id, idempotency_key)，幂等创建
  - RLS：owner-scoped SELECT/INSERT/UPDATE，无 DELETE policy（软删除通过 UPDATE deleted_at）
  - 索引：owner_id+created_at desc, owner_id+status, deleted_at partial
- **Server**: generation jobs service (`generationJobsService.ts`) — upsertJob, completeJob, listJobs, getJob, softDeleteJob。使用 user-scoped Supabase client（JWT）执行 RLS 查询。
- **Server routes** (`/api/generations`):
  - `POST` — 创建/幂等检索 job
  - `GET` — 分页列表（summary，不含 jsonb）
  - `GET /:id` — 详情（含所有字段）
  - `PATCH /:id` — 更新状态/结果
  - `DELETE /:id` — 软删除（owner 检查）
  - 全部由 `requireAuth` 保护
- **Client**: HistoryPage (`/app/history`) — 加载态/空态/错误态/列表/删除，遵循设计系统（dark/light）。App 路由已接入。
- **Client types**: GenerationJob, GenerationJobSummary, API response types
- **Client API**: getAuthHeaders (JWT from session), create/list/get/delete generation jobs

### Verification

- Client Vitest: **32/32 passed**（+5 slice-c1），0 act warnings
- Server Vitest: **24/24 passed**（+18 generations tests：6 auth gate + 12 functional/isolation）
- Client/Server `tsc --noEmit`: pass
- Client build: pass（603 KB JS, 77 KB CSS）
- Server build: pass
- 安全扫描：0 service_role / secret / admin bypass
- 证据：`docs/evidence/2026-07-11/slice-C1/`

### Pending

- 远端 Migration **未推送**。命令：`npx supabase db push`
- 生成流尚未接入 generation_jobs 持久化（`/api/generate` 不保存到 DB）
- HistoryPage 导航链接未加入 Header

## 2026-07-11 — Slice B 验收修复 v2（act 警告 + 行为测试）

### Fixed

- **消除全部 React act(...) 警告**：所有页面测试添加 `awaitAuthReady()` helper，等待 AuthProvider 异步 `getSession()` dispatch 完成；`AuthContext` 导出以支持 Provider 直注测试。
- **新增 6 个行为测试**（`slice-b.test.tsx` Suite 5–7）：
  - resetPassword 成功/失败 → isLoading 复位 / 不显示"已发送"
  - updatePassword 失败 → 不显示"密码已重置"
  - 普通 SIGNED_IN Session → 重置页面拒止
  - PASSWORD_RECOVERY Session → 重置表单可用
  - AuthCallback 已有已确认 Session → 成功跳转
- **Client tsconfig**：添加 `typeRoots` 修复 workspace hoisting 导致的 `superagent` 类型解析错误（TypeScript 5.9.3）。
- **Root package.json**：添加 `vitest` devDependency 修复 `@testing-library/jest-dom` hoisting 无法解析 `vitest` 的问题。

### Verification

- Client Vitest: **27/27 passed**（12 slice-a + 15 slice-b），**0 act warnings** in stderr
- Server Vitest: 6/6 passed
- Client/Server `tsc --noEmit`: pass
- Client build: pass（599 KB JS, 76 KB CSS）
- Server build: pass
- 证据：`docs/evidence/2026-07-11/slice-B-acceptance-v2/`

### Pending

- 真实邮箱收信 B.17–B.24 人工验证

## 2026-07-11 — Slice B 真实 Auth 接入（验收修复 v1）

### Changed

- **AuthContext** 完全重写：对接真实 Supabase Auth（signUp/signInWithPassword/signOut/resetPasswordForEmail/updateUser）。
- `resetPassword`/`updatePassword` 返回 `Promise<boolean>` 明确成功/失败；`isLoading` 在所有路径复位。
- **ResetPasswordPage**：新增 `PASSWORD_RECOVERY` 事件验证，拒绝普通登录 Session 访问。
- **ForgotPasswordPage**：仅在 `resetPassword` 返回 true 时显示"已发送"。
- **AuthCallback**：新增 `getSession()` 主动检查，避免错过已存在的验证 Session。
- **Server dotenv**：移至 `index.ts` 顶层（动态 import 保证先于模块树初始化）；`supabase.ts` 改为 lazy init。
- **Server 测试**：新增 vitest + supertest，6 测试覆盖 `/api/health`、`/api/me` 四种 401 场景及启动。
- **vite-env.d.ts**：`VITE_SUPABASE_ANON_KEY` → `VITE_SUPABASE_PUBLISHABLE_KEY`。
- **`.env.example`**：清空所有真实密钥值，仅保留占位说明。
- 删除 `supabase-stub.d.ts`（client + server 双份）。
- 从根 `package.json` 移除 `@supabase/supabase-js`。

### Verification

- Client Vitest: 21/21 passed, 0 act warnings。
- Server Vitest: 6/6 passed（health + 401×4 + bootstrap）。
- Client/Server `tsc --noEmit` 通过。
- Client/Server build 通过。
- Server 启动确认：`[env] loaded .env` → port 3001。
- 安全扫描：0 `service_role`/`secret_key`/`supabaseAdmin`/`[MOCK]`/明文密码。
- 证据：`docs/evidence/2026-07-11/slice-B-acceptance/`

### Pending

- 需要真实邮箱收信完成 B.17–B.24 人工验证。

## 2026-07-11 — Slice B 角色函数安全补丁

### Changed

- 将 RLS 角色辅助函数迁入未暴露的 `private` schema。
- 删除 `public.has_role/public.has_any_role` RPC 暴露面并重建关联策略。

### Verification

- 远端已记录 `20260711170000_harden_role_helpers`。
- Supabase Security Advisors：0 findings。

## 2026-07-11 — Slice B 首次远端 Migration

### Added

- 远端创建 `profiles`、`user_roles`、`audit_log`、注册触发器与 RLS。
- 准备后续安全 Migration，将角色辅助函数移出公开 RPC schema。

### Verification

- 远端 Migration `20260711000000_slice_b_schema` 已记录。
- 三张表均显示 `rls_enabled: true`。
- 安全顾问的两条 public SECURITY DEFINER 警告尚待后续 Migration 消除。

## 2026-07-11 — Slice B Migration 安全修复（未部署）

### Changed

- 收紧 `profiles/user_roles/audit_log` 的 RLS、列权限和函数执行权限。
- 角色范围固定为 `user/admin/super_admin`；浏览器不能直接修改角色。
- 审计写入改为后端可信通道负责，普通用户不能伪造审计事件。
- 用户删除时审计记录保留，但 `actor` 置空，避免阻止账户清理。

### Verification

- `npx supabase db push --dry-run` 通过，仅预览一份 Slice B Migration，未修改远端数据库。

## 2026-07-11 — Slice A 独立验收复核

### Verification

- Client/server TypeScript 与 build 通过。
- 浏览器验证未登录保护、Mock 标识、注册写入和工作台进入通过。

### Reopened

- Slice A 验收修复完成（2026-07-11）：重置密码假成功、ThemeContext 统一主题、亮色 orange 品牌色、表单 a11y、登录标题孤行、12 个行为测试全部通过。

### Fixed

- ResetPasswordPage: mockResetPassword 返回 boolean，页面检查返回值后才 setSuccess。
- ThemeContext: 创建全局单一主题源，Auth 页面不再各自读取 localStorage。
- Workbench 亮色品牌色：Tabs/SegmentedControl/Slider/Spinner/Badge/InputPanel CTA 新增 `light:orange-*`。
- Auth 表单 a11y：全部 label 加 htmlFor、input 加 id、error 加 role=alert + aria-describedby。
- 登录标题：max-w-md→max-w-xl、clamp 降低、text-wrap:balance 消孤行。
- 行为测试：Vitest + Testing Library + 12 个测试覆盖核心流程。

### Environment

- `5173` 被旧 `D:\work\思念\client` 占用；本轮在 `http://localhost:5175` 验收。

## 2026-07-11 — Slice A：正式路由 + 账户 Mock 壳

### Added

- Mock 认证系统：AuthContext（useReducer + localStorage），支持登录/注册/退出/重置密码。
- 认证页面：LoginPage、SignupPage、ForgotPasswordPage、ResetPasswordPage。
- 共享 AuthLayout：左右分栏布局，CSS 渐变动画背景（模拟总览 DarkVeil），深色/浅色双模式。
- 正式路由：`/`、`/login`、`/signup`、`/forgot-password`、`/reset-password`、`/app`（受保护）。
- ProtectedRoute：未登录访问 `/app` 自动跳转 `/login`；刷新保留会话。
- Header 退出登录按钮。

### Changed

- App.tsx：从简单 pathname 分流改为完整 path-based 路由。
- Header.tsx：新增可选 `onLogout` / `userEmail` props（向后兼容）。
- index.css：新增 `.auth-bg-animate` 关键帧动画。

### Verification

- Client TypeScript + Vite 构建通过（1639 modules, 2.19s）。
- Server TypeScript + 构建通过。
- 所有 5 个路由可访问，Mock 标记可见。
- 现有工作台 `/app` 无回归。

### Known Limits

- Auth 完全是 localStorage Mock；密码明文存储（已标记 MOCK）。
- DarkVeil 是 CSS 渐变近似，不是 WebGL canvas。
- 零新增依赖。

## 2026-07-11 — SaaS 项目交接与执行基线

### Added

- 建立项目内 `spec/`、`.planning/`、验证命令和 Claude Code 交接入口。
- 固化 SaaS MVP 页面、数据、Auth、支付、后台和严格测试范围。
- 新增父目录项目总入口、页面进度表和第一阶段执行单。

### Changed

- 最终产品宿主从“待决定”固定为 `77`。
- `总览` 降为登录视觉、Auth/RLS/审计模式参考，不再作为待迁移主应用。
- 开发顺序调整为：账户 Mock → 真实 Auth/RLS → 任务数据 → 云收藏/品牌 → 支付 Mock → 支付宝沙箱 → 后台。

### Verification

- `77/client` TypeScript 检查通过。
- `77/server` TypeScript 检查通过。
- `总览` 生产构建失败，已记录依赖解析问题并排除为主基线。

### Known Limits

- 未实现真实 Auth、数据库、支付或管理员。
- 存在待用户处理的疑似密钥暴露风险。


## Proposed - 2026-07-12 - 参考收藏案例入口在无四星收藏时消失

- Type: bug
- Risk: low
- Why: 用户无法发现该能力及其启用条件
- Verification: 无收藏状态下可找到折叠入口和空状态说明
- Evidence: client tests 119/119 and build passed


## Proposed - 2026-07-12 - 用户反馈中心与管理员微信通知

- Type: feature
- Risk: high
- Why: 早期用户可提交需求、Bug和其他建议，管理员能及时获知
- Verification: 覆盖成功、无权限、限流、非法输入、通知失败和跨用户隔离
- Evidence: strict: API tests, RLS tests, redacted notification evidence, UI screenshot


## Proposed - 2026-07-12 - 工作台 Header 信息架构收纳

- Type: change
- Risk: medium
- Why: 右上角功能横排过多，降低识别效率
- Verification: Header 菜单行为与原有功能无回归
- Evidence: strict UI screenshot and behavior tests


## Proposed - 2026-07-12 - 反馈提交返回 Internal server error

- Type: bug
- Risk: high
- Why: H1 Migration 未应用且通知状态写回与 SendKey 解析存在阻断
- Verification: 真实表/RLS前置、trusted写回、SendKey=格式、限流和通知失败不丢数据
- Evidence: strict server tests, dry-run, redacted ServerChan result


## Proposed - 2026-07-12 - 进入生成历史后工作台结果丢失

- Type: bug
- Risk: medium
- Why: 工作台状态只在内存中，整页路由导航会重建 AppProvider
- Verification: owner-scoped session snapshot round-trip and account isolation
- Evidence: client behavior tests and browser smoke


## Proposed - 2026-07-12 - 从生成历史载入工作台

- Type: feature
- Risk: medium
- Why: 用户需要继续编辑、复用过去生成的完整结果
- Verification: completed job loads; incomplete/failed job cannot masquerade as usable result
- Evidence: client behavior tests and browser smoke


## Proposed - 2026-07-12 - 四星收藏参考案例在工作台不可发现

- Type: bug
- Risk: low
- Why: 用户已有两条四星收藏，但生成区无法确认或选择参考案例；现有测试只验证入口存在，未覆盖云端水合与可用案例列表
- Verification: TBD
- Evidence: TBD


## Proposed - 2026-07-12 - 节日话题未覆盖五个平台版本

- Type: bug
- Risk: low
- Why: 用户在话题日历选择节日后，实际输出只有Shorts提及；全局Prompt虽存在强制指令，但缺少五版本输出覆盖验证与防回归测试
- Verification: TBD
- Evidence: TBD


## Proposed - 2026-07-12 - 官网Pricing与结算转化链路未接通

- Type: bug
- Risk: low
- Why: Pricing是孤立路由，官网套餐预览没有进入Pricing的链接，未登录用户点击Pro后也不能在登录后返回结算页
- Verification: TBD
- Evidence: TBD


## Proposed - 2026-07-12 - 已开发功能规格沉淀与防覆盖门禁

- Type: change
- Risk: low
- Why: 连续切片可能在新增页面或功能时弱化既有参考案例、话题注入、Header信息架构和转化链路
- Verification: TBD
- Evidence: TBD
