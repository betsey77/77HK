# Verification Commands

Generated: 2026-07-11T10:04:06
Project: D:\work\77港话通社媒文案\77

## Detected Stack

- node

## Recommended Order

1. Install dependencies when needed.
2. Run fast static checks.
3. Run behavior tests for the changed slice.
4. Run build, smoke, or integration checks when the slice touches UI, API, auth, data, or deployment paths.
5. Save the command output with `vibe_loop.py` or `vibe_verify.py`.

## Commands

| Purpose | Command | Required | Notes |
|---|---|---:|---|
| install dependencies | `npm install` | when needed | Detected npm. |
| production build | `npm run build` | yes | package.json script `build`. |
| local dev server | `npm run dev` | recommended | package.json script `dev`. |

## Loop Usage

```text
python path/to/vibe_loop.py . --name "verify current slice" --phase verify --goal "prove the slice works" -- npm run build
```

## Harness Rule

Do not mark a slice done until at least one required command has passed or the user accepts a documented manual verification substitute.
