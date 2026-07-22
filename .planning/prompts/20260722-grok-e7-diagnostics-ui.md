# Grok Agent Team — 2.1 Slice E7 诊断指标 UI

你是 Grok leader，当前目录是 Codex 显式创建、基于最新 `refs/codex/checkpoints/2026-07-22-slice-e-baseline` 的 detached worktree。先阅读 `README.md`、`AGENTS.md`、`docs/plans/2026-07-22-2.1-bad-case-review-pack-plan.md`、`spec/TEST_PLAN.md`、`badCaseDiagnosticsService.ts`、现有 `AdminPage`、`AdminMetricsPanel`、`BadCaseReviewPackPanel` 和客户端 API 测试风格。

先并行创建最多两个 `slice-e-worker` 一级成员，只读调研：

1. 成员 A 设计最小但可定位问题的指标信息架构和 390px/空态/局部错误展示。
2. 成员 B 冻结 diagnostics API DTO 的运行时校验、null/unavailable 与人民币成本显示边界。

成员不得写代码或继续派生 agent。leader 汇合后独自修改。

## 目标

- 新增 super_admin-only 的“Bad Case 诊断指标”面板，调用 `GET /api/admin/bad-case-review-packs/diagnostics`。
- 展示：分类分布、同类复发率/重复样本数、finding 人工覆盖/确认/误报、标准 evaluated/not_evaluated 覆盖、P50/P95 解决时长。
- 明确帮助文字：综合成功/错误率只能说明健康程度，本面板用阶段/类别/Trace 定位错误发生位置。
- CNY 成本：`costStatus=ok|partial` 且 `sumCny` 为有效数时显示；缺价格表/usage 时显示“暂不可估算”，绝不显示伪造 ￥0。
- 所有 rate 为 null 时显示“暂无样本”，0 是合法结果时显示 0%；response 做运行时白名单校验，错误不展示 raw body。
- 仅 super_admin 挂载和发请求；普通管理员不渲染、不请求。宽表/分类列表只在组件内部滚动，390px 无页面横向溢出。

## 冻结响应

```ts
{
  from: string; to: string;
  summary: {
    categoryDistribution: { total: number; byCategory: Record<string,{count:number;share:number|null}> };
    recurrence: { totalFindings:number; sampleRecurrenceRate:number|null; categoryRecurrenceRate:number|null; duplicateSampleCount:number };
    dispositionRates: { total:number; reviewed:number; reviewCoverage:number|null; confirmationRate:number|null; falsePositiveRate:number|null };
    criterionCoverage: { total:number; evaluated:number; notEvaluated:number; evaluatedRate:number|null; notEvaluatedRate:number|null; failRateAmongEvaluated:number|null };
    resolutionLatency: { sampleSize:number; p50Ms:number|null; p95Ms:number|null; invalidCount:number };
    tokenCost: null | { costStatus:'ok'|'partial'|'unavailable'; sumCny:number|null; okCount:number; unavailableCount:number; sampleSize:number };
  }
}
```

## 允许修改

- `client/src/services/badCaseDiagnosticsApi.ts`（新）
- `client/src/components/admin/BadCaseDiagnosticsPanel.tsx`（新）
- `client/src/pages/AdminPage.tsx`
- `client/src/test/bad-case-diagnostics-api.test.ts`（新）
- `client/src/test/slice-e7-bad-case-diagnostics.test.tsx`（新）

不要修改服务端、Migration、其他现有组件、package lock、规格或 Git 配置。

## 验收

- 先写失败测试再实现。
- 覆盖 super_admin 请求、ordinary admin 零请求、null 与合法 0 区分、partial/unavailable 成本、loading/empty/error、raw error 不外泄。
- 运行新增测试、client `npx tsc --noEmit` 和 build。
- 最终报告成员结论、文件、测试输出与等待 E3 API 对接的边界。

禁止 commit/push、reset/clean、部署、运行 Migration、删除 worktree、读取 secrets 或修改允许范围之外文件。
