# Dirty Worktree 可提交分组与回滚点

日期：2026-07-14  
范围：只读盘点 + 建议提交边界。**本轮未执行 commit / push。**

## 回滚点（Rollback anchors）

| 锚点 | 说明 | 如何回退 |
| --- | --- | --- |
| `857a5ff` | 当前唯一基线 commit：`chore(security): establish sanitized local MVP baseline` | `git checkout 857a5ff -- <path>` 或新建分支后 reset（未发布前可用 soft/mixed；**hard 需用户确认**） |
| 当前 dirty tree | 所有产品切片与 Phase 0 修复仍在工作区 | 按下方分组分批 commit 后再 tag；未 commit 时可用 `git stash` / 按文件还原 |
| 无 remote | `git remote -v` 为空 | 建立 remote 前不可 push；无远端覆盖风险 |

**建议 release tag（待用户确认后再打）：** `phase0-production-baseline` 打在「Phase 0 验证通过」的 commit 上。

## 建议提交分组（按依赖从底到顶）

### G0 — 勿提交 / 排除

| 路径 | 原因 |
| --- | --- |
| `.env` / 任何真实密钥文件 | 密钥门禁 |
| `node_modules/`、`dist/`、构建缓存 | 生成物 |
| `前端设计稿/grok/` | 设计探索素材，非运行时基线（单独 PR 或文档附件） |
| 运行中进程产生的临时日志 | 非产品 |

### G1 — 规划与规格文档

- `.planning/*`（status / progress / loop_log / regression_matrix / task_plan / prompts）
- `spec/PRD.md`、`spec/SDD.md`、`spec/TEST_PLAN.md`、`spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`
- `spec/WORKBENCH_CONTENT_CONTROLS.md`
- `docs/comprehensive-spec-v2.md`
- `docs/release/*`、`docs/handoff/*`、`docs/evidence/**`

**意图：** 产品与验收索引可独立回滚，不影响运行时。

### G2 — Schema / Migration（已远端应用的内容对齐）

- `supabase/migrations/20260713000000_slice_f1_payment_sandbox.sql`
- `supabase/migrations/20260714052140_w2_case_library.sql`（本地原 `20260714000000`，已对齐远端 version）
- `supabase/migrations/20260714052414_harden_w2_case_library_function.sql`（本地原 `20260714000001`）

**意图：** 与远端 history 一一映射；**禁止在未授权时 `db push` 或改 schema_migrations。**

### G3 — 支付 F1 服务端

- `server/src/services/alipayAdapter.ts`、`alipayConfig.ts`、`alipayService.ts`
- `server/src/routes/billing.ts`、`server/src/app.ts`（router 顺序 / body parser）
- 相关测试：`billing.test.ts`、`alipayAdapter.test.ts`、`alipayCheckoutFailure.test.ts`、`admin.test.ts`

### G4 — 额度 / 历史 / 同步 / 生成

- `server/src/routes/generate.ts`、`generations.ts`、`sync.ts`
- `server/src/services/generationJobsService.ts`、`cloudSyncService.ts`、`planAccessService.ts`
- `server/src/prompts/*`、engines（deepseek/cantonese/fallback）
- 对应 server tests + client `useGenerate` / `cloudSync` / plan limits

### G5 — 案例库 W2–W4 + 管理后台

- `server/src/routes/caseLibrary.ts`、`admin.ts`、`adminService.ts`、`caseLibrary*`
- client AdminPage、PlanAccessContext、case library UI
- 相关 tests（w2/w3/w4/admin）

### G6 — 工作台前端（W1 / 折叠 / 收藏 / 登录视觉）

- `client/src/components/input/*`、`favorites/*`、`results/*`、`layout/*`
- `client/src/context/AppContext.tsx`、`pages/*`（History/Billing/Login）
- `client/src/utils/*`、品牌资源 `client/public/brand/*`
- client tests（login-admin-accordion、plan-limits、history-settings 等）

### G7 — Phase 0 发布基线（本轮新增）

- 根 `package.json` / `package-lock.json`（脚本拆分、overrides、concurrently、Playwright）
- `.env.example`（仅空值变量名契约）
- `playwright.config.ts`、`e2e/smoke.spec.ts`
- `scripts/verify/commands.md`
- `docs/evidence/2026-07-14/phase0-production-baseline/*`

## 推荐 commit 顺序

1. G1 文档  
2. G2 migrations（文件名对齐后）  
3. G3 → G4 → G5 → G6 产品能力（可再按切片拆分）  
4. G7 Phase 0 基线  
5. 用户确认后：建 remote、`main`/`staging` 保护分支、tag

## 未经用户确认禁止

- `git commit` / `git push` / `git push --force`
- `supabase db push` / migration history repair
- 生产支付开关、部署
