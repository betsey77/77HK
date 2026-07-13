#!/usr/bin/env bash
set -euo pipefail

cd '/d/work/77港话通社媒文案/77'
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
export PATH="/d/work/77港话通社媒文案/77/node_modules/.bin:/c/Program Files/nodejs:/c/Users/35308/AppData/Roaming/npm:$PATH"

exec '/c/Users/35308/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe' \
  --permission-mode acceptEdits \
  'Read .planning/prompts/20260711-145157-continue.md and execute it exactly. Use the approved Agent Team. Stop at the Slice B completion gate or the first missing Supabase remote configuration; do not enter Slice C, payment, or deployment.'
