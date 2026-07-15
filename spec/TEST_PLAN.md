# TEST PLAN：77港话通 SaaS MVP

> 待开发测试范围：工作台内容控制与个人案例库。以 spec/WORKBENCH_CONTENT_CONTROLS.md 第 6 节的 W1–W4 验收矩阵为准；远端 Migration/RLS 需单独授权。

## 固定命令（Phase 0 起）

安装与构建分离；**禁止**在 `build` 内执行 `npm ci`。

```powershell
# 依赖变更后
npm ci
# 或
npm run install:all

# 单元 / 行为
npm run test:client    # 期望 ≥358（含 apiBase）
npm run test:server    # 期望 ≥521（含 CORS + alipayUrls）

# 类型与生产构建
npm run typecheck
npm run build

# 安全门禁
npm run audit:prod     # 无 high/critical
npm run audit:all      # 无 high/critical

# 一键（含 audit）
npm run verify

# 可选：公开页 smoke（需先 dev:client + playwright install chromium）
npm run test:e2e:smoke
```

等价分项：

```powershell
cd client; npx vitest run; npx tsc --noEmit; npm run build
cd server; npm test; npx tsc --noEmit; npm run build
```

Playwright 仅 Phase 0 smoke；完整业务 E2E 见 `docs/release/2026-07-14-playwright-smoke-plan.md` 与 production-launch-plan Phase 2。新增付费服务或强制升级依赖档位前必须用户同意。权威命令表：`scripts/verify/commands.md`。

## Phase 0 发布基线回归

- Client ≥353、Server ≥509；双端 typecheck/build。
- `npm audit` 与 `npm audit --omit=dev` 无未处置 high/critical。
- W2 本地 migration version 对齐 `20260714052140` / `20260714052414`；未授权不做 repair/push。
- 证据：`docs/evidence/2026-07-14/phase0-production-baseline/`。

## R1 — 审核分组 + 管理员收藏批注（2026-07-14）

### Migration 静态/契约

- `profiles.review_group` CHECK + 索引存在。
- `favorite_admin_reviews` 表/RLS/owner SELECT/同组 admin SELECT/super_admin SELECT 存在。
- authenticated 无 review 写权限。
- `admin_update_favorite_review` 仅 grant service_role；PUBLIC/anon/authenticated revoke。
- RPC 校验 admin 角色与同组，同函数写 review + audit。

### Server

- group1 admin 列表/count 仅同组；越组搜索不泄漏。
- 未分组 admin 空列表；super_admin 全量。
- group1 访问 group2 favorite → 404，无 audit/body。
- 同组详情顺序 scope → audit → body。
- review 写：成功 / 空意见 400 / 超长 400 / 越组 404 / 普通用户 403 / 清除成功。
- 写路径走原子 RPC，route 不分别写 review/audit。
- 列表仍不返回 content。

### Client

- 管理员详情可保存已采纳/需修改；加载/成功/失败状态正确；列表 chip 更新。
- 用户收藏卡显示审核意见（折叠可见）；无 review 不显示空框。
- `favoriteRecordToBookmark` 保留 review；`bookmarkToSyncFavorite` 不发送 review。
- 首页出现电话与 `tel:` 链接。

### 命令

```powershell
npx vitest run src/__tests__/review-groups-migration.test.ts src/__tests__/review-groups-admin-notes.test.ts
# client
npx vitest run src/test/slice-review-groups-admin-notes.test.tsx
npm run test:client
npm run test:server
npm run typecheck
npm run build
```

远端 migration **未执行**。证据：`docs/evidence/2026-07-14/review-groups-admin-notes/`。

## 2026-07-14 本地 Vercel readiness + 官网滚动 smoke

| 区域 | 命令 / 检查 | 期望 |
| --- | --- | --- |
| E2E smoke | `npm run test:e2e:smoke`（先 `dev:client`） | 首页 HTTP；分段滚动后全部 `[data-reveal]` 为 `is-in` 且 opacity≠0；不硬编码节点数 29 |
| Client apiBase | `npx vitest run src/test/apiBase.test.ts` | 相对 `/api` 默认；`VITE_API_BASE_URL` 拼接；不双写 `/api` |
| Server CORS | `cors.test.ts` | 允许本地/配置 origin；拒绝未授权；无 Origin 允许 |
| Server alipayUrls | `alipayUrls.test.ts` | 分域 return/notify；显式 URL 优先；sandbox fail closed |
| JSON | `client/vercel.json`、`server/vercel.json` | 合法 JSON；无 secret |
| Secret scan | 本轮新增配置/证据 | 无 private key / sendkey / service_role 形态 |
| 全量 | `npm run verify` | test + typecheck + build + audit |

