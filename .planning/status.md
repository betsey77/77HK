# Project Status

Generated: 2026-07-16
Project: D:\work\77港话通社媒文案\77

## Current Phase

**Staging Auth/RLS and review notifications accepted (2026-07-16).**

- User adopted/changes-requested dialog, dedupe, new-review notification, and immediate favorite focus are covered.
- Admin pending reminder, later/immediate actions, pending filter, and highlighted row are covered.
- Node 22 Playwright harness passed 6/6 twice with 11 desktop/mobile screenshots and localhost-only network enforcement.
- All 18 migrations were replayed on isolated staging `wzpaghnxlpfjojvuxplx`.
- Real mailbox confirmation, initial login, password reset, old-password rejection,
  and new-password login passed.
- Owner and review-group RLS, admin authorization, fail-closed API behavior, and
  cleanup passed with temporary staging users and data.
- Real staging browser sessions passed admin pending reminders, admin review save,
  user adopted/changes-requested reminders, and desktop/mobile immediate favorite
  focus.

## Latest slice

- Review notification evidence: `docs/evidence/2026-07-16/review-notifications-local-e2e/`
- Staging Auth/RLS and notification evidence: `docs/evidence/2026-07-16/staging-auth-rls/`
- Hardened soft-delete Migration `20260716024428` is applied and read-only verified remotely.
- Prior shell mock evidence remains at `docs/evidence/2026-07-15/workbench-shell-local-smoke/`.

## Git baseline

Pushed to `origin/master` through `8336121`:

- `38ff83b` `fix(server): prefer service-local environment config`
- `a339bbc` `security(database): restrict platform RLS helper execution`
- `8336121` `test(staging): verify Auth RLS and review notifications`

## Commands

```powershell
powershell -File .\scripts\e2e-workbench-shell.ps1 -SelfTest
powershell -File .\scripts\e2e-workbench-shell.ps1 -Twice -EvidenceDir docs/evidence/2026-07-16/review-notifications-local-e2e
```

## Boundaries

- Staging only; no production deployment or production data mutation.
- The real-mailbox staging account remains available; temporary administrators and
  acceptance data were removed.
- Supabase CLI link-state files under `supabase/.temp/` remain intentionally dirty
  and were excluded from all commits.

## Next

1. Prepare preview deployment configuration and environment-variable inventory.
2. Run preview smoke acceptance after explicit deployment approval.
3. Run Alipay sandbox E2E under separate approval.
