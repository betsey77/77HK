# 2.1 Slice E8 staging migration evidence

Date: 2026-07-22  
Target: staging Supabase `wzpaghnxlpfjojvuxplx`  
Scope: `20260722100000_slice_e_bad_case_review_packs.sql` only

## Result

- The local migration was applied once to the authorized staging project.
- Remote migration history now records `20260722100000 / slice_e_bad_case_review_packs`, matching the repository filename.
- No production database, application deployment, commit, push, reset, clean, or worktree action occurred.

## Execution notes

1. Read-only preflight confirmed the linked project ref and that the only pending local migration was `20260722100000_slice_e_bad_case_review_packs.sql`.
2. Supabase CLI connection was attempted three times and stopped under the loop limit:
   - default resolver: `LegacyDbConnectError: PgClient: Failed to connect`;
   - native resolver: the same connection failure;
   - HTTPS resolver: no valid IP for `db.wzpaghnxlpfjojvuxplx.supabase.co`.
3. The official Supabase connector was used as the bounded fallback. Its pre-apply migration list ended at `20260719120000_slice_d4_activity_model_telemetry`, so no unrelated migration was bundled.
4. The connector applied the Slice E SQL successfully. Because it initially generated migration version `20260722053951`, the migration-history version was corrected to the repository version `20260722100000` without re-running the schema SQL. The final remote migration list matches the local version and name.

## Read-only verification

The four expected tables exist and have RLS enabled:

- `generation_artifact_snapshots`
- `bad_case_review_packs`
- `bad_case_findings`
- `bad_case_review_events`

ACL verification:

- `anon`: no SELECT on all four tables.
- `authenticated`: no SELECT on all four tables.
- `service_role`: the intended SELECT/INSERT/UPDATE grants only.
- `bad_case_review_events` remains append-only for `service_role` (no UPDATE/DELETE).
- No E8 table grants DELETE to `service_role`.

Advisor review:

- The four E8 `RLS enabled, no policy` INFO notices are intentional because browser roles have no grants and all access goes through the trusted BFF.
- Three new INFO notices identify unindexed assignee/reviewer/actor foreign keys. They are not a functional blocker for staging acceptance, but should be evaluated as a small forward-only hardening migration before production if expected volume justifies it.
- Existing warnings for authenticated SECURITY DEFINER functions and leaked-password protection are outside this migration and remain release-readiness items.

## Still pending in E8

- Real `super_admin`, ordinary-admin, and cross-owner API/browser acceptance.
- Successful and failed generation hooks creating review packs on new jobs.
- Strict detail audit-order verification, write operations, stale snapshot rejection, diagnostics aggregation, and cleanup proof with zero QA residue.
- Final human desktop/mobile acceptance.

