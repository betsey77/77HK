# 77hk.net frontend forward-fix acceptance

Date: 2026-08-06 (Asia/Hong_Kong)

## Candidate

- Branch: `release/v2.1`
- Base checkpoint: `6d6dc44` (`fix: 补齐生产图片资源`)
- Additional scope: replace the Synear Shorts case card with the user-supplied
  image and extend the tracked-asset contract.
- Dirty Worktree rule: only the reviewed asset, contract test, evidence, and this
  release record may enter the delivery commit.

## Acceptance

- Focused static deployment contract: 4/4 passed.
- Isolated index candidate: 58 test files and 491/491 tests passed.
- TypeScript and Vite production build: passed; 1,737 modules transformed.
- Required discovery files remain in the build: canonical, `robots.txt`, and
  `sitemap.xml`.
- Required production images are present in the build with accepted hashes.
- No API, database, migration, authentication, authorization, billing, DNS,
  environment-variable, or dependency change.

## Release transaction

1. Push the exact delivery commits to `origin/release/v2.1`.
2. Record the immutable Vercel Preview deployment.
3. Verify API health and CORS before frontend smoke.
4. Verify homepage, discovery files, all three restored/replaced image paths,
   and the Synear Shorts case image on Preview.
5. Promote that exact immutable Preview deployment to Production.
6. Repeat the same HTTP and visual checks on `https://77hk.net`.

## Rollback and forward-fix

- Pre-release production deployment: `dpl_E2uTyYVZZmDD5wfEu6a76NmPHdsG`.
- Known earlier stable frontend deployment: `dpl_5Zw1mp1RfqZHNEsYP8yToWDn1j7v`.
- Rollback means moving the production alias; do not delete immutable deployment
  evidence.
- If Preview differs from the isolated candidate or any API/auth smoke fails,
  stop before promotion and issue a new forward-fix candidate.

## Verdict

GO for Preview deployment. Production promotion is authorized by the user but
remains conditional on the Preview checks above passing against the same
immutable deployment.

## Completed deployment

- Git delivery SHA: `1f66b16624106dcaaf33eb7835dbc80f1d12ed6b`.
- Preview deployment: `dpl_5g2PPQomw855FjfZK3g4Pzrhbcmq` — READY and passed
  discovery, asset, API-health, and CORS checks.
- Production deployment: `dpl_Ga46CnXVc2L2NP1oZ1pHvzBigwaP` — READY; promoted
  from the Preview above.
- Production alias: `https://77hk.net` resolves to the production deployment.
- Production smoke: `/`, `/app`, `/login`, `/pricing`, `robots.txt`,
  `sitemap.xml`, and all three image paths returned HTTP 200 with expected
  content types and bytes.
- Final verdict: GO. No rollback triggered.
