# Slice C2a 最终独立验收修复（第 3/3 轮）

这是同一问题的最后一轮。只做以下最小修复，不扩范围，不再组建多 Agent；完成后停止。先读当前 Migration、quotaService、trusted adapter、generate route 和对应测试。

## 必修阻断

1. `reserve_quota` 的同键并发幂等仍有边界错误：初始幂等查询后，等待 `FOR UPDATE` 的第二个请求会看到 `quota_used` 已满并提前返回 null。取得 subscription lock 后、额度检查前必须再次查询并返回已有 reserve；测试静态断言该顺序。
2. `consume_quota`/`release_quota` 发现 terminal event 时不能一律返回 true：重复同一 transition 返回 true；相反 transition 已存在时返回 false。查询 terminal `event_type` 并测试 consume-after-release / release-after-consume 冲突。
3. `reserve_quota` 只允许当前有效周期：active subscription 还必须 `current_period_end > now()`；补静态断言。
4. generate.ts 的 uncertain 202 只允许 `uncertain && jobId && reservation`。预占前/任务前的网络错误不得返回 `jobId: undefined` 的 202；补行为测试：无 reservation 时走普通 500，不 release。
5. 不再在源代码、当前测试、当前 spec/planning/evidence-fix 中出现已停用 key 的精确环境变量名。adapter 只读取 `SUPABASE_SECRET_KEY`；删除“显式忽略旧 key”的测试和文字。Migration 不需要提应用环境变量；key 测试只针对 adapter。
6. Migration 明确 grant `select, insert, update on public.generation_jobs to service_role`，不要依赖“C1 继承”假设；authenticated 仍无 UPDATE。
7. 不写入未确认业务默认值：`plans.price_cny`、`quota_per_cycle`、`cycle_days` 删除 default，增加合理 CHECK（price/quota >= 0；cycle_days null 或 > 0）。`subscriptions.quota_used >= 0`，status 限定；不 seed 计划。

## 验证

- Server Vitest 仅 `server/src` 全量。
- Client Vitest 全量（上一轮漏跑，必须实际执行并报告计数）。
- Client/Server tsc 与 build。
- `rg` 验证当前源代码、测试、spec、planning、`slice-C2a-fix` 证据中已停用 key 的精确变量名为 0；允许旧的 `slice-C2a-local` 历史证据不改。
- 更新 `spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`、`.planning/progress.md`、`.planning/findings.md`、`.planning/status.md` 和 `docs/evidence/2026-07-11/slice-C2a-fix/notes.md`，准确记录最终测试计数。

## 禁止

仍禁止 push/远端 SQL、secret 获取或配置、部署、支付、安装依赖、git commit、大重构。Migration 仍为本地草案。价格/额度/周期仍未决定。

完成后停止；若任一必修项无法完成，明确标 blocked，不得声称通过。
