# PROMPTS

Use these prompts to keep agent work aligned with 77vibe-dev-flow.

## Start New Product

```text
Use 77vibe-dev-flow. First clarify MVP, PRD, SDD, TEST_PLAN, harness, and acceptance. Do not code until the plan is aligned.
```

## Continue Existing Project

```text
Use 77vibe-dev-flow. Run vibe_start.py first, then read README, AGENTS.md, CLAUDE.md, spec/, .planning/, docs/evidence/, and docs/experience-library only as needed.
```

## Start Or Resume

```text
Use 77vibe-dev-flow. Run vibe_start.py with lean context, show me .planning/status.md, and recommend the next safe action.
```

## Check Status

```text
Use 77vibe-dev-flow. Generate .planning/status.md with vibe_status.py and tell me the current score, missing items, recent evidence, and next safe action.
```

## Add Requirement

```text
Use 77vibe-dev-flow. Record this change with vibe_change.py, update tests before implementation, and keep the implementation to one vertical slice.
```

## Fix Bug

```text
Use 77vibe-dev-flow. Reproduce first, add or update a behavior test, then fix with the smallest change. Save test output and evidence.
```

## Run One Loop

```text
Use 77vibe-dev-flow. Check scripts/verify/commands.md, then run one vertical loop with vibe_loop.py using lean context, keep the goal narrow, save evidence, update progress, and refresh the context pack.
```

## Build Harness

```text
Use 77vibe-dev-flow. Detect the project stack with vibe_harness.py and write scripts/verify/commands.md before implementation.
```

## Handoff

```text
Use 77vibe-dev-flow. Generate a context pack, update progress and memory, then summarize current status, unresolved risks, and next safe action.
```

## Generate Agent Prompt

```text
Use 77vibe-dev-flow. Generate a ready-to-send prompt with vibe_prompt.py for the target agent and mode, defaulting to lean context. Do not dispatch multiple subagents unless the user approves.
```

## Low Token Mode

```text
Use 77vibe-dev-flow in low-token mode. Read .planning/status.md first, regenerate context with --profile lean, summarize only the next action, and open large files only when required.
```

## Acceptance

```text
Use 77vibe-dev-flow. Generate an acceptance report with vibe_accept.py. Only if evidence passes, ask whether to do a preview deployment. Do not deploy production without explicit approval.
```
