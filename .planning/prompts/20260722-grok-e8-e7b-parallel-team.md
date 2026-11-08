# Grok Team — 2.1 E8 staging harness + E7b diagnostics UX

Repository source: `D:\work\77港话通社媒文案\77`  
Approved worktree baseline: `refs/codex/checkpoints/2026-07-22-slice-e-baseline`  
Mode: Grok Build CLI leader with at most three first-level `slice-e-worker` members.

## Objective

Produce candidate code for two bounded, independent lanes and one read-only security review:

1. E8 staging acceptance harness for the existing Bad Case review-pack implementation.
2. E7b super-admin diagnostics notification plus a collapsible diagnostics panel.
3. Read-only Auth/RLS/API/Advisor review that reports blockers and focused tests.

The main Codex agent owns all staging execution, secret access, integration, database writes and final verification. You only create candidate local files in this Grok worktree.

## Required team behavior

- As leader, spawn exactly three first-level members using the project `slice-e-worker` agent definition, one per lane below, and wait for all three.
- Members have the Agent tool disabled and must not create tasks, agents, teams, worktrees or background subagents.
- All agents inherit `permission-mode=auto`; do not ask to weaken or bypass permissions.
- Use background terminal tasks only for independent local tests, and wait for their results before reporting.
- The leader may integrate member findings but must keep lane file scopes non-overlapping.

## Lane A — staging acceptance harness

Allowed files:

- `scripts/staging-slice-e8-acceptance.mjs` (new)
- a focused local unit/contract test for this script only if genuinely useful

Read-only references:

- `scripts/staging-slice-d7-acceptance.mjs`
- `server/src/services/badCaseReviewPack*.ts`
- `server/src/services/badCaseProposalService.ts`
- `server/src/routes/admin.ts`
- `supabase/migrations/20260722100000_slice_e_bad_case_review_packs.sql`
- `docs/plans/2026-07-22-2.1-bad-case-review-pack-plan.md`

Harness contract:

- Require environment variables by name but never print their values.
- Create uniquely prefixed temporary staging users/data only when the main agent later executes it.
- Verify anonymous 401; user/ordinary admin 403; super_admin list/detail/write paths; cross-owner fail-closed behavior; generation success/failure hook or the narrowest truthful equivalent; detail audit ordering; finding disposition; stale/forged snapshot proposal rejection; diagnostics aggregation.
- Cleanup in `finally`, revoke/delete temporary auth users safely, and verify zero prefixed QA residue.
- Emit a redacted structured transcript. Never print email, JWT, service-role key, full owner UUID, prompt/response body, raw provider error or cookies.
- Do not run the staging harness in this worktree.

## Lane B — E7b diagnostics notification and folding

Allowed files:

- `client/src/components/admin/BadCaseDiagnosticsPanel.tsx`
- `client/src/test/slice-e7-bad-case-diagnostics.test.tsx`

Product contract:

- `super_admin` only; ordinary admin remains hidden and performs no request.
- Panel is collapsible and defaults collapsed to reduce admin-page length.
- Collapsed header keeps date window plus a clear badge such as `N 类指标需关注`; the count represents triggered diagnostic categories, not a fake number of unique cases.
- Actionable categories are deterministic from current DTO only: unreviewed findings, duplicate samples, evaluated criteria failures, not-evaluated criteria, and invalid latency records.
- On first load of a new actionable summary, show a non-blocking dismissible popup/toast with `role="alert"`, concise counts, and an `展开查看` action.
- Deduplicate by a privacy-safe summary signature in `sessionStorage`; the same refresh must not pop repeatedly, while a changed summary may alert once.
- Error/loading/empty states must remain usable. No polling, new endpoint, dependency, chart library or global state.
- Keep existing dark emerald/light orange design, Lucide icons, keyboard-accessible disclosure button, visible `aria-expanded`, and 44px primary touch targets.
- Add focused tests for collapsed default, badge calculation, popup dedupe, changed-summary alert, expand action, close action and ordinary-admin isolation. Preserve existing tests.

## Lane C — read-only security and release review

No file edits. Inspect the existing E8 contracts and report:

- exact missing staging assertions;
- any BOLA/IDOR, trusted-client, audit-order, secret/logging or cleanup risk;
- whether the three unindexed foreign-key Advisor INFO findings warrant a production-blocking follow-up migration;
- a minimal test list ordered by risk.

## Global non-goals and prohibitions

- Do not read `.env`, `server/.env`, Supabase `.temp`, Grok auth/session files, credentials or secret values.
- Do not run Supabase/database/Auth admin commands, migrations, staging harness, deployment, network mutation or paid model calls.
- Do not install packages.
- Do not edit Migration SQL, shared API contracts, server business logic, spec/planning/docs, package files or unrelated code.
- Do not commit, push, reset, clean, checkout, merge, cherry-pick, remove worktrees or delete files.
- Do not claim staging or full-suite verification.
- Stop after two identical capacity failures, two no-progress rounds, or three implementation attempts.

## Verification and output

- Lane B: run `npm test -- --run src/test/slice-e7-bad-case-diagnostics.test.tsx` from `client` if dependencies are available; otherwise report the exact missing prerequisite without installing.
- Lane A: run syntax/static checks that do not contact staging.
- Leader final output: member summaries, changed-file list, diff summary, test commands/results, unresolved risks and worktree path. Do not commit.

