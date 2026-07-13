# Slice G1 (A/B/C/D/E) Verification — 2026-07-12

## Summary

Single Claude sequential execution. All 5 areas completed with zero regressions.

## Results

| Check | Status |
|-------|--------|
| Server tests | 338/338 passed (11 files) |
| Client tests | 243/243 passed (13 files) |
| Server tsc --noEmit | Clean |
| Client tsc --noEmit | Clean |
| Secret scan | 0 findings |
| New dependencies | None |

## Area A: 4-star Reference Cases
- ReferenceCaseSelector confirmed always visible with "可用 N 条 · 已选 M/3"
- 13 new tests: cloud hydration, selection toggle, max-3 constraint, cross-account isolation
- useGenerate hook correctly sends referenceCases in payload
- Storage keys are owner-scoped (`hk-cantonese-bookmarks:<ownerId>`)

## Area B: Calendar 5-platform Coverage
- Prompt contract confirmed: `buildCalendarEventsSection` has 🚨 mandatory instruction
- 13 new tests: DeepSeek prompt builder, Cantonese LLM prompt builder, fallback engine
- `buildCalendarEventsSection` exported for testability
- `validateCalendarCoverage` runs post-generation as bounded non-blocking check
- No additional model calls, no hidden quota cost

## Area C: Pricing & Billing Linkage
- PricingPage plan content verified: Free 20/7d, Pro ¥19/月 400
- CTA links: Free → /signup?next=%2Fapp, Pro → /login?next=%2Fapp%2Fbilling
- nextPath allowlist secure: rejects http, https, //, .., ?, #
- MarketingPage nav and plans section both link to /pricing
- HeaderMenu billing entry → /app/billing confirmed
- No new top-right nav entries (uses HeaderMenu)

## Area D: Regression Matrix
- `.planning/regression_matrix.md` created: 12 domains, 11 anti-regression gates
- Pre-commit checklist for future slices
- Covers: Auth, Generation, 5-layer Prompt, Reference Cases, Calendar, History, Cloud Sync, Feedback, Quota, Pricing, Header IA, Dual Theme

## Area E (G1): Read-Only Admin Dashboard
- Server: `adminService.ts` (trusted Supabase, field allowlists, pagination MAX_PAGE_SIZE=100)
- Server: `routes/admin.ts` (6 GET endpoints, requireAuth + requireAdmin, no mutations)
- Server: 11 new tests (types, security invariants, route registration)
- Client: `AdminPage.tsx` (stats card + 5-tab tables with loading/empty/error/403 states)
- Client: 10 new tests (rendering states, design system, no mutations, HeaderMenu entry)
- Client: `checkAdminAccess()` in api.ts for server-verified admin check
- Client: HeaderMenu admin entry only visible after server confirms admin role
- Client: `/admin` route registered in App.tsx

## Files Created
- `server/src/services/adminService.ts`
- `server/src/routes/admin.ts`
- `server/src/__tests__/admin.test.ts`
- `client/src/pages/AdminPage.tsx`
- `client/src/test/slice-g1-admin.test.tsx`
- `.planning/regression_matrix.md`

## Files Modified
- `server/src/prompts/diagnoseGenerate.ts` (exported buildCalendarEventsSection)
- `server/src/app.ts` (registered adminRouter)
- `client/src/App.tsx` (registered /admin route)
- `client/src/services/api.ts` (added admin API functions + types)
- `client/src/components/layout/HeaderMenu.tsx` (admin entry + server-verified check)
- `client/src/test/slice-g1-regression.test.tsx` (Area A tests + helpers)
- `server/src/__tests__/calendar-validation.test.ts` (Slice B tests)
- `.planning/status.md`, `.planning/progress.md`, `.planning/findings.md`, `.planning/task_plan.md`

## Gates Met
- No remote Supabase writes
- No database migrations
- No real Alipay/payment actions
- No role assignments
- No new dependencies
- No secrets leaked
- All existing tests continue to pass

## Independent re-review and blocking fixes (final)

The initial G1 report was not accepted because the admin mock contract did not match the actual migrations and calendar coverage only logged missing variants. The final accepted implementation adds these non-regression guarantees:

- Admin server and client use the same schema-derived response fields; default generation and feedback lists do not query or return body text.
- Admin generation detail follows `metadata existence check → mandatory audit write → explicit detail query`; an audit failure is fail-closed.
- Calendar coverage is enforced across `standardHK`, `lightCantonese`, `ig`, `facebook`, and `shorts` before audit, consumer simulation, persistence, and response, without a second model call or quota charge.
- The reference-case control remains visible when collapsed and shows `可用 N 条 · 已选 N/3`; only ratings ≥4 are eligible.
- Marketing links to `/pricing`; login/signup redirects accept only the explicit `next` allowlist.

Independent commands and results on 2026-07-12:

- Server `npx tsc --noEmit`: PASS
- Server `npm test`: PASS — 12 files, 387 tests
- Server `npm run build`: PASS
- Client `npx tsc --noEmit`: PASS
- Client `npx vitest run`: PASS — 13 files, 249 tests
- Client `npm run build`: PASS — 1,698 modules
- `git diff --check`: PASS (line-ending warnings only)
- Targeted secret-pattern scan: PASS after redacting a secret copied into a stopped, auto-generated Claude worktree. That worktree still requires user-approved removal; the affected DeepSeek key should be rotated as a precaution.
