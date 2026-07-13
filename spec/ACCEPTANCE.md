# Acceptance Criteria

## 2026-07-12 — Slice E 本地验收（权威状态）

| 验收项 | 结果 |
|---|---|
| 定价页 Free/Pro 双卡 + MOCK 标签 | ✅ 渲染测试通过 |
| 定价页价格、配额、功能列表、CTA 链接 | ✅ 全部渲染验证通过 |
| 定价页 FAQ 区 | ✅ 渲染测试通过 |
| 结算页受保护（需鉴权） | ✅ auth gate by ProtectedRoute |
| 结算页加载/空状态/错误/列表 | ✅ API client 测试覆盖 |
| POST /api/billing/checkout 校验 planId | ✅ 测试验证 |
| 原型链键不可绕过 planId allowlist | ✅ constructor / __proto__ / toString 均返回 400 |
| 前端篡改金额不改变订单金额 | ✅ 服务端仍按 Pro 定价返回 ¥19 |
| 拒绝 Free→Free + Pro→Free | ✅ 测试验证 |
| 成功创建 Mock 订单含 redirectUrl | ✅ 测试验证 |
| GET /api/billing/orders 按 userId 隔离 | ✅ User A/B 隔离测试 |
| GET /api/billing/orders/:id 拒绝非所有者 | ✅ 403 测试 |
| GET /api/billing/orders/:id 404 | ✅ 测试验证 |
| GET /api/billing/plans 公开无需鉴权 | ✅ 测试验证 |
| 支付结果页成功/取消状态 | ✅ 渲染 + 订单摘要测试 |
| 支付结果页缺少 orderId 错误态 | ✅ 错误消息测试 |
| 所有响应和页面含 isMock/[MOCK] | ✅ 类型常量 + 渲染测试 |
| 不走真实支付宝/DB Migration/远端订单 | ✅ 纯内存 Mock |
| 结算入口不挤占 Header 横排 | ✅ 收纳至 HeaderMenu |
| 新 Logo 无白边容器 | ✅ 官网、工作台、定价、结算四处共用裁切规范 |
| 现有功能无回归 | ✅ Server 306/306; Client 198/198 |
| 自动化验证 | ✅ 双端 tsc、生产 build 与运行烟测通过 |
| 证据保存 | ✅ `docs/evidence/2026-07-12/slice-E/verification.md` |

## 2026-07-12 — Slice H1 本地验收（权威状态）

| 验收项 | 结果 |
|---|---|
| 收藏删除确认对话框（Escape/焦点/aria） | ✅ 24 项行为测试通过 |
| 确认对话框危险/非危险配色 | ✅ 红色 danger vs 亮橙/emerald |
| FeedbackCenter drawer 四种反馈类型 | ✅ 渲染 + 表单校验测试通过 |
| 反馈提交 loading/success/error 状态 | ✅ 行为测试覆盖 |
| POST /api/feedback 持久化 + 通知 | ✅ 26 项 API 测试通过 |
| 通知失败仍返回 201 | ✅ 测试验证 |
| 未登录拒绝 401 | ✅ Auth gate 测试 |
| 服务端输入校验（类型/长度/meta） | ✅ 所有边界测试通过 |
| ServerChan notifier 超时/失败 | ✅ 18 项单元测试通过 |
| SendKey 不泄漏（错误脱敏） | ✅ 测试断言 |
| 自动化验证 | ✅ Server 253/253；Client 159/159；双端 TypeScript/build 通过 |
| H1 Migration | ✅ `20260712072936` 已通过认证 Supabase MCP 应用并完成结构验收 |

仍需人工完成：从已登录工作台提交一条普通反馈；真实 Server酱通知测试必须另行确认。

## 2026-07-12 — Slice H1-R 独立复验

| 验收项 | 结果 |
|---|---|
| 工作台结果在历史往返后恢复 | ✅ owner-scoped sessionStorage 行为测试通过 |
| 完整历史记录载入工作台 | ✅ 原平台、语气、语言与生成结果映射测试通过 |
| 失败/不完整历史不可载入 | ✅ 边界测试通过 |
| 坏快照与跨账号快照隔离 | ✅ 行为测试通过 |
| H1 管理员 RLS helper | ✅ 静态测试限定 `private.has_any_role` |
| 工作台与官网共用 77 Logo | ✅ 双页面渲染回归测试通过；静态资源可用 |
| 自动化验证 | ✅ Client 170/170；Server 282/282；双端 TypeScript 与 build 通过 |
| Migration 远端应用 | ✅ MCP 应用成功；表、RLS、策略、授权与触发器已读取验证 |

当前边界：用户已于 2026-07-12 完成浏览器反馈提交测试；真实 Server酱通知是否送达以用户微信端结果为准。

## 2026-07-12 — UX-F1 生成进度 + Header 菜单收纳（权威状态）

