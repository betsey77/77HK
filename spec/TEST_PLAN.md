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

# 可选：公开页 smoke（Chromium；config 为 .mjs）
# 本地可复用已启动的 Vite；否则 webServer 会 npm run dev:client
npm run test:e2e:smoke
# 或聚焦：
npx playwright test e2e/smoke.spec.ts e2e/public-routes.spec.ts e2e/protected-route.spec.ts --config=playwright.config.mjs --project=chromium --reporter=list
```

等价分项：

```powershell
cd client; npx vitest run; npx tsc --noEmit; npm run build
cd server; npm test; npx tsc --noEmit; npm run build
```

Playwright 公开页 / 未登录保护冒烟（2026-07-15）：`playwright.config.mjs` + `e2e/smoke.spec.ts` + `e2e/public-routes.spec.ts` + `e2e/protected-route.spec.ts`。
**不**将 `e2e/user-authored-review-queue.spec.ts` 的 localStorage mock 视为真实 Auth/RLS。完整业务 E2E 见 `docs/release/2026-07-14-playwright-smoke-plan.md` 与 production-launch-plan Phase 2。新增付费服务或强制升级依赖档位前必须用户同意。权威命令表：`scripts/verify/commands.md`。

## 2026-07-15 — 本地工作台壳层 smoke（mock Auth）

| 项 | 说明 |
| --- | --- |
| 状态 | **通过（本地 mock only）** — **不是**真实 Auth/RLS/支付验收 |
| 配置 | `client/vite.e2e.config.ts` + `playwright.workbench-local.config.mjs` |
| Fixture | `client/src/e2e/*`；`e2e-local-user` / `e2e@example.invalid` |
| 网络 | Playwright 拦截非 localhost；`/api/**` 固定 DTO |
| 脚本 | `scripts/e2e-workbench-shell.ps1`（`-SelfTest` / `-Twice`；端口 5184） |
| 路径 | Playwright：`C:\work\77hk-workbench-e2e`；Vite：真实 `client/` |
| 覆盖 | `/app` 壳层加载；Header/输入/结果空态/审核空态/Footer；桌面+移动无横溢 |
| 命令 | `npm run test:e2e:workbench:win` / `:twice` |
| 证据 | `docs/evidence/2026-07-15/workbench-shell-local-smoke/` |

## 2026-07-15 — E2E harness 安全收口

| 项 | 说明 |
| --- | --- |
| 脚本 | `scripts/e2e-public-smoke.ps1`（fail-closed junction + marker + evidence） |
| 自检 | `-SelfTest`：拒绝普通目录/错目标；正确 junction 仅摘链接 |
| 截图 | `E2E_SCREENSHOT_DIR` → `docs/evidence/2026-07-15/e2e-harness-hardening/screenshots/` |
| 回归 | `-Twice` focused 8 例 ×2；Node 22；ASCII `C:\work\77hk-e2e` |
| 证据 | `docs/evidence/2026-07-15/e2e-harness-hardening/` |

## 2026-07-15 — Playwright 运行时基线返工

| 项 | 说明 |
| --- | --- |
| 状态 | **通过（有条件）**：Node 22 + ASCII cwd |
| 根因 | 项目根路径含非 ASCII 时 Playwright execute 挂起；list / chromium.launch 正常 |
| 运行时 | 便携 Node v22.23.1；CI 仍为 Node 22 |
| 本地命令 | `npm run test:e2e:smoke:win` 或 `:twice`（`scripts/e2e-public-smoke.ps1` → `C:\work\77hk-e2e`） |
| 验收 | focused 8 例连续两次通过；证据 `docs/evidence/2026-07-15/playwright-runtime-repair/` |

## 2026-07-15 — Playwright runner + 公开路由冒烟（上一轮，验收未通过）

| 项 | 说明 |
| --- | --- |
| 配置 | `playwright.config.mjs`（**勿**恢复 Node26 下会挂起的 `.ts` config） |
| webServer | `npm run dev:client` + `reuseExistingServer: !CI`；`E2E_BASE_URL` 可覆盖 |
| Escape | `E2E_NO_WEBSERVER=1` 时不启服务，要求 baseURL 已就绪 |
| 覆盖 | `/` 滚动 reveal；`/pricing`；`/login`；未登录 `/app` → `/login?next=/app`；桌面+移动截图 |
| 证据 | `docs/evidence/2026-07-15/playwright-runner-public-smoke/` |
| 独立验收 | **未通过** — 见 runtime-repair handoff / evidence |

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

## 2026-07-16：Preview 真实模型严格模式

- 单元测试验证 `deepseek-v4-flash` 默认值、显式 `thinking=disabled`、`REQUIRE_REAL_MODEL` 解析、DeepSeek 单独配置可用及严格应用预算为 51 秒。
- 静态 readiness 验证 `.env.example` 包含 `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`REQUIRE_REAL_MODEL` 且敏感值为空。
- 最小真实 API 冒烟必须使用服务端密钥，记录模型名、耗时和成功/失败，不保存 prompt、响应正文或密钥。
- 部署后生成必须返回 `generationEngine=deepseek`；模型失败必须返回 503/明确错误并释放产品额度，`generationEngine=rules` 视为验收失败。
- Preview 不配置 `CANTONESE_API_URL` 或任何 `CANTONESE_*` 密钥，并由 `/api/health` 确认 `selfHostedConfigured=false`。
## 2026-07-16：审核提醒本地隔离浏览器回归

- 入口：`powershell -File scripts/e2e-workbench-shell.ps1 -Twice -EvidenceDir docs/evidence/2026-07-16/review-notifications-local-e2e`
- 用户路径：通过/未通过文案、稍后去重、刷新不重复、新审核再次提醒、立即查看定位并高亮收藏。
- 管理员路径：待审计数与右下角提醒、稍后审核、立刻审核、待审筛选和高亮行。
- 视口：1440px 桌面与 390px 手机；检查页面横向溢出并保存截图。
- 隔离门禁：只允许 localhost；E2E Auth/Supabase fixture 不含真实项目、JWT 或密钥；禁止复用历史 `user-authored-review-queue` 伪会话。
- 证据边界：本切片证明浏览器 UI/交互，不证明真实 Auth、RLS、review_group 或 staging。

## 2026-07-16：内部 Preview 真实额度与人工开通

- 服务端回归：在 `PAYMENT_MODE=mock` 下提供可信 Supabase mock，验证 `/api/me/entitlements` 返回数据库的 `quota_used / quota_per_cycle / cycle` 且 `isMock=false`。
- 服务端降级：本地没有可信 Supabase 时保留既有 mock 测试能力；缺失认证仍返回 401。
- 客户端回归：mock 支付模式的 Pro CTA 打开“联系开通 Pro”弹窗，不发送任何 checkout POST；支付宝沙箱模式的既有行为保持不变。
- staging 验收：脱敏核对内部账号的 plan、quota_used、review_group 和管理员可见待审核数量；不得输出邮箱、完整 UUID、JWT 或密钥。
- 通知验收：配置 Server酱后提交一条可清理的临时反馈，验证 `notify_status=sent` 和微信实际收件；清理测试数据前需保留脱敏证据。
- 部署门禁：客户端/服务端测试、typecheck、build、依赖审计和 `git diff --check` 通过后才重新部署 Preview。

## 2026-07-16：注册、当前设备退出与热点恢复

- AuthContext：退出必须调用 `signOut({ scope: 'local' })`。
- 注册页：Supabase 接受注册后显示邮箱验证弹窗，包含邮箱、垃圾邮件和返回本站登录说明。
- Auth callback：确认成功后仅退出当前会话并跳转 `/login?registered=1`，不得跳转工作台。
- 登录页：`registered=1` 显示一次性注册成功弹窗，关闭后 URL 不再保留该标记。
- Inspiration API：匿名请求返回 401；有效 JWT 可调用热点、语感、YouTube 搜索与热门接口。
- YouTube 缓存：相同参数在 TTL 内只请求一次上游；不同查询不串数据；失败结果不长期缓存。
- 本地真实冒烟：只记录热点数量、缓存命中和健康状态，不记录 API Key、视频正文或用户 JWT。
- 部署仍需独立授权；未获授权前不得写 Vercel 环境变量或重新部署。
## 2026-07-16：角色邮箱私有视图

- 静态合同：确认视图在 `private` schema 且为 `security_invoker=true`。
- 字段白名单：只联结实时 `auth.users.email`，不出现密码或令牌字段。
- ACL：确认 `public/anon/authenticated/service_role` 全部被撤销且无 `grant select`。
- 远程前置：`migration list` 与 `db push --dry-run` 必须只列出本迁移；未获实际 push 授权时不写入 staging。

## 2026-07-18：1.1.4.5 验收矩阵

### Slice A

- 注册成功 mock：只在 Supabase 接受且需要确认时出现指定弹窗；429/重复邮箱不出现成功弹窗。
- 注册路由加载回归：提交后 Auth action loading 期间 `SignupPage` 不卸载，受控输入保持；请求成功后显示目标邮箱确认弹窗，关闭后进入“请检查邮箱”状态。
- 工作台桌面与 390px 移动端：根页面无纵向滚动和黑边，三个面板内部仍可滚动；官网/登录页自然滚动不回归。
- Footer 精确显示 `Powered by CANTONESE API`、`v1.1.4.5`，不出现 `Powered by DeepSeek API`。
- Persona API 即使模型返回 2 条也只响应 1 条；连续解析两次后列表为原有人设 + 2 条新画像，旧数据不被覆盖，实例 ID 不冲突。

### Slice B

- 卖点新增/删除/翻译成功、失败重试、10 条上限和长度校验；匿名本地化请求返回 401。
- Prompt 契约验证卖点港话表达存在、红线优先且输入数量被限制。
- 服务边界契约验证 DeepSeek 与 CantoneseLLM 都把生成请求中的 `productSellingPoints` 继续传给 Prompt builder，避免只测试 builder 而漏掉真实调用链。
- 配置 JSONB 云同步、跨设备恢复和 User A/User B RLS；生成历史详情载入后卖点原文/港话表达一致。

### Slice C

- 假时钟验证可见页面 15 秒轮询、隐藏暂停、focus 立即刷新、错误退避和卸载清理 timer。
- 管理员新待审与用户新审核结果在 0–15 秒内出现；同一事件只弹一次，跨用户/跨组无数量与品牌泄露。
- 服务端验证匿名 401、owner ID 显式过滤、仅以该 owner 的 favorite IDs 查询最新审核时间，以及无收藏时不执行审核查询。
- 浏览器用例不刷新页面，推进假时钟 15 秒后改变审核摘要版本，验证触发 owner bootstrap 并显示新的审核结果。

### Slice D

- 签到：香港 23:59/00:00、重复点击幂等、连续 7 天、漏签重置、并发第 7 天、每账号唯一奖励、客户端伪造日期无效。
- 会员：Free 立即应用且新周期 `quota_used=0`；有效 Pro 生成 pending、不改变现有结束时间/额度；到期领取、领取时又有有效 Pro、事务失败全回滚。
- 权限：匿名 401；用户只读自己的签到/奖励且不能直接写 subscription/grant；A 用户不能读取或领取 B 用户奖励。
- 活跃：每用户每日去重，DAU=香港当天、WAU/MAU 为滚动 7/30 天；普通管理员只能看到当前 review_group，空组/跨组不得泄露数量，super_admin 可见全局。
- 额度：消费和结余从现有 `usage_ledger`/`subscriptions` 复算，不出现第二账本或因签到奖励丢失既有用量。
- 模型：成功、错误、超时、重试、fallback、耗时和官方 usage 聚合准确；缺失 usage 保持 null；日志写入失败不导致生成失败。
- 隐私：日志和管理响应明确拒绝 Prompt、回复正文、原始 provider error、邮箱、JWT、Key；bad case 阈值使用已确认的港味总分字段。
- 余额：仅 super_admin；官方接口成功、缓存命中、超时/错误“暂不可用”均覆盖，任何情况下不返回密钥或伪造 0。
- Migration：先做本地静态/合同测试；只有用户明确授权后才可在独立 staging dry-run/实际 push，并完成 RLS A/B、并发和临时数据清理验证。
- D3 API 客户端：三条请求必须复用鉴权 fetch，不发送客户端 userId/日期；合法 status/claim DTO 通过，缺字段或错误类型拒绝，401/404/409/5xx 按 status/code 处理且不展示原始错误。
- D3 去扰：同账号同香港日关闭后不再显示；下一香港日重新显示；不同账号互不影响；localStorage 只含日期关闭键，不含 streak、grant、reward 或 subscription 状态。
- D3 组件：覆盖 loading/error/retry、未签到、服务端整表替换、busy 防双点、pending 不可领/可领、claim success/404/409、applied、Escape 和焦点路径；失败不得乐观修改连续天数或奖励状态。
- D3 浏览器：使用 localhost-only 隔离 API mock 覆盖桌面与 390px，保存签到和领奖截图，验证无横向溢出、44px 操作目标、同日关闭不重现；D1 Migration 未应用时不得把真实本地 API 503 当作 UI 验收结论。
- D4 Migration：静态合同覆盖每日主键、香港日数据库派生、first/last seen 语义、model attempt 枚举/Token 约束、`generation_jobs` 外键、RLS/revoke/minimum service-role grants，并证明 Migration 不调度删除任务。
- D4 writer：运行时未知键和敏感字段在 trusted client 前拒绝；合法字段只映射到固定 snake_case 列；`unavailable` usage 全为 null；数据库错误、同步异常和 400ms 超时不得中断后续模型业务。
- D6a overview：验证默认 30 日、最多 90 日、非法/倒序/未来日期；普通管理员空组先 403、同组 owner 过滤、跨组零泄露，`super_admin` 全局；分页与 owner 分批后聚合不丢数据。
- D6a 指标口径：DAU/WAU/MAU 分别使用结束日的 1/7/30 日窗口；会员奖励按请求区间统计，额度消耗来自 `usage_ledger.consume`，当前结余来自有效 subscription 与 plan quota。
- 工作台滚动条：静态合同确认样式受 workbench shell 限定，暗/浅色轨道透明、滑块低对比圆角，并保留 forced-colors；localhost-only 浏览器截图确认不再出现原生白色轨道。
- D6b 路由：models/bad-cases/provider-balance 对匿名 401、普通用户 403、ordinary admin 403、super_admin 200；非法日期在 DB/service 前 400。
- D6b 模型聚合：多 provider/model、全成功/全失败/混合错误率、nearest-rank P95、部分 null Token、usage unavailable 和区间边界；每次 retry/fallback attempt 独立计数。
- D6b bad case：49 入选、50 排除、缺分/非法分/软删排除、低分优先、同分新任务优先、最多 20；序列化响应不含 scores/source/variants/owner/email/prompt。
- D6b 余额：无 Key、超时、非 2xx、坏 JSON/schema 为 unavailable；合法 `is_available=false` 和 `0.00` 保持 ok；合法响应 10 分钟缓存，任何响应不含 Key/Bearer/raw error。
- D6b UI：普通管理员只有 overview；超级管理员显示模型/Token/余额/低分任务；覆盖 loading、empty、overview error、局部 super error、余额 unavailable。桌面与 390px 截图检查暗色层级、内部表格滚动、无页面级横向溢出。
- 完整 D0-D7 验证矩阵见 `docs/plans/2026-07-19-1.1.4.5-slice-d-development-plan.md`。

## 2.1 Slice E — Bad Case 诊断审阅包测试矩阵

- 工件快照：双模型生成路径实际使用的 Prompt/规则/知识/模型策略版本、哈希和 schema 一致；旧任务返回 `legacy_unavailable`，禁止用当前版本回填假历史。
- 自动触发：低分、生成失败、关键标准失败和人工标记均幂等创建单一审阅包；正常任务不误建。
- Findings：每个失败结论都有可解析 evidence ref、criterion ref 和 artifact ref；缺字段为 `not_evaluated`；责任团队建议可追溯。
- Trace：阶段顺序、retry/fallback、attempt、耗时、有限错误类和 provider usage 正确；无 prompt/response/raw error/CoT/email/JWT/Key/Cookie。
- 权限：匿名 401，普通用户/ordinary admin 403，super_admin 200；列表无正文/邮箱/工件正文；详情审计失败拒绝正文，范围在正文读取前后各检查一次。
- 写入：指派、状态和 disposition 只信任认证 actor，非法流转 409，所有变更产生追加审计事件；客户端伪造 owner/actor/role 无效。
- 工件提案：before/after diff 可审阅但不能直接发布或修改源码/知识；敏感键在持久化前拒绝。
- 评测候选：未经脱敏和人工批准不晋升；删除/跨 owner 样本不可读；价格表缺失时不显示人民币成本。
- UI：桌面和 390px 覆盖 loading/empty/error/legacy/trace unavailable、超长正文、键盘、焦点、内部滚动和无页面级横向溢出。
- E7b 提醒/折叠：默认折叠保留异常类别徽标；未审核 Finding、重复样本、已评估失败、未评估标准、无效时长触发提醒；同摘要刷新去重、摘要变化再提醒、提醒可直接展开；ordinary admin 零请求/零提示；桌面与 390px 截图复核。
- Staging：E8 经独立授权后验证 Migration history、RLS/ACL、并发幂等、审计、清理与 Advisor；E0-E7 不得以本地 fixture 代替远端证据。
- 更新日志：`HeaderMenu` 入口打开 drawer/dialog 且不重置工作台；Escape/焦点/body scroll lock/390px 内滚动通过；只渲染 `deployed` 条目，local/staging/preview 草稿不显示；生产部署 manifest 与 `2.1` 用户可见更新逐项一致。

## V2.1 发布范围约束

- 轻量 `review_group` 协作、收藏/提交审核后的组内共享属于 V2.1 验收范围；组织/席位/邀请/SSO 不在本版。
- RAG、自动反哺/优化、批准生效和自动发布属于 V3，不作为 V2.1 测试或上线阻塞条件。

## V2.1 审核结果/签到协调回归

- 同时挂载：未读审核结果出现时签到不可见；关闭审核结果后签到恢复。
- 晚挂载：审核结果已打开后再挂载签到，仍不得出现签到遮罩；关闭审核结果后恢复。
- staging：桌面“审核通过”和 390px“需修改”通知出现时，显式断言“每日签到”为 0，再验证“立即查看”可点击并定位收藏。
# 2026-07-22 - Slice E8 staging closure

- 安全合同先红：验收脚本必须锁定 staging ref、临时账号前缀、公开 E8 API、真实 hook 和零残留标记，且不得包含 Migration/部署命令。
- 真实 JWT：匿名/无效 token 401，普通用户/admin 403，super_admin 才能 list/detail/assign/status/analyze/review/proposal；浏览器角色不能直读 E8 表。
- 真实数据：完成/失败 hook 重复运行仍各只有一个 pack/`pack_created`；隐藏任务 404 且不产生详情审计。
- 真实 DeepSeek：旧 deterministic completion 升级一次，复点不重复事件；无效密钥进入安全失败分类；人工 disposition 不被分析覆盖。
- 提案：详情 content hash 可创建 review-only proposal；旧 hash 返回 409；不得 publish/autoPublish。
- 清理：临时账号及 E8 业务表归零；按保留策略存在的模型遥测必须解除 job 关联。
