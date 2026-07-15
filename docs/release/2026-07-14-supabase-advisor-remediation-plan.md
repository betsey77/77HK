# Phase 0：Supabase Advisor 修复提案

> 日期：2026-07-14  
> 状态：**提案 only** — 未改 Dashboard、未执行 Migration、未改 grants  
> 任何 DB/Auth 写操作需用户授权

## 1. Security Advisor 项

### S1 — `public.soft_delete_generation_job(uuid)` SECURITY DEFINER + authenticated EXECUTE

| 项 | 内容 |
| --- | --- |
| 现状 | C1 patch 引入；函数内强制 `owner_id = auth.uid()` 且 `deleted_at is null`；`search_path = ''` |
| 为何存在 | 远端 RLS `WITH CHECK` 拒绝 soft-delete 的 UPDATE，需 DEFINER 原子更新 |
| 风险 | 通用 Advisor 警告：authenticated 可调 DEFINER；若未来改坏 WHERE 会越权 |
| 是否阻断首发 | **中** — 行为正确时可接受，但应文档化 + 可选 harden |
| 推荐修复 | **方案 1（最小）**：保持 RPC，在验收文档标注“已知接受”，加集成测试防回归。**方案 2（更严，需 Migration 授权）**：撤销 `authenticated` EXECUTE，仅 `service_role`；BFF 用 user JWT 校验 owner 后以 service role 调用（或直接 service role UPDATE with owner filter）。方案 2 需改 `generationJobsService` 与回归。 |
| 本轮 | 不改代码/SQL |

相关文件：`supabase/migrations/20260711223000_fix_generation_soft_delete.sql`，`server/src/services/generationJobsService.ts`

### S2 — Leaked Password Protection 未开启

| 项 | 内容 |
| --- | --- |
| 现状 | Supabase Auth 未开启 HaveIBeenPwned 类 leaked password 保护 |
| 风险 | 用户可用已知泄露密码注册/改密 |
| 是否阻断首发 | **建议首发前开启**（对 Free 项目通常为 Dashboard 开关，无需付费） |
| 推荐修复 | Dashboard → Authentication → Providers/Security → **Enable Leaked password protection**；在 staging 验证注册弱密码被拒 |
| 本轮 | 不操作 Dashboard |

### S3 — `payment_webhook_events` RLS 启用但无 policy

| 项 | 内容 |
| --- | --- |
| 现状 | F1 migration：`enable row level security`；`revoke all` from public/anon/authenticated/service_role；再 `grant select, insert, update` **仅** `service_role`；无 authenticated policy |
| 设计意图 | 仅可信服务端（service role）可访问；用户 JWT 即使猜到表名也无 policy + 无 grant |
| Advisor 含义 | INFO/WARN：有 RLS 无 policy ⇒ 对非 bypass 角色默认拒绝 |
| 风险 | 若误 grant 给 authenticated 且仍无 policy → 全拒（安全）；若禁用 RLS → 灾难。当前 grants 正确则 **安全** |
| 推荐验证 SQL（只读） | 见下方 |
| 可选 harden | 显式 `create policy ... for service_role using (true)` **非必须**；或保持现状并在 ACCEPTANCE 记为“by design” |
| 本轮 | 不改表 |

只读验证（授权后在 SQL Editor 执行，结果写入脱敏证据）：

```sql
-- grants
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'payment_webhook_events'
order by grantee, privilege_type;

-- policies (expect 0 rows or only service_role if later added)
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'payment_webhook_events';
```

期望：grantee 仅 `service_role`（及可能 postgres/supabase_admin）；policies 为空可接受。

## 2. Performance Advisor（非 Phase 0 强制，记录）

| 项 | 建议 |
| --- | --- |
| `payment_orders.plan_id` 缺覆盖索引 | 授权后加 `create index ... on payment_orders(plan_id)` |
| `user_feedback` 两条 permissive SELECT | 后续合并 owner/admin policy |
| 未使用索引 | 有真实流量后再删，禁止盲删 |

## 3. 执行优先级（授权后）

1. 开启 Leaked Password Protection（Dashboard，零 Migration）  
2. 只读证明 `payment_webhook_events` grants  
3. 决定 soft_delete：文档接受 vs service_role-only Migration  
4. Performance 索引与 policy 合并

## 4. 本轮未做

- 未开启 leaked password  
- 未 push Migration  
- 未修改 RPC grants  
- 未改 RLS policies  
