# Grok Agent Team — 2.1 Slice E2/E4 数据与标准引擎

你是 Grok leader，当前目录是由 Codex 显式创建、基于 `refs/codex/checkpoints/2026-07-22-slice-e-baseline` 的 detached worktree。先阅读 `README.md`、`AGENTS.md`、`docs/plans/2026-07-22-2.1-bad-case-review-pack-plan.md`、`spec/SDD.md`、`spec/TEST_PLAN.md`、`server/src/services/generationArtifactManifest.ts` 和现有 Supabase Migration 风格。

先并行创建最多两个 `slice-e-worker` 一级成员，只做只读调研：

1. 成员 A 检查现有 Migration、RLS/ACL、审计表和 generation_jobs 字段，给出四表最小安全 DDL。
2. 成员 B 检查 scores/audit/model_call_logs 的实际结构和测试风格，给出确定性触发与验收标准/证据引用模型。

成员不得写代码或继续派生 agent。leader 汇合结论后独自修改。

## 目标

完成 E2 + E4 的本地数据与纯领域层，不连接路由/UI，不执行 Migration：

- 新增一个时间戳为 `20260722100000` 的本地 Migration，创建：
  `generation_artifact_snapshots`、`bad_case_review_packs`、`bad_case_findings`、`bad_case_review_events`。
- `anon/authenticated` 不得直读写；开启 RLS；只给最小 `service_role` 权限。事件表追加式，禁止 UPDATE/DELETE；外键、唯一约束、状态/枚举 check、JSON 大小上限和必要索引齐全。
- 新增 repository/assembler/criteria 的纯 TypeScript 实现：低分 `<50`、失败、关键标准失败、手动标记均生成幂等 pack upsert 输入；正常任务不生成。
- 版本化验收标准至少覆盖：港味总分、生成成功、卖点体现、红线/合规、五平台输出完整性。未知或缺字段必须为 `not_evaluated`，不能臆造失败。
- 每个自动 finding 都有可解析的 `evidenceRefs`、`criterionRefs`、`artifactRefs`，并给出可追溯 `recommendedOwnerTeam`；没有证据不产 finding。
- repository 只接受显式白名单 DTO；不接受请求体 actor/owner 作为可信来源；不得保存 prompt、provider payload、原始错误、CoT、邮箱、JWT、Key/Cookie。
- 工件 manifest 直接复用 E1 类型/哈希，不重新发明格式。

## 允许修改

- `supabase/migrations/20260722100000_slice_e_bad_case_review_packs.sql`（新）
- `server/src/services/badCaseReviewPackRepository.ts`（新）
- `server/src/services/badCaseCriteria.ts`（新）
- `server/src/services/badCaseReviewPackAssembler.ts`（新）
- `server/src/__tests__/slice-e2-review-pack-migration.test.ts`（新）
- `server/src/__tests__/bad-case-criteria.test.ts`（新）
- `server/src/__tests__/bad-case-review-pack-assembler.test.ts`（新）
- `server/src/__tests__/bad-case-review-pack-repository.test.ts`（新）

不要修改 `server/src/types/index.ts`、路由、客户端、package lock、规格或 Git 配置。类型先放在相关新模块导出，后续整合切片统一。

## 验收

- 先写失败测试再实现。
- 运行新增测试和 server `npm run build`；允许用 background task，但必须等待结果。
- Migration 只做静态/合同测试，绝不 `db push`、`migration up` 或连接远端。
- 最终报告成员结论、改动文件、测试输出和 E3 接入点。

禁止 commit/push、reset/clean、部署、运行 Migration、删除 worktree、读取 secrets 或修改允许范围之外文件。
