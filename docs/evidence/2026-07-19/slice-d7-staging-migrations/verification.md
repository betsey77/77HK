# Slice D7 staging migration dry-run verification

Date: 2026-07-19

## Authorized scope

- Target only the linked staging project `wzpaghnxlpfjojvuxplx` (`77HK-staging`).
- Prepare D1/D4 migrations for staging verification.
- Do not deploy, commit, push, touch production, reset/clean, or create a worktree.

## Local checks completed

- The linked project ref, Client ref, and Server ref all resolve to `wzpaghnxlpfjojvuxplx`.
- `supabase projects list` reports `77HK-staging` as linked and `ACTIVE_HEALTHY`.
- The focused migration contract tests passed: 11/11.
- The dry-run helper now refuses any linked project other than the expected staging ref.
- No database password was written to this evidence directory.

## Dry-run attempts

1. `supabase migration list --linked` failed before migration execution with `LegacyDbConnectError: PgClient: Failed to connect`.
2. A retry with `--dns-resolver https` failed before migration execution because the direct database hostname did not yield a usable address.
3. A read-only WSL fallback check found that WSL is not installed; it was not installed for this task.
4. After the network began resolving the shared pooler to public IPv4 addresses, the guarded retry completed both migration history comparison and `db push --dry-run`.

The Windows resolver currently maps the shared pooler hostname into a `198.18.0.0/15` proxy/Fake-IP range. Bypassing that resolver makes the CLI select the direct Free-plan database endpoint, which requires working IPv6. This machine does not currently have a usable IPv6 route for that endpoint.

## Result

**DRY-RUN PASSED.** The 19 existing Local/Remote migration versions match. Exactly two local-only migrations would be pushed:

- `20260719090000_slice_d1_checkin_rewards.sql`
- `20260719120000_slice_d4_activity_model_telemetry.sql`

The command ran with `--dry-run`; no migration or remote database write occurred.

Raw transcripts:

- `dry-run-transcript.txt`
- `dry-run-attempt-2.txt`
- `dry-run-attempt-3.txt`

## Next safety gate

Obtain explicit approval naming migrations `20260719090000` and `20260719120000`. Only then apply them once to linked staging, immediately compare migration history again, and continue with read-only schema/RLS/GRANT/RPC/concurrency/telemetry verification.
