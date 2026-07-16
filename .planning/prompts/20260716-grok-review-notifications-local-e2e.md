# Grok Build Task: Local Review Notification E2E

Work in the existing dirty worktree at `D:\work\77港话通社媒文案\77` on `master`.

Do not create a worktree. Do not reset, clean, delete, or overwrite existing user changes.

Read first:

- `README.md`
- `AGENTS.md` if present
- `.planning/status.md`
- `docs/handoff/2026-07-15-next-codex-handoff.md`
- `scripts/e2e-workbench-shell.ps1`
- `playwright.workbench-local.config.mjs`
- `client/vite.e2e.config.ts`
- `client/src/e2e/`
- `e2e/workbench-shell-local.spec.ts`
- review-notification components and focused tests

## Single objective

Implement a fully local, isolated Playwright E2E slice for the admin pending-review reminder and the user review-result dialog. Close the browser-evidence gaps recorded in `spec/ACCEPTANCE.md` for these two completed features.

## Requirements

1. Localhost only. Do not connect to real Supabase, a production project ref, real JWT/Auth, real APIs, payment, or any external network.
2. Do not read, print, or modify `.env` or secrets. Do not reuse the historical `sb-*` token/localStorage fake session from `e2e/user-authored-review-queue.spec.ts`.
3. Prefer the existing `client/src/e2e` module mocks, Node 22 ASCII cwd, and PowerShell harness. Add the minimum fixtures/spec/script. Do not broadly alter production business code. If a real bug is found, write a reproducing test first and make only the smallest fix.
4. Cover at least:
   - user `adopted` and `changes_requested` wording;
   - "later" closes and deduplicates across refresh;
   - a new revision or review time can notify again;
   - "view now" opens favorites and locates/highlights the target;
   - admin `pending > 0` bottom-right reminder, "later", and "review now";
   - admin navigation/filtering shows the pending count;
   - 390px mobile and 1440px desktop have no incoherent overlap or horizontal overflow, with screenshots.
5. The harness must provide `-SelfTest` and `-Twice`, or an equivalent repeatable entry point. Failures must clean up orphan processes and return non-zero.
6. Run focused tests, then the E2E twice. Save strict evidence under `docs/evidence/2026-07-16/review-notifications-local-e2e/` with `verification.md`, `test-output.txt`, and `screenshots/`.
7. Update `spec/TEST_PLAN.md`, `spec/ACCEPTANCE.md`, `spec/CHANGELOG.md`, and `.planning/progress.md` only with precise additions/status changes for this slice. Do not rewrite historical content.
8. Do not install dependencies or Docker. Do not run migrations or Supabase writes. Do not deploy, commit, push, create a worktree, broadly format, or refactor unrelated code.
9. Do not use subagents. Make at most three repair attempts. Stop after two no-progress rounds.
10. Do not claim real Auth/RLS acceptance.

Implement directly, not just a plan.

At completion report:

- objective and result;
- changed files;
- exact test commands and results;
- screenshot paths;
- explicit non-goals respected;
- residual risks.
