# 77vibe-dev-flow Context Pack

Updated: 2026-07-19
Project: D:\work\77港话通社媒文案\77

Use this file after context compaction, agent handoff, or thread restart.
Token rule: read `.planning/status.md` first; open this pack only when the status is not enough.

## Latest (2026-07-19)

- 1.1.4.5 Slice D1-D4 are complete locally: unapplied check-in/reward and telemetry Migration drafts, authenticated BFF, daily check-in/reward UI, and private activity/model telemetry writer contracts.
- Confirmed rules: one 7-day reward per account lifetime; valid Pro receives a pending grant and claims after expiry; reward period is fixed 30 days.
- D3 mounts after cloud hydration, treats the server DTO as authoritative, and scopes local dismissal to owner + Hong Kong date. The next Hong Kong date reopens the entry.
- Signup action loading no longer unmounts the public form; accepted registration shows the email-confirmation dialog and then the check-email state.
- D4 adopts HK-day 1/7/30 activity windows, bad-case score `<50`, 90-day model-log and 15-month daily-activity retention targets. Cleanup is not scheduled.
- Latest verification: Client 437/437, D4-focused 18/18, Migration contracts 61/61, Server 658/658, Server typecheck/build, prior localhost-only Playwright 11/11 × 2.
- D1/D4 Migrations are still unapplied; no database/staging write, deployment, commit, push, reset, clean or worktree.
- Latest evidence: `docs/evidence/2026-07-19/slice-d4-telemetry-contracts/verification.md`.
- Next bounded work: D5 model-attempt instrumentation; database execution remains D7 and requires separate authorization.

## Latest (2026-07-18)

- Local runtime is left running at `http://localhost:5173/app` and `http://localhost:3001`.
- Ordinary-admin generation list/detail group isolation is fixed and verified against staging.
- `super_admin` cross-group visibility remains intentional; the QQ admin is a super administrator.
- Admin UI exposes current role/group and owner-group labels.
- Full verification: Client 410/410, Server 597/597, typecheck/build/audits passed.
- Evidence: `docs/evidence/2026-07-18/admin-review-group-scope/verification.md`.
- Handoff: `docs/handoff/2026-07-18-admin-review-group-scope-handoff.md`.
- Preserve the dirty worktree; no migration/deployment/commit/push was performed in this slice.

## Latest (2026-07-15)

- **Local workbench shell smoke PASS (mock only)**: not real Auth/RLS/payment.
- Command: `powershell -File scripts/e2e-workbench-shell.ps1 -Twice` (Node 22, port 5184).
- Self-test: `powershell -File scripts/e2e-workbench-shell.ps1 -SelfTest`
- Evidence: `docs/evidence/2026-07-15/workbench-shell-local-smoke/`
- Codex review: `.planning/prompts/20260715-221800-codex-review.md`
- Fixtures: `client/src/e2e/*` via `client/vite.e2e.config.ts` only.
- Windows: Playwright ASCII `C:\work\77hk-workbench-e2e`; Vite from real `client/` path.
- Prior public harness: `scripts/e2e-public-smoke.ps1` + `docs/evidence/2026-07-15/e2e-harness-hardening/`

Resume order:
1. Read `.planning/status.md` then this pack.
2. Shell smoke ≠ real login. Do not reuse `user-authored-review-queue` localStorage mock as Auth proof.
3. Next after Codex accept: plan real Auth/RLS slice only with explicit authorization.
