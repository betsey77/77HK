# Admin review-group scope verification

Date: 2026-07-18

## Scope

- Preserve the existing dirty worktree.
- Keep `super_admin` cross-group visibility.
- Restrict ordinary `admin` generation metadata and detail reads to owners in the same non-null `profiles.review_group`.
- Show the current administrator scope and each copy owner's group in the admin UI.
- No migration, deployment, commit, push, reset, clean, or worktree creation.

## Root cause

The favorites list/detail path already passed an actor scope and filtered owners by review group. The generation list/detail path used the trusted Supabase client without an owner-group filter, so an ordinary administrator could read cross-group generation metadata and detail. A separate observation was expected behavior: the QQ administrator is `super_admin`, and therefore can intentionally see all groups.

## Verification

- Focused server tests: 73/73 passed.
- Focused client tests: 27/27 passed.
- Full `npm run verify`: Client 410/410, Server 597/597, both typechecks and builds passed, both dependency audits found 0 vulnerabilities.
- Real staging read-only acceptance with ordinary admin `77@tezign.com`:
  - role `admin`, current group `group1`;
  - generation list HTTP 200, 3 rows, groups only `group1`;
  - favorites list HTTP 200, 5 rows, groups only `group1`;
  - direct request for an existing `group2` generation detail returned HTTP 404.

## Local acceptance runtime

- Web: `http://localhost:5173/`
- Workbench: `http://localhost:5173/app`
- Admin: `http://localhost:5173/admin`
- API health: `http://localhost:3001/api/health`
- Root process PID: `.planning/runtime/dev.pid`
- Logs: `.planning/runtime/dev.stdout.log`, `.planning/runtime/dev.stderr.log`

