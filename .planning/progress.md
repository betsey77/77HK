# Progress

- 2026-07-16: ✅ **审核提醒本地隔离浏览器 E2E** — 复用 Node 22/ASCII workbench harness，以 localhost-only API fixture 覆盖用户通过/未通过、稍后去重、新审核再次提醒、立即定位，以及管理员待审提醒/筛选；聚焦测试 13/13，Playwright 6/6×2，11 张截图，无残留进程。证据：`docs/evidence/2026-07-16/review-notifications-local-e2e/`。不作为真实 Auth/RLS/staging 证据；无生产代码、Migration、部署或 Git 操作。

- 2026-07-15: ✅ **个人案例库保存 500 修复 + 副标题配色 + 文案澄清** — DB 授予 `case_library_tags_valid` EXECUTE；软删除 RPC；UI 标明功能已可用（W3 只传 ID）；左侧字段副标题统一暗绿/亮橙。交接：`docs/handoff/2026-07-15-case-library-fix-and-label-colors-handoff.md`。未 commit/push。

- 2026-07-15: ✅ **本地工作台壳层 smoke（mock only）** — `vite.e2e.config.ts` 模块级替换 Auth/Supabase；fixture `e2e@example.invalid`；Playwright 阻断非 localhost + `/api` 固定 mock；独立端口 5184；ASCII Playwright cwd + 真实 client 路径启动 Vite（避免中文 junction 白屏）。`-SelfTest` + `-Twice` **2/2×2**。证据：`docs/evidence/2026-07-15/workbench-shell-local-smoke/`。**不**证明真实 Auth/RLS/支付。未 commit/push/安装。

- 2026-07-15: ✅ **E2E harness 安全收口** — junction fail-closed（仅删除已验证指向本仓库的 Junction）；`E2E_SCREENSHOT_DIR` 截图回写仓库 evidence；移除浏览器安装开关；`-SelfTest` + `-Twice` **8/8×2**。证据：`docs/evidence/2026-07-15/e2e-harness-hardening/`。未 commit/push/安装/业务改动。

- 2026-07-15: ✅ **Playwright 运行时基线返工** — 用户授权安装 Node 22.23.1 便携版。根因：非 ASCII 项目根路径导致 Playwright worker 无输出挂起（非单纯 Node 26）。修复：`scripts/e2e-public-smoke.ps1` + `C:\work\77hk-e2e` ASCII cwd；focused **8/8 ×2**。证据：`docs/evidence/2026-07-15/playwright-runtime-repair/`。未 commit/push/verify。

- 2026-07-15: 🛑 **运行时返工曾 BLOCKED** — 无 Node 22 时仅能做标记与文档；已由上条关闭。

- 2026-07-15: ⚠️ **Playwright runner + 公开路由冒烟（独立验收未通过）** — 改为 `playwright.config.mjs`、public/protected 用例与截图；本地曾报告 8/8，但 Codex 复验执行阶段挂起，**不作完成结论**。历史证据：`docs/evidence/2026-07-15/playwright-runner-public-smoke/`。

- 2026-07-14: ✅ **R1 审核分组 + 管理员收藏批注（远端 Migration 已推送）** — migration `20260714190000` 已应用至 `qiotocumkbwckiezuptr`；admin favorites 同组 scope + PUT review 原子 RPC；bootstrap `adminReview`；收藏卡/管理后台/官网 tel；运维文档。远端元数据/RLS/grants/RPC 与 Advisor 已复核；尚未配置分组、未部署/commit。证据：`docs/evidence/2026-07-14/review-groups-admin-notes/`。

- 2026-07-14: ✅ **本地部署适配切片完成（未部署）** — 官网 Playwright 分段滚动 reveal smoke；`apiUrl`/`VITE_API_BASE_URL`；`ALLOWED_ORIGINS` CORS；支付 `APP_FRONTEND_URL`/`APP_API_URL` 分域；`client`/`server` vercel.json（东京 hnd1、300s）与托管决策/Dashboard 空变量文档；`.env.example` 与 spec/planning 同步。证据：`docs/evidence/2026-07-14/local-vercel-readiness/`。禁止项遵守：无云部署 CLI、无 migration、无真实密钥读写、无 git commit/push。

- 2026-07-14: ✅ **Phase 0 生产发布基线完成（本地工程，未部署）** — 受控修复 form-data high 与 concurrently/shell-quote critical（overrides + concurrently ^9.2.4，无 audit fix --force）；根脚本 install/test/typecheck/build/audit 分离且 build 内无 npm ci；`.env.example` 空值契约；Playwright smoke harness；W2 migration 本地文件 rename 对齐远端 version + 映射/Advisor 提案（均未写远端）。验证：Client 353/353、Server 509/509、双端 typecheck/build、prod+full audit 0 vulnerabilities。证据：`docs/evidence/2026-07-14/phase0-production-baseline/`。未 commit/push；等待 Codex 独立验收。