| 验收项 | 结果 |
|---|---|
| 四阶段进度条渲染 | ✅ pending/active/done/failed 四态视觉正确 |
| "预估"标注可靠 | ✅ 标注清晰显示于进度下方 |
| 进度阶段推进 | ✅ 诊断原文→生成变体→质量审核→消费者反馈 |
| 暗色 emerald / 亮色 orange | ✅ 设计系统颜色对 |
| Header 高频保留 | ✅ 历史、收藏库、引擎状态直接可见 |
| HeaderMenu 收纳 | ✅ 官网、复原配置、主题、退出在菜单中 |
| Menu 键盘/Escape/点击外部 | ✅ 全部行为测试通过 |
| Menu aria 属性 | ✅ aria-expanded/haspopup/menu/menuitem |
| ReferenceCaseSelector 始终可见 | ✅ 回归测试通过 |
| 自动化验证 | ✅ Client 135/135；双端 TypeScript/build 通过 |

## Slice B — Acceptance Criteria

## 2026-07-12 — Slice D 云同步最终验收（权威状态）

| 验收项 | 结果 |
|---|---|
| 收藏、备注、评分、删除同步 | ✅ reducer 真实行为测试通过 |
| 配置新增、修改、删除同步 | ✅ 内容快照检测，不再只比较 ID |
| 品牌新增、修改、清空同步 | ✅ null 清空可同步 |
| hydration / retry / outbox | ✅ 不自我取消；失败操作持久化并可重放 |
| 服务端 owner_id | ✅ 仅取认证用户；payload/filter 精确断言 |
| 数据库 RLS | ✅ 三表启用；双账号角色事务模拟通过 |
| 配置上限 | ✅ 数据库原子限制 20 条；第 21 条失败；已有项可更新 |
| Migration | ✅ `20260712070000_slice_d_cloud_sync` 已推送远端 |
| 自动化验证 | ✅ Server 209/209；Client 113/113；双端 TypeScript/build 通过 |

仍需人工完成：用两个真实浏览器会话操作收藏与刷新，确认最终 UI 文案和交互体验。

## Slice D — Cloud Sync (✅ PASSED — 2026-07-12, Audit Fix v2 2026-07-12)

