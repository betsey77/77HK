# Phase 0：Dirty Worktree 审阅与可提交分组

> 日期：2026-07-14  
> 状态：**仅方案，未经用户确认不得 commit / push**  
> 回滚点：当前唯一本地基线 `857a5ff chore(security): establish sanitized local MVP baseline`  
> 远端：`git remote -v` 为空，尚无 Git remote

## 1. 当前状态摘要

- 分支：`master` @ `857a5ff`
- 工作树：大量已修改文件 + 未跟踪文件（产品切片 F1/W1–W4/UI 与证据）
- 无 remote；无 release tag
- 生成物注意：`client/dist/`、`server/dist/`、`node_modules/` 不应提交

## 2. 回滚点

| 标签 | 说明 | 如何回到 |
| --- | --- | --- |
| `baseline-mvp-857a5ff` | 安全清理后的唯一 commit | `git checkout 857a5ff` 或未来 `git reset --hard 857a5ff`（破坏性，需用户确认） |
| 建议 release tag（提交后） | `phase0-baseline` | 在 Phase 0 全部本地提交完成后打 tag，再谈 remote |
| 建议 feature 分支 | `phase0/production-baseline` | 从当前 dirty 状态分批提交到该分支，保留 master 基线 |

**不要**在未备份的情况下 `git clean -fdx` 或 `reset --hard`。

## 3. 建议提交分组（按依赖从底到顶）

每组应可单独 `git add` + 独立 message；组间顺序可微调，但 **Migration 与支付后端应先于依赖它们的前端/证据**。

### Group A — Spec / 规划文档（无运行时影响）

- `spec/PRD.md`, `spec/SDD.md`, `spec/TEST_PLAN.md`, `spec/ACCEPTANCE.md`, `spec/CHANGELOG.md`
- `spec/WORKBENCH_CONTENT_CONTROLS.md`（若纳入基线）
- `.planning/*`（status/progress/regression_matrix/loop_log/task_plan/prompts）
- `docs/comprehensive-spec-v2.md`（若仅文档增量）
- `docs/handoff/`, `docs/release/*`

Message 示例：`docs: freeze SaaS MVP specs and planning state for phase0`

### Group B — Supabase migrations（结构已在远端验证过的 SQL 文件）

- `supabase/migrations/20260713000000_slice_f1_payment_sandbox.sql`
- `supabase/migrations/20260714052140_w2_case_library.sql`
- `supabase/migrations/20260714052414_harden_w2_case_library_function.sql`

Message 示例：`db: add F1 payment + W2 case library migrations (local filenames)`

> 注意：本地文件名已与远端 version 对齐（`20260714052140` / `20260714052414`）。提交前仍以 migration 映射方案为准。**不在本 commit 执行 db push / repair**；不改 SQL 语义。

### Group C — Server 支付 / 额度 / 管理 / 案例库

- `server/package.json`（若仅 alipay-sdk 等已落地依赖）
- `server/src/services/alipay*.ts`, `planAccessService.ts`, `caseLibrary*.ts`, …
- `server/src/routes/billing.ts`, `caseLibrary.ts`, `admin.ts`, `generate.ts`, …
- `server/src/__tests__/*` 对应新增/修改测试
- `server/src/prompts/*`, `middleware/admin.ts`, `types/index.ts`, `app.ts`

Message 示例：`feat(server): F1 sandbox billing, plan limits, case library, admin review`

### Group D — Client 工作台 / 路由 / UI 切片

- `client/src/**` 全部产品改动与测试
- `client/public/brand/hero-marketing.jpg`（若确认为产品素材）
- 前端设计稿目录是否入库：建议 **单独 group 或排除**（体积大、非运行时）

Message 示例：`feat(client): workbench controls, history, billing UI, admin review`

### Group E — Phase 0 安全与工程基线（本轮重点）

- `package.json`, `package-lock.json`（依赖修复 + scripts 分离 + overrides）
- `.env.example`（空值契约）
- `playwright.config.ts`, `e2e/smoke.spec.ts`
- `scripts/verify/commands.md`
- Phase 0 evidence / release 文档

Message 示例：`chore(phase0): audit fixes, verify scripts, env contract, playwright smoke`

### Group F — 证据归档

- `docs/evidence/2026-07-13/**`
- `docs/evidence/2026-07-14/**`

Message 示例：`docs(evidence): archive 2026-07-13/14 verification outputs`

## 4. 明确不要提交

| 路径/类型 | 原因 |
| --- | --- |
| `.env`, `server/.env`, 任何真实密钥文件 | 密钥 |
| `node_modules/`, `client/node_modules/`, `server/node_modules/` | 安装产物 |
| `client/dist/`, `server/dist/` | 构建产物 |
| 含真实 URL/密钥的临时笔记 | 脱敏后才能进库 |
| 操作系统垃圾 / IDE 私有缓存 | 与产品无关 |

## 5. 建议操作顺序（用户确认后）

1. 确认 Group 划分与是否纳入 `前端设计稿/`。
2. 创建分支 `phase0/production-baseline`。
3. 按 A→F 顺序提交；每组后可选跑 `npm run test:client` 或全量 `npm run verify`。
4. 打 tag `phase0-baseline`。
5. **单独授权**后再 `git remote add` + `git push`。

## 6. 本轮代理未执行的动作

- 未 `git add` / `git commit` / `git push`
- 未创建 remote
- 未 `git reset` / `git clean`
- 未修改已有产品功能逻辑（除 Phase 0 工程脚本与依赖门禁外）
