# 1.1.4.5 Slice D1 签到/奖励 Migration 草案验证

日期：2026-07-19  
状态：本地草案与静态合同测试完成；Migration 未应用

## 本轮目标

- 新增香港自然日签到与每账号终身一次的 30 天 Pro 奖励数据结构。
- 有效 Pro 只产生待领取奖励；Free/无有效 Pro 立即获得固定 30 天新周期并把新周期 `quota_used` 设为 0。
- 所有写入仅允许 service-role BFF 调用；浏览器只能读取自己的签到/奖励记录。
- 不改现有 `usage_ledger`、额度 RPC 或支付宝支付 RPC。

## 变更

- Migration 草案：`supabase/migrations/20260719090000_slice_d1_checkin_rewards.sql`
- 合同测试：`server/src/__tests__/slice-d1-checkin-rewards-migration.test.ts`
- 两张最小表：`daily_checkins`、`membership_grants`
- 两个 service-role-only `SECURITY INVOKER` RPC：`apply_daily_checkin(uuid)`、`claim_checkin_membership_grant(uuid, uuid)`
- 固定锁顺序：每用户 advisory lock → `subscriptions FOR UPDATE` → 签到/奖励写入。

## TDD 与验证结果

| 阶段 | 命令 | 结果 |
| --- | --- | --- |
| Red | `cd server; npx vitest run src/__tests__/slice-d1-checkin-rewards-migration.test.ts` | 目标 SQL 不存在，6/6 按预期失败 |
| Green | 同上 | 1 文件，6/6 通过 |
| Migration 回归 | 所有 `*migration.test.ts` | 9 文件，56/56 通过 |
| Server 全量 | `npm run test:server` | 41 文件，615/615 通过 |
| Server 类型检查 | `npm run typecheck:server` | 通过 |
| Server 构建 | `npm run build:server` | 通过 |
| 空白门禁 | `git diff --check` | 通过（仅既有 LF/CRLF 提示） |

## Grok Build 使用记录

- 第一次只读设计审查完成，重点确认 invoker/search_path、service_role ACL、香港日期、固定 30 天、有效 Pro 截止时间和锁顺序。
- 第二次实际 SQL 终审达到 120 秒上限，未形成最终结论；按停止规则没有重试。
- 两次调用只开放 `read_file,grep`，关闭 memory/subagents/web，未修改业务文件。
- Worktree 条目从 D0 后的 133 增至预期的 137，正好对应本轮两份 prompt、一个测试文件和一个 Migration；没有 Grok 额外改动。

## 尚未证明的边界

- 没有在本地或远端 PostgreSQL 实际执行 Migration，因此本轮证据是静态合同验证，不是数据库运行时证据。
- 没有执行 `supabase db push --dry-run`、Migration history 远端检查、RLS A/B、并发事务或 Advisor；这些属于经单独授权后的 D7。
- D2 API/BFF、D3 UI 和人工验收尚未开始。
- 未执行 Migration、staging 写入、部署、commit、push、reset、clean 或创建 Worktree。