证据：`docs/evidence/2026-07-14/local-vercel-readiness/verification.md`。

## 证据策略

| 区域 | 等级 | 最小证据 |
|---|---|---|
| 文档/索引 | basic | diff/进度记录 |
| 官网/工作台 UI | strict UI | 构建、桌面截图、交互/焦点说明 |
| Auth/Session/RLS | strict | 行为测试、浏览器证据、User A/B 隔离 |
| 生成持久化/额度 | strict | API/DB 状态、失败释放、幂等 |
| 支付/Webhook | strict | 沙箱请求、验签、重放、订单和权益状态 |
| 管理员/审计 | strict | 非管理员拒绝、正文访问/删除审计 |

## 2026-07-13：收藏卡片品牌/产品展示

- 使用一条含品牌名、产品名和 IG 平台的收藏记录渲染 `FavoritesPanel`。
- 断言 `思念 · 煎饺王` 存在、使用暗色 `text-red-400` 与亮色 `light:text-red-600`，并在 DOM 顺序上位于高亮 `IG` 标签之前。
- 运行完整 Client Vitest 与 production build，确认收藏、参考案例和其他工作台功能不回归。

## Slice A：账户壳 Mock

- `/`、`/login`、`/signup`、`/forgot-password`、`/reset-password` 可访问。
- 未登录访问 `/app` 重定向 `/login`。
- 合法 mock 登录后返回 `/app`；刷新恢复；退出后受保护页再次重定向。
- 非法邮箱、密码规则、必填、loading、disabled、错误和成功状态可见。
- 现有工作台仍渲染；生成相关类型检查和构建不回归。
- 截图：1440、1024、窄桌面；登录 loading/错误/成功三态。

## Slice B：真实 Auth 与 RLS

- 注册、邮箱验证、登录、错误密码、退出、忘记/重置、过期 session。
- 重复邮箱和注册限频有清晰错误。
- 公开注册无法指定 admin 或 plan。
- User A 不能读取/修改 User B 的 profile、task、favorite、brand。
- non-admin 不能访问 `/api/admin/*`。
- service role 不出现在浏览器 bundle、日志或证据中。

## Slice C/D：任务、历史、收藏与额度

- 同一幂等键只创建一个任务。
- 无额度不调用模型；预占、消费、失败释放与超时 reconciliation 正确。
- 刷新恢复 pending/running；成功显示 5 类结果；失败可重试且不重复扣额。
- 删除正文后用户常规查询不可见；审计/支付记录不随正文误删。
- localStorage 导入幂等；收藏和配置跨设备；参数恢复不修改原任务。

## Slice E：套餐/订单/支付 Mock

- 定价页展示 Free/Pro 双卡、价格、配额、功能和 [MOCK] 标签。
- 结算页受保护，显示当前套餐、使用进度条、升级 CTA 和订单记录。
- 结算页支持 loading/empty/error/列表 四种状态。
- 支付结果页（成功/取消）显示订单摘要和 [MOCK] 标签。
- 服务端 entitlements/checkout/orders 端点通过 requireAuth 保护。
- checkout 校验 planId；拒绝 Free→Free；拒绝 Pro→Free。
- GET orders 按 userId 隔离；GET orders/:id 拒绝非所有者访问。
- GET /api/billing/plans 公开无需鉴权。
- 所有 API 响应和页面均含 isMock 或 [MOCK] 标记。
- 不走真实支付宝、不写 DB Migration、不创建远端订单、不修改真实 subscription/usage。
- 证据等级：strict mocked billing — server/client 测试、TS/build 验证。

## Slice E/F：支付

