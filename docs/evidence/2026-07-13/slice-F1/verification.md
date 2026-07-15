# Slice F1 / G1-R Final Blocker Fix — Verification

Date: 2026-07-13
Status: **Live smoke fix complete; All local tests + tsc + build pass**

## F1 Live Smoke Routing Fix (2026-07-13 session)

**Problem**: In `PAYMENT_MODE=alipay_sandbox`, two critical issues blocked the live smoke test:

1. **Public routes return 401**: `GET /api/billing/plans` and `POST /api/billing/alipay/notify` (both public, no auth) were being intercepted by `requireAuth` middleware from `generationsRouter` and `syncRouter` — because `billingRouter` was mounted AFTER both of these routers in `app.ts`, and those routers have `router.use(requireAuth)` which catches any unmatched paths.

2. **Notify endpoint times out on empty body**: The hand-written JSON body parser checked `Object.keys(req.body).length > 0` before skipping. When `express.urlencoded` parses an empty form body to `{}`, the condition was `0 > 0 = false`, so the parser tried to read the already-consumed stream → hang/timeout.

**Fix**:
- Moved `billingRouter` mount before `generationsRouter`, `syncRouter`, and `feedbackRouter` in `app.ts` — all three have `router.use(requireAuth)` that blocks unmatched paths
- Changed body parser skip condition from `req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0` to `req.body && typeof req.body === 'object'` — now skips for empty `{}` bodies too
- Updated outdated comment in `billing.ts` notify route (urlencoded is in `app.ts`, not `billing.ts` router.use)

**New tests (TDD)**:

| # | Test | Expected | Result |
|---|------|----------|--------|
| 1 | `GET /api/billing/plans` no token, sandbox, mock DB → 200 | `paymentMode=alipay_sandbox, isMock=false`, 2 plans | ✅ |
| 2 | `GET /api/billing/plans` no token, sandbox → not 401 | status 200 (handler reached) | ✅ |
| 3 | `POST /api/billing/alipay/notify` empty form body → "fail" | 200, text/plain, no timeout | ✅ |
| 4 | `POST /api/billing/alipay/notify` fast response | <500ms | ✅ |
| 5 | `POST /api/billing/alipay/checkout` no token → 401 | 401 | ✅ |
| 6 | `GET /api/sync/bootstrap` no token → 401 (regression) | 401 | ✅ |
| 7 | `GET /api/me/entitlements` no token → 401 (regression) | 401 | ✅ |

**Live smoke (real process)**:

| Endpoint | Mock mode | Sandbox mode |
|----------|-----------|-------------|
| `GET /api/billing/plans` (no token) | 200, mock plans ✅ | 500 (handler reached, DB missing) ✅ |
| `POST /api/billing/alipay/notify` (empty form) | 200, `fail` ✅ | 200, `fail` ✅ |
| `POST /api/billing/alipay/checkout` (no token) | — | 401 ✅ |
| `GET /api/sync/bootstrap` (no token) | 401 ✅ | 401 ✅ |

Sandbox plans returns 500 because `getTrustedSupabase()` requires real Supabase connection — but the key validation is that the request **reaches the billing handler** (not blocked by requireAuth with 401).

## 11 Blocker Fixes

| # | Blocker | Status |
|---|---------|--------|
| 1 | BillingPage sandbox route selection | FIXED |
| 2 | Sandbox DB-backed plans/orders/entitlements | FIXED |
| 3 | Return URL with orderId + paymentMode via WHATWG URL | FIXED |
| 4 | BillingResultPage sandbox detection + no false success | FIXED |
| 5 | express.urlencoded dedup (app.ts only) | FIXED |
| 6 | Notify: verify signature BEFORE any DB mutation | FIXED |
| 7 | SDK 4.14 camelCase tradeQuery + adapter unit test | FIXED |
| 8 | Reconcile: check rpcErr + success, don't swallow errors | FIXED |
| 9 | Admin Supertest: exact 200 assertion via controlled mock | FIXED |
| 10 | .env.example merge (delete server/.env.example) | FIXED |
| 11 | Documentation update | FIXED |

## Test Results

- Server tests: **415/415** (13 files, +7 live-smoke fix tests)
- Client tests: 250/250 (13 files)
- Server tsc --noEmit: clean
- Client tsc --noEmit: clean
- Server build: pass
- Live smoke (mock mode): 4/4 endpoints correct
- Live smoke (sandbox mode): 4/4 endpoints correct (plans 500=handler reached, not 401)
- Secret scan: clean (no PEM keys/secrets in source)

## Key Files

- `server/src/routes/billing.ts` — sandbox DB reads, paymentMode routing
- `server/src/services/alipayService.ts` — notify security reorder, reconcile RPC check, return URL
- `server/src/services/alipayAdapter.ts` — SDK 4.14 camelCase tradeQuery
- `server/src/app.ts` — plans front-door, urlencoded only on notify path
- `server/src/__tests__/admin.test.ts` — controlled service mock for 200
- `server/src/__tests__/alipayAdapter.test.ts` — NEW adapter tests
- `client/src/pages/BillingPage.tsx` — paymentMode routing, idempotencyKey
- `client/src/pages/BillingResultPage.tsx` — query param sandbox detection
- `.env.example` — merged PAYMENT/ALIPAY placeholders
- `server/.env.example` — DELETED

## Remaining Gates

1. Real Alipay sandbox E2E NOT executed
2. ALIPAY_APP_ID + keys not configured
3. Production payment FORBIDDEN
4. All payment/production actions require explicit user authorization

## Remote Migration Verification

- Project: `qiotocumkbwckiezuptr`
- Migration history: `20260713000000 slice_f1_payment_sandbox`
- `payment_orders` and `payment_webhook_events`: present, RLS enabled
- `payment_orders`: authenticated owner-only SELECT policy
- `payment_webhook_events`: service-role-only grants; no user policy by design
- `apply_alipay_payment`: SECURITY DEFINER with locked empty search path;
  `PUBLIC`, `anon`, and `authenticated` cannot execute; `service_role` can
- Security Advisor: no new blocking F1 finding
- Performance Advisor: recommends a later covering index for
  `payment_orders.plan_id`

## Codex Independent Re-verification

Re-run on 2026-07-13 after restoring the exact lockfile dependencies with
root `npm ci` (user-authorized):

- Client Vitest: **250/250 passed** (13 files)
- Client `tsc --noEmit`: **passed**
- Client production build: **passed** (1,698 modules)
- Server Vitest: **408/408 passed** (13 files)
- Server `tsc --noEmit`: **passed**
- Server build: **passed**

Non-blocking follow-ups observed during verification:

- The client production bundle reports a chunk larger than 500 kB; code
  splitting remains a later performance task.
- `npm ci` reports 3 dependency audit findings (1 high, 2 critical). No
  automatic `npm audit fix` was run because it may change locked versions;
  dependency remediation requires a separate reviewed task.