- 2026-07-14: 📋 **部署就绪审计完成（未部署）** — 全量回归为 Client 353/353、Server 509/509，双端类型检查/生产构建通过；但真实支付宝 sandbox E2E、生产支付开关、生产域名/CORS/CSP、Supabase Auth 正式邮件验收、staging/CI/监控回滚以及 1 个 form-data high 依赖漏洞尚未关闭，因此不可直接上线。计划见 docs/release/2026-07-14-deployment-readiness-plan.md。

- 2026-07-14: ✅ **管理员类型彩色 chip + 登录标题渐变完成** — Admin 用户收藏列表类型 chip 使用 sky 变体（中文映射不变），平台保持 green；AuthLayout 左栏标题对齐官网 emerald→lime / light orange→amber 渐变。聚焦测试 11/11，client tsc + build 通过；无 Migration/RLS/支付/Auth/服务端/git。证据：`docs/evidence/2026-07-14/admin-type-login-gradient/`。

- 2026-07-14: ✅ **登录视觉、收藏卡片布局、管理员备注标签与左侧折叠页完成** — AuthLayout/LoginPage 对齐官网克制深色科技感（Logo、≤3 能力点、「欢迎回来」），不改认证调用。FavoritesPanel 卡片头部可换行且操作固定右侧。Admin 收藏表备注高亮 + 标签中文 chip。InputPanel 四大折叠页（默认展开品牌/文案参数，收起受众/配置；内容保持挂载）。Client 351/351、Server 509/509、双端 tsc/build 通过；无 Migration/RLS/支付/`.env`/git push。证据：`docs/evidence/2026-07-14/login-admin-accordion/`。

- 2026-07-14: ✅ **收藏发布平台同步、管理员检索与支付跳转去等待完成** — 每条收藏独立保存 `settings.publishPlatform`，不改全局生成平台；新收藏默认变体，旧 `platform=all` 在用户/管理员侧回退显示为收藏变体。管理员收藏列表/详情中文化平台、类型与标签，增加仅元信息（品牌、产品、类型、平台、备注、原因、标签）检索，列表不读取正文且详情继续审计先行。结算页删除订单创建成功后的 1.5 秒人为延迟，仍仅使用服务端成功返回的 `redirectUrl`。Client 342/342、Server 508/508、双端 tsc/build 通过；无 Migration/RLS/支付服务端或 `.env` 改动。证据：`docs/evidence/2026-07-14/favorite-platform-admin-search/`。

- 2026-07-14: ✅ **路由与结算体验定向修复** — 静态 `homepage-v2.html` 集中 `APP_ORIGIN=http://localhost:5173`，真实应用 CTA 不再落在静态预览端口；`BillingPage` 订单创建成功文案按 `paymentMode` 区分 mock / alipay_sandbox；Pro 仍隐藏升级 CTA。新增 `slice-route-billing-fix.test.tsx`（5 项）。未改 `.env`、支付服务端、密钥或 `PAYMENT_MODE`。

- 2026-07-13: 🟡 **高影响操作确认与批量删除进入 TDD** — 范围固定为退出登录、复原创作配置、历史单删/详情删确认，以及收藏/历史多选、全选当前列表和批量删除；历史部分失败必须保留失败项。复用现有 API、RLS、收藏云同步与 outbox，不新增 Migration。

- 2026-07-13: ✅ **收藏库卡片品牌/产品识别完成** — `FavoritesPanel` 在平台高亮标签左侧以双主题红色显示已有品牌名与产品名（`品牌 · 产品`；暗色 red-400、亮色 red-600），双字段为空时保持原样；长文本可截断并保留完整 title。新增 DOM 顺序与颜色行为测试，Client 260/260、TypeScript 与 Vite production build 通过；无接口、数据库、RLS 或 Migration 变化。证据：`docs/evidence/2026-07-13/slice-favorite-brand-product/verification.md`。

- 2026-07-13: ✅ **F1 支付确认回跳 UI + 结算页账户菜单完成** — 支付结果页仅对服务端已确认 `paid` 的非 Mock 订单自动返回结算页；结算页再以真实订单列表核对并弹出支付成功/Pro 已开通提示，伪造 URL 不显示成功。右上角复用工作台 HeaderMenu。同步修复参考收藏案例被 Flex 压缩成绿色细线的问题。Client 253/253、TypeScript、Vite build 通过。下一切片：普通管理员只读查看用户收藏详情，禁止编辑/删除/导出并记录访问日志。

- 2026-07-13: ✅ **Slice F1 PKCS8 签名阻断修复完成** — 用户授权后将确认为同一用户、同一 sandbox 环境的 3 条失败 `pending` 订单原位标记为 `failed`（`SDK_PRIVATE_KEY_FORMAT`），未删除、未授予 Pro。`alipay-sdk` 4.14 会默认按 PKCS1 解析私钥；适配器现根据 PEM header 显式传入 PKCS8/PKCS1，继续使用 RSA2。新订单若在 page-pay URL 生成阶段失败，会条件更新 `pending → failed` 并写入通用错误码 `PAYMENT_INIT_FAILED`。实钥离线签名预检通过（sandbox host、page.pay、RSA2），远端 pending=0、目标 failed=3。Server 14 files / 417 tests、tsc、build、diff check 通过。真实沙箱付款与 webhook 入账仍待用户手动执行。