- 前端篡改 plan/amount 不影响服务端订单金额。
- success/cancel 跳转页不直接授予权益。
- 无效签名、错误金额、错误商户、未知订单、closed/refunded 均 fail closed。
- 有效异步通知将 pending→paid，并以事务授予一次权益。
- 同一通知重放、并发通知和乱序通知不重复授予。
- 退款/到期/失败后的权益符合用户已确认规则。
- 所有证据使用沙箱并脱敏；不得调用生产支付。

## Slice G：管理员

- user、admin、super_admin 路由/API 权限矩阵。
- 管理员正文查看自动写 audit_log；正文默认不可编辑。
- 违规删除、封禁、额度调整、角色变更有二次确认和审计。
- 管理员不能删除/修改 audit_log，不能读取密码/完整密钥，不能伪造 paid。
- 超级管理员的业务权限不绕过支付验签和审计。

## 上线前安全检查

- Git 跟踪文件无真实密钥；疑似暴露密钥已轮换。
- 依赖审计无未解释的 critical/high。
- CORS/CSP/HTTPS/环境变量/回滚方案已记录。
- Auth、RLS、支付、Webhook、管理员证据链接到 `ACCEPTANCE.md`。
- 未确认高风险决策没有被默认写入生产。

## Slice UX-F1：生成进度 + Header 菜单收纳

- 四阶段进度：诊断原文→生成变体→质量审核→消费者反馈，标注"预估"
- 每个阶段有 pending/active/done/failed 四态，视觉区分
- 暗色 emerald、亮色 orange 遵循设计系统
- Header：历史、收藏库、引擎状态直接可见
- HeaderMenu：官网、复原配置、主题、退出收纳到下拉
- HeaderMenu 键盘可访问，Escape/点击外部关闭，aria-expanded/haspopup 正确
- ReferenceCaseSelector 始终渲染，无四星收藏时显示空状态
- 不修改数据库、支付、Supabase Migration、真实微信通知或任何 secret
- 证据等级：strict UI — 截图、行为测试、构建验证

|CR-2026-07-12-bug|参考收藏案例入口在无四星收藏时消失|无收藏状态下可找到折叠入口和空状态说明|✅ COMPLETED — UX-F1|client tests 135/135 and build passed|入口始终显示；无可用案例时展开显示评分四星条件|✅ PASSED|

|CR-2026-07-12-feature|用户反馈中心与管理员微信通知|覆盖成功、无权限、限流、非法输入、通知失败和跨用户隔离|Feature branch or local dev state|Run the relevant behavior path and boundary checks|已登录用户可提交需求反馈、Bug反馈或其他反馈; 反馈先持久化，再异步尝试微信通知；通知失败不丢失反馈; 通知密钥仅保存在服务端环境变量，客户端和日志不得出现|strict: API tests, RLS tests, redacted notification evidence, UI screenshot|

|CR-2026-07-12-change|工作台 Header 信息架构收纳|Header 菜单行为与原有功能无回归|✅ COMPLETED — UX-F1|client tests 135/135 and build passed|Header 只保留高频入口，低频官网、复原配置、主题与退出收纳到菜单; 键盘、Escape、点击外部关闭和焦点状态可用|✅ PASSED|

## Slice H1：用户反馈中心 + Server酱通知 + 收藏删除防误触

- 收藏删除先弹出符合 shadcn-like 规范的可访问确认对话框
- 取消不删除，确认才触发云同步删除
- HeaderMenu 增加"意见反馈"入口，打开 FeedbackCenter drawer
- 支持 4 种反馈类型、标题/内容必填且有长度限制
- 自动附带 page_path 与 app_version
- 提交 loading/success/error 状态 + 最近自己的反馈列表
- Server 受 requireAuth 保护的 POST/GET /api/feedback
- 反馈持久化优先，Server酱通知 best-effort
- 通知失败不回滚，记录 notify_status/attempts/last_error/notified_at
- 反馈正文不写入普通 server log
- Migration 已起草但绝不推送远端
- SendKey 通过外部文件指针加载，仓库和前端零泄漏
- 证据等级：strict — 测试覆盖确认删除、表单校验、成功/失败、未登录隔离、通知失败仍 201、密钥不泄漏

