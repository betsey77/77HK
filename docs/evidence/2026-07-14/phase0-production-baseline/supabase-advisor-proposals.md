# Supabase Advisor 修复提案（Phase 0 — 只提案，不写库）

日期：2026-07-14  
约束：Vercel Hobby + Supabase Free；**任何数据库写操作 / Dashboard 配置变更需用户授权。**

来源：`docs/evidence/2026-07-14/production-readiness-audit/verification.md`  
及 W2 远端复核中的既有提示。

---

## S1 — `public.soft_delete_generation_job(uuid)` SECURITY DEFINER

### 现状

- Migration：`20260711223000_fix_generation_soft_delete.sql`
- `SECURITY DEFINER` + `set search_path = ''`
- `GRANT EXECUTE` → `authenticated`, `service_role`
- 函数内强制：`auth.uid()` 非空；`UPDATE ... WHERE id = _job_id AND owner_id = auth.uid() AND deleted_at IS null`

### Advisor 含义

Authenticated 可调用 DEFINER 函数 → 若实现有误，可能越权。当前实现已绑定 `owner_id = auth.uid()`，**意图合理**（绕过 WITH CHECK 对 soft-delete 的误杀）。

### 修复提案（择一，需授权）

| 方案 | 内容 | 风险 | 推荐 |
| --- | --- | --- | --- |
| A 保持并加固文档 | 保留 RPC；补 `REVOKE` 确认；Advisor 记为 accepted risk + 单测锁 ownership | 低 | **首选短期** |
| B 改为 BFF-only | `REVOKE` authenticated execute；仅 service_role；服务端用 user JWT 校验后 trusted 调用 | 中：客户端/路由需改软删路径 | 中期 |
| C 修复 UPDATE RLS | 调整 generation_jobs UPDATE policy 使 soft-delete 走普通 RLS，删除 DEFINER | 中高：需回归全部 UPDATE 场景 | 长期理想 |

**本轮不执行。** 验收前应至少用方案 A 在 `ACCEPTANCE` 登记 accepted risk，或授权 B/C。

---

## S2 — Leaked Password Protection 未开启

### 现状

Supabase Auth 安全顾问：HaveIBeenPwned 类泄露密码检测关闭。

### 修复提案

Dashboard（Auth → Providers / Attack Protection，以控制台实际菜单为准）：

1. 开启 **Leaked password protection**。
2. 在 staging 用已知泄露测试密码注册，应被拒绝。
3. 确认错误文案不暴露内部细节。

| 项 | 说明 |
| --- | --- |
| 是否 SQL migration | 否，Auth 项目配置 |
| Free 层 | 通常可用；若控制台显示需 Pro，**记录阻断并停止，不自动升级** |
| 本轮 | **未开启**（需用户在 Dashboard 授权操作） |

---

## S3 — `payment_webhook_events` RLS 无 policy

### 现状（设计意图，F1）

```sql
alter table public.payment_webhook_events enable row level security;
revoke all on table public.payment_webhook_events from public, anon, authenticated, service_role;
grant select, insert, update on table public.payment_webhook_events to service_role;
```

- 无 authenticated/anon policy → 客户端 JWT **不能** 经 PostgREST 读写。
- 仅 `service_role` grant → 服务端 notify 路径使用 secret key。

### Advisor INFO 含义

「有 RLS、无 policy」对 user roles 等价于默认拒绝；对 `service_role` 则绕过 RLS 但仍受 table grant 约束。这是 **service-role-only 审计表** 的预期形态。

### 修复提案

| 方案 | 内容 | 推荐 |
| --- | --- | --- |
| A 证明并关闭噪音 | 用只读查询列出 grants；在验收文档写明「无 policy + revoke authenticated = 故意」 | **首选** |
| B 加 deny policy 注释性 | `CREATE POLICY ... FOR ALL TO authenticated USING (false)` | 可选，不改变实际安全边界 |
| C 错误地给 authenticated 加 SELECT | **禁止** — 会暴露支付事件元数据 | 否 |

**本轮不改表。** 建议 Codex 验收时执行：

```sql
select grantee, privilege_type
from information_schema.role_table_grants
where table_name = 'payment_webhook_events';
```

期望：无 `anon`/`authenticated` 行；仅 `service_role`（及可能的 postgres/supabase_admin）。

---

## P1 — Performance（非 Phase 0 阻断，记录）

| 项 | 提案 | 时机 |
| --- | --- | --- |
| `payment_orders.plan_id` 缺索引 | `create index ... on payment_orders(plan_id)` 小迁移 | 首发前可授权 |
| `user_feedback` 双 SELECT policy | 合并为单一 permissive policy | 小迁移，避免行为变化 |
| 未使用索引 | **勿盲删**；有真实流量后再判断 | 延后 |

---

## 授权清单（用户确认后才能做）

- [ ] S1 选定 A/B/C 并实施  
- [ ] S2 Dashboard 开启 Leaked Password Protection  
- [ ] S3 只读 grants 取证（或授权 B 加 deny policy）  
- [ ] P1 索引/policy 小迁移  

**本轮全部保持提案状态。**
