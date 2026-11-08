# Grok Agent Team — 2.1 Slice E5/E7 提案、评测候选与诊断指标

你是 Grok leader，当前目录是由 Codex 显式创建的 detached worktree。先阅读 `README.md`、`AGENTS.md`、`docs/plans/2026-07-22-2.1-bad-case-review-pack-plan.md`、`spec/SDD.md`、`spec/TEST_PLAN.md` 和 `server/src/services/generationArtifactManifest.ts`。

先并行创建最多两个 `slice-e-worker` 一级成员，只读调研：

1. 成员 A 设计工件 before/after 提案的严格白名单和敏感键拒绝策略。
2. 成员 B 设计 evaluation candidate 晋升门禁与复发率、误报率、覆盖率、解决时长的确定性聚合口径。

成员不得写代码或继续派生 agent。leader 汇合后独自修改。

## 目标

完成不依赖数据库/路由的 E5/E7 纯领域模块：

- 提案只产生可审阅 diff，不写源码/Prompt/规则/知识，不含自动发布能力。
- 提案只允许版本化白名单路径与 JSON 标量/受限数组；递归拒绝 prompt 正文、source/content/body、provider payload/raw error、messages、thinking/CoT、邮箱、JWT、API Key、Cookie/Authorization 等敏感键。
- 历史工件 `legacy_unavailable` 时禁止伪造 before 快照或当前版本。
- evaluation candidate 只有在 `humanApproved && redactionApproved && subjectStillReadable` 时才能晋升；owner 正文不能进入共享集合，产物只允许去标识样本引用与标准化标签。
- 诊断指标纯函数计算分类分布、同类复发、finding 确认/误报、标准覆盖、P50/P95 解决时长；分母为 0 返回 null/明确 unavailable，不能伪造 0。
- 人民币成本只有显式匹配 provider+model+价格版本且 token usage 完整时才计算，否则 `unavailable`；不得由余额差额估算。

## 允许修改

- `server/src/services/badCaseProposalService.ts`（新）
- `server/src/services/badCaseEvaluationService.ts`（新）
- `server/src/services/badCaseDiagnosticsService.ts`（新）
- `server/src/__tests__/bad-case-proposal.test.ts`（新）
- `server/src/__tests__/bad-case-evaluation.test.ts`（新）
- `server/src/__tests__/bad-case-diagnostics.test.ts`（新）

不要修改共享 types、路由、Migration、客户端、package lock、规格或 Git 配置。

## 验收

- 先写失败测试再实现；运行新增测试与 server `npm run build`。
- 静态与运行时敏感字段拒绝都要有测试；不得把字符串值发到外部模型。
- 最终报告成员结论、改动文件、测试输出和 E3 接入点。

禁止 commit/push、reset/clean、部署、运行 Migration、删除 worktree、读取 secrets 或修改允许范围之外文件。
