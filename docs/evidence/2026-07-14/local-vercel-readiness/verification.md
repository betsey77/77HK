# Evidence — 2026-07-14 local Vercel readiness + homepage scroll smoke

> 本地配置与测试证据。无 secret、无部署、无 migration、无 git push。

## Commands

| # | Command | Result |
| --- | --- | --- |
| 1 | `npm run test:e2e:smoke` | **2/2 passed** (~7.2s). Homepage HTTP + body; full segmented scroll → all `[data-reveal]` have `is-in` and opacity ≠ 0. |
| 2 | Client `apiBase.test.ts` | **5/5 passed** |
| 3 | Server `cors.test.ts` + `alipayUrls.test.ts` | **17/17 passed** |
| 4 | `npm run verify` | **exit 0** |
| 4a | `npm run test:client` | **28 files, 358/358** |
| 4b | `npm run test:server` | **24 files, 526/526** |
| 4c | `npm run typecheck` | client + server clean |
| 4d | `npm run build` | client Vite production build + server `tsc` OK |
| 4e | `npm run audit:prod` / `audit:all` | **0 vulnerabilities** |
| 5 | `JSON.parse` on `client/vercel.json` + `server/vercel.json` | **OK** |
| 6 | Secret/private-key pattern scan on new config/docs | **No real secrets.** Only doc/comment placeholders (e.g. `.env.example` comment mentioning `SUPABASE_SECRET_KEY=...`) — values remain empty. |

## Numbers

| Suite | Before (Phase 0 baseline) | This slice |
| --- | --- | --- |
| Client tests | 353 | **358** (+5 apiBase) |
| Server tests | 509 | **526** (+17 CORS/URLs) |
| E2E smoke | 1 | **2** |

## Scope guardrails (confirmed not done)

- No `vercel` / `netlify deploy` / `render` / `wrangler deploy`
- No new dependency install
- No `supabase db push` / remote SQL
- No reading/printing real `.env` secrets
- No git commit/push
- No fee rules / RLS / admin privilege / generate prompt changes

## Key files

- `e2e/smoke.spec.ts`
- `client/src/services/apiBase.ts` + consumers
- `server/src/services/corsOrigins.ts`, `alipayUrls.ts`
- `client/vercel.json`, `server/vercel.json`（`src/app.ts` + `functions.maxDuration: 300`，无 legacy builds）
- `docs/release/2026-07-14-hosting-platform-decision.md`
- `docs/release/2026-07-14-vercel-two-project-setup.md`
- `.env.example` (empty values only)

## Notes

- Playwright baseURL default `http://localhost:5173`; client was already up during smoke.
- Node count for reveal is **not** hard-coded; assertion is total > 0 && activated === total && hidden === 0.
- Commercial Alipay live collection still requires separate hosting/legal review (documented in hosting decision).