| # | Criterion | Result |
|---|-----------|--------|
| D.1 | Migration `20260713000000_slice_d_cloud_sync.sql` exists | ✅ |
| D.2 | Migration `supabase db push --dry-run` shows ONLY Slice D | ✅ |
| D.3 | 3 tables created: `favorites`, `saved_configs`, `brand_profiles` | ✅ |
| D.4 | RLS enabled on all 3 tables; anon=no access; authenticated=own rows | ✅ |
| D.5 | `GET /api/sync/bootstrap` returns user's cloud data | ✅ |
| D.6 | `POST /api/sync/favorites` upsert with validation | ✅ |
| D.7 | `DELETE /api/sync/favorites/:clientId` only own; 404 for others | ✅ |
| D.8 | `POST /api/sync/configs` enforces MAX_SAVED_CONFIGS=20 | ✅ |
| D.9 | `POST /api/sync/import` idempotent (duplicate run doesn't increase count) | ✅ |
| D.10 | `PUT /api/sync/brand-profile` MVP: one per user | ✅ |
| D.11 | Body `owner_id`/`ownerId`/`id` rejected (overpost protection) | ✅ |
| D.12 | Validation: variantKey enum, rating 1-5, content/source length, JSON type | ✅ |
| D.13 | DB errors sanitized — no constraint/table names leaked | ✅ |
| D.14 | Client cloudSync service: 17 exported functions | ✅ |
| D.15 | Legacy global key detection + explicit import (never auto-import) | ✅ |
| D.16 | Hydration guard: cloud data merged, local-only auto-imported, empty state not overwritten | ✅ |
| D.17 | Non-blocking sync error: data stays local, retryable | ✅ |
| D.18 | Server tests — 37 sync tests: auth gate, CRUD, validation, import, sanitization | ✅ 193/193 |
| D.19 | Client tests — 39 slice-d tests: API, conversion, legacy keys, error handling | ✅ 92/92 |
| D.20 | User A cannot read/modify User B data (owner-scoped RLS + WHERE clauses) | ✅ |
| D.21 | No secrets, tokens, or keys in any new code | ✅ |

### Known Limitations

- Migration NOT pushed to remote (requires user authorization)
- Real two-browser RLS test requires human verification (two accounts)
- Build (`npm run build`) blocked by pre-existing EPERM on dev server lock
- Individual `tsc --noEmit` passes clean on both sides
- Cloud sync mutations are fire-and-forget; error shown as non-blocking banner

## Slice C2b — Remote quota closure (✅ PASSED — 2026-07-12)

| # | Criterion | Result |
|---|-----------|--------|
| C2b.1 | Migration `20260712000000` exists locally and remotely | ✅ |
| C2b.2 | Catalogue is `Free = 20 / rolling 7 days`, `Pro = ¥19 / calendar month / 400` | ✅ |
| C2b.3 | Every existing auth user has exactly one subscription after backfill | ✅ 2 users / 2 subscriptions |
| C2b.4 | New-user trigger provisions profile, role and Free subscription | ✅ static + remote schema verified |
| C2b.5 | Browser role cannot INSERT/UPDATE `generation_jobs` or execute quota RPCs | ✅ remote privilege + role test |
| C2b.6 | `usage_ledger` is append-only for service role (`SELECT, INSERT`; no `UPDATE`) | ✅ remote privilege test |
| C2b.7 | reserve / duplicate reserve / consume / release / transition conflicts execute successfully | ✅ remote transaction, rolled back |
| C2b.8 | Old-period release does not refund quota into a new period | ✅ remote transaction, rolled back |
| C2b.9 | RLS exposes only the signed-in user's subscription | ✅ remote role/JWT simulation |
| C2b.10 | Trusted client reads the external secret file pointer without copying the key into the repo | ✅ plan count 2; key never printed |
| C2b.11 | Server/client tests and builds pass | ✅ server 156/156; client 53/53; both builds pass |

Known non-blocking advisor warnings: the owner-checked soft-delete RPC is intentionally `SECURITY DEFINER`; Supabase leaked-password protection remains a dashboard hardening task.

## Local Automation Gate (✅ PASSED — v2 acceptance fixes applied)

| # | Criterion | Result |
|---|-----------|--------|
| B.1 | Client `npx tsc --noEmit` | ✅ 0 errors |
| B.2 | Server `npx tsc --noEmit` | ✅ 0 errors |
| B.3 | Client `npm run build` (tsc -b + vite build) | ✅ dist/ (599 KB JS, 76 KB CSS) |
| B.4 | Server `tsc` | ✅ dist/ |
| B.5 | Client Vitest: 27 tests, 0 failed | ✅ 27/27 passed (12 slice-a + 15 slice-b) |
| B.6 | Client Vitest: **zero act() warnings in stderr** | ✅ no "act(" nor "not wrapped in act" in stderr |
| B.7 | Server Vitest: 6/6 (health, /api/me 401×4, bootstrap) | ✅ 6/6 passed |
| B.8 | Server starts (`npm run dev:server`) | ✅ loads .env, port 3001 |
| B.9 | GET /api/me — no token → 401 | ✅ "Missing or invalid" |
| B.10 | GET /api/me — invalid token → 401 | ✅ "Invalid or expired" |
| B.11 | No legacy secret key names, `service_role`, `supabaseAdmin` in source | ✅ comments only |
| B.12 | No `[MOCK]` badges in auth pages | ✅ 0 matches |
| B.13 | No plaintext password storage (no `hk-cantonese-mock-auth`) | ✅ 0 matches |
| B.14 | `.env.example` has no real key values | ✅ all set to empty/placeholder |
| B.15 | `vite-env.d.ts` uses `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ |
| B.16 | `supabase-stub.d.ts` files deleted | ✅ |

## New Behavior Tests (✅ PASSED — v2 acceptance fixes)

| # | Test | Result |
|---|------|--------|
| B.5a | `resetPassword` success → `isLoading=false`, "Resolved" shown | ✅ |
| B.5b | `resetPassword` failure → "重置链接已发送" NOT shown | ✅ |
| B.5c | `updatePassword` failure → "密码已重置" NOT shown | ✅ |
| B.5d | Normal `SIGNED_IN` session → "链接已过期或无效" | ✅ |
| B.5e | `PASSWORD_RECOVERY` session → reset form visible | ✅ |
| B.5f | `AuthCallback` existing confirmed session → success redirect | ✅ |

## v2 Fixes Applied (2026-07-11)

- **Act warnings eliminated**: All page-render tests now use `awaitAuthReady()` helper to wait for AuthProvider's async `getSession()` dispatch before assertions. `AuthContext` exported for direct Provider-based testing.
- **Client tsconfig**: Added `typeRoots: ["./node_modules/@types"]` — fixes workspace-hoisted `@types/superagent` resolution error in TypeScript 5.9.3.
- **Root `package.json`**: Added `vitest` devDependency — fixes hoisting issue where `@testing-library/jest-dom` (hoisted to root) could not resolve `vitest` (in client `node_modules`).

## Pending: Real Email Interaction (⏸️ BLOCKED)

Requires a human to use a real email address and inbox:

| # | Criterion | How to verify |
|---|-----------|---------------|
| B.17 | Email signup → confirmation email received | Register at /signup, check inbox |
| B.18 | Click confirmation link → redirected to /app | Click link in email |
| B.19 | Login with confirmed email → /app works | /login with confirmed credentials |
| B.20 | Forgot password → reset email received | /forgot-password, check inbox |
| B.21 | Reset password link → new password works | Click reset link, set new password, login |
| B.22 | Session persists across refresh | Refresh /app, stay logged in |
| B.23 | Logout → /app redirects to /login | Click logout, try /app |
| B.24 | User A cannot see User B data (RLS) | Two different accounts, verify isolation |

**Stop here.** Do not mark Done until B.17–B.24 are verified by a human.

---

## Slice C1 — Local Automation Gate (✅ PASSED — v3 acceptance fixes applied)

| # | Criterion | Result |
|---|-----------|--------|
| C1.1 | Server `npx tsc --noEmit` | ✅ 0 errors |
| C1.2 | Client `npx tsc --noEmit` | ✅ 0 errors |
| C1.3 | Client `npm run build` | ✅ dist/ (615 KB JS, 78 KB CSS) |
| C1.4 | Server Vitest: 45/45 (me 6 + generations 39) | ✅ PASS |
| C1.5 | Client Vitest: 38/38 (12 slice-a + 15 slice-b + 11 slice-c1) | ✅ PASS, 0 act warnings |
| C1.6 | POST /api/generate — 401 without token | ✅ requireAuth gate |
| C1.7 | POST /api/generate — requires idempotencyKey, validates format (1-128 chars, alphanumeric) | ✅ |
| C1.8 | POST /api/generate — atomic upsert via INSERT...ON CONFLICT (no check-then-insert race) | ✅ |
| C1.9 | POST /api/generate — completed duplicate returns 200 with cached result (idempotent=true) | ✅ |
| C1.10 | POST /api/generate — processing/pending duplicate returns 202 (no re-generation) | ✅ |
| C1.11 | POST /api/generate — failed duplicate returns 200 with error + retryHint (use new key) | ✅ |
| C1.12 | POST /api/generate — saves complete GenerateResponse to generation_jobs on success | ✅ |
| C1.13 | POST /api/generate — saves error to generation_jobs on failure (failJob) | ✅ |
| C1.14 | GET /api/generations — paginated list with limit/offset validation (1-100, ≥0) | ✅ |
| C1.15 | GET /api/generations/:id — detail with UUID validation, 404 for non-owner | ✅ |
| C1.16 | DELETE /api/generations/:id — soft delete (UUID validation, ownership check) | ✅ |
| C1.17 | PATCH /api/generations/:id — **REMOVED** (was arbitrary status injection vector) | ✅ 404 |
| C1.18 | Owner isolation: RLS-enforced, cross-user returns 404 indistinguishable from not-found | ✅ |
| C1.19 | Input validation: UUID format, idempotency key format/length, limit/offset bounds, source non-empty | ✅ 400 on invalid |
| C1.20 | Migration `20260711213000_slice_c1_generation_jobs.sql` (renamed after 20260711170000) | ✅ local only |
| C1.21 | RLS: owner-scoped select/insert/update, no delete policy, soft delete via deleted_at | ✅ |
| C1.22 | UNIQUE(owner_id, idempotency_key) constraint + atomic INSERT...ON CONFLICT | ✅ |
| C1.23 | Migration static safety assertions: 10 automated checks in test suite | ✅ |
| C1.24 | Frontend HistoryPage — loading/empty/error/populated/delete, linked to Header | ✅ |
| C1.25 | Frontend HistoryDetailPage — all 5 result types (variants/diagnosis/audit/scores/consumerFeedback) + error + brief | ✅ |
| C1.26 | `/app/history` and `/app/history/:id` routed with ProtectedRoute | ✅ |
| C1.27 | Client generates stable idempotencyKey per user action (gen-{ts}-{uuid}) | ✅ |
| C1.28 | No service_role / secret / admin bypass in any new code | ✅ |
| C1.29 | Service-layer tests exercise Supabase query chain (not just mock entire service) | ✅ |
| C1.30 | Database errors sanitized — no constraint names/table names leaked to client | ✅ |

### Security Risk Assessment (C1 → C2)

**Finding: `grant update` to `authenticated` allows browser-direct status tampering.**

The migration grants `select, insert, update` on `generation_jobs` to `authenticated`. Combined with the permissive UPDATE RLS policy, a browser client with a valid JWT can call the Supabase REST API directly to modify their own jobs' `status`, `variants`, `scores`, etc., bypassing the BFF entirely.

**C1 acceptable boundary:** In C1, there is no quota enforcement, billing, or admin dashboard that consumes `generation_jobs.status` as a trusted signal. The BFF's `/api/generate` endpoint is the intended write path and the only code that sets status. Browser-direct writes would only affect the user's own history view — a self-deception vector, not a cross-user security issue.

**C2 trusted-write mitigation (recommended):**
1. Revoke `update` on `generation_jobs` from `authenticated`
2. Create SECURITY DEFINER functions for status transitions (e.g., `complete_generation_job()`)
3. Grant `execute` on these functions to `service_role` only
4. Add a `service_role` Supabase client in the BFF for trusted writes
5. Drop the existing UPDATE policy since `authenticated` no longer has update grant

This ensures only the trusted BFF can finalize job status/results, which is essential when C2 introduces usage quotas and billing based on job records.

### Pending for Remote Application

- **Migration NOT pushed to Supabase.** Exact push command:
  ```bash
  cd D:\work\77港话通社媒文案\77
  npx supabase db push
  ```
  This will apply `20260711213000_slice_c1_generation_jobs.sql` (renamed from `20260711000001`) to the linked remote project.
- After push: verify with `npx supabase db lint` and Security Advisors.
- Then: real auth + real DB integration test (create via generate, list, soft-delete with two users).
- Real RLS isolation must be verified post-push (current tests mock Supabase).

### Known Limitations (C1 v3)

- **Table grant update risk** — documented above; acceptable for C1, must be addressed in C2 before quotas/payments.
- **generate flow requires functional AI engine** — tests that exercise the full POST /api/generate path may get 500 if no AI API key is configured. The idempotency and validation tests are isolated from AI calls via mock.
- **HistoryPage does not auto-refresh** — user must navigate away and back to see new entries after generation.
- **No pagination UI** — list endpoint supports limit/offset but HistoryPage currently fetches first 50 with no "load more".

---

## Slice C1 v4 — Client Response Discrimination & Polling (✅ PASSED, 2026-07-11)

| # | Criterion | Result |
|---|-----------|--------|
| C1v4.1 | Client `npx tsc --noEmit` | ✅ 0 errors |
| C1v4.2 | Server `npx tsc --noEmit` | ✅ 0 errors |
| C1v4.3 | Client build | ✅ dist/ (616 KB JS, 78 KB CSS) |
| C1v4.4 | Server build | ✅ dist/ |
| C1v4.5 | Client Vitest: 49/49 (12 A + 15 B + 11 C1 + **11 C1v4**) | ✅ PASS, 0 unhandled rejections |
| C1v4.6 | Server Vitest: 45/45 (6 me + 39 generations) | ✅ PASS |
| C1v4.7 | Discriminated response types: `GenerateSuccessBody` \| `GeneratePendingBody` \| `GenerateFailedBody` | ✅ no blind cast |
| C1v4.8 | `generateCopy` retries network errors once with **same** `idempotencyKey` | ✅ test verified |
| C1v4.9 | `generateCopy` on HTTP 202: polls `GET /api/generations/:id` with exponential backoff (1s→2s→…→16s, 120s cap) | ✅ test verified |
| C1v4.10 | Polling: completed job → mapped to full `GenerateResponse` → `SET_RESULTS` | ✅ test verified |
| C1v4.11 | Polling: failed job → throws → `SET_ERROR` (never `SET_RESULTS`) | ✅ test verified |
| C1v4.12 | Polling: timeout → throws with `jobId` in message for user recovery | ✅ test verified |
| C1v4.13 | HTTP 200 `body.status='failed'` → throws immediately → `SET_ERROR` | ✅ test verified |
| C1v4.14 | Incomplete data (202 body, 200-failed body) **never** dispatched as `SET_RESULTS` | ✅ structurally prevented by types |
| C1v4.15 | `useGenerate` generates one idempotencyKey per call; new click = new key | ✅ test verified |
| C1v4.16 | `crypto.randomUUID()` with RFC 4122 v4 fallback for environments without it | ✅ |
| C1v4.17 | Comment accurately describes behaviour: "network retries once with SAME key" | ✅ matches code |
| C1v4.18 | Polling transient network errors are swallowed, job-level failures re-thrown | ✅ |
| C1v4.19 | No `service_role` / secret / admin bypass introduced | ✅ |

### Known Limitations (C1 v4)

- **Main migration pushed** — `20260711213000_slice_c1_generation_jobs.sql` is applied to remote Supabase.
- **Table grant update risk** — carries forward from v3; C2 trusted-write plan documented.
- **No pagination UI** — carries forward from v3.
- **Fake-timer polling tests** — two tests use `promise.catch(() => {})` to suppress expected unhandled rejections during `act()` timer advancement. This is a Vitest fake-timer idiom, not a code smell.

---

## Slice C1 Patch — Soft-Delete RLS Fix (✅ PASSED dry-run, 2026-07-11)

| # | Criterion | Result |
|---|-----------|--------|
| CP.1 | Server `npx tsc --noEmit` | ✅ 0 errors |
| CP.2 | Client `npx tsc --noEmit` | ✅ 0 errors |
| CP.3 | Client build | ✅ dist/ (616 KB JS, 78 KB CSS) |
| CP.4 | Server build | ✅ dist/ |
| CP.5 | Server Vitest: 65/65 (**+20 patch tests**) | ✅ PASS |
| CP.6 | Client Vitest: 49/49 (no regression) | ✅ PASS |
| CP.7 | Patch migration `20260711223000` is later than main `20260711213000` | ✅ |
| CP.8 | RPC is SECURITY DEFINER | ✅ |
| CP.9 | RPC sets `search_path = ''` | ✅ |
| CP.10 | RPC checks `auth.uid() is not null` before UPDATE | ✅ |
| CP.11 | **Single atomic UPDATE** — no SELECT-then-UPDATE TOCTOU window | ✅ test verified |
| CP.12 | UPDATE WHERE contains all 3 conditions: `id = _job_id AND owner_id = auth.uid() AND deleted_at is null` | ✅ test verified |
| CP.13 | No `_owner_id` variable, no pre-query — TOCTOU-free | ✅ test verified |
| CP.14 | All objects fully qualified (`public.generation_jobs`) | ✅ |
| CP.15 | REVOKE from `public, anon`; GRANT EXECUTE to `authenticated, service_role` | ✅ |
| CP.16 | `softDeleteJob` calls RPC via user-scoped client, returns `Promise<boolean>` | ✅ |
| CP.17 | `false` → route returns 404 (indistinguishable cross-user) | ✅ test verified |
| CP.18 | DB errors sanitised — no constraint names / table names leaked | ✅ test verified |
| CP.19 | SELECT policy unchanged — still filters `deleted_at IS NULL` | ✅ regression test |
| CP.20 | No `grant delete to authenticated` in original migration | ✅ regression test |
| CP.21 | `supabase db push --dry-run` previews ONLY the patch migration | ✅ verified |

### Remote verification

- ✅ `20260711223000_fix_generation_soft_delete.sql` 已推送远端。
- ✅ 本人身份创建、读取与软删除成功。
- ✅ 模拟其他用户读取为 0，调用软删除 RPC 返回 false。
- ✅ 软删除后普通查询不可见。
- ✅ 验证事务整体回滚，`generation_jobs` 测试数据为 0。
- ⚠️ Security Advisor 对 authenticated 可执行 SECURITY DEFINER RPC 提示通用警告；该 RPC 仅允许 `owner_id = auth.uid()` 的原子软删除，属于当前明确接受的 C1 边界。

---

## Slice C2a — Local Automation Gate (✅ PASSED, 2026-07-11, FIXED 2026-07-11, FINAL FIX 2026-07-11)

| # | Criterion | Result |
|---|-----------|--------|
| C2a.1 | Server `npx tsc --noEmit` | ✅ 0 errors |
| C2a.2 | Client `npx tsc --noEmit` | ✅ 0 errors |
| C2a.3 | Client `npm run build` | ✅ dist/ (616 KB JS, 78 KB CSS) |
| C2a.4 | Server `tsc` build | ✅ 0 errors |
| C2a.5 | Server Vitest (src): 154/154 | ✅ PASS (6 me + ~98 generations + 30 quota + 20 migration) |
| C2a.6 | Client Vitest: 49/49 | ✅ PASS |
| C2a.7 | Migration `20260712000000_slice_c2a_trusted_write_quota.sql` | ✅ local only, NOT pushed |
| C2a.8 | `REVOKE UPDATE on generation_jobs from authenticated` | ✅ present in migration |
| C2a.9 | No dead SECURITY DEFINER job functions (auth.uid() problem) | ✅ complete/fail/mark functions deleted |
| C2a.10 | `usage_ledger` append-only — no UPDATE/DELETE grants; terminal events INSERTed | ✅ SELECT + INSERT only |
| C2a.11 | `plans`, `subscriptions`, `usage_ledger` with RLS | ✅ all 3 tables |
| C2a.12 | Trusted adapter fail-closed on missing `SUPABASE_SECRET_KEY` | ✅ test verified |
| C2a.13 | Quota reserve → model call only if quota available | ✅ 402 when exhausted; atomic via reserve_quota RPC |
| C2a.14 | Successful generation → consume quota (append-only INSERT) | ✅ via consume_quota RPC |
| C2a.15 | Known failure → release quota (append-only INSERT + atomic decrement) | ✅ via release_quota RPC |
| C2a.16 | Duplicate idempotency key → no double reserve | ✅ RPC-level idempotency + UNIQUE constraint |
| C2a.17 | Only `SUPABASE_SECRET_KEY` (no legacy key names in source/tests/docs) | ✅ test verified |
| C2a.18 | Quota service unit tests: 27/27 | ✅ trust adapter (2) + reserve (6) + consume (7) + release (7) + entitlement (5) |
| C2a.19 | Migration static assertions: ~65 C2a checks | ✅ generations.test.ts |
| C2a.20 | No hardcoded production prices/quota values in migration | ✅ no defaults; CHECK constraints only |
| C2a.21 | generate.ts quota orchestration: no quota → 402, no model call | ✅ code reviewed |
| C2a.22 | generationJobsService UPDATE ops use trusted client + owner_id WHERE | ✅ service_role bypasses RLS; WHERE enforces ownership |
| C2a.23 | Security review: 0 critical, 0 medium, 0 low findings | ✅ ALL 7+7 blocking issues resolved |
| C2a.24 | No secret key in source code or error messages | ✅ error msgs sanitised |

### 2026-07-11 Final Fix — 7 项边界修复（第三轮）

| # | Fix | Mechanism |
|---|-----|-----------|
| F1 | reserve_quota 同键并发幂等边界 | FOR UPDATE 后再次查询 idempotency，发现已有 reserve 直接返回 |
| F2 | consume/release terminal 冲突检测 | 查询 terminal event_type：同 transition→true，相反→false |
| F3 | reserve_quota 有效周期校验 | 添加 `current_period_end > now()` 条件 |
| F4 | uncertain 202 守卫 | 仅 `uncertain && jobId && reservation` 返回 202；无 reservation 走普通 error |
| F5 | 已停用 key 名清除 | 源代码/测试/spec/planning/evidence 中已停用 legacy key 全部移除 |
| F6 | 显式 service_role grant | `grant select, insert, update on generation_jobs to service_role` |
| F7 | 未确认业务默认值移除 | price_cny/quota_per_cycle/cycle_days 删 default 加 CHECK；subscriptions CHECK 约束 |

### Atomicity Invariants (C2a-FIX)

| Invariant | Mechanism | Status |
|-----------|-----------|--------|
| Atomic reserve | `reserve_quota` RPC: FOR UPDATE lock + balance check + INSERT + quota_used increment in one transaction | ✅ |
| Append-only ledger | consume/release INSERT new terminal events; original reserve row NEVER mutated | ✅ |
| Terminal uniqueness | `idx_ledger_one_terminal_per_reservation` partial unique index; `chk_terminal_has_reservation` CHECK constraint | ✅ |
| No TOCTOU fallback | release_quota RPC handles quota_used decrement atomically; TS code never SELECT-then-UPDATE | ✅ |
| Timeout resilience | Uncertain errors (timeout, ECONNRESET, AbortError) keep job + reservation alive, return 202 | ✅ |

### RPC Functions

| RPC | Signature | Locking | Purpose |
|-----|-----------|---------|---------|
| `reserve_quota` | `(_user_id uuid, _idempotency_key text) → jsonb` | FOR UPDATE on subscription | Atomic reserve |
| `consume_quota` | `(_user_id uuid, _reservation_id uuid) → boolean` | FOR UPDATE on reservation | Append-only consume |
| `release_quota` | `(_user_id uuid, _reservation_id uuid) → boolean` | FOR UPDATE on reservation | Append-only release + atomic quota_used decrement |

All: SECURITY INVOKER, `search_path = ''`, explicit `_user_id`, service_role EXECUTE only. The modern secret runs as the explicitly granted `service_role`, so owner privileges are unnecessary.

## 2026-07-12 — Workbench usability polish

| ID | Acceptance criterion | Result |
|---|---|---|
| UI.1 | Generation history always exposes a “回到工作台” link to `/app` | ✅ automated |
| UI.2 | Saved bookmark notes remain visible as a highlighted summary after parameter details collapse | ✅ automated |
| UI.3 | Reference favorite cases default to collapsed and expose user notes when expanded | ✅ automated |
| UI.4 | Successful unconfirmed signup exits the global loading state | ✅ automated |
| UI.5 | Signup confirmation explains inbox check, verification link, refresh, and login | ✅ automated |
| UI.6 | Client regression suite | ✅ 118/118 |
| UI.7 | Client TypeScript and production build | ✅ |

Manual visual confirmation remains available at `http://localhost:5175/app` while the development server is running.

### Pending for Remote Application

- **Migration NOT pushed:** `20260712000000_slice_c2a_trusted_write_quota.sql`
  ```bash
  cd D:\work\77港话通社媒文案\77
  npx supabase db push
  ```
- **`SUPABASE_SECRET_KEY` NOT configured** — must be set in `server/.env` (modern key name)
- **Price/Quota/Cycle NOT decided** — Migration contains no production values; test fixtures use non-production values
- **Push requires user authorization** per high-risk gate

### Known Limitations (C2a)

- No SSE/streaming progress for quota status — synchronous response only.
- Timeout recovery relies on client polling; no server-side reconciliation cron yet.
- Migration is a local draft; real Supabase testing requires push + secret config.

---

## 2026-07-12 — Slice G1 验收阻断修复（权威状态）

| 验收项 | 结果 |
|---|---|
| A1: `ensureCalendarCoverage` 纯函数创建 | ✅ 33 项测试通过 |
| A2: 节日话题五平台强制覆盖 | ✅ 生成路由在 persist/return 前覆盖缺失平台 |
| A3: 已有覆盖不重复；无 event 不变 | ✅ 测试验证 |
| A4: 不调用模型、不重试、不消费 quota | ✅ 确定性桥接句生成 |
| A5: 仅 shorts 命中→其余四项补齐 | ✅ 测试验证 |
| A6: 全命中不变；全 key 存在 | ✅ 测试验证 |
| A7: 生成路由使用修正后结果持久化/返回 | ✅ generate.ts 在 completeJob 前补丁 variants |
| B1: profiles 只用真实字段（无 email/last_sign_in_at/deleted_at） | ✅ schema contract + admin test 验证 |
| B2: subscriptions 用 user_id + 真实周期/配额字段 | ✅ schema contract 验证 |
| B3: generation list 只读元数据字段 | ✅ 不选 source/variants/diagnosis/audit/consumer_feedback |
| B4: feedback 默认列表禁止 content | ✅ 只选 type/title/notify_status/created_at |
| B5: audit_log 用真实列（actor/entity/diff） | ✅ schema contract 验证 |
| B6: 无 `select('*')`；无不存在 RPC | ✅ admin-schema-contract.test.ts 验证 |
| B7: generation detail endpoint fail-closed | ✅ audit 写入失败 → 500 拒绝 |
| B8: Supabase error 不静默伪装空数据 | ✅ 所有查询 error 检查抛异常 |
| B9: schema contract tests 读迁移 SQL | ✅ 10 describe blocks 解析真实 migration 文件 |
| B10: 客户端 AdminPage 与 API 类型同步 | ✅ AdminUserOverview/AdminGenerationMeta 等类型更新 |
| C1: SignupPage 调用 resolveNextPath | ✅ 外部/evil/路径穿越均被丢弃 |
| C2: MarketingPage 含 /pricing 链接 | ✅ nav + plans section 两处都有 |
| C3: PricingPage Free/Pro CTA 进真实流程 | ✅ /signup?next=%2Fapp 与 /login?next=%2Fapp%2Fbilling |
| D1: 收藏参考案例云端 HYDRATE 保留 | ✅ 现有测试全部通过 |
| D2: 折叠状态可见"可用 N 条" | ✅ ReferenceCaseSelector 始终显示计数 |
| D3: 四星筛选 + 最多 3 条 | ✅ 现有门禁不变 |
| 自动化验证 | ✅ Server 381/381; Client 243/243; 双端 TS + build 通过 |
| 无 secrets 泄露 | ✅ 全变更文件扫描通过 |

## 2026-07-12 — Slice G1 最终修复（日历顺序 + Admin 审计顺序 + 客户端类型同步）

| 验收项 | 结果 |
|---|---|
| **F1**: AdminPage 不再引用旧字段（email/ownerEmail/lastSignIn/sourceLength/contentPreview/ownerId/planId/actorId/resource/resourceId/metadata） | ✅ 源码静态断言 + 6 项 fixture 测试通过 |
| **F1**: Admin 客户端类型与后端 JSON 完全同步 | ✅ 5 个接口类型全部更新；UsersTable/GenerationsTable/FeedbackTable/SubscriptionsTable/AuditTable 表头同频 |
| **F2**: `ensureCalendarCoverage` 移至 `validateDiagnoseGenerateResult` 之后、audit/consumerFeedback 之前 | ✅ generate.ts 顺序：validate → calendar patch → audit/consumerFeedback → persist |
| **F2**: audit 与 consumerFeedback 使用补丁后 `validatedGen.variants`（非 `generateResult.variants`） | ✅ 源码静态断言 |
| **F2**: 删除旧重复日历补丁块 + "audit based on pre-patch" 限制 | ✅ 源码静态断言无旧注释 |
| **F2**: 路由/静态顺序测试防 `ensureCalendarCoverage` 再次移到 audit 之后 | ✅ 3 项顺序测试 |
| **F3**: 新增 `adminGenerationExists(jobId)`——仅查 `id` 列，不读正文 | ✅ `.select('id')`，不含 variants/source/diagnosis/audit/consumer_feedback |
| **F3**: detail 路由改为 exists → audit → detail（fail-closed） | ✅ audit 失败 500 阻断 detail 查询 |
| **F3**: 调用顺序测试 exists → audit → detail；audit 失败不调用 detail | ✅ 4 项顺序测试 |
| 自动化验证 | ✅ Server 387/387; Client 249/249; 双端 TS + build 通过 |
| 无 secrets 泄露 | ✅ 无新密钥/令牌/密钥引入 |