|CR-2026-07-12-bug|反馈提交返回 Internal server error|真实表/RLS前置、trusted写回、SendKey=格式、限流和通知失败不丢数据|Feature branch or local dev state|Run the relevant behavior path and boundary checks|反馈可持久化并返回 201；通知状态可信；SendKey 文件格式兼容；限流返回 429|strict server tests, dry-run, redacted ServerChan result|

|CR-2026-07-12-bug|进入生成历史后工作台结果丢失|owner-scoped session snapshot round-trip and account isolation|Feature branch or local dev state|Run the relevant behavior path and boundary checks|进入历史再返回工作台保留当前结果；刷新同一标签页也能恢复|client behavior tests and browser smoke|

|CR-2026-07-12-feature|从生成历史载入工作台|completed job loads; incomplete/failed job cannot masquerade as usable result|Feature branch or local dev state|Run the relevant behavior path and boundary checks|完成的历史记录可一键载入原文、参数、变体、诊断、审核、评分和消费者反馈|client behavior tests and browser smoke|

|CR-2026-07-12-bug|四星收藏参考案例在工作台不可发现|Verify 四星收藏参考案例在工作台不可发现|Feature branch or local dev state|Run the relevant behavior path and boundary checks|云端或本地收藏中有两条评分>=4时，工作台明确显示2条可用；展开后两条均可选择；所选案例随下一次生成请求注入且跨账号不串数据|docs/evidence/YYYY-MM-DD/slice-NN/|

|CR-2026-07-12-bug|节日话题未覆盖五个平台版本|Verify 节日话题未覆盖五个平台版本|Feature branch or local dev state|Run the relevant behavior path and boundary checks|选中节日后，standardHK/lightCantonese/IG/Facebook/Shorts五个返回版本都明确融入至少一个所选事件角度或hook；所有生成引擎路径有测试，未选择事件时不改变输出|docs/evidence/YYYY-MM-DD/slice-NN/|

|CR-2026-07-12-bug|官网Pricing与结算转化链路未接通|Verify 官网Pricing与结算转化链路未接通|Feature branch or local dev state|Run the relevant behavior path and boundary checks|官网导航和套餐区可进入/pricing；Pricing的Free/Pro CTA分别进入正确注册或结算流程；未登录结算保留安全next路径，登录后回到/app/billing且拒绝外部open redirect|docs/evidence/YYYY-MM-DD/slice-NN/|

|CR-2026-07-12-change|已开发功能规格沉淀与防覆盖门禁|Verify 已开发功能规格沉淀与防覆盖门禁|Feature branch or local dev state|Run the relevant behavior path and boundary checks|权威PRD/SDD/TEST_PLAN列出已完成能力与不变量；每个后续Slice运行跨域回归矩阵；未经需求变更不得删除、隐藏或降级既有能力|docs/evidence/YYYY-MM-DD/slice-NN/|

|CR-2026-07-13-bug|生成历史完整恢复左侧输入配置|旧 brief 兼容、完整 settings 持久化、损坏值回退、双页面恢复提示|✅ COMPLETED|`npx vitest run`; `npx tsc --noEmit`; `npm run build`|旧记录恢复已保存字段；新记录恢复全部 AppSettings；列表和详情显示文字消失恢复指引|`docs/evidence/2026-07-13/slice-history-settings/verification.md`|

## 2026-07-13：高影响操作确认与批量删除

- HeaderMenu：退出/复原点击后不立即执行；取消保持原状态，确认只执行一次。
- HistoryPage：单条删除确认；多选两条后批量确认；全成功、部分失败、零选择 disabled、删除中防重复。
- HistoryDetailPage：确认前不调用 DELETE，取消保留正文，确认后进入已删除状态。
- FavoritesPanel：选择两条中的一条并批量删除，未选项保留；全选/退出多选状态正确；仍触发既有云同步差异路径。
- ConfirmDialog：confirming 时按钮 disabled、`aria-busy` 和处理中标签可见。
- 回归：Client 全量 Vitest、TypeScript、production build；不运行 Migration 或生产数据操作。

### 同切片检索分页

