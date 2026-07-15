# Cross-Domain Regression Matrix

Generated: 2026-07-12
Purpose: Prevent future slices from silently deleting, hiding, downgrading, or mock-overriding completed real capabilities.

## Domain Map

| # | Domain | Status | PRD Ref | SDD Ref | Test Files | Acceptance | Last Verified |
|---|--------|--------|---------|---------|------------|------------|---------------|
| 1 | Auth (Supabase) | ✅ Real | spec/PRD.md §Slice B | spec/SDD.md §Auth | slice-b.test.tsx | slice-B-acceptance-v2 | 2026-07-12 |
| 2 | Generation (5-layer Prompt) | ✅ Real | spec/PRD.md §Core | spec/SDD.md §Prompt | useGenerate + server | 2026-07-11 | 2026-07-11 |
| 3 | 5-layer Prompt Architecture | ✅ Real | docs/comprehensive-spec-v2.md | CLAUDE.md | Prompt structure static | 2026-07-11 | 2026-07-11 |
| 4 | Reference Cases (≥4★ bookmarks) | ✅ Real | Task A (this slice) | AppContext.tsx | slice-g1-regression.test.tsx | Task A tests pass | 2026-07-12 |
| 5 | Calendar (5-platform) | ✅ Real | Task B (this slice) | calendarValidation.ts | calendar-validation.test.ts | Task B tests pass | 2026-07-12 |
| 6 | History (generation_jobs) | ✅ Real | Slice C1 | generations API | slice-c1.test.tsx | Slice C1 v4 | 2026-07-11 |
| 7 | Favorites Cloud Sync | ✅ Real | Slice D | sync API | slice-d.test.tsx, slice-d-hook.test.tsx | Slice D final | 2026-07-12 |
| 8 | Feedback (User) | ✅ Real | Slice H1-R | feedback API | slice-h1.test.tsx | Slice H1-R | 2026-07-12 |
| 9 | Quota (trusted write) | ✅ Real | Slice C2a/C2b | quotaService.ts | quota.test.ts, generations.test.ts | Slice C2b remote | 2026-07-12 |
| 10 | Pricing/Billing | ✅ Mock+Sandbox | Slice E + F1 | PricingPage, BillingPage, BillingResultPage | slice-g1-regression.test.tsx, billing.test.ts | Slice F1 final | 2026-07-13 |
| 11 | Header IA (Menu) | ✅ Real | UX-F1 | HeaderMenu.tsx | slice-ux-f1.test.tsx | UX-F1 | 2026-07-12 |
| 12 | Dual Theme (dark/light) | ✅ Real | docs/design-system.md | Theme in AppContext | slice-ux-f1.test.tsx | 2026-07-11 | 2026-07-11 |
| 13 | Payment/Alipay F1 | ⚠️ Sandbox E2E Pending | Slice F1 | alipayService/Adapter/Config + billing routes | billing.test.ts, alipayAdapter.test.ts, admin.test.ts | F1 migration pushed; preflight passed | 2026-07-13 |
| 14 | History → Workbench Full Restore | ✅ Real | History recovery | workbenchSnapshot + brief.workbenchSettings | slice-history-settings.test.ts, slice-h1-r-history.test.ts, slice-c1.test.tsx | 2026-07-13 | 2026-07-13 |
| 15 | Favorites Card Brand/Product Metadata | ✅ Real | 收藏卡片识别信息 | FavoritesPanel.tsx | slice-ui-polish.test.tsx | 2026-07-13 | 2026-07-13 |

## Anti-Regression Gates

### Gate 1: Auth
- **Must NOT**: Replace real Supabase auth with localStorage mock
- **Must NOT**: Remove requireAuth middleware from any /api route that currently uses it
- **Must NOT**: Remove or weaken email verification flow
- **Must NOT**: Expose service_role or secret keys to client
- **Guard test**: `slice-b.test.tsx` — must keep passing; auth context must remain real

### Gate 2: Generation + 5-layer Prompt
- **Must NOT**: Remove or collapse any of the 5 prompt layers (System Identity, Compliance, Writing Framework, Contextual, Output Format)
- **Must NOT**: Remove the self-critique (港話自檢) section
- **Must NOT**: Remove any of the 5 platform variants from Variants type
- **Must NOT**: Downgrade the prompt quality by reducing word count or removing vocabulary tables
- **Guard**: `docs/comprehensive-spec-v2.md` is the authoritative spec for generation domain
- **Guard test**: calendar-validation.test.ts — prompt contract tests

### Gate 3: Reference Cases
- **Must NOT**: Hide ReferenceCaseSelector component (must always be visible in InputPanel)
- **Must NOT**: Remove the "可用 N 条 · 已选 M/3" count display
- **Must NOT**: Remove the max-3 selection constraint
- **Must NOT**: Remove referenceCase payload from generate requests
- **Must NOT**: Use non-owner-scoped bookmark data (cross-account isolation)
- **Guard test**: slice-g1-regression.test.tsx — Area A tests

### Gate 4: Calendar
- **Must NOT**: Remove `buildCalendarEventsSection` from either prompt builder
- **Must NOT**: Remove the 🚨 mandatory instruction text
- **Must NOT**: Change calendar coverage to single-platform only
- **Must NOT**: Add infinite retries or hidden quota costs to coverage validation
- **Must NOT**: Alter behavior when no calendar events are selected
- **Must NOT**: Downgrade `ensureCalendarCoverage` enforcement back to `validateCalendarCoverage` warning-only
- **Must NOT**: Remove deterministic bridge sentences for missed platform variants
- **Final behavior**: Five-platform mandatory enforcement — when calendar events are selected, any missing platform variant receives a deterministic bridge sentence BEFORE persist/return
- **Guard test**: calendar-validation.test.ts — all 33 tests

