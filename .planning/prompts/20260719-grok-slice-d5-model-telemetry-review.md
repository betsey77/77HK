# Grok Build read-only review: 1.1.4.5 Slice D5 model instrumentation

Repository: `D:\work\77港话通社媒文案\77`, branch `master`, very dirty worktree. Every existing change belongs to the user.

Read-only architecture/implementation review. Do not modify/create/delete files, run tests, install, deploy, apply/dry-run migrations, access databases, call real models, use web search, spawn subagents, create a worktree, or run Git write/destructive commands.

Read only:

- `docs/plans/2026-07-19-1.1.4.5-slice-d-development-plan.md` sections 6-8
- `server/src/services/telemetryService.ts`
- `server/src/services/deepseekService.ts`
- `server/src/services/cantoneseService.ts`
- `server/src/routes/generate.ts`
- `server/src/routes/modify.ts`
- `server/src/routes/parsePersonas.ts`
- relevant existing tests under `server/src/__tests__/`

D4 is complete locally and its Migration remains unapplied. D5 must instrument every real DeepSeek/Cantonese provider attempt with explicit optional `ModelCallContext`, including success/error latency, retry/fallback attempt numbers and provider-returned usage. Logging remains 400 ms best-effort and must never change model results. No prompt, response body, raw error, user id, email, JWT or API key may reach telemetry.

Official DeepSeek non-streaming response fields are `usage.prompt_tokens`, `completion_tokens`, `total_tokens`, `prompt_cache_hit_tokens`, and `prompt_cache_miss_tokens`. Missing provider usage stays null/unavailable.

Return only:

1. minimal file/call-site plan and exact recommended `ModelCallContext` shape;
2. whether to use one shared `observeModelCall` wrapper, and its error/usage normalization contract;
3. correct operation/provider/attempt numbering across generate, quality retry, post-processing, Cantonese cold-start retry and fallback;
4. whether the current Cantonese `for (attempt <= MAX_RETRIES)` plus cold-start `continue` actually performs `COLD_START_RETRIES=2`, and the smallest safe fix if not;
5. focused test matrix, especially telemetry failure not changing results;
6. blocking risks only, then stop.

Do not propose admin UI/API, provider balance, retention cleanup, schema changes, D7 database execution, broad refactors or new dependencies.
