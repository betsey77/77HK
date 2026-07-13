# 77vibe-dev-flow Agent Prompt

Target agent: claude
Mode: continue - Continue existing work
Generated: 2026-07-12T19:09:27
Project: D:\work\77港话通社媒文案\77

## User Objective

Slice G1 read-only admin plus reference cases calendar prompt and pricing regression gates

执行模式覆盖：首次 Agent Teams 启动后连续多个观察周期无文件落盘，已停止该次进程。本次必须由单一 Claude 顺序执行，不得再次启动 Agent Teams 或 worktree。先修复 A/B/C 回归并通过测试，才可继续 E；发现旧功能被覆盖时优先恢复。完成本轮后立即停止。

### A. 四星收藏参考案例

- 复现两条云端或本地评分 >=4 收藏在工作台不可发现的问题。
- 折叠入口始终可见，并明确显示“可用 N 条 · 已选 M/3”；两条四星收藏水合后展开均可见并展示备注。
- 最多选择 3 条；选择后下一次 generate request 必须携带对应真实 referenceCases；账号切换不得串数据。
- 测试必须覆盖云端水合/真实 reducer 状态、展开列表、选择与请求载荷，不能只断言组件存在。

### B. 话题日历五平台覆盖

- 选中的 calendarEventIds 必须到达服务端并影响 standardHK、lightCantonese、IG、Facebook、Shorts 五个返回版本，而不只是 Shorts。
- 当前根因是全局 Prompt 已有强制指令，但没有生成后五版本覆盖校验。建立单一 calendar generation contract，覆盖 DeepSeek、自部署 Cantonese 和 rules fallback；未选事件时行为不变。
- 返回结果必须确保每个版本明确融合至少一个所选事件 angle 或 narrative hook。实现必须有界、可测试、无无限重试；不得新增模型供应商、不得产生隐藏的额外额度扣减。
- 增加 prompt contract、五平台覆盖、无事件不改写、fallback 路径测试。

### C. 官网、Pricing 与结算链路

- 官网导航和套餐预览区增加明确的 `/pricing` 入口，并把套餐内容更新为 Free 每滚动 7 天 20 次、Pro ¥19/月 400 次。
- Pricing Free CTA 进入注册；Pro CTA 进入结算。未登录访问结算时保留安全站内 next 路径，登录或注册后回到 `/app/billing`。
- next 仅允许显式站内白名单路径；拒绝 `//evil`、`http://`、`https://` 和其他 open redirect。
- 保持 HeaderMenu 收纳，不新增右上角横排入口。增加路由行为测试。

### D. 已交付能力不变量与防覆盖

- 在 PRD、SDD、TEST_PLAN、ACCEPTANCE、CHANGELOG 与 planning 建立跨域回归矩阵：Auth、生成、五层 Prompt、参考案例、话题日历、历史恢复、收藏云同步、反馈、额度、Pricing/Billing Mock、Header 信息架构、双主题。
- 后续切片不得静默删除、隐藏、降级或以 Mock 覆盖已经完成的真实能力。
- `docs/comprehensive-spec-v2.md` 继续作为生成域权威规格，不得削减五层 Prompt。

### E. Slice G1 只读管理后台

- 目标角色仅为已认证 admin/super_admin；普通 user 必须返回 403。必须使用现有 requireAuth + requireAdmin 和现有 profiles、user_roles、audit_log、generation_jobs、user_feedback、subscriptions 结构。
- 实现 `/admin` 只读运营总览与最小只读 API：统计、用户概览、生成任务元数据、反馈摘要、订阅概览、审计列表。默认列表不得返回生成正文或反馈正文。
- 若提供正文详情，服务端必须先 append-only 写入 audit_log；本切片禁止删除、封禁、额度调整、角色修改、支付状态修改及任何危险按钮。
- 不得读取密码、token 或完整 secret。分页与上限、字段 allowlist、非管理员拒绝、错误脱敏必须有测试。
- 前端必须覆盖 loading、empty、error、403；沿用 docs/design-system.md、桌面工作台密度、暗色荧光绿/亮色橙色、Lucide 和现有 shared primitives；不新增 Ant Design 或任何依赖。
- 管理后台入口只在经过服务端确认 admin 权限后显示，不能靠浏览器角色字符串决定。
- 不为任何用户赋管理员角色，不推数据库 Migration，不执行远端写入或部署。若现有 schema 无法安全满足，停在本地代码/Mock 测试并报告。

### 强制边界与验收

- 保留用户上传的 77 Logo 裁切规范。
- 严禁真实支付宝、支付 Migration、远端角色授权、远端数据变更、真实管理员破坏操作和 secret 输出。
- 全量 client/server tests、tsc、build、secret scan、运行烟测、严格证据与文档更新全部通过。
- 顺序执行建议：收藏/转化链路 → 日历 Prompt → 管理员后端安全 → 管理员前端与文档；每阶段绿灯后再进入下一阶段。

