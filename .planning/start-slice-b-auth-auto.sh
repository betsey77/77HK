#!/usr/bin/env bash
set -euo pipefail

cd '/d/work/77港话通社媒文案/77'
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
export PATH="/d/work/77港话通社媒文案/77/node_modules/.bin:/c/Program Files/nodejs:/c/Users/35308/AppData/Roaming/npm:$PATH"

exec '/c/Users/35308/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe' \
  --permission-mode auto \
  'Read .planning/prompts/20260711-193340-continue.md and execute it exactly with the approved Agent Team in AUTO mode. Never query API keys, use secret/service_role, write the database, run migrations, deploy, or enter Slice C/payment. Use only .planning/supabase-connection.local.env and stop when real email inbox interaction is required.'