### Gate 5: History
- **Must NOT**: Remove generation_jobs persistence
- **Must NOT**: Remove owner-scoped RLS on generation_jobs
- **Must NOT**: Remove soft-delete capability
- **Must NOT**: Remove the "回到工作台" history-to-workbench navigation
- **Guard test**: slice-c1.test.tsx, generations.test.ts

### Gate 6: Favorites Cloud Sync
- **Must NOT**: Remove cloud sync API endpoints
- **Must NOT**: Replace cloud hydration with localStorage-only
- **Must NOT**: Remove legacy import flow
- **Must NOT**: Remove owner-scoped outbox and retry
- **Must NOT**: Hide an available favorite brand/product summary or move it behind the highlighted platform label
- **Guard test**: slice-d.test.tsx, slice-d-hook.test.tsx, slice-ui-polish.test.tsx

### Gate 7: Feedback
- **Must NOT**: Remove authenticated feedback submission
- **Must NOT**: Remove FeedbackCenter dialog
- **Must NOT**: Remove rate limiting from feedback
- **Guard test**: slice-h1.test.tsx

### Gate 8: Quota
- **Must NOT**: Remove trusted-write quota reserve/consume/release
- **Must NOT**: Downgrade to client-side quota counting
- **Must NOT**: Remove the atomic RPC-based ledger
- **Must NOT**: Change Free/Pro limits without updating PricingPage
- **Guard test**: quota.test.ts, generations.test.ts

### Gate 9: Pricing/Billing (Mock + Sandbox)
- **Must NOT**: Remove /pricing route
- **Must NOT**: Remove pricing links from MarketingPage nav
- **Must NOT**: Change Free CTA from signup or Pro CTA from login+next
- **Must NOT**: Weaken nextPath allowlist security
- **Must NOT**: Add new top-right nav entries (use HeaderMenu)
- **Must NOT**: Trust client-submitted amounts (server reads from DB/config)
- **Must NOT**: Grant Pro entitlement from sync return page
- **Must NOT**: Mix mock state with real DB entitlements
- **Guard test**: slice-g1-regression.test.tsx — Area C tests; billing.test.ts; admin.test.ts

### Gate 12: Payment/Alipay F1 (Migration Pushed — Sandbox E2E Pending)
- **Migration pushed**: `20260713000000_slice_f1_payment_sandbox.sql` is registered remotely as `20260713000000 slice_f1_payment_sandbox`
- **E2E NOT executed**: Authenticated checkout → Alipay sandbox payment → notify/query entitlement grant still requires manual sandbox verification
- **Must NOT**: Re-push/alter the F1 migration or enable production mode without explicit user auth
- **Must NOT**: Replace authoritative `plans.is_public` / `period_unit in ('week','month')` with non-schema fields
- **Must NOT**: Remove PKCS8/PKCS1 private-key detection or leave a payment order pending after page-pay initialization fails
- **Must NOT**: Store full Alipay notify payload in DB (hash only)
- **Must NOT**: Log private keys, signatures, or full payment params
- **Must NOT**: Perform DB mutation before signature verification
- **Must NOT**: Return `paid: true` from reconcile when RPC fails
- **PAYMENT_MODE default**: `mock` (all existing functionality preserved)
- **Guard test**: billing.test.ts, alipayAdapter.test.ts, admin.test.ts

### Gate 10: Header IA
- **Must NOT**: Move low-frequency items from HeaderMenu back to header row
- **Must NOT**: Remove high-frequency items (历史, 收藏库, engine status) from visible header
- **Guard test**: slice-ux-f1.test.tsx — Header Refactoring tests

### Gate 11: Dual Theme
- **Must NOT**: Remove theme toggle from HeaderMenu
- **Must NOT**: Hardcode colors to dark-only (emerald) without light (orange) variants
- **Guard**: docs/design-system.md color specs

### Gate 14: History → Workbench Full Restore
- **Must NOT**: 只恢复生成结果而把左侧输入配置静默重置为默认值
- **Must NOT**: 移除 `brief.workbenchSettings` 持久化或旧 `brief` 兼容解析
- **Must NOT**: 让非法历史配置绕过运行时校验，或改变 owner-scoped session 隔离
- **Must NOT**: 移除历史列表/详情的文字消失恢复提示
- **Guard test**: `slice-history-settings.test.ts`, `slice-h1-r-history.test.ts`, `slice-c1.test.tsx`

### Gate 15: Free 收藏与历史容量权益
- **Must NOT**: 仅在客户端隐藏超额数据而移除服务端 `PLAN_LIMIT` 门禁
- **Must NOT**: 删除、覆盖或静默迁移既有超额收藏/历史
- **Must NOT**: 让锁定收藏进入参考案例选择或生成 Prompt
- **Must NOT**: 允许关键词搜索或详情 URL 绕过最新 15 条历史范围
- **Must NOT**: 阻止 Free 更新/删除已有收藏，或在删除后仍拒绝释放的容量
- **Guard test**: `slice-plan-limits.test.tsx`, `slice-c1.test.tsx`, `generations.test.ts`, `sync.test.ts`

## Slice Pre-Commit Checklist

Before marking any new slice as complete, verify:
1. [ ] All 15 domains' guard tests still pass
2. [ ] No real capability replaced with Mock unless explicitly authorized
3. [ ] No existing endpoint removed or weakened
4. [ ] No existing component hidden or conditionally removed
5. [ ] No localStorage key namespace changed without migration
6. [ ] Client tsc --noEmit passes
7. [ ] Server tsc --noEmit passes
8. [ ] Client build passes
9. [ ] Server build passes
10. [ ] No secrets/tokens in new code (secret scan)
11. [ ] This matrix updated with any new domain or changed status