## Operating Rules

- Use the 77vibe-dev-flow workflow.
- Treat files as the source of truth; do not rely on memory alone.
- Start with `.planning/status.md`; open larger files only when the status is not enough.
- Read `.planning/insight.md` for compact product, verification, context, and loop-risk diagnosis before long implementation work.
- Read `.planning/capability_router.md` before product discovery, design, analytics, memory, marketing, deployment, or other companion-skill work.
- For UI work, read `references/FRONTEND_UI_FLOW.md`, `references/PRODUCT_DESIGN_PLUGIN_FLOW.md`, `references/COMPONENT_LIBRARY_ROUTER.md`, and `references/UI_UX_QUALITY_GATE.md`; start from a design system, product-design/prototype checkpoint when useful, and scenario-appropriate component library before implementation.
- For MVP, prototype, internal-tool, or business-workflow work, read `references/MVP_PROTOTYPE_AND_REUSE_FLOW.md` and check real need, current alternatives, competitor patterns, and build-vs-buy before custom development.
- For commercial or paid products, read `references/COMMERCIAL_SAAS_FLOW.md` and decide landing, login, dashboard, billing, account, admin, and support surfaces before coding.
- For security-sensitive work, read `references/SECURITY_ENGINEERING_GATE.md`; use `anthropic-cybersecurity-skills` or the downloaded security library only for authorized, lawful, defensive work.
- If requirements are unclear, run `vibe_prd_gate.py`; if it fails, ask focused questions and update PRD before implementation.
- Read README if present, then AGENTS.md, CLAUDE.md, spec/, .planning/, docs/evidence/, and docs/experience-library/.
- If context looks stale, regenerate .planning/context_pack.md before deciding.
- Use the minimum companion skills needed for the current phase, then write durable outputs back to PRD, SDD, TEST_PLAN, evidence, acceptance, changelog, or memory.
- Keep work to one vertical slice unless the user approves a broader plan.
- Use evidence levels: basic for harmless routine work, standard for normal feature or bug work, strict for user-mentioned key requirements and high-risk behavior.
- Basic successful loops can use loop/progress records only; strict loops need saved command output and screenshots, recordings, state snapshots, or acceptance evidence when relevant.
- UI work must record design-system and component-library decisions in SDD and verify accessibility, touch states, responsive behavior, loading/empty/error states, and screenshots when user-facing.
- When `product-design` is available and UI is multi-page, commercial, dashboard/admin-heavy, mobile/app-like, or visually ambiguous, create or update a design-system/prototype checkpoint before deep implementation and record the artifact in SDD.
- Component defaults: HeroUI for landing/display pages, shadcn/ui for customizable product feature pages, Ant Design for backend/admin systems, and stack-native alternatives for Vue, native mobile, browser extensions, Feishu tools, commerce, or existing-project constraints.
- Security-sensitive work must record security requirements, trust boundaries, auth/authz, secrets, dependency/security checks, agent tool-call controls, and residual risks in project files.
- Stop after 3 attempts on the same loop unless the user explicitly approves continuing.
- Stop immediately when the current slice goal is achieved; do not continue just because a long-term goal remains active.
- Stop after 2 no-progress rounds unless the user explicitly approves continuing. Repeating the same command or edit without a better result is not progress.
- When stopping for max attempts or no progress, write or update `.planning/loop_stop.md` with attempts made, what changed, what did not change, current blocker, needed decision, and recommended next step.
- Prefer reliable SDKs, APIs, open-source libraries, MCP servers, models, or existing tools when they solve the problem faster and more safely than custom code.
- After building an MVP, prototype, or first-version frontend code, provide a local URL, file path, command, screenshot, Storybook, simulator view, or sample API request so the user can inspect or use it.
- Do not start implementation code from an unclear PRD. Requirement misunderstanding causes rework; clarify PRD first.
- Do not perform penetration testing, red-team activity, exploit validation, phishing simulation, credential testing, or third-party security testing without explicit written scope and user confirmation.
- Before dispatching multiple subagents, ask the user for approval.
- If git worktrees are useful, only use them after confirming the project is a git repository and the tasks are independent.
- Do not deploy, delete files, migrate data, or make broad refactors without explicit user approval.
- Save test output, screenshots, frame evidence, or command output under docs/evidence/.
- Update .planning/progress.md and .planning/loop_log.md after meaningful work.

## Mode Focus

Recover current state, identify the next unfinished slice, and continue from recorded evidence.

## Suggested Next Action

Read context pack, task plan, progress, findings, and recent evidence before editing.

