# Findings

## Slice G1 (A/B/C/D/E) Findings — 2026-07-12

### Architecture Decisions

- **ReferenceCaseSelector**: Already always visible and correct. Added 13 new tests covering hydration, selection toggle, max-3 constraint, and cross-account isolation.
- **Calendar coverage**: Prompt already has 🚨 mandatory 5-platform instruction. Added 13 new tests covering DeepSeek/Cantonese LLM prompt builders, fallback engine, and prompt contract validation. Exported `buildCalendarEventsSection` for testability.
- **Pricing/Billing**: Already correct — PricingPage plan content, CTA links, nextPath security, MarketingPage nav links, HeaderMenu billing entry all in place. Verified with existing tests.
- **Regression matrix**: Created `.planning/regression_matrix.md` with 12 domains, 11 anti-regression gates, and pre-commit checklist.
- **Admin dashboard**: Implemented adminService (trusted Supabase, field allowlists, pagination), admin routes (6 endpoints scoped to `/admin` prefix with requireAuth+requireAdmin), AdminPage (5-tab dashboard with stats, tables, loading/empty/error/403 states), and HeaderMenu admin entry (server-verified via `checkAdminAccess`, not browser role string).
- **Middleware scoping**: Admin router must use `router.use('/admin', ...)` not `router.use(...)` to avoid intercepting non-admin routes.

### Verification

- Server: 338/338 tests (+11 admin tests)
- Client: 243/243 tests (+33 g1-regression + 10 admin tests)
- Server tsc --noEmit: pass
- Client tsc --noEmit: pass
- Secret scan: 0 findings in new files
- No new dependencies added
- No real migrations, no remote writes

## Slice H1-R Findings — 2026-07-12

- sessionStorage 快照恢复必须配合测试 beforeEach 清理 `ssStore.clear()`，否则跨测试残留会导致 `SET_ERROR → variants 应为 null` 断言失败。
- `Notifier` 接口增加可选 `isConfigured?()` 方法避免破坏现有 NoopNotifier 使用者；测试使用 `?.()` 调用。
- Migration trigger 中的 advisory lock key 计算使用 `hashtext` 衍生，跨 uuid 碰撞概率极低但在极端场景下可能误串行化；生产环境建议在 `pg_stat_user_tables` 确认无实际碰撞。
- DB trigger `RATE_LIMIT` 错误通过 `P0001` (raise_exception) 传播到 BFF，BFF 做模式匹配映射到 429；这种方式只在 INSERT 阶段生效，不影响 SELECT/UPDATE。
- `FeedbackCenter` 焦点管理在测试环境下 `jsdom` 不完全支持 `document.activeElement` 赋值，初始焦点测试使用 `waitFor` + `toHaveFocus` 需确保 close button ref 已挂载。

## Slice D Final Findings — 2026-07-12

- 实测跨账号收藏问题包含客户端旧 global localStorage 导入风险；现在改为账号命名空间 + 明示导入/跳过。
- 仅有 RLS 不足以保证业务上限；配置 20 条上限由数据库 trigger 原子执行，不能依赖 Express 的 count-then-insert。
- 云同步不能只比较 ID，否则备注、评分、同 ID 配置修改会静默漏传；最终使用序列化内容快照。
- 网络失败使用 owner-scoped outbox，并在 bootstrap 前重放，避免旧云数据覆盖本地乐观更新。
- Security Advisor 仍有两个既知警告：受控 soft-delete SECURITY DEFINER RPC、泄露密码保护未开启；均非 Slice D 新增。
- Performance Advisor 仅报告未使用索引；新表当前 0 行，现阶段不据此删除索引。

## Slice D — Cloud Sync (2026-07-12) — 全部完成

### Architecture Decisions

- **3 表 RLS 设计**：favorites（UNIQUE owner+client）、saved_configs（同模式，MAX 20）、brand_profiles（UNIQUE owner，MVP 单品牌）
- **身份保护**：所有路由 requireAuth；owner_id 取自 JWT，不从 body；overpost 显式拒绝
- **幂等导入**：INSERT ON CONFLICT (owner_id, client_id) DO UPDATE；重复执行不增行
- **旧数据隔离**：旧全局 key 仅检测并提示，用户确认后才导入；导入后写 marker 不删旧 key
- **合并策略**：云端为主（匹配 client_id）、本地 namespaced 未匹配项自动导入、hydration 前不覆盖
- **同步容错**：变更 fire-and-forget + 非阻断错误提示（"仅保存在本机"）

### Verification

- Server 193/193 tests、Client 92/92 tests、双端 tsc --noEmit ✅
- supabase db push --dry-run：仅 20260713000000_slice_d_cloud_sync.sql
- 安全扫描：0 secrets/tokens/keys in new code
- git diff --check：无空白问题

## Slice C2a Final Fix (2026-07-11) — 7 项边界修复全部完成（第三轮）

### Fix Summary

- **#F1 reserve_quota 同键并发幂等边界**: FOR UPDATE 后再次查询 idempotency，发现已有 reserve 直接返回；不再因 quota_used 已满而返回 null
- **#F2 consume/release terminal 冲突检测**: 查询已存在 terminal event_type：同 transition→true（幂等），相反→false（冲突）
- **#F3 reserve_quota 有效周期**: 添加 `current_period_end > now()` 条件
- **#F4 uncertain 202 守卫**: 仅 `uncertain && jobId && reservation` 返回 202；无 reservation 走普通 500
- **#F5 已停用 key 名清除**: 已停用 legacy key 精确名从源代码/测试/spec/planning/evidence-fix 全部移除
- **#F6 显式 service_role grant**: `grant select, insert, update on generation_jobs to service_role`，不依赖 C1 继承
- **#F7 未确认默认值移除**: plans 删 default 加 CHECK；subscriptions 加 CHECK 约束；不 seed

