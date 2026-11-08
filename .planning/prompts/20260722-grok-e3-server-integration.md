# Grok Agent Team — 2.1 Slice E3 服务端集成

你是 Grok leader，当前目录是 Codex 显式创建、基于最新 `refs/codex/checkpoints/2026-07-22-slice-e-baseline` 的 detached worktree。先阅读 `README.md`、`AGENTS.md`、`docs/plans/2026-07-22-2.1-bad-case-review-pack-plan.md`、`spec/SDD.md`、`spec/TEST_PLAN.md`，以及 E1-E7 新模块、现有 `admin.ts`、`generate.ts`、`adminService.ts`、`adminMetricsService.ts`、`generationJobsService.ts`、`telemetryService.ts`、`trustedSupabase.ts` 与同类路由测试。

先并行创建最多三个 `slice-e-worker` 一级成员，只读调研：

1. 成员 A 设计 super_admin-only 列表/详情/写入路由和严格 `scope -> audit -> recheck -> body` 查询顺序，列出 fail-closed 测试。
2. 成员 B 设计生成成功/失败后的 E1 manifest 捕获与 E2 幂等自动建包接点，要求遥测/审阅包失败不破坏用户生成主路径。
3. 成员 C 对齐前端冻结 DTO、Trace model_call_logs 投影、状态流转、finding disposition、analyze 限流和提案输入合同。

成员不得写代码或继续派生 agent。leader 汇合后独自修改。

## 目标

完成 E3 服务端基本闭环，不运行 Migration、不连接远端：

- 新增 trusted repository/service，使用固定列白名单读写四表；任何数据库/raw provider 错误对外脱敏。
- `GET /api/admin/bad-case-review-packs` 仅返回元数据、双 Owner 中的 subject owner 脱敏展示、分数/严重度/计数，不返回 source/brief/variants/邮箱/工件正文。
- `GET /api/admin/bad-case-review-packs/:id` 必须按顺序：
  1. 仅查 pack id + generation_job_id + subject_owner_id 做存在/范围判断；
  2. 写 `admin_view_bad_case_review_pack` 审计，失败立即 500；
  3. 再查同一 scope 并验证未变化；
  4. 才读取 generation job 正文、snapshot、findings、events、model_call_logs。
  删除/软删除任务返回 404；不得在审计前读取正文。
- Trace 只返回阶段、attempt、provider/model、status、有限 errorClass、latency、官方 usage、时间；禁止 prompt/response/raw error/CoT/email/JWT/Key/Cookie。
- 实现 assign/status/finding review/analyze/proposal 路由。状态只允许合法流转；actor/role/owner 只取认证上下文；每次写入追加事件。analyze 幂等并有进程内最小限流，不能调用外部模型；只重跑确定性标准/Findings。
- proposal 请求必须携带 `artifactType + before.contentHash/snapshot + afterPatch + rationale`，调用 E5 白名单 builder，只保存 `pending_review` 建议，不发布、不改源码/知识。只有 note 的请求必须 400，禁止凭空生成 diff。
- 在真实新 generation 成功后捕获实际 generation engine 对应 manifest、保存 snapshot，并按低分/关键标准幂等建包；失败路径至少显式保存 `snapshot_missing`/legacy manifest 并幂等建失败 pack。该附属写入失败只记录固定分类日志，不泄露错误且不改变原生成 HTTP 结果。
- 若新 Migration 尚未应用，生成主路径仍成功；管理 API 可以返回脱敏 500/503，不伪装空数据。

## 允许修改

- `server/src/services/badCaseReviewPackService.ts`（新）
- `server/src/routes/admin.ts`
- `server/src/routes/generate.ts`
- `server/src/__tests__/bad-case-review-pack-service.test.ts`（新）
- `server/src/__tests__/bad-case-review-pack-routes.test.ts`（新）
- `server/src/__tests__/generation-review-pack-hook.test.ts`（新）

确有必要时可最小修改：

- `server/src/services/badCaseReviewPackRepository.ts`
- `server/src/services/badCaseReviewPackAssembler.ts`
- `server/src/services/badCaseProposalService.ts`

不要修改 Migration、客户端、package lock、规格、Git 配置或其他既有服务。

## 验收

- 先写失败测试再实现。
- 覆盖匿名 401、ordinary admin 403、super_admin 200、列表无正文、详情审计顺序/失败关闭/二次 scope、软删 404、Trace 白名单、非法状态 409、伪造 actor/owner 400、写事件、analyze 幂等/429、proposal 不能发布、生成附属失败不破坏成功响应。
- 运行新增测试、相关现有 admin/generate 测试和 server `npm run build`；允许 background task 但必须等待。
- 最终报告成员结论、文件、测试输出、Migration 未应用时的真实边界。

禁止 commit/push、reset/clean、部署、运行 Migration、删除 worktree、读取 secrets 或修改允许范围之外文件。
