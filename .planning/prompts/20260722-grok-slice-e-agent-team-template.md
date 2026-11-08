# Grok CLI Slice E Agent Team 模板

> 仅在 `docs/plans/2026-07-22-2.1-bad-case-review-pack-plan.md` 的 Dirty Worktree 基线闸门解除后使用。

## 固定约束

- 你是 Grok leader，只能创建最多三个一级成员。
- 所有成员不得再创建 task、agent、subagent、team 或 worktree。
- leader 与成员均使用主命令的 `permission-mode=auto` 和相同 allow/deny 策略。
- 不读取/复制 secrets，不修改 `.env`，不迁移数据库，不部署，不 commit/push，不 reset/clean，不删除 worktree。
- 只改本任务文件清单；共享文件只由 leader 修改。
- 发现基线 ref、文件清单或权限不一致时立即停止。
- 输出必须包含：文件 diff 摘要、执行测试、失败证据、未决风险；不得声称未运行的测试通过。

## Leader 启动前检查

1. 确认 approved baseline ref 与主工作区真实目标一致。
2. `grok inspect` 确认项目和 agent 配置；确认成员不可继续派生。
3. 为各 lane 分配不重叠文件；冻结共享 API/type 合同。
4. 命令使用 `--permission-mode auto --worktree-ref <approved-ref> --max-turns 12`。
5. 若 CLI 无法技术性限制一层代理，放弃 Team 模式，改为每个 worktree 一个独立 leader。

## 任务卡

- Slice：`<E1-E7>`
- Worktree：`<name>`
- Baseline ref：`<approved-ref>`
- 目标：`<one bounded goal>`
- 允许文件：`<explicit paths>`
- 禁止文件：`<explicit paths>`
- 成功标准：`<tests and observable result>`
- 停止条件：同错两次无新证据，或三次实现尝试仍失败。

## 集成规则

Grok 只交付候选 diff。主代理复核权限、隐私、Migration 和测试后再决定是否合并；任何 staging、部署或 Git 发布动作重新向用户申请授权。
