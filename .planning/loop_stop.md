# Loop Stop — H1 Migration Push

Date: 2026-07-12

## Goal

Push `20260712143000_slice_h1_user_feedback.sql` to the linked Supabase project after explicit user authorization.

## Attempts

1. `npx supabase migration list` — failed before remote version discovery with `LegacyDbConnectError`.
2. `npx supabase db push` — failed during remote Postgres TLS negotiation with EOF.

## What Changed

- No remote database change is evidenced; the CLI never reached migration application output.
- Local migration file was not modified.

## Blocker

The current machine cannot establish the Supabase CLI Postgres TLS connection to `db.qiotocumkbwckiezuptr.supabase.co`.

## Needed Decision

Choose either Supabase Dashboard SQL Editor / authenticated Supabase MCP as the alternative application path, or first troubleshoot the local network/IPv6/TLS path and retry CLI later.

## Recommended Next Step

Use an authenticated Supabase management path to inspect the migration and apply it once, then verify the table, policies, grants and feedback API with redacted evidence.

## Resolution

Resolved on 2026-07-12 through the authenticated Supabase MCP after explicit user authorization. Remote migration version is `20260712072936`; table, RLS, policies, grants and triggers were verified.

---

# Loop Stop — R1.1 Grok Build Implementation

Date: 2026-07-14

## Goal

Use Grok Build to implement the local-only R1.1 review-save hotfix and resizable review body, without pushing a migration or changing remote data.

## Attempts

1. Headless Grok rejected incompatible `--check` + `--no-subagents`; no task work started.
2. Grok returned exit 0 but stopped after planning; allowed implementation files were unchanged.
3. Retried with `--no-plan`; Grok again returned exit 0 without editing implementation files.

## What Changed

- Confirmed from Supabase PostgreSQL logs that the save failure is caused by writing `_actor_role text` into `audit_log.actor_role public.app_role`.
- Recorded R1.1 and R2 requirements in PRD, TEST_PLAN, CHANGELOG and planning notes.
- Created the controlled Grok task prompt: `.planning/prompts/20260714-grok-r1-review-save-hotfix.md`.
- Removed the empty local migration placeholder so it cannot be pushed accidentally.

## What Did Not Change

- No application code or test implementation was completed by Grok.
- No migration was pushed; no remote SQL, role/group assignment, deployment, payment or Git operation occurred.

## Blocker

The installed Grok Build CLI exits successfully after planning but does not execute file edits in headless mode under the current invocation/permission setup.

## Needed Decision

The user can either authorize Codex to implement R1.1 directly, or run the saved prompt in the interactive Grok TUI and return when Grok has actually changed files.

## Recommended Next Step

Implement and verify R1.1 first; only after its local acceptance and explicit migration-push confirmation proceed to R2 sentence-level annotations.

---

# Loop Stop — R2 Browser Manual Acceptance

Date: 2026-07-15

## Goal

Manually verify the deployed R2 chain in a real browser: existing review -> owner edits favorite -> admin sees “修改后待审核” -> admin saves an inline annotation -> owner refreshes and sees the red highlight.

## Attempts

1. The isolated QA setup reached the deployed RPC but used `p_*` argument names; PostgREST correctly rejected the unknown signature before browser work.
2. The corrected RPC call used `start/end` annotation fields; the deployed function correctly rejected the invalid annotation shape.
3. The setup passed with the deployed `_actor_id/_favorite_id/_status/_note/_annotations` signature and `startOffset/endOffset`. Headless Chromium then failed during the first user login because its Supabase Auth request ended with `ERR_CONNECTION_CLOSED` / `Failed to fetch`; the page never navigated to `/app`.

## What Changed

- Started the existing client and server on `http://localhost:5173` and `http://localhost:3001`; both remain running with clean startup logs.
- Added a strict browser acceptance runner and failure report under `test-results/manual-r2/`.
- Created isolated remote QA data only; no existing user or business row was modified, no migration/deployment/Git operation ran, and no QA data was deleted.
- Recorded the user's product decisions: existing Pro users change to 250 in the current period immediately; Team is ￥99/month.

## Verification Result

