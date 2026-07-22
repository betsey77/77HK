# Task Plan

## V2.1 发布收尾（2026-07-22）

1. 统一人工验收 — completed。
2. 工作台底部空白与再次生成整段标红 — fixed and verified。
3. 本地发布门禁与浏览器双跑 — completed。
4. Dirty Worktree 精确发布清单、`server/src/index.ts` 删除决策 — completed。
5. `release/v2.1` 分组 commit/push 与 GitHub CI — pending explicit authorization。
6. 双 Vercel Preview、Preview 真机/真实模型验收 — pending separate authorization after CI。

## 2.1 Slice E（2026-07-22）

1. E0 规格与 E1 工件快照合同 — completed。
2. E2 数据模型与 E3 BFF/生成 hook — completed locally；Migration applied to staging。
3. E4 验收标准/findings 与 E5 review-only 提案 — completed locally。
4. E6 管理端审阅包/更新日志入口与 E7 诊断指标 — completed locally。
5. E7b 超级管理员诊断提醒、摘要去重与面板折叠 — completed locally。
6. 全量测试、typecheck、production build、证据收口 — completed。
7. E8 staging Migration、真实 Auth/RLS/API、生成 hook、DeepSeek、审计与清理验收 — completed；浏览器按钮截图并入统一人工验收。
8. 统一人工验收、GitHub/Vercel Preview/Production、部署后更新日志 — pending separate release authorization。

当前停止点：E8 staging API/数据闭环已完成；下一步为统一浏览器/人工验收，之后进入 E9 Dirty Worktree 发布清单与 Preview 准备。

## 2026-07-15 Phase 0 CI / Migration checkpoint

- **已完成本地：** `supabase/config.toml`、只读 GitHub Actions CI、安全静态门禁。
- **已只读验证：** linked Migration history 15/15 本地远端一致，旧 W2 漂移已关闭，无需 repair。
- **已验证：** Client 400/400、Server 571/571、双端 typecheck/build、两次 audit 0 vulnerabilities。
- **已完成远端 Git：** Phase 0 基线与 Node 22 CI 修复已 push；GitHub Actions `29403089055` 全绿。
- **仍待授权/外部状态：** 创建独立 staging Supabase 并从零重放 migrations。
- **下一小切片建议：** 在不连接生产数据的前提下准备 Playwright 稳定运行和完整浏览器 E2E 用例分层；staging 创建与部署另行确认。

## 2026-07-14 生产上线门禁复审

- 结论：**尚未达到生产部署条件**；本地核心回归通过，但真实支付宝 sandbox E2E、浏览器 E2E、migration history 对齐、依赖安全、staging/CI、Auth 邮件与运维闭环仍为阻断项。
- 本轮实测：Client 353/353、Server 509/509、双端 production build 通过。
- 新发现：本地/远端 W2 migration 时间戳不一致；production audit 仍有 `form-data` high，完整 audit 另有 `concurrently`/`shell-quote` critical；Supabase Advisor 仍有 SECURITY DEFINER 与 leaked-password 警告。
- 推荐架构更新：按用户确认先采用 Vercel Hobby 免费层，同域托管 Vite + Express Function（东京）并继续使用东京 Supabase；若用途不再属于个人非商业、或生成时延/长连接/GPU 触发门槛，再升级 Pro 或拆为 Vercel 前端 + 独立常驻 API。
- 权威执行计划：`docs/release/2026-07-14-production-launch-plan-v2.md`。
- Grok Build Phase 0 交接：`.planning/prompts/20260714-grok-phase0-production-readiness.md`。
- 本轮未部署、未切生产支付、未推送 Migration、未 commit/push。

## 2026-07-14 checkpoint

- **2026-07-14 部署审计：** 详细的上线阻断项、Vercel + 独立 Express API 建议、真实支付宝与 E2E 分阶段计划见【docs/release/2026-07-14-deployment-readiness-plan.md】。未执行任何部署、真实支付、迁移或 Git 推送。

- **已完成：** 管理员用户收藏「文案类型」sky 彩色 chip + 平台 green 区分；AuthLayout 左栏标题官网渐变（仅前端展示）。
- **已完成：** 登录视觉、收藏卡片头部布局、管理员备注/标签 chip、工作台左侧四大折叠页（仅前端布局）。
- **已完成：** 收藏发布平台可编辑并经既有云同步写回；管理员收藏平台默认使用用户收藏快照而非 `all`，标签/类型中文化，元信息检索与分页可用。
- **已完成：** 结算 checkout 成功后不再额外等待 1.5 秒；安全订单/签名/webhook/回跳代码未变。
- **仍待人工验收：** 登录页深/浅色标题渐变观感；管理员收藏类型/平台双 chip 对比；折叠展开后改参数/保存配置/案例库 state；收藏平台同步与管理员详情正文。
- **仍待单独授权/执行：** 真实支付宝 sandbox 付款与 webhook 回调 E2E；部署；git commit/push（本切片未提交）。

