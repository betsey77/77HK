# 77hk.net production asset forward-fix verification

Date: 2026-08-06 (Asia/Hong_Kong)

## Scope

- Restore the two image assets served by the 2026-07-23 stable frontend deployment.
- Keep the existing `robots.txt`, `sitemap.xml`, and homepage canonical changes.
- Add a deployability regression contract so locally present but untracked assets fail verification.
- No API, database, auth, billing, DNS, environment-variable, or production mutation.

## Runtime RED

The current `https://77hk.net` production deployment returned HTTP 200 with
`text/html` for both image URLs instead of image content:

- `/brand/team-collab-preview.jpg`
- `/brand/whiteboard_exported_image.png`

The previous stable immutable deployment returned the expected JPEG and PNG.
The local untracked files matched those stable bytes exactly.

## Local RED/GREEN

Focused command:

```powershell
cd client
npx vitest run src/test/seo-static-contract.test.ts
```

- RED: 3 passed, 1 failed because Git did not track
  `client/public/brand/team-collab-preview.jpg`.
- GREEN after staging only the two assets: 4 passed, 0 failed.

## Isolated candidate verification

The candidate was exported from the Git index plus `HEAD` to
`C:\Users\35308\AppData\Local\Temp\77-forward-fix-candidate-20260806-181459`.
This excluded unrelated Dirty Worktree modifications.

```powershell
vitest run
npm run build
```

- Client: 58 files passed, 491 tests passed.
- TypeScript and Vite production build: passed; 1,737 modules transformed.
- Built JPEG: 144,776 bytes, SHA-256
  `be0a5d1ee8538ef799505deb9ca52d21158a7fce6ebc33668770cb57ed4ba837`.
- Built PNG: 535,135 bytes, SHA-256
  `d3d5f1feb2020e08e0652ac61ac454d4979b4b32717018fe4b2a2f3aa2c0a4e5`.
- File signatures: JPEG `FF-D8-FF`; PNG `89-50-4E-47-0D-0A-1A-0A`.

## Review verdict

- Standards axis: PASS. Only two accepted binary assets and one focused static
  deployment-contract test are changed; no runtime logic or dependency changes.
- Spec/incident axis: PASS. The candidate preserves the SEO discovery files and
  restores the two known production asset paths with the stable accepted bytes.
- Release status: local candidate ready; production deployment remains a separate
  explicit approval gate.

## Backup

Pre-change copies with matching SHA-256 hashes are stored at
`C:\Users\35308\AppData\Local\Temp\77-forward-fix-2026-08-06-prechange`.
