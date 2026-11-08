# Grok Agent Team — 2.1 Slice E1 工件 Manifest 合同

你是 Grok leader，在独立 worktree 中完成一个小而完整的 E1 切片。先完整阅读：

- `README.md`
- `AGENTS.md`
- `docs/plans/2026-07-22-2.1-bad-case-review-pack-plan.md`
- `spec/PRD.md`、`spec/SDD.md`、`spec/TEST_PLAN.md`
- `.grok/agents/slice-e-worker.md`

## Agent Team 要求

先并行创建最多两个 `slice-e-worker` 一级成员：

1. 成员 A 只读检查 Prompt、规则、案例/知识和 modelPolicy 来源，提出最小 manifest 字段与稳定版本策略。
2. 成员 B 只读检查 generation job 类型/生命周期和现有测试结构，提出 E1 纯合同的最小测试矩阵及 E2 持久化接点。

成员不得继续派生 task/agent。等待两者结果后，由 leader 独自修改文件；成员不要写代码，避免同 worktree 冲突。

## 本切片目标

先冻结并实现“生成时实际使用工件”的纯 TypeScript 合同，不创建 Migration，不接数据库，不修改路由/UI：

- 新增 `server/src/services/generationArtifactManifest.ts`。
- 在 `server/src/types/index.ts` 增加最小强类型：schema version、prompt/rule/knowledge/model policy manifest、availability (`captured | legacy_unavailable`)。
- 使用 Node 内置 `crypto` 对 canonical JSON 计算稳定 SHA-256；不得新增依赖。
- 定义明确的版本常量，覆盖 diagnose/generate Prompt、audit Prompt、system Prompt、built-in compliance rules、W1 constraints、case library/reference cases/calendar context 和 model policy。
- manifest 只保存可审阅白名单：ID、版本、hash、section/key 列表、知识条目 ID/type/title/version-or-updatedAt；E1 不保存完整用户正文、渲染 Prompt、原始 provider payload、错误、邮箱、JWT、Key 或思维链。
- 对旧任务提供显式 `legacy_unavailable` 工厂，不得拿当前版本冒充历史。
- 新增 `server/src/__tests__/generation-artifact-manifest.test.ts`，先写失败测试再实现。

## 允许修改

- `server/src/services/generationArtifactManifest.ts`（新增）
- `server/src/types/index.ts`
- `server/src/__tests__/generation-artifact-manifest.test.ts`（新增）

除此之外不得修改。特别禁止修改 Migration、route、client、spec、package lock、Git 配置。

## 验收

- 同一语义对象无论 key 插入顺序如何 hash 一致；数组顺序保留。
- 两条模型路径、规则、知识和 model policy 都能产生非空、版本化、无敏感正文的 manifest。
- 空知识上下文合法；旧任务返回 `legacy_unavailable`。
- 运行聚焦测试与 server TypeScript 检查；测试可用 Grok background task 运行并等待结果。
- 最终报告改动文件、测试输出、未决 E2 接点和成员结论。

## 禁止

不得 commit/push、reset/clean、迁移数据库、部署、删除 worktree、读取 secrets，或修改本任务之外文件。遇到现有工作区错误时只报告，不扩大修复范围。