## Current checkpoint — 2026-07-13

- **COMPLETED — 高影响操作确认与批量删除：** 退出/复原确认，收藏与历史多选/全选/批量删除，历史部分失败保留；无 Migration。
- **收藏库卡片品牌/产品识别小切片已完成**：复用现有收藏 settings，在平台标签左侧显示“品牌 · 产品”；Client 260/260 与 production build 通过，无 Migration。
- Slice D cloud sync is **COMPLETE locally and remotely**. 3 tables + 7 API endpoints + mutation sync/outbox + hydration/retry + explicit legacy import. Migration pushed and RLS/limit transaction smoke passed.
- Slice C2a/C2b is complete locally and remotely.
- Slice E 套餐/订单/支付 Mock 已完成。
- Slice G1 管理后台只读 API 已完成（schema-matched, Supertest 401/403/200）。
- **Slice F1 / G1-R 最终阻断修复已完成（本地）**：支付宝沙箱前置架构（checkout/notify/reconcile/adapter）+ 11 项阻断修复。
- **✅ F1 Migration 已推送并完成远端结构/RLS/权限核验；⚠️ 真实支付宝 sandbox E2E 未执行。**
- PAYMENT_MODE 默认 `mock`；所有支付/生产动作仍需单独授权。

## Goal

交付可运行的 77港话通 SaaS MVP；当前只推进 Slice B：真实 Supabase Auth、邮箱确认、profiles/user_roles 与 RLS。

## Success Criteria

- 公开邮箱注册、邮箱确认、登录、退出、忘记/重置密码与过期 session 行为可验证。
- `/app` 使用真实 session 保护；移除账户流程的 Mock 标记和明文 localStorage 密码。
- 创建 `profiles`、`user_roles` 与最小 RLS；普通用户不能自升权，User A 不能读取/修改 User B 的资料。
- 原有官网与生成工作台能力不删减、不降级，并通过回归测试。
- 严格证据覆盖成功、失败、未验证邮箱、权限不足和跨用户隔离；不进入支付、部署或 Slice C。

## Phases

1. Slice A：正式路由 + 登录/注册/重置 Mock 壳（done — 2026-07-11 验收修复通过，12/12 测试）。
2. Slice B：真实 Supabase Auth + profiles/roles/RLS（completed；后续远端 Auth/RLS 切片已验收）。
3. Slice C：generation_jobs + history + 服务端额度。
   - Slice C1：generation_jobs + history + owner RLS（done；v4 + soft-delete patch，远端闭环）
   - Slice C2a：可信写入 + 额度账本本地基础（done；2026-07-11 本地通过，Migration 未推送，secret 未配置）
   - Slice C2b：远端应用 + 真实额度端到端验证（pending — 需用户授权 push + 配置）
4. Slice D：收藏/品牌/配置云同步。
5. Slice E：套餐/订单/支付 Mock。
6. Slice F：支付宝沙箱（需商户与计费决策）。
7. Slice G：管理后台与审计。

## Assumptions

- `77` 是唯一主仓库；`总览` 只读参考。
- 首发只做邮箱账户，Google OAuth 默认暂缓。
- 同步生成可作为持久化 MVP 的过渡，异步 Worker 单独切片演进。

## 2026-07-11 用户授权