- 收藏库按品牌/产品/原文/文案检索，11 条数据按 10 条分页；全选仅覆盖当前页。
- 生成历史首屏请求 `limit=10&offset=0`，翻页请求正确 offset，搜索提交携带 `q` 并回到第 1 页。
- 服务端拒绝含 PostgREST 过滤语法的非法搜索值；合法搜索保留 owner 过滤并覆盖品牌、产品、原文字段。
- 生成历史摘要返回 `brandName/productName`，客户端类型、服务端类型与映射保持同步。

## 2026-07-13：Free 收藏与历史容量权益

- Free 已有 10 条收藏时点击未收藏按钮：不 dispatch 新增，显示 Pro 解锁入口；删除一条后可新增。
- Pro 在 10 条后仍可新增；套餐加载失败按 Free。
- Free 收藏库有 11 条时只渲染最新 10 条和“1 条需 Pro 解锁”；Pro 渲染全部；参考案例与 Prompt 注入不得使用锁定收藏。
- Free 新收藏 BFF 在 owner count=10 时返回 `403 PLAN_LIMIT`；同 clientId 更新与删除仍允许。
- Free legacy import 预检超限时零写入；Pro 不受该容量门禁。
- Free 历史总数 18 时返回 15 条可访问总数和 `lockedCount=3`，第二页最多 5 条；Pro 返回全部。
- Free 搜索只过滤最新 15 条；锁定历史的详情 URL 返回 403，跨用户/不存在仍返回 404。
- 回归：生成额度、支付、RLS、收藏删除、历史软删除、检索分页、全量 Client/Server 测试与双端构建。

|CR-2026-07-14-bug|R1.1 管理员审核保存与正文审阅修复|静态 migration 契约 + 管理员审核 UI 行为测试 + 双端 typecheck/build。|Feature branch or local dev state|Run the relevant behavior path and boundary checks|管理员保存已采纳或需修改时不再返回 500，审核与审计记录原子写入。; 收藏正文区域可拖拽增高，弹窗关闭、审核编辑与复制仍可访问。; 失败信息可访问且不暴露数据库细节。|docs/evidence/2026-07-14/r1-review-save-hotfix/|

|CR-2026-07-14-feature|R2 收藏文案句子级管理员批注|管理员同组/越组 API 测试、用户 RLS 读取测试、文本选择与高亮 UI 测试、失效锚点回退测试。|Feature branch or local dev state|Run the relevant behavior path and boundary checks|管理员可选中收藏正文片段并添加修改建议，整篇审核状态继续独立保留。; 收藏所属用户能看到红色高亮片段、状态文字和批注意见，不能修改管理员批注。; 普通管理员仅能批注同 review_group 用户收藏，super_admin 可跨组；越权请求不可读取或写入。; 原文锚点不匹配时降级为批注列表并标记定位失效，不把批注错误套到其他句子。|docs/evidence/2026-07-14/r2-inline-review-annotations/|

|CR-2026-07-14-feature|R2.1 收藏正文直接编辑与重新送审|新增数据库契约、owner API、管理员 API、reducer 与收藏编辑/批注行为测试；再跑 Client/Server 全量测试、typecheck 与 build。|Feature branch or local dev state|Run the relevant behavior path and boundary checks|用户只能编辑并保存自己的收藏正文，不能修改他人收藏或生成历史原文。; 正文保存成功后旧整篇审核和句子级批注失效，管理员列表与详情显示修改后待审核。; 管理员重新审核后，用户刷新收藏库可看到新的状态、整篇意见和句子级批注。; 取消编辑或关闭含未保存改动的编辑区时先确认，保存失败不覆盖本地已显示正文。|docs/evidence/2026-07-14/r2-inline-review-and-favorite-edit/|

|CR-2026-07-15-change|Shorts 展示名统一为 Shorts/TK|搜索可见文案与 UI 行为测试，确认无孤立 Shorts 标签且历史记录仍可读取。|Feature branch or local dev state|Run the relevant behavior path and boundary checks|所有用户可见的 Shorts 文案统一显示为 Shorts/TK，包括工作台、结果、收藏、历史、管理员页、官网和定价说明。; 内部持久化 key 暂继续使用 shorts，避免无必要数据库迁移和历史数据失配；API/Prompt 语义需同时覆盖 Shorts 与 TikTok。|docs/evidence/2026-07-15/shorts-tk-label/|

