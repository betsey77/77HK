# AGENTS.md

## Project Goal

交付一个可运行、可验证的香港粤语社媒文案 SaaS：公开邮箱账户、核心生成/审核/反馈、历史与收藏、Free/Pro 额度、支付宝沙箱支付和受审计的管理后台。

## Workflow

- Follow `AI_AGENT_PRODUCT_DEV_FLOW.md` or the installed `77vibe-dev-flow` skill.
- On first entry, prefer `vibe_start.py` to initialize missing files, refresh lean context, and write status.
- Read `README.md`, `spec/`, and `.planning/` before making changes.
- If `.planning/status.md` is stale or missing, generate it before deciding the next action.
- Regenerate `.planning/context_pack.md` before handoff, long pauses, or context-heavy work; use lean context for repeated loops.
- Generate `.planning/prompts/` handoff prompts before asking another agent to continue.
- Keep token use low: read status first, then only open full context or large evidence files when needed.
- Keep changes small and tied to PRD, SDD, tests, or bug fixes.
- Use TDD vertical slices.
- Before implementation, check or generate `scripts/verify/commands.md`.
- Record each implementation or verification loop in `.planning/loop_log.md`.
- Before multi-step or non-single-thread work, record whether subagents or git worktrees are needed in `.planning/agent_assessment.md`.
- Ask the user for approval before dispatching multiple subagents.
- Use isolated git worktrees for parallel implementation when tasks are independent and the project is a git repository.
- Provide test output and real-run evidence for every completed slice.
- Record reusable decisions, lessons, bug causes, and handoff context in `docs/experience-library/`.
- Do not deploy, delete files, migrate data, or make broad refactors without explicit user approval.
- Do not install dependencies without first explaining the package, purpose, and impact and receiving user approval.
- Never print or rewrite `.env` secrets. `.env.example` currently needs a user-approved security cleanup before any push or deployment.
- Generate an acceptance report under `docs/release/` before asking about deployment.

## Done Gate

A feature is done only when:

- PRD traces to it.
- `.planning/status.md` reflects the current score, gaps, and next action.
- SDD describes it.
- Behavior tests pass.
- `scripts/verify/commands.md` identifies the command used for local verification.
- Boundaries are handled.
- Local verification was run.
- Loop result is recorded in `.planning/loop_log.md`.
- Evidence is saved.
- Reusable lessons or decisions are recorded when they would help the next agent.
- `.planning/context_pack.md` is current before handoff or after meaningful scope changes.
- A fresh `.planning/prompts/` prompt exists before another agent is asked to continue.
- `ACCEPTANCE.md`, `CHANGELOG.md`, and `.planning/progress.md` are updated.
- Deployment is only discussed after acceptance evidence passes.
