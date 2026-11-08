# Grok Build read-only review: 1.1.4.5 Slice D activity and model telemetry

Repository: `D:\work\77港话通社媒文案\77`, branch `master`, HEAD `a86a40f`, very dirty worktree. Every existing change belongs to the user.

This is architecture/spec review only. Do not modify, create, or delete files. Do not run tests, install, deploy, migrate, call a real model API, use web search, spawn subagents, create a worktree, or run Git write/destructive commands.

Read only:

- `spec/PRD.md` lines around the 2026-07-18 Slice D metrics requirements
- `spec/SDD.md` Slice D section
- `spec/TEST_PLAN.md` Slice D section
- `server/src/routes/generate.ts`
- `server/src/routes/modify.ts`
- `server/src/services/deepseekService.ts`
- `server/src/services/cantoneseService.ts`
- `server/src/services/huggingfaceService.ts`
- `server/src/services/adminService.ts`
- `server/src/routes/admin.ts`
- `server/src/services/generationJobsService.ts`
- `supabase/migrations/20260711213000_slice_c1_generation_jobs.sql`
- `supabase/migrations/20260712000000_slice_c2a_trusted_write_quota.sql`

Known fact: DeepSeek non-streaming chat-completion responses expose `response.usage` with prompt/completion/total and cache hit/miss tokens, but current service functions discard it and return only parsed content.

Review goal: design minimal privacy-safe instrumentation for DAU/WAU/MAU, quota consumption/balance, model success/error/latency/token usage, and score-under-50 bad cases. Normal administrators must see only their current non-null review group; super_admin can see global aggregates and model health. No prompt/response body, key, JWT, raw provider error, or cross-group identifiers may be logged or returned.

Return only a concise review with:

1. recommended slice decomposition and dependency order;
2. minimal schema and indexes, including retention;
3. where to instrument each model call without missing retries/fallbacks;
4. whether to pass explicit call context or use request-local context, with rationale;
5. stable operation/provider/model/error enums;
6. usage normalization for DeepSeek and providers with no usage;
7. DAU/WAU/MAU event definition and Hong Kong date/window semantics;
8. admin API permission/scoping and response contracts;
9. tests, failure behavior, and performance/cardinality risks;
10. unresolved decisions that must block coding.

Stop after the review. Do not change the repository.
