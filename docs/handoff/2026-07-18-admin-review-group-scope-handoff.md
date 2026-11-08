# 2026-07-18 admin review-group scope handoff

## Read first

1. Read `.planning/status.md` and this document.
2. Preserve the existing dirty worktree. Do not reset, clean, or create another worktree.
3. The local development runtime is intentionally left running for manual acceptance.

## Current runtime

- Web: `http://localhost:5173/`
- Workbench: `http://localhost:5173/app`
- Admin: `http://localhost:5173/admin`
- API: `http://localhost:3001/api/health`
- Root process PID: `.planning/runtime/dev.pid`
- Logs: `.planning/runtime/dev.stdout.log`, `.planning/runtime/dev.stderr.log`

## Completed slice

- Ordinary administrators now receive only same-group generation metadata.
- Cross-group generation detail requests fail closed with HTTP 404 before audit/body reads.
- `super_admin` retains intentional cross-group visibility.
- Admin header shows the current role and review group; generation and favorite rows show owner group.
- Existing favorite group scoping remains unchanged.
- Evidence: `docs/evidence/2026-07-18/admin-review-group-scope/verification.md`.

## Verification

- Focused server: 73/73.
- Focused client: 27/27.
- Full verification: Client 410/410, Server 597/597, typecheck/build/audits passed.
- Real staging ordinary-admin check: group1 lists only group1; an existing group2 generation detail returns 404.

## Important interpretation

- The QQ account currently has `super_admin`, so its cross-group visibility is expected by the accepted product rule.
- Use `77@tezign.com` (`admin`, `group1`) to manually verify ordinary-admin isolation.
- No database migration was needed for this slice.

## Git and deployment state

- Local and `origin/master` baseline remains `a86a40f` before this dirty worktree.
- The worktree contains many earlier local changes plus this slice; nothing was committed or pushed here.
- API Preview Ready deployment recorded previously: `dpl_5yKcJFYvATAmxejR6X3gjMHLZ8ki`.
- Web stable alias remains on the earlier Ready deployment `dpl_8Yn3LPjBBqtzkMFCciZ66XtF7tCd`; the newer 1.1.4.5 UI is local because three Web deploy attempts ended `UNKNOWN`.

## Recommended next slice

1. Complete manual local acceptance of the admin role/group labels and ordinary-admin isolation.
2. Implement Product Selling Points end to end: itemized input, Cantonese translation, prompt priority, configuration sync, and history restoration.
3. Then improve review notifications with visible-page polling before starting the larger 7-day check-in and analytics slice.
4. Audit the dirty worktree into functional commits only after explicit authorization.