- 2026-07-13: ✅ **Slice F1 支付宝沙箱运行前置复验完成，等待手动付款** — 用户修正支付宝公钥后，本地 PEM 类型检查通过且未输出/复制密钥。真实 Supabase `plans` 查询发现并修复 schema contract 漂移（错误的 `is_active/day` → 权威 `is_public/week`）；空对象 features 回退现有 Free/Pro 展示清单。公开套餐现返回 200（Free ¥0/20，Pro ¥19/400，`alipay_sandbox`、非 Mock）；本地与 Cloudflare 临时公网 notify 入口已验证可达且无效通知快速返回 `fail`；无 token checkout/sync 鉴权边界保持。Server 415/415、tsc、build 通过。⚠️ 尚未执行登录后创建沙箱订单、支付宝沙箱付款及 webhook/query 入账，下一步需用户在 `/app/billing` 手动确认。

- 2026-07-13: ✅ **Slice F1 公开路由烟测阻断修复（实时）** — 两个阻断修复：1) `billingRouter` 移至 `generationsRouter`/`syncRouter`/`feedbackRouter` 之前，防止后三者的 `router.use(requireAuth)` 拦截公开 billing 路由（plans/notify）；2) 手动 body parser 跳过任何已解析的 object（含空 `{}`），修复 urlencoded 空 body 后重读已消费流导致的超时。TDD: +7 测试（415/415），Server tsc/build 通过，mock+sandbox 实时烟测 4/4 验证通过。修改文件：`app.ts`（router 顺序 + body parser）、`billing.ts`（注释修正）、`billing.test.ts`（+7 测试）。证据：`docs/evidence/2026-07-13/slice-F1/verification.md`

- 2026-07-13: ✅ **Slice F1 Migration 远端推送与结构验收完成** — `20260713000000_slice_f1_payment_sandbox` 已应用到 Supabase 项目 `qiotocumkbwckiezuptr`。确认 `payment_orders` / `payment_webhook_events` 存在且 RLS 开启；订单 owner SELECT policy 与最小 grants 正确；`apply_alipay_payment` 为锁定 search_path 的 SECURITY DEFINER，PUBLIC/anon/authenticated 均无 EXECUTE，仅 service_role 可执行。Security Advisor 无本次阻断；`payment_webhook_events` 无用户策略为 service-role-only 的预期设计。Performance Advisor 建议后续为 `payment_orders.plan_id` 补索引。真实支付宝 sandbox E2E、密钥配置与部署均未执行。

- 2026-07-13: ✅ **Slice F1 / G1-R 最终阻断修复完成（本地）** — 11 项阻断全部修复：BillingPage 沙箱路由分流、sandbox DB-backed plans/orders/entitlements、return URL 安全追加 orderId+paymentMode、BillingResultPage sandbox 识别、urlencoded 去重、notify 验签前零 DB mutation、SDK 4.14 camelCase tradeQuery、reconcile RPC 错误检查、Admin Supertest 200 精确断言、.env.example 合并、文档更新。Server 408/408、Client 250/250、双端 tsc/build 通过；Migration 随后已推送并远端验收。⚠️ 真实支付宝 sandbox E2E 未执行。证据：`docs/evidence/2026-07-13/slice-F1/verification.md`

- 2026-07-12: **H1 Migration 已通过 Supabase MCP 推送并完成远端结构验收。** 远端登记为 `20260712072936 slice_h1_user_feedback`，本地文件名已同步；确认表存在、RLS 开启、owner/admin 策略、authenticated 最小权限、service_role 通知写回权限与两个触发器。未读取反馈正文、未发送真实 Server酱消息。性能顾问提示两条 permissive SELECT policy 可在后续小迁移合并。

- 2026-07-12: **H1 Migration 推送被连接层阻断。** 用户已明确授权；本地迁移与 SHA-256 已核对。`supabase migration list` 返回 `LegacyDbConnectError`，随后正式 `supabase db push` 在连接远端 Postgres 时 TLS EOF，均未进入迁移应用阶段。按两轮无进展停止规则未继续重试，远端状态仍按“未推送/未验证”处理。

- 2026-07-12: **Slice H1-R 安全修复 + 工作台会话恢复 + 历史载入完成并独立复验。** Migration 使用 `private.has_any_role`；快照增加字段校验、owner 隔离和历史真实参数映射；工作台与官网共用 77 Logo。Server 282/282，Client 170/170，双端 tsc/build 通过，零 secret 泄漏。Migration 未推送、未发真实 ServerChan 消息；dry-run 连接远端 Postgres 时 TLS EOF，未取得 SQL 预检结论。证据：`docs/evidence/2026-07-12/slice-H1-R/verification.md`。