|CR-2026-07-15-feature|用户自写收藏文案与待审核队列|覆盖 owner 创建/编辑、必填校验、RLS 分组隔离、待审核计数、去重提醒、审核后清零及刷新恢复。|Feature branch or local dev state|Run the relevant behavior path and boundary checks|用户可在收藏库新增自写文案；品牌、文案类型、发布平台必填，备注选填，并明确选择是否需要审核。; 收藏库现有文案的发布平台和文案类型均可编辑；需要审核的文案进入该用户 review_group 的管理员队列并高亮。; 管理员用户收藏页和首页右上角折叠菜单显示未审核圆形数字角标；审核完成后计数消失或递减。; 每次出现新增待审核任务时，管理员右下角收到合并提醒，可选稍后审核或立刻审核并跳转用户收藏页；不得跨 review_group 泄露数量或正文。|docs/evidence/2026-07-15/user-authored-review-queue/|

### 用户自写收藏与待审核队列验证结果

- Migration 静态契约、远端 history/列/约束/索引/触发器和 Advisor 复核通过。
- 服务端覆盖自写必填与 overpost、同组 pending summary、pendingOnly 列表和无正文响应。
- 客户端覆盖字段白名单往返、自写表单、类型编辑、角标、深链筛选、行高亮、相同批次去重、数量下降不误报和新时间再次提醒。
- 完整回归：Client 383/383，Server 569/569，双端 typecheck/build，production audit 0 vulnerabilities。
- Playwright 运行器 3 次启动超时，保留用例但截图验收未通过；不得把该项写成已通过。

|CR-2026-07-15-change|Pro 月额度调整为 250 次|套餐展示、entitlements、reserve quota 边界 249/250/251 与存量订阅迁移测试。|Feature branch or local dev state|Run the relevant behavior path and boundary checks|官网、Pricing、结算页、数据库 plans、额度服务和管理员订阅页统一显示 Pro 每自然月 250 次。; 存量 Pro 用户当前周期立即调整为 250 次，后续周期同样为 250 次；执行数据库变更前仍需再次确认 Migration 授权。|docs/evidence/2026-07-15/pro-250-quota/|

|CR-2026-07-15-feature|团队协作版 99 元/月联系定制|Pricing/官网 CTA 路由回归、弹窗交互、剪贴板失败与二维码资源可用性测试。|Feature branch or local dev state|Run the relevant behavior path and boundary checks|官网和定价页新增团队协作版 ￥99/月，并说明审核分组、管理员批注、待审核队列等团队功能。; CTA 不进入支付页；弹窗显示联系 vx：18595680518，号码可一键复制，并展示项目内保存的微信二维码。; 弹窗具备关闭、复制成功/失败状态与键盘可访问性；不把电话或二维码错误描述为支付宝收款入口。|docs/evidence/2026-07-15/team-plan-contact/|

|CR-2026-07-15-feature|用户审核结果弹窗|覆盖通过/未通过文案、品牌为空回退、owner/RLS 隔离、刷新去重、新审核再次提醒、立即查看定位与键盘可访问性。|Feature branch or local dev state|Run the relevant behavior path and boundary checks|adopted 显示“你的{品牌}文案已通过审核，请立即查看”，changes_requested 显示“你的{品牌}文案未通过审核，请立即查看”。; 同一 owner+favorite+revision+review time 只提示一次，新审核再次提示。; 立即查看打开收藏库并定位目标；不得泄露其他 owner 或 review_group 的品牌、审核状态、正文或计数。|docs/evidence/2026-07-15/user-review-result-dialog/|

## 2026-07-15：Phase 0 CI 与 Migration 基线

- 静态门禁必须验证本地 Supabase project ID、5173 Auth 回调、Migration enabled，以及不包含生产 project ref。
- CI 必须固定官方 Action SHA、最小 `contents: read` 权限、关闭 checkout 凭据持久化，并顺序执行 install/test/typecheck/build/audit。
- CI 禁止 `pull_request_target`、`${{ secrets.* }}`、`db push`、`migration repair` 与部署命令。
- `npx supabase migration list --linked` 只读输出必须保证每个 local/remote version 一致。
- 完整验收命令：`npm run verify`；GitHub 线上 CI 状态只能在 workflow commit/push 后判定。
