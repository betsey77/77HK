# Slice C2b remote acceptance — 2026-07-12

## Outcome

`20260712000000_slice_c2a_trusted_write_quota.sql` was applied to the linked Supabase project. The secret value was never printed or copied into the repository; the server reads it through an ignored `.env` pointer to an external file.

## Verified state

- Local/remote migration history: 5/5 synchronized.
- Plans: Free = 20 per rolling 7 days; Pro = 400 per calendar month, `price_fen = 1900`.
- Existing auth users / subscriptions: 2 / 2.
- `authenticated`: generation job SELECT yes, INSERT no, UPDATE no; quota RPC EXECUTE no.
- `service_role`: ledger SELECT + INSERT yes, UPDATE no; quota RPC EXECUTE yes.
- RLS enabled on generation jobs, plans, subscriptions and usage ledger.

## Transactional smoke tests

All smoke tests ran inside `BEGIN ... ROLLBACK`, so no quota or ledger test data remained:

1. reserve succeeds;
2. same idempotency key returns the same reservation without double charge;
3. consume is idempotent;
4. release-after-consume is rejected;
5. release is idempotent;
6. consume-after-release is rejected;
7. only a consumed reservation remains charged;
8. releasing an old-period reservation does not change the new period's counter;
9. authenticated JWT simulation sees one own subscription and cannot execute reserve RPC.

## Automated verification

- Server Vitest: 156/156 passed.
- Client Vitest: 53/53 passed.
- Server TypeScript/build: passed.
- Client TypeScript/Vite build: passed.
- Trusted server query through external secret file: passed, plan count 2.
- Supabase performance advisor: no warnings.
- Security advisor: two known warnings only — intentional owner-checked soft-delete `SECURITY DEFINER` RPC and leaked-password protection disabled.

## Related hotfixes

- Browser-local bookmarks, settings and saved configs are scoped by Supabase `user.id`.
- Ambiguous legacy global keys are retained but ignored; no silent cross-account assignment.
- Header includes “复原配置” for the five approved defaults.