- 2026-07-12: **UX-F1 工作台进度 + Header 菜单收纳完成。** 四阶段预估生成进度（诊断原文→生成变体→质量审核→消费者反馈）+ HeaderMenu 下拉菜单收纳低频功能（官网、复原配置、主题、退出）。ReferenceCaseSelector 始终可见回归确认。Client 135/135（+16 UX-F1）、TypeScript、Vite build 通过。证据：`docs/evidence/2026-07-12/slice-ux-f1/`。下一候选：Slice E 支付/订单 Mock 或 F 支付宝沙箱（需用户授权）。

- 2026-07-12: **工作台易用性小切片完成。** 生成历史新增固定”回到工作台”入口；收藏备注在参数收起后以琥珀色摘要展示；”参考收藏案例”默认折叠并展示用户备注；修复未确认邮箱注册成功后加载状态不复位，并补充查收邮件、点击验证链接及刷新页面提示。Client 118/118、TypeScript、Vite build 通过。下一候选任务调整为 Spec v2.1 F1 前端模拟运行进度条，完成后再进入 Slice E 支付/订单 Mock。

- 2026-07-12: **Slice D 云同步远端闭环完成。** Migration `20260712070000_slice_d_cloud_sync` 已推送；收藏/配置/品牌真实 mutation 同步、内容快照、owner-scoped outbox、一次性迁移与真实 retry 已接通。远端回滚事务通过双账号 RLS、伪造 owner 拒绝、配置第 21 条拒绝/已有项可更新、JSON/标签边界。Server 209/209、Client 113/113、双端 TypeScript/build 通过。人工双浏览器 UI 验收待用户执行。

- 2026-07-12: **Slice D 云同步完成。** 3 张新表（favorites/saved_configs/brand_profiles）含 RLS + API + hydration + legacy import。Server 193/193（+37 sync）、Client 92/92（+39 slice-d）、双端 tsc --noEmit 通过、dry-run 仅预览 Slice D Migration。证据：`docs/evidence/2026-07-12/slice-D-cloud-sync/`。Migration 未推送（需用户授权）。

- 2026-07-12: **Slice C2b 远端额度闭环完成。** C2a Migration 已推送并进入远端 history；Free 20/7 天、Pro ¥19/自然月 400 次；2 个现有账号均已回填订阅。远端真实事务（全部 rollback）通过 reserve/consume/release/幂等/冲突/跨周期测试，RLS 与最小权限通过。外部 secret 文件仅通过 `.env` 路径指针加载，未复制进仓库。同步修复 localStorage 跨账号收藏泄漏并增加复原配置按钮。Server 156/156、Client 53/53、双端 build 通过。证据：`docs/evidence/2026-07-12/slice-C2b-remote/`。

- 2026-07-11: **Slice C2a Final Fix — 7 项边界修复完成（第三轮）。** reserve_quota 同键并发幂等（FOR UPDATE 后 re-check）、consume/release terminal event_type 冲突检测（同 transition true/相反 false）、reserve_quota current_period_end > now() 校验、uncertain 202 仅限 jobId+reservation、已停用 key 名清除、显式 service_role grant、未确认默认值移除。154/154 server tests + 49/49 client tests，TS + Build 通过。证据：`docs/evidence/2026-07-11/slice-C2a-fix/`。

- 2026-07-11: **Slice C2a Fix — 7 项阻断修复完成。** 原子 RPC reserve/consume/release，追加账本（reservation_id + terminal uniqueness），SUPABASE_SECRET_KEY，timeout 分类（202 keep-alive），死码 SECURITY DEFINER 函数删除，文档准确。143/143 server tests，TS + Build 通过。证据：`docs/evidence/2026-07-11/slice-C2a-fix/`。Migration 未推送，SUPABASE_SECRET_KEY 未配置，价格/额度/周期未决定。

- 2026-07-11: **Slice C2a 本地完成。** 可信写入 + 额度账本本地基础：Migration 草案（plans/subscriptions/usage_ledger + generation_jobs REVOKE UPDATE）+ trusted Supabase adapter + quotaService（reserve/consume/release）+ generate.ts quota orchestration 注入。127 server + 49 client tests 全通过，TS + Build 通过。Security review: 0 critical findings（后发现 7 项阻断 → 已修复）。Migration 未推送。证据：`docs/evidence/2026-07-11/slice-C2a-local/`。

- 2026-07-11: **Slice C1 远端闭环通过。** `20260711223000_fix_generation_soft_delete.sql` 已推送；远端事务验证本人创建/读取/原子软删除成功，模拟其他用户读取为 0、软删除返回 false，事务整体回滚后 `generation_jobs` 为 0。Migration history 已包含 `20260711213000` 与 `20260711223000`。Security Advisor 的 authenticated SECURITY DEFINER 警告属于当前受控 RPC 的刻意设计；泄露密码保护未开启另列为 Auth 待办。