- Node-side Supabase setup succeeded for confirmed QA users, same review group, admin role, favorite creation and old R2 review creation.
- Browser acceptance did not reach the first product interaction, so R2 remains not manually accepted.
- Evidence: `test-results/manual-r2/report.json` and `test-results/manual-r2/dev.stdout.log`.

## Blocker

The headless Chromium process cannot currently complete the Supabase Auth HTTPS request, while the Node Supabase client can reach the same project. Three attempts are exhausted for this loop.

## Needed Decision

Authorize a fresh R2 acceptance loop using a browser-network workaround or a user-connected logged-in browser. Separately authorize deletion of the six synthetic QA auth users and their three cascade-owned favorites created by these attempts, if cleanup is desired.

## Recommended Next Step

First diagnose Chromium proxy/TLS connectivity with a read-only Supabase Auth health request, then rerun the same bounded R2 browser path once. Do not begin Shorts/TK until R2 passes.

## Authorized Retry Audit

The user authorized both cleanup and a fresh R2 loop on 2026-07-15. The original six QA users and three favorites were deleted and verified absent before retrying.

### Retry Attempts

1. Browser login succeeded, but the runner waited for a `dialog` role that the existing favorites drawer does not expose.
2. The owner path passed through old-review display and edit invalidation. Admin login then correctly fell back to `/app` because `/admin` is not in the post-login allowlist; the runner incorrectly waited for `/admin`.
3. Owner old-review display, owner edit invalidation, same-group admin login and the admin “修改后待审核” list all passed. The admin detail opened, but the scripted textarea selection did not produce the inline-annotation note editor; the runner timed out waiting for `#inline-annotation-note`.

### Retry Verification Result

- Passed in browser: old review and annotation visible to the owner; owner edit persists; old review disappears; owner sees “修改后待审核”; same-group admin sees the matching pending status and can open the edited body.
- Still unverified: native text selection -> add inline annotation -> save review -> owner refresh sees red highlight.
- Screenshots: `01-user-old-review.png`, `02-user-edit-pending.png`, `03-admin-pending-list.png` under `test-results/manual-r2/`.
- Cleanup: every retry account was deleted by the runner; final remote counts are zero QA profiles and zero QA favorites.

### Current Blocker

The automated browser selection method does not reproduce the native textarea selection state expected by `captureAnnotationSelection`. A fourth retry is prohibited without a new explicit continuation decision.

### Recommended Next Step

Use a connected interactive browser or native keyboard/mouse selection instead of programmatic `setSelectionRange`, then run only the remaining annotation-save-refresh path. Do not begin Shorts/TK until that path passes.

## Second Authorized Retry Audit

The user explicitly authorized another R2 continuation and allowed Grok Build as an optional helper. Grok was not invoked because the remaining blocker is browser-native selection control, not product implementation, and previous Grok headless runs did not execute edits.

### Attempts

1. Used keyboard navigation (`Home`, arrow keys and `Shift+ArrowRight`) on the read-only review textarea. Chromium did not expose a usable selection to the React handler.
2. Used a real Playwright mouse drag based on computed font measurements. A native selection was created, but the actual range was `3..18`, not the required `2..6`; the runner stopped before clicking “加入批注”.
3. Calibrated pixels-per-character from the first native drag and retried. The actual range became `18..19` (`。`), so the exact-text guard stopped the run before any annotation write.

### Result

- The previously passed owner edit and admin pending-list path remained stable on all three attempts.
- No incorrect annotation or review was saved.
- Final cleanup succeeded: zero QA profiles and zero QA favorites remain remotely.
- New diagnostic screenshot: `test-results/manual-r2/04-admin-native-selection.png`.

### Blocker And Decision

The remaining acceptance step requires a controllable interactive browser or a human drag selection. Coordinate-based headless selection is not reliable enough to certify the feature. A new continuation requires explicit approval after this three-attempt stop, preferably with an attached browser-control capability or a user-performed selection in the currently open `/admin` page.

## Final Resolution

Resolved on 2026-07-15 by user-performed browser interaction. The supplied user-side screenshot shows the saved `changes_requested` review, whole-copy note, three sentence annotations and red inline highlights. R2/R2.1 is accepted; evidence is archived under `docs/evidence/2026-07-14/r2-inline-review-and-favorite-edit/`.
