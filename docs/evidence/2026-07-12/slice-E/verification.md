# Slice E Acceptance Evidence

Date: 2026-07-12
Status: ✅ PASSED — local-only MOCK implementation

## Verification Results

| Item | Result |
|------|--------|
| Server tests | ✅ 306/306 passed (billing 24/24 after review hardening) |
| Client tests | ✅ 198/198 passed |
| Server `tsc --noEmit` | ✅ 0 errors |
| Client `tsc --noEmit` | ✅ 0 errors |
| Full test suite regression | ✅ No failures |

## New Files

### Server
- `server/src/routes/billing.ts` — MOCK billing routes (entitlements, checkout, orders)
- `server/src/__tests__/billing.test.ts` — 24 tests (auth gates, runtime allowlist, trusted amount, checkout, order CRUD, 403 isolation)
- `server/src/types/index.ts` — added Slice E types

### Client
- `client/src/pages/PricingPage.tsx` — Public pricing page with Free/Pro comparison
- `client/src/pages/BillingPage.tsx` — Protected billing page (plan, usage bar, upgrade CTA, order history)
- `client/src/pages/BillingResultPage.tsx` — Success/cancel post-checkout pages
- `client/src/test/slice-e.test.tsx` — 28 tests (PricingPage, BillingPage, BillingResultPage, shared logo, types, API client)
- `client/src/types/index.ts` — added Slice E types (PlanInfo, PlanEntitlements, CheckoutRequest/Response, PaymentOrder)
- `client/src/services/api.ts` — added getEntitlements, createCheckout, listOrders, getOrder

### Modified
- `client/src/App.tsx` — added /pricing, /app/billing, /billing/success, /billing/cancel routes
- `client/src/components/layout/HeaderMenu.tsx` — added 套餐与结算 menu item without expanding the compact Header action row
- `server/src/app.ts` — registered billingRouter, added /api/billing/plans endpoint

## MOCK Scope (all respected)

| Constraint | Status |
|------------|--------|
| No real Alipay | ✅ MOCK labels on all pages, no Alipay SDK, no real redirect |
| No DB migration | ✅ All data in-memory (Map), no SQL written or pushed |
| No remote order writes | ✅ Orders stored per-process, wiped on restart |
| No real subscription/usage modification | ✅ Entitlements are mock defaults, not from DB |
| No secret reading/printing | ✅ No env vars read in billing code |
| Existing functionality regression-free | ✅ Full test suite passes (306 server, 198 client) |

## Known Limitations

- All orders are stored in per-process memory; restarting the server clears all mock data
- Pro upgrade does not change entitlements in mock mode (only creates an order)
- No real payment flow, no Alipay sandbox callbacks
- Pricing page links to signup and billing pages; these work locally
- Client and server TypeScript checks and production builds pass. The client retains the existing >500 kB bundle-size warning.

## Independent Review Fixes

- Replaced object-property plan validation with an explicit `free | pro` runtime allowlist; inherited keys such as `constructor`, `__proto__` and `toString` are rejected.
- Added a tampered-price test proving client-supplied `amountCny`/`priceCny` cannot change the server-defined ¥19 Pro amount.
- Kept the compact Header information architecture by placing billing under HeaderMenu instead of adding another horizontal action.
- Replaced the shared logo asset with the user-provided reference and clipped it inside a black rounded container on the homepage, workbench, pricing and billing pages so the source image's white outer area is not visible.
- Restored the existing workspace dependencies with `npm install` after React/Vite modules were found missing; no new business dependency was introduced. Audit still reports 3 dependency vulnerabilities (1 high, 2 critical), and no automatic audit fix was applied.
- Runtime smoke: `/`, `/pricing`, `/app/billing`, and the logo asset return HTTP 200; local Mock plans API returns HTTP 200 after starting the Express server.