- 2026-07-11: **Slice C1 soft-delete RLS patch 完成。** 远端事务验收发现 UPDATE policy WITH CHECK 拒绝软删除（42501）。新建 `20260711223000_fix_generation_soft_delete.sql` — SECURITY DEFINER RPC 替代直接 UPDATE，内部强制 owner 检查。`softDeleteJob` 改为调用 RPC 返回 boolean。63 server + 49 client tests 全通过。Dry-run 仅预览 patch migration。主 Migration `20260711213000` 已推送远端，patch **未推送**。证据：`docs/evidence/2026-07-11/slice-C1-patch/`。

- 2026-07-11: **Slice C1 v4 客户端响应鉴别修复完成。** 阻断项（盲 cast 2xx→GenerateResponse 导致不完整对象进入 UI）已修复：discriminated response 类型 + generateCopy 重写（网络重试、202 轮询、200 failed 抛错）+ useGenerate 幂等键生命周期修正 + crypto.randomUUID fallback + 11 项新客户端测试。49 client + 45 server tests 全通过，TS + Build 通过。证据：`docs/evidence/2026-07-11/slice-C1-v4/`。Migration 已起草但**未推送远端**。

- 2026-07-11: **Slice C1 v3 验收修复完成。** 9 项验收问题全部修复：Migration 重命名 20260711213000、生成流接入 requireAuth + 原子幂等 + 持久化、PATCH 移除、输入验证、Header 历史入口 + 详情页、Supabase client 级测试 + Migration 静态断言、安全风险评估（grant update→C2 trusted-write）。38 client + 45 server tests 全通过（+6 detail page + 21 server），TS + Build 通过。证据：`docs/evidence/2026-07-11/slice-C1-v3/`。Migration 已起草但**未推送远端**。

- 2026-07-11: **Slice C1 本地实现完成。** generation_jobs Migration 草案（可回滚）+ 后端 generations CRUD API（5 endpoints, requireAuth + owner RLS）+ 前端 HistoryPage（loading/empty/error/list/delete）+ 服务器 18 新测试 + 客户端 5 新测试。32 client + 24 server tests 全通过，TS + Build 通过。证据：`docs/evidence/2026-07-11/slice-C1/`。Migration 已起草但**未推送远端**；生成流尚未接入持久化。

- 2026-07-11: **Slice B 验收修复 v2 完成。** 消除全部 act() 警告 + 新增 6 个行为测试。27 测试全通过（Client 27 + Server 6），0 act warnings，TS + Build 通过。证据：`docs/evidence/2026-07-11/slice-B-acceptance-v2/`。等待真实邮箱 B.17–B.24 人工验证。

- 2026-07-11: **Slice B 验收修复 v1 完成。** 10 项修复全部落实。27 测试全通过（Client 21 + Server 6），0 act warnings。TS + Build 通过。Server 实测启动并加载 .env。证据：`docs/evidence/2026-07-11/slice-B-acceptance/`。16 项自动化检查通过，等待真实邮箱 B.17–B.24 人工验证。

- 2026-07-11: **Slice B 本地接入完成。** 真实 Supabase Auth（publishable key + JWT + user-scoped client）替换全部 localStorage Mock。Client/Server TS + Build 通过。21/21 测试通过。安全性验证通过（无 service_role/secret key/mock 密码/[MOCK] 标）。证据：`docs/evidence/2026-07-11/slice-B-auth/`。

- 2026-07-11: 安全补丁 `20260711170000_harden_role_helpers` 已应用；公开角色 RPC 已移除，仅保留 `private.has_any_role` 供 RLS 使用。Supabase Security Advisors 复查为 0 findings。

- 2026-07-11: 已获授权并将 `20260711000000_slice_b_schema` 应用到 Supabase 开发项目；三张表均启用 RLS。安全顾问发现 public SECURITY DEFINER RPC 警告，已准备未推送的 `20260711170000_harden_role_helpers.sql`，dry-run 通过。

- 2026-07-11: Slice B Migration 安全修复完成并通过 `supabase db push --dry-run`；未修改远端。已移除浏览器角色写入/审计伪造入口，加入列级资料更新权限和显式最小授权。证据：`docs/evidence/2026-07-11/slice-B-migration-review/`。

- 2026-07-11: Slice A 二次独立复测通过：12/12 Vitest、Client/Server TypeScript、Client 构建及浏览器关键交互均通过；确认当前无真实邮箱验证，证据归档至 `docs/evidence/2026-07-11/slice-A-retest/`。

- 2026-07-11: Slice A 完成 — 正式路由 + 账户 Mock 壳。TypeScript + 构建通过，证据归档 `docs/evidence/2026-07-11/slice-A/`。
- 2026-07-11: Slice A 独立复核改判 Needs Fix → 全部 6 项修复完成 → 12/12 Vitest 测试 + TS + 构建通过。
- 2026-07-11T09:43:30: loop `官网第二版视觉重构` stopped because goal was achieved.
- 2026-07-11: 完成 SaaS 可执行性审计；固定 `77` 为唯一宿主，排除当前无法构建且领域不匹配的 `总览` 作为主应用。
- 2026-07-11: 建立项目总入口、页面进度表、SaaS MVP 交接、第一阶段 Claude Code 执行单和项目内 PRD/SDD/TEST_PLAN/ACCEPTANCE/CHANGELOG。
- 2026-07-11: 下一切片确定为“正式路由 + 登录/注册 Mock 壳”；Supabase/迁移/支付均等待对应授权。
- 2026-07-11: PRD Gate 通过；client/server TypeScript 基线检查已归档至 evidence slice-03/04。Vite 彩色输出的证据封装遇到 Windows 编码限制，已记录在 slice-02，不作为项目失败。

