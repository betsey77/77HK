# Slice C2a — Local Evidence (2026-07-11)

## Summary

C2a local-only reviewable foundation: trusted server-side writes + configurable quota ledger.

## Verification Results

| # | Criterion | Result |
|---|-----------|--------|
| C2a.1 | Server `npx tsc --noEmit` | ✅ 0 errors |
| C2a.2 | Client `npx tsc --noEmit` | ✅ 0 errors |
| C2a.3 | Client `npm run build` | ✅ dist/ (616 KB JS, 78 KB CSS) |
| C2a.4 | Server `tsc` build | ✅ dist/ |
| C2a.5 | Server Vitest: 127/127 (6 me + 101 generations + 26 quota) | ✅ PASS |
| C2a.6 | Client Vitest: 49/49 (12 A + 15 B + 11 C1 + 11 C1v4) | ✅ PASS |
| C2a.7 | Migration static assertions: 36 C2a checks | ✅ PASS |
| C2a.8 | Quota service tests: 26/26 (trusted adapter + reserve/consume/release/entitlement) | ✅ PASS |

## Files Changed (Team Lead integration)

| File | Change |
|------|--------|
| `server/src/routes/generate.ts` | Quota orchestration: reserve → model → consume/release |
| `server/src/services/generationJobsService.ts` | UPDATE ops → trusted client + owner_id WHERE |
| `server/src/types/index.ts` | Added QuotaReservation, UserEntitlement types |
| `server/src/__tests__/generations.test.ts` | C2a migration assertions + trusted client mock |

## Files Created (Agents)

| File | Creator | Content |
|------|---------|---------|
| `supabase/migrations/20260712000000_slice_c2a_trusted_write_quota.sql` | Database/Security agent | 263 lines: plans, subscriptions, usage_ledger, generation_jobs hardening |
| `server/src/services/trustedSupabase.ts` | Backend/TDD agent | 41 lines: service_role client, fail-closed |
| `server/src/services/quotaService.ts` | Backend/TDD agent | 294 lines: reserve/consume/release/getUserEntitlement |
| `server/src/__tests__/quota.test.ts` | Backend/TDD agent | 26 tests: adapter + quota orchestration |

## Security Review (Review agent)

- **Overall: PASS** — 0 critical findings
- 2 medium: S1 (reserve non-atomic race), S2 (release fallback TOCTOU)
- 3 low: S3 (missing status guards), S4 (stale quota_used), S5 (error sanitization)
- 2 info: S6 (dead code SECURITY DEFINER functions), env var doc gap
- All medium/low findings are documented known limitations for C2a local scope

## Migration Status

- **NOT pushed to remote Supabase.** File: `20260712000000_slice_c2a_trusted_write_quota.sql`
- Contains: REVOKE UPDATE from authenticated, 3 SECURITY DEFINER functions, plans/subscriptions/usage_ledger tables
- Push command (requires user authorization): `npx supabase db push`

## Trusted Secret Status

- **SUPABASE_SERVICE_ROLE_KEY NOT configured.** `.env` must be updated before testing against real DB.
- Trusted adapter fails closed with `"Trusted service unavailable"` when key is missing.

## Price/Quota Status

- **Not decided.** Migration uses `price_cny integer default 0`, `quota_per_cycle integer default 0`.
- Test fixtures use explicitly marked non-production values (`quota_per_cycle: 10` for Free plan tests).

## Next Steps (user decision gate)

1. Configure `SUPABASE_SERVICE_ROLE_KEY` in `server/.env`
2. Authorize `npx supabase db push` to apply C2a migration
3. Insert test plan/subscription data for end-to-end verification
4. Verify real quota flow: no-quota→402, reserve→consume, failure→release
5. Decide production Free/Pro pricing, quotas, cycle duration
6. Address review findings S1-S5 before C2b