### Verification

- Server Vitest: 154/154 (src only)
- Client Vitest: 49/49
- Client/Server TS + Build: pass
- Evidence: `docs/evidence/2026-07-11/slice-C2a-fix/`

### Pending (user gate)

- Migration not pushed; SUPABASE_SECRET_KEY not configured
- Price/quota/cycle not decided

---

## Slice C2a Fix (2026-07-11) — 7 项阻断全部修复（已被 Final Fix 取代）

### Fix Summary

- **#1 Atomic reserve**: `reserve_quota` RPC with FOR UPDATE lock; quotaService calls only .rpc()
- **#2 Append-only ledger**: consume/release INSERT terminal events with reservation_id; original rows never mutated
- **#3 No TOCTOU fallback**: release_quota RPC atomically decrements quota_used; TS code has zero fallback
- **#4 Modern key**: `SUPABASE_SECRET_KEY` only; no legacy key names in source, tests, or docs
- **#5 Timeout resilience**: UNCERTAIN_ERROR_PATTERNS classification; timeout→keep job+reservation→202
- **#6 Dead functions removed**: complete/fail/mark job SECURITY DEFINER functions deleted; BFF uses service_role direct UPDATE + owner_id WHERE
- **#7 Docs accurate**: No "known medium but done" false claims; all 7 issues resolved

### Verification

- Server Vitest: 143/143 (src only)
- Client TS + Build: pass
- Server TS + Build: pass
- Evidence: `docs/evidence/2026-07-11/slice-C2a-fix/`

### Pending (user gate)

- Migration not pushed; SUPABASE_SECRET_KEY not configured
- Price/quota/cycle not decided

## Slice C2a (2026-07-11) — original implementation (superseded by C2a Fix above)

### Implementation

- Migration `20260712000000_slice_c2a_trusted_write_quota.sql`: plans, subscriptions, usage_ledger tables + REVOKE UPDATE hardening (rewritten in fix)
- `trustedSupabase.ts`: service_role client, fail-closed, no VITE_/legacy keys (key name updated in fix)
- `quotaService.ts`: RPC-based reserve/consume/release/getUserEntitlement (rewritten in fix)
- `quota.test.ts`: 30 tests (rewritten in fix)
- `generate.ts`: quota orchestration with uncertain error classification (updated in fix)
- `generationJobsService.ts`: trusted client + owner_id WHERE (unchanged)
- `generations.test.ts`: ~50 C2a migration assertions (updated in fix)
- `types/index.ts`: +QuotaReservation, +UserEntitlement (unchanged)

## Slice A (2026-07-11)

- AuthContext + 4 auth pages + AuthLayout created; App.tsx routing updated.
- 零新增依赖：路由用纯 pathname 判断，动画用纯 CSS。
- 总览 DarkVeil 用 CSS 渐变 + 关键帧动画近似，效果可接受。
- Header 增加 `onLogout` prop，向后兼容，无破坏性改动。
- 所有 Mock 数据存储在 `hk-cantonese-mock-auth` localStorage key。
- Client/Server TS + 构建无错误。

## Files Read

- `开发日志/02-PRD-77港话通社媒文案器-SaaS.md`
- `开发日志/03-SPEC-77港话通社媒文案器-SaaS.md`
- `77/CLAUDE.md`、`77/client`、`77/server`
- `总览/src/routes/login.tsx`、Auth/Supabase 参考与 migrations
- `登录页` 独立视觉复现项目

## Technical Findings

- Slice A 独立验收：`ResetPasswordPage` 在 `mockResetPassword` 失败后仍无条件显示成功。
- Auth 页面各自从 localStorage 读取 `isDark` 快照，主题状态未形成单一响应源。
- Workbench 多处把交互品牌色写死为 emerald；light 需要按语义改 orange，成功/审核 green 保留。
- Auth label/input 缺少 htmlFor/id；项目无任何 test/spec 行为测试文件。
- 本机 `5173` 被旧 `D:\work\思念\client` 占用，77 当前实际运行于 5175/5177；交接必须以终端端口为准。
- Claude Code 2.1.193 与 MSYS2 tmux 3.6a 可用，但 Agent Teams/split-panes 尚未开启。

- `77/client` 与 `77/server` TypeScript 检查通过，核心工作台是最稳基线。
- `总览` 生产构建失败，且 migrations/route 仍是费用报销领域。
- `总览` 登录逻辑依赖管理员分配账号、邮箱域名、Lovable OAuth，与已确认公开邮箱注册冲突。
- `77` 仍缺 Auth、RLS、服务端历史、额度、支付和管理员。
- `.env.example` 被 Git 跟踪、处于用户修改状态且含疑似真实密钥；未覆盖，部署前需用户处理和轮换。

## User Confirmations

- 支付方向：支付宝、CNY。
- 套餐：Free/Pro，可扩展第三档。
- 注册：公开邮箱。
- 正文保留至用户主动删除；注销后 30 天删除。
- 管理员正文默认可查看、只读，违规可删并记录访问日志。
- 超级管理员拥有业务权限，但仍受密钥、审计和支付真实性边界限制。
- 希望直接套用总览登录页，并由 Claude Code 负责后续具体开发。

## Decisions

- 最终宿主固定为 `77`，不再保留“迁入总览或带回77”的双轨决策。
- 迁移登录视觉，重写 Auth 逻辑；不复制总览报销领域。
- 开发顺序为账户 → 数据 → 核心持久化 → 支付 → 后台，支付不提前于任务归属与额度台账。