- 已授权：Slice B、必要的 Supabase SDK 开发依赖、Supabase 项目连接、本切片迁移、Agent Teams 与 tmux 可视化执行。
- 未授权：支付/订单、支付宝、生产部署、删除或迁移既有业务数据、Slice C 及以后功能。
- 2026-07-12 新授权：仅 Slice E 套餐/订单/支付 Mock 前端与本地可测试壳；真实支付宝、支付 Migration、远端订单写入、真实权益变更和生产部署仍未授权。
- 当前环境：Supabase CLI `2.109.1` 已作为根项目 devDependency 安装，可用 `npx supabase`；仓库仍没有 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`，也没有已登录配置。机器未安装 Docker，因此不能启动完整本地 Supabase 容器栈。允许先完成代码、迁移草案和静态/Mock 测试；远端执行前必须取得有效项目配置，不能伪造通过。

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| `总览 npm run build` 无法解析 `@tanstack/query-core` | 1 | 不修复、不安装；记录为排除总览作为最终宿主的证据 |

- pending: bug - 参考收藏案例入口在无四星收藏时消失 → **RESOLVED 2026-07-12**: Component confirmed always visible; 13 new regression tests added covering hydration, selection, max-3, cross-account isolation.

- pending: feature - 用户反馈中心与管理员微信通知. Confirm with user before implementation.

- pending: change - 工作台 Header 信息架构收纳 → **DONE (UX-F1)**.

- completed: bug - 反馈提交返回 Internal server error；代码与 H1 Migration 已推送，待已登录工作台提交一条反馈完成端到端验收。

- completed: bug - 进入生成历史后工作台结果丢失；owner-scoped session 快照与回归测试通过。

- completed: feature - 从生成历史载入工作台；仅完整 completed job 可载入，真实参数映射与边界测试通过。

- completed: bug - 四星收藏参考案例在工作台不可发现 → **RESOLVED 2026-07-12**: 13 new Area A tests in slice-g1-regression.test.tsx; ReferenceCaseSelector always visible; payload verified.

- completed: bug - 节日话题未覆盖五个平台版本 → **RESOLVED 2026-07-12**: 13 new calendar tests including prompt contract for both prompt builders + fallback engine; coverage validation confirmed; prompt has mandatory 5-platform instruction.

- completed: bug - 官网Pricing与结算转化链路未接通 → **RESOLVED 2026-07-12**: PricingPage content correct; CTA links verified; nextPath security tested; MarketingPage nav links confirmed.

- completed: change - 已开发功能规格沉淀与防覆盖门禁 → **RESOLVED 2026-07-12**: regression_matrix.md created with 12 domains, 11 anti-regression gates.
- completed: bug - 收藏案例已选但生成风格无明显关系 → **RESOLVED 2026-07-13**: invalid ID count fixed; dual-model prompt contract strengthened; rules fallback consumes reference style signals.
- completed: feature - 普通管理员查看用户收藏详情并复制 → **RESOLVED 2026-07-13**: read-only metadata list + fail-closed audited detail + single-copy UI; no mutation/export and no RLS relaxation.
- completed: bug - 配置管理未保存参考收藏案例 → **RESOLVED 2026-07-13**: SavedConfig + Supabase JSON round-trip + LOAD_CONFIG now preserve selectedReferenceCaseIds; UI shows reference count.
- completed: bug - 生成历史载入后左侧配置丢失 → **RESOLVED 2026-07-13**: legacy brief compatibility + full workbenchSettings persistence + history recovery guidance; Client 259/259, TypeScript/build passed.
- completed: safety + usability - 高影响操作确认、收藏/历史批量删除、检索分页 → **RESOLVED 2026-07-13**: 退出/复原/历史删除均先确认；收藏与历史支持多选、当前页全选、批量删除；两处均每页 10 条并可按品牌/产品/正文检索。Client 270/270、Server 427/427、双端 build 通过，无 Migration。
- completed: monetization entitlement - Free 收藏最多 10 条、生成历史开放最新 15 条，其余保留并由 Pro 解锁；客户端提示 + 服务端防绕过，无 Migration。Client 276/276、Server 433/433、双端 TypeScript/build 通过。

## Current checkpoint — 2026-07-13（支付回跳 UI）

- completed: 结算页账户信息复用 HeaderMenu 折叠菜单。
- completed: 仅服务端已确认 paid 的非 Mock 支付自动返回结算页。
- completed: 结算页核对 paid 订单后弹出支付成功 / Pro 已开通窗口；伪造 URL fail-closed。
- completed: 参考收藏案例增加 `shrink-0`，修复左栏只显示绿色细线。
- verified: Client 253/253；TypeScript + Vite build passed。
- authorized next: 普通管理员只读查看用户收藏详情，禁止编辑/删除/导出，记录访问日志。

- completed: bug - R1.1 管理员审核保存与正文审阅修复. Local tests/build/audit passed; remote `20260714190100` pushed and transaction-verified without persisting test data.

- completed: feature - R2 收藏文案句子级管理员批注；自动化验收通过，R2 Migration 已推送并复核。

- completed: feature - R2.1 收藏正文直接编辑与重新送审；自动化验收通过，R2 Migration 已推送并复核。

- completed: change - Shorts 展示名统一为 Shorts/TK；内部 key 保持 `shorts`，Prompt 同时覆盖 YouTube Shorts/TikTok，全量验证与浏览器截图通过。

- completed: feature - 用户自写收藏文案与待审核队列；远端 Migration、应用行为和本地隔离浏览器证据均已验收，真实 Auth/RLS 留待 staging。

- completed: change - Pro 月额度调整为 250 次；Migration `20260715113350` 已推送，存量有效 Pro 当前周期由 10/400 立即变为 10/250，边界事务验证后无 QA 残留。

- completed: feature - 团队协作版 99 元/月联系定制；官网/Pricing 卡片、共享微信联系弹窗、二维码与复制/键盘/手机验收完成，无支付或权益改动。

- completed: feature - 用户审核结果弹窗与管理员待审提醒；2026-07-16 本地隔离 Playwright 6/6×2，覆盖去重、再次提醒和“立即查看”定位，不作为真实 Auth/RLS 证据。

## 2026-07-18 - 1.1.4.5 后续顺序

1. blocked-deploy：Slice A 本地实现与严格验证已完成；API Preview 已更新，Web Preview 三次停在 `UNKNOWN`，稳定 Web 域名未切换；无 Migration。
2. completed-local：Slice B 修复后已由用户重新生成并确认文案体现卖点；本地人工验收通过，未部署。
3. completed-local：Slice C 已新增 owner-only 审核版本摘要、可见页面 15 秒轮询、隐藏暂停、focus 立即刷新和 15/30/60 秒退避；仅版本变化时执行全量 owner bootstrap。Client 422/422、Server 609/609、Playwright 8/8×2。
4. D4-complete-local：D1 Migration 草案、D2 签到 BFF、D3 签到 UI 与 D4 活跃/模型遥测契约均已完成本地实现。D4 聚焦 18/18、Migration 合同 61/61、Server 658/658、typecheck/build 通过；P1-2 至 P1-4 已采用推荐值。D1/D4 Migration 均未应用，D7 数据库执行另行授权。
5. completed-local：D5 已在 DeepSeek/CantoneseLLM 真实尝试边界接入 request/job context、官方 usage、耗时、错误类别与重试/fallback 编号，并证明日志失败不阻断生成；同时修复 cold-start 实际不重试。
6. ✅ D6a：已以权限与口径测试完成普通管理员同组 / `super_admin` 全局 overview API，并完成工作台滚动条视觉融合。
7. ✅ D6b：已实现仅 `super_admin` 的模型健康、bad cases、DeepSeek 余额失败态与最小指标 UI。
8. ✅ D7：用户授权后已完成 staging dry-run、两项 Migration 单次应用、结构/ACL/Advisor 复核及真实 RLS、8 路并发、奖励领取、活动 API、模型日志约束与清理验收；最终人工视觉/业务验收仍为发布前门禁。
6. pending：审计 Dirty Worktree，按功能切片提交并 push，使 GitHub/Vercel 自动部署基线重新一致。

## 2026-07-22 - 2.1 Slice E 后续顺序

1. ✅ E0：完成 Bad Case 诊断审阅包规格，覆盖样本、Operational Trace、双 Owner、版本化验收标准、Prompt/规则/知识工件和带证据 Findings。
2. ✅ E1：工件 manifest/version/hash 与新任务生成时快照合同；旧任务只标 `legacy_unavailable`。
3. ✅ E2：Review Pack/Finding/Event 数据层、自动触发与 Migration；Migration 已应用 staging。
4. ✅ E3：仅 `super_admin` 的审计详情 API、Owner 和 Trace；详情保持 scope/audit/recheck/body。
5. ✅ E4：确定性标准引擎、错误位置分类、evidence refs 和责任团队建议。
6. ✅ E5：Prompt/规则/知识审阅器与不可直接发布的修复提案。
7. ✅ E6：管理端筛选、详情、指派、状态和人工 disposition 闭环 UI；`HeaderMenu -> 更新日志` 外壳已完成，仍不把未部署功能标为已上线。
8. ✅ E7/E7b/E7c：脱敏评测候选、诊断指标/提醒/折叠、DeepSeek review-only 诊断和明确按钮反馈。
9. partial E8：staging Migration/RLS/ACL 已完成；仍需真实角色/API/浏览器/DeepSeek/审计/清理闭环的单独授权验收。
10. pending E9：最终人工验收后，才进入 commit/push/Vercel Preview/Promote 的独立授权流程；生产部署成功后按 deployment manifest 回填本次全部真实上线更新。

Grok 执行说明：只使用 Grok CLI 自身 Agent Teams/Autonomous Agents/worktree/background task，不使用 Codex 子代理。用户已授权并建立本地 `refs/codex/checkpoints/2026-07-22-slice-e-baseline`；后续 worktree 必须显式使用该 ref，成员不得继续派生任务。