## Required Completion Gate

- PRD, SDD, TEST_PLAN, ACCEPTANCE, and CHANGELOG are aligned with the finished slice.
- PRD Gate passes for implementation slices, or the work stayed in discovery/prototype clarification.
- Local verification or equivalent command has passed.
- Evidence level matches risk: lightweight record for basic successful work, saved evidence for standard/strict work, and strict evidence linked from acceptance for key requirements.
- UI acceptance includes design system, product-design artifact if used, component library decision, preview artifact, desktop/mobile evidence, interaction states, responsive checks, design-to-code parity notes, and accessibility notes when the slice is user-facing.
- MVP/prototype handoff includes something inspectable or runnable by the user, plus known fake data, mocks, manual steps, and next decision.
- Context pack is refreshed before handoff.
- Deployment is only discussed after acceptance evidence passes.
- Deployment is only discussed after applicable security gates pass or are explicitly marked mocked/out of scope.

## Current Context Pack

````text
[truncated: showing head]
# 77vibe-dev-flow Context Pack

Generated: 2026-07-12T19:09:27
Project: D:\work\77港话通社媒文案\77

Use this file after context compaction, agent handoff, or thread restart.
Token rule: read `.planning/status.md` first; open this pack only when the status is not enough.

Resume order:
1. Read this context pack.
2. Re-open `.planning/task_plan.md`, `.planning/progress.md`, and `.planning/findings.md` if details are needed.
3. Continue only from documented PRD, SDD, TEST_PLAN, and acceptance evidence.
4. If the pack is stale, regenerate it before making decisions.

## README.md

```text
# 77港话通社媒文案器

香港粤语社媒文案 AI SaaS。当前仓库已经包含官网、匿名生成工作台和 Express AI 服务；账户、服务端数据、额度、支付和管理后台按 `spec/` 的切片顺序继续开发。

## 本地运行

```powershell
npm run dev
```

- 官网：`http://localhost:5173/`
- 工作台：`http://localhost:5173/app`
- API：`http://localhost:3001/api`

端口被占用时以 Vite/Express 终端输出为准。

## 验证

```powershell
cd client; npx tsc --noEmit; npm run build
cd ..\server; npx tsc --noEmit; npm run build
```

## 开发事实源

1. `spec/PRD.md`：MVP 范围和业务门禁。
2. `spec/SDD.md`：最终架构、页面、数据、接口和安全边界。
3. `spec/TEST_PLAN.md`：每个切片的严格证据要求。
4. `.planning/status.md`：当前状态和下一步。
5. `.planning/context_pack.md`：Claude Code/Codex 交接上下文。
6. `docs/design-system.md`：前端设计规范。
7. `docs/comprehensive-spec-v2.md`：生成域权威规格。

父目录项目导航：`D:\work\77港话通社媒文案\README.md`。

## 当前下一步

Slice A（正式路由 + 使用总览登录视觉的账户 Mock 壳）已完成并通过二次复测。

当前进入 Slice B：真实 Supabase Auth
[truncated: showing head]
```


## AGENTS.md

```text
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
- Keep token use low: read status first, then only open full context or large evidence files when neede
[truncated: showing head]
```


## CLAUDE.md

```text
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**本项目继承 `D:\vibecoding\claude\CLAUDE.md` 中的全部行为准则。** 遇到此处未覆盖的问题时，以上级文档为准。

## 2026-07-11 SaaS 交接入口

本仓库 `D:\work\77港话通社媒文案\77` 是唯一开发基线。不要把父目录的 `总览`、`dashboard` 或 `登录页` 另建成主产品。

开始任何新切片前依次读取：

1. `.planning/status.md`
2. `.planning/context_pack.md`
3. `spec/PRD.md`
4. `spec/SDD.md`
5. `spec/TEST_PLAN.md`
6. `D:\work\77港话通社媒文案\项目管理\03-ClaudeCode-第一阶段执行单.md`
7. `D:\work\77港话通社媒文案\开发日志\02-PRD-77港话通社媒文案器-SaaS.md`（完整 SaaS 产品需求）
8. `D:\work\77港话通社媒文案\开发日志\03-SPEC-77港话通社媒文案器-SaaS.md`（完整 SaaS 技术规格）
9. `docs/comprehensive-spec-v2.md`（文案生成工作台的领域权威规格）

交接文档和 `.planning` 文件只是执行摘要与当前状态索引，不能替代上述完整 PRD/SPEC。发生冲突时：用户最新确认 > `spec/PRD.md` > `spec/SDD.md` > 父目录完整 SaaS PRD/SPEC > `docs/comprehen
[truncated: showing head]
```


## PROMPTS.md

```text
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

## Add Requi
[truncated: showing head]
```


## spec/PRD.md

````
