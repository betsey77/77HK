# Grok Build read-only review — Slice D6b

Repository: `D:\work\77港话通社媒文案\77`

## Objective

Review the smallest safe implementation of Slice D6b:

1. `GET /api/admin/metrics/models?from=&to=` — `super_admin` only; aggregate `model_call_logs` by provider/model with total/success/error counts, average/p95 latency, official token sums and unavailable-usage count.
2. `GET /api/admin/metrics/bad-cases?from=&to=` — `super_admin` only; return at most 20 jobs whose `scores.generated.total < 50`, with only job id, score, platform, tone, generation engine and timestamps. Never return prompt, source, generated body, email or raw scores.
3. `GET /api/admin/metrics/provider-balance` — `super_admin` only; server calls official DeepSeek `GET https://api.deepseek.com/user/balance`, caches valid results for 10 minutes, validates CNY/USD decimal strings, and maps missing key/timeout/error/invalid response to `{ status: "unavailable" }` without exposing secrets or raw errors. A successful API response with `is_available=false` is still a reachable/valid response, not a transport failure.
4. Minimal AdminPage visualization: all admins see D6a overview cards; only super admins see provider/model table, token/latency summaries, bad-case metadata, and balance. Loading, empty, partial-error and unavailable balance states must remain readable in dark/light modes and at 390px.

## Existing constraints

- Very dirty worktree; every existing change is user-owned.
- Do not edit files. This is plan/read-only review only.
- Do not reset, clean, create a worktree, install, deploy, migrate, commit or push.
- D1/D4 migrations are local and unapplied; tests must mock DB/provider calls. Do not query any real database or provider.
- Existing server auth chain is `requireAuth` + `requireAdmin`; D6b endpoints must additionally use `requireSuperAdmin`.
- D6a range parser already provides Hong Kong default 30-day and maximum 90-day validation.
- Existing UI stack is React/Vite/Tailwind/Lucide with dark emerald and light orange. Prefer a separate `AdminMetricsPanel` over expanding AdminPage state further.
- No new dependency, component library, chart package or cost estimation.
- Official balance schema: `is_available` plus `balance_infos[]` containing `currency`, `total_balance`, `granted_balance`, `topped_up_balance` strings.

## Review questions

Return concise, actionable findings:

1. Blocking authorization/privacy defects in the proposed API shapes.
2. Correct aggregation semantics, especially token nulls, p95, error rate, range boundaries and bad-case threshold.
3. Safe balance timeout/cache/validation rules that distinguish provider failure from a valid zero balance.
4. Minimal UI hierarchy and responsive/error-state rules consistent with the existing admin design.
5. A focused TDD matrix and any implementation pitfall likely to cause regressions.

Stop after the review. Do not modify files or run destructive/external actions.