- 2026-07-12: ✅ **completed** bug `参考收藏案例入口在无四星收藏时消失` — UX-F1 修复并加回归测试。

- 2026-07-12: recorded feature request `用户反馈中心与管理员微信通知` with high risk (pending).

- 2026-07-12: ✅ **completed** change `工作台 Header 信息架构收纳` — UX-F1 HeaderMenu 实现。

- 2026-07-12: recorded bug request `反馈提交返回 Internal server error` with high risk.

- 2026-07-12: recorded bug request `进入生成历史后工作台结果丢失` with medium risk.

- 2026-07-12: recorded feature request `从生成历史载入工作台` with medium risk.

- 2026-07-12: ✅ **completed + independently reviewed** Slice E 套餐/订单/支付 Mock — 补齐显式 plan allowlist、可信金额测试、BillingPage 渲染测试，将结算入口收纳至 HeaderMenu；用户参考 Logo 已在四处统一裁切白边。Server 306/306，Client 198/198，双端 tsc/build 和本地运行烟测通过。纯内存 Mock，不走真实支付宝/DB Migration/远端订单。证据：`docs/evidence/2026-07-12/slice-E/verification.md`。

- 2026-07-12: recorded bug request `四星收藏参考案例在工作台不可发现` with low risk.

- 2026-07-12: recorded bug request `节日话题未覆盖五个平台版本` with low risk.

- 2026-07-12: recorded bug request `官网Pricing与结算转化链路未接通` with low risk.

- 2026-07-12: ✅ **completed** change request `已开发功能规格沉淀与防覆盖门禁` — regression_matrix.md created with 12 domains, 11 anti-regression gates, and pre-commit checklist.

- 2026-07-12: ✅ **completed** Slice G1 read-only admin dashboard — server-side adminService + admin routes (6 endpoints, requireAuth+requireAdmin), client-side AdminPage (stats/5-tab tables/loading/empty/error/403), HeaderMenu server-verified admin entry. Server 338/338 (+11 admin), Client 243/243 (+10 admin), dual TS/build + secret scan passed. Evidence: `docs/evidence/2026-07-12/slice-G1/`.
- 2026-07-12: ✅ **Slice G1 independently accepted after blocking fixes.** Admin API and client now match the committed Supabase migration schema; default lists exclude generation/feedback body text; generation detail follows `exists → mandatory audit → detail`; selected calendar topics are deterministically enforced across all five variants before audit, consumer simulation, persistence, and response; the reference-case entry is always visible with eligible-count feedback; homepage links to `/pricing`, and auth `next` values are allowlisted. Independent verification: Server 387/387, Client 249/249, both TypeScript checks and production builds passed. Temporary background-worktree secret copy was redacted; the generated worktree remains pending user-approved cleanup.
- 2026-07-13: ✅ 完成收藏案例可信闭环：清理失效选中计数、加强双模型 Prompt 合约、补齐 rules fallback 风格映射；普通管理员新增用户收藏只读列表/审计详情/单条复制，用户 RLS 未放宽。全量验证 Server 425/425、Client 255/255、双端 build 通过。
- 2026-07-13: ✅ 修复配置管理遗漏参考收藏案例：`selectedReferenceCaseIds` 现已进入 SavedConfig、本地保存、Supabase `saved_configs.config` JSON 上下行和 LOAD_CONFIG；配置提示显示参考数量。Client 256/256、TypeScript/build 通过，无 Migration。
- 2026-07-13: ✅ 修复生成历史只恢复结果、不恢复左侧配置：旧 `brief` 可恢复已有结构化写作/画像/收藏/日历字段，新生成记录保存完整 `workbenchSettings`；历史列表与详情新增文字消失恢复提示。Client 259/259、TypeScript/build 通过，无 Migration。
- 2026-07-13: ✅ 完成高影响操作安全与列表收纳：退出登录、复原创作配置、历史单删/详情删除均增加确认；收藏库与生成历史支持多选批量删除、部分失败保留、每页 10 条、品牌/产品/正文检索。历史检索继续使用用户 JWT、owner 条件与 RLS；无数据库变更。Client 270/270、Server 427/427、双端 TypeScript/build 通过。
- 2026-07-13: ✅ 完成 Free 收藏与历史容量权益：Free 最多新增并访问最新 10 条收藏、访问最新 15 条生成历史；超额旧数据保留并显示锁定数，Pro 全部解锁。收藏新增、legacy import、历史列表/搜索/详情均有服务端 `PLAN_LIMIT` 防绕过；锁定收藏不会进入参考案例或 Prompt。Client 276/276、Server 433/433、双端 TypeScript/build 通过，无 Migration、部署或远端写入。证据：`docs/evidence/2026-07-13/slice-plan-limits-verification.md`。

