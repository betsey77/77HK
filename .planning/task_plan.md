# Task Plan

## Current checkpoint — 2026-07-12

- Slice D cloud sync is **COMPLETE locally and remotely**. 3 tables + 7 API endpoints + mutation sync/outbox + hydration/retry + explicit legacy import. Migration pushed and RLS/limit transaction smoke passed.
- Slice C2a/C2b is complete locally and remotely.
- Workbench usability polish is complete: history back-navigation, collapsed note summaries, collapsible reference cases, and signup confirmation loading/copy.
- Next candidate: Spec v2.1 F1 simulated generation progress (diagnosis → generation → audit → feedback). After F1, continue with Slice E payment/order mock. Real Alipay integration remains a separate high-risk gate and requires explicit user approval.
- Pricing: Free 20 successful full-generation workflows per rolling 7 days; Pro ¥19/month and 400 workflows. Feature-level entitlements are not yet enforced.

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
2. Slice B：真实 Supabase Auth + profiles/roles/RLS（in progress；2026-07-11 已获迁移授权）。
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
