# Slice C2a：可信写入与额度账本本地基础

你是本切片的 Claude Code Team Lead。先完整阅读 `README.md`、`AGENTS.md`、`CLAUDE.md`、`spec/PRD.md`、`spec/SDD.md`、`spec/TEST_PLAN.md`、`spec/ACCEPTANCE.md`、`.planning/task_plan.md`、`.planning/progress.md`、`.planning/agent_assessment.md`，再检查当前实现与测试。

## 当前事实

- Slice B 已完成真实 Supabase Auth/RLS。
- Slice C1 的 `generation_jobs`、历史页、生成持久化、原子软删除已完成并推送远端。
- C1 远端隔离事务测试已通过。
- 当前安全债：authenticated 仍可直接 INSERT/UPDATE 自己的 `generation_jobs`；任务状态/结果不能作为可信额度事实。
- 产品只确认 Free/Pro、CNY、未来可扩第三档。价格、每期额度、周期、续费模型尚未确认，禁止自行决定生产数值。

## 唯一目标

只完成 C2a 的本地可审查基础：设计并实现“服务端可信写入 + 可配置额度账本”的 Migration 草案、服务端接口与 TDD，使额度预占、成功消费、业务失败释放、幂等和无额度不调用模型可验证。不要推进支付、云同步或后台。

## Agent Teams 分工

使用 Agent Teams，auto mode。先在汇报中声明成员与文件所有权：

1. Team Lead：独占共享入口与最终集成（`server/src/routes/generate.ts`、`server/src/app.ts`、共享类型、规划/规格文档）。
2. Database/Security agent：仅负责新 Migration 草案、SQL 静态测试/威胁检查，不编辑共享入口。
3. Backend/TDD agent：负责额度服务、Supabase trusted adapter 接口和服务端单测，不编辑共享入口。
4. Review agent：只读复核安全、幂等、失败路径与密钥边界，可补独立测试但不改共享入口。

仓库当前很脏且不是可安全拆分的提交基线，不创建 worktree，不提交，不覆盖用户已有修改。

## 必须实现

1. 新建一份按时间排序的 C2a Migration **草案**，至少覆盖：
   - 服务端管理的 `plans`、`subscriptions`、append-only `usage_ledger`（或更小但能证明同等不变量的结构）。
   - 额度事件至少能表达 reserve / consume / release / adjustment；幂等引用唯一。
   - 原子预占：服务端确定用户、计划和单位；余额不足原子失败。
   - consume/release 只作用于有效 reservation，重复请求不重复计费或释放。
   - generation job 的状态/结果写入收紧为 trusted server only；普通 authenticated 不能直接伪造完成、失败或结果。
   - RLS、REVOKE/GRANT、固定 `search_path`、最小权限、必要索引和约束。
   - 不在 Migration 中写入虚构的生产价格、额度或周期。测试可使用明确标记的 fixture。
2. 服务端新增最小 trusted Supabase adapter：
   - 只读取 server-only 环境变量；绝不能以 `VITE_` 前缀出现，不能回传/记录密钥。
   - 未配置 trusted secret 时 fail closed，并返回可诊断但不泄密的服务不可用错误。
   - 不读取、查询或要求 legacy key；不连接远端做写操作。
3. 将生成流程通过可注入的 quota/job orchestration 接口接入：
   - 鉴权后、调用模型前 reserve。
   - 无额度时绝不调用 DeepSeek/Cantonese/rules 模型链。
   - 成功后 consume；已知业务失败 release。
   - 未知超时/不确定结果保持待 reconciliation，不自动重复扣额或释放。
   - 同一用户 + 同一幂等键只形成一个任务/一笔 reservation；重试不重复调用模型（按现有 C1 行为兼容实现）。
4. 测试先行，至少覆盖：
   - no quota => model not called。
   - reserve once / consume once。
   - known failure releases once。
   - duplicate idempotency key 不重复任务、不重复扣额、不重复模型调用。
   - unknown timeout 进入 reconciliation 状态。
   - trusted secret 缺失 fail closed。
   - Migration 静态断言：authenticated 无直接状态/结果写权限、函数最小授权、append-only、原子与幂等约束。
5. 更新 `spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`、`.planning/task_plan.md`、`.planning/progress.md`、`.planning/findings.md`，明确：
   - C2a 仅本地完成还是未完成。
   - Migration 未推送、trusted secret 未配置。
   - 价格/额度/周期仍是用户决策门。
   - 下一步门禁与验收命令。

## 禁止事项

- 禁止 `supabase db push`、远端 SQL、远端数据写入或删除。
- 禁止部署、支付、支付宝、真实订单/权益授予。
- 禁止检索、获取、打印或配置任何高权限密钥；禁止 legacy keys。
- 禁止 YOLO/bypassPermissions；只用 auto mode。
- 禁止安装依赖，除非现有依赖无法完成且先停下说明。
- 禁止大范围重构、改 Prompt 内容、改变 5 类输出协议或删减现有功能。
- 禁止写死生产套餐数值。

## 验证与停止

运行 client/server 全量 Vitest、两侧 TypeScript、两侧 build，以及 Migration 静态测试；保存证据到 `docs/evidence/2026-07-11/slice-C2a-local/`。

最多修复 3 轮。完成这个本地小目标后立即停止，输出：成员/文件所有权、改动文件、测试计数、风险、Migration 文件名、未执行的高风险动作、下一步需要用户确认的事项。不要自行进入 C2b，不要 push Migration。