- 2026-07-14: recorded bug request `R1.1 管理员审核保存与正文审阅修复` with high risk.

- 2026-07-14: recorded feature request `R2 收藏文案句子级管理员批注` with high risk.

- 2026-07-14: ✅ **R1.1 本地修复完成，停在远端推送门前** — 新增 `20260714190100_fix_review_actor_role_type.sql`，修复 RPC 向 `audit_log.actor_role` 写入 text 导致的事务回滚；管理员正文框支持纵向拉伸，详情内容区可滚动，保存错误加入可访问提示。Client 365/365、Server 551/551、双端 TypeScript/生产构建与依赖审计通过。远端 Migration 未推送，需用户单独确认。证据：`docs/evidence/2026-07-14/r1-review-save-hotfix/verification.md`。

- 2026-07-14: ✅ **R1.1 远端 Migration 已推送并验证** — 用户明确授权后，仅将 `20260714190100_fix_review_actor_role_type.sql` 应用至 `qiotocumkbwckiezuptr`。远端迁移历史一致；函数含两处 `public.app_role` 转换，ACL 仅 `postgres/service_role`；事务级真实调用 `rpc_ok=true`、`status_ok=true`，随后回滚且持久化测试记录为 0。待用户刷新 `/admin` 做一次浏览器手工保存确认。

- 2026-07-14: recorded feature request `R2.1 收藏正文直接编辑与重新送审` with medium risk.
- 2026-07-15: ✅ R2/R2.1 已完成远端落库。Client 370、Server 554、双端 typecheck/build 通过；Migration `20260714190200` 已推送至 `qiotocumkbwckiezuptr`。远端复核：三列与 review reset trigger 存在，`admin_save_favorite_review` 对 anon/authenticated 不可执行、service_role 可执行。Advisor 仅保留既有警告。

- 2026-07-15: recorded change request `Shorts 展示名统一为 Shorts/TK` with medium risk.

- 2026-07-15: recorded feature request `用户自写收藏文案与待审核队列` with high risk.

- 2026-07-15: recorded change request `Pro 月额度调整为 250 次` with high risk.

- 2026-07-15: recorded feature request `团队协作版 99 元联系定制` with medium risk.

- 2026-07-15: ⛔ **R2 浏览器人工验收按 3 次上限停止** — 前两次修正验收脚本的远端 RPC 参数/批注字段契约；第 3 次 Node 侧隔离账号、同组管理员、收藏和旧审核准备成功，但 Chromium 请求 Supabase Auth 出现 `ERR_CONNECTION_CLOSED`，未进入 `/app`，因此 R2 未人工通过且未继续 Shorts/TK。未修改产品代码、未迁移/部署/commit；证据：`test-results/manual-r2/report.json`。已记录产品决策：存量 Pro 当前周期立即改为 250；团队版为 ￥99/月。

- 2026-07-15: ⛔ **R2 授权重试完成 3 次后再次停止** — 已先删除原 6 个 QA 账号/3 条收藏。浏览器已通过“旧审核可见 → 用户编辑 → 旧审核失效 → 用户和同组管理员均见修改后待审核”，并保存 3 张截图；最后阻断为脚本化 textarea 选区未触发句子批注编辑器，尚未验证保存批注及用户刷新红色高亮。每次重试账号均自动删除，最终远端 QA profile/favorite=0；未进入 Shorts/TK。

- 2026-07-15: ⛔ **R2 第二次授权重试达到 3 次上限** — 键盘选区、真实鼠标拖选、动态像素标定均无法在 headless Chromium 中稳定命中目标 `2..6 / 夏日限定`；实际诊断范围包括 `3..18` 与 `18..19`。精确文本门禁在写入前停止，因此无错误批注，最终远端 QA profile/favorite=0。需要可控制的交互式浏览器或人工拖选完成最后链路；未调用 Grok Build，未进入 Shorts/TK。

- 2026-07-15: ✅ **R2/R2.1 浏览器人工验收通过** — 用户实操完成管理员句子批注与审核保存；用户收藏库截图显示“需修改”、整篇审核意见、三条句子批注和红色正文锚点高亮。证据已归档，R2 阻断关闭。新增待办：管理员审核完成后，用户收到“你的某品牌文案已通过/未通过审核，请立即查看”弹窗，并独立验证 owner 隔离与刷新去重。

- 2026-07-15: ✅ **Shorts/TK 本地切片完成** — 所有用户可见标签统一为 `Shorts/TK`，内部 key 保持 `shorts`；生成、审核、复审与快速检查明确同时适配 YouTube Shorts 和 TikTok。Client 372/372、Server 557/557、双端 typecheck/build、两次 audit 均通过；桌面与 390px 手机浏览器点击、选中态和无横向溢出检查通过。无 Migration、部署、commit 或 push。

