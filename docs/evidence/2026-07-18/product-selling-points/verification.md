# Product Selling Points Slice B verification

Date: 2026-07-18

## Scope

- Add, delete, retain-on-failure, and retry itemized product selling points.
- Enforce 10-item and 200-character source limits on client and server.
- Require Supabase authentication for `POST /api/localize-selling-point`.
- Prefer Cantonese-localized selling points in both prompt engines with facts/brand red lines taking priority.
- Preserve selling points through local configs, cloud JSONB, generation snapshots, and history restoration.
- No Migration, deployment, commit, push, reset, clean, or worktree creation.

## Automated verification

- Product-selling-point focused tests: Client 7/7; Server 7/7.
- Impacted regression: Client 75/75; Server 154/154.
- Final full verification: Client 417/417; Server 604/604; both typechecks and production builds passed; both dependency audits found 0 vulnerabilities.
- Post-review prompt conflict fix: 39/39 related prompt tests and server typecheck passed.
- Isolated Playwright: 8/8 twice, all traffic restricted to localhost, no horizontal overflow.

## Evidence

- Full output: `../slice-03/test-output.txt`
- Playwright output: `test-output.txt`
- Desktop: `screenshots/product-selling-points-desktop-1440-local-mock.png`
- Mobile: `screenshots/product-selling-points-mobile-390-local-mock.png`

## Manual acceptance

- The first signed-in manual generation failed acceptance: selling points localized and persisted, but the generated copy did not contain them.
- Root cause: both real-model services omitted `productSellingPoints` when forwarding the validated generation request to their Prompt builders.
- Local fix: DeepSeek and CantoneseLLM now forward the normalized selling-point array. A new service-boundary regression test failed on both paths before the fix and passes after it.
- Fix verification: selling-point focused server tests 9/9; final full verification Client 417/417, Server 606/606, both typechecks/builds, and both audits passed. Full output: `../slice-04/test-output.txt`.
- Passed on 2026-07-18: the user repeated the signed-in local generation and confirmed the selling points appeared in the generated copy.
- Slice B is accepted locally. No deployment, Migration, commit, or push is implied by this manual result.
