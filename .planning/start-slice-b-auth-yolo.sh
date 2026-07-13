#!/usr/bin/env bash
set -euo pipefail

cd '/d/work/77港话通社媒文案/77'
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
export PATH="/d/work/77港话通社媒文案/77/node_modules/.bin:/c/Program Files/nodejs:/c/Users/35308/AppData/Roaming/npm:$PATH"

exec '/c/Users/35308/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe' \
  --dangerously-skip-permissions \
  'Read .planning/prompts/20260711-171026-continue.md and execute it exactly with the approved Agent Team. YOLO permission is approved only for this bounded Slice B application integration. Do not migrate or delete database data, deploy, enter Slice C/payment, or use secret/service_role keys. Stop when real email inbox interaction is required.'