- 2026-07-15: ✅ **Pro 250 远端切片完成** — 官网、Pricing、结算、Mock/Sandbox 套餐与 entitlements 统一为每自然月 250 次。Migration `20260715113350` 已授权并推送；1 位有效 Pro 用户保留已用 10 次并立即变为 10/250。远端真实 `reserve_quota` 事务验证 249 可预留、250/251 拒绝，回滚后 QA ledger=0、真实用量仍为 10。Client 372/372、Server 560/560、双端 typecheck/build 与两次 audit 通过；未部署、commit 或 push Git。

- 2026-07-15: ✅ **团队协作版 ￥99/月联系入口本地切片完成** — 官网与 Pricing 均新增团队卡片，展示审核分组、管理员句子批注、待审核队列与提醒；共享弹窗显示微信号 `18595680518` 和项目二维码，支持复制反馈、Esc、焦点管理并明确不会发起支付宝付款。Client 378/378、Server 560/560、双端 typecheck/build 与两次 audit 通过；桌面/390px 手机浏览器验收无横向溢出。无 Migration、部署、订单、权益授予、commit 或 push。

- 2026-07-15: ✅ **用户自写收藏与待审核队列应用层完成，Migration 已推送** — 收藏库新增自写表单、显式审核选择与类型编辑；管理员新增同组待审核筛选、行高亮、圆形角标及合并提醒，数量下降不误报。Migration `20260715121000` 已授权推送并完成远端 history/结构/Advisor 复核；真实 PostgREST anti-join 只读调用通过且列表无正文。Client 383/383、Server 569/569、双端 typecheck/build、production audit 0 vulnerabilities。Playwright runner 连既有 smoke 共 3 次启动超时，截图未判通过；未部署、commit、Git push、reset/clean 或创建 Worktree。

- 2026-07-15: ✅ **用户审核结果弹窗本地切片完成** — owner-scoped 云同步 ready 后显示通过/未通过右下角通知；点击前不标记，稍后/立即查看后按 owner+favorite+revision+review time+status 去重，新审核再次提醒。立即查看会清搜索、翻页、滚动并高亮目标收藏，窗口重新聚焦会主动刷新。Client 388/388、TypeScript、production build 通过；无 Migration、后端接口、Realtime、部署、commit、push、reset/clean 或 Worktree。Playwright 按上一切片 3 次超时停止结论未重跑。

- 2026-07-15: ✅ **管理员待审核空状态说明完成** — 远端只读诊断确认当前 4 条 `review_requested=true` 收藏均已有审核结果（3 需修改、1 已通过），真实 pending=0；新建品牌“11”记录未提交审核。管理员筛选现显示 `只看待审核（N）`，空状态解释已通过/需修改需在全部收藏查看，用户修改并重新提交后才回队列。Client 389/389、Server 受影响回归 25/25、Client production build 通过；未写远端数据、无 Migration/部署/commit/push/reset/clean/Worktree。
- 2026-07-15：✅ **收藏自动送审与管理员后台即时提醒修复完成** — 远端只读诊断确认最新“11”收藏已同步但 `review_requested=false`；新生成文案收藏和收藏正文修改现自动进入待审核，自写收藏显式送审负载已有 hook 回归；`/admin` 新增右下角提醒并支持标签重新可见刷新及“立刻审核”跳转。Client 392/392、Server 569/569、双端 typecheck/build、前端/API 200 均通过。历史 false 记录未回填；无远端写入、Migration、部署、commit/push/reset/clean/Worktree。
- 2026-07-15：✅ **前端路由级代码拆分完成** — 营销、认证、历史、结算、管理员和工作台重组件改为 `React.lazy` 按需加载，主入口 JS 从 857,028 bytes 降至 471,335 bytes（约 -45%），Vite 500 kB 警告消失。Client 393/393、typecheck/build、`/`/`/admin`/`/app` 200 通过。Grok Build 只读审阅连续两次仅返回 CLI 警告、无有效结论，按上限停止且未改文件。无安装、Migration、远端写入、真实支付、部署、commit/push/reset/clean/Worktree。

- 2026-07-15：✅ **Phase 0 CI 与 Migration 基线本地完成** — 新增 Supabase CLI 本地配置和只读 GitHub Actions CI；官方 Actions 固定 SHA，Token 仅 `contents: read`，不引用 secrets、不部署、不执行 DB 写入。linked Migration history 15/15 完全一致，无需 repair。Client 400/400、Server 571/571、双端 typecheck/build、两次 audit 0 vulnerabilities。workflow 尚未 commit/push，GitHub 线上运行与 staging 从零重放未验证。

- 2026-07-15：✅ **Phase 0 GitHub CI 在线验证完成** — 首次 Node 20 运行因 Supabase Realtime 缺原生 WebSocket 失败；最小修复为 CI Node 22。随后将 checkout/setup-node 更新到固定 SHA 的 v5，最终 run `29403089055` 全绿且无旧 runtime 弃用警告。基线已推送；仍未 staging、部署、Migration 写入或真实支付。
