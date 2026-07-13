# Workbench usability polish evidence

Date: 2026-07-12

## Red phase

Five behavior failures reproduced the requested gaps: missing history back link, unconfirmed signup loading not settling, collapsed bookmark notes not highlighted, non-collapsible reference cases, and incomplete signup confirmation copy.

## Green phase

- Targeted tests: 46/46 passed.
- Full client tests: 118/118 passed across 7 files.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; Vite transformed 1688 modules.

## Scope

No database migration, payment change, API contract change, or deployment was performed. The runtime workflow progress bar remains pending under Spec v2.1 F1.
