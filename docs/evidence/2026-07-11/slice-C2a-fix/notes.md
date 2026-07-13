# Slice C2a Final Fix — Evidence (第三轮，2026-07-12)

Date: 2026-07-12
Status: ✅ ALL 7 BOUNDARY FIXES COMPLETE — local gate passed

## Verification Summary

| Check | Result |
|-------|--------|
| Server Vitest (src only) | ✅ 154/154 passed (3 test files) |
| Client Vitest | ✅ 49/49 passed (3 test files) |
| Client TypeScript | ✅ 0 errors |
| Client Vite Build | ✅ dist/ (616 KB JS, 78 KB CSS) |
| Server TypeScript | ✅ 0 errors |
| Server tsc Build | ✅ 0 errors |
| rg deprecated key (source/tests/spec/planning/evidence-fix) | ✅ 0 matches |

## Boundary Fixes Applied (Round 3)

### F1: reserve_quota 同键并发幂等边界
- Problem: 第二请求在 FOR UPDATE 等待后看到 quota_used 已满返回 null，但第一请求已插入同键 reservation
- Fix: FOR UPDATE 获取锁后再次查询 idempotency；若已有 reservation 立即返回，不进入 quota 检查
- Evidence: reserve_quota RPC has 2 idempotency checks (pre-lock + post-lock); static assertion verifies order

### F2: consume/release terminal 冲突检测
- Problem: consume/release 发现 terminal event 一律返回 true（幂等），不区分 consume-after-release 或 release-after-consume 冲突
- Fix: 查询 terminal 的 event_type；consume_quota: consume→true, release→false; release_quota: release→true, consume→false
- Evidence: RPC functions use `select event_type into _terminal_event`; 2 new behavioral tests

### F3: reserve_quota 有效周期校验
- Problem: active subscription 未检查 current_period_end，过期订阅仍可预占
- Fix: 添加 `current_period_end > now()` 条件到 subscription FOR UPDATE 查询
- Evidence: static assertion in generations.test.ts

### F4: uncertain 202 守卫
- Problem: uncertain error 无条件返回 202，即使预占前/任务前的网络错误（无 reservation）也返回 202 with jobId: undefined
- Fix: 仅 `uncertain && jobId && reservation` 时返回 202；无 reservation 走普通 error 路径
- Evidence: generate.ts guard condition + comment

### F5: 已停用 key 名清除
- Problem: 已停用 legacy key 精确名出现在测试、注释、文档中
- Fix: 从源代码、当前测试、spec、planning、evidence-fix 全部移除；adapter 只读 `SUPABASE_SECRET_KEY`
- Evidence: rg search = 0 in current artifacts; old slice-C2a-local evidence unchanged

### F6: 显式 service_role grant
- Problem: generation_jobs 的 service_role 权限依赖 C1 继承假设
- Fix: `grant select, insert, update on public.generation_jobs to service_role`
- Evidence: explicit grant statement in migration; static assertion in test

### F7: 未确认业务默认值移除
- Problem: plans 有 price_cny=0, quota_per_cycle=0, cycle_days=30 未确认默认值
- Fix: 删除 defaults，添加 CHECK（price>=0, quota>=0, cycle_days null or >0）；subscriptions 加 quota_used>=0 CHECK 和 status IN 约束
- Evidence: 6 new static assertions in generations.test.ts

## RPC Functions

| RPC | Signature | Key Changes |
|-----|-----------|-------------|
| `reserve_quota` | `(_user_id uuid, _idempotency_key text) → jsonb` | +post-lock idempotency re-check, +current_period_end > now() |
| `consume_quota` | `(_user_id uuid, _reservation_id uuid) → boolean` | +terminal event_type conflict detection |
| `release_quota` | `(_user_id uuid, _reservation_id uuid) → boolean` | +terminal event_type conflict detection |

All functions: SECURITY INVOKER, search_path = '', service_role EXECUTE only, explicit _user_id parameter.

## Invariants

- **Atomic**: reserve_quota uses FOR UPDATE; post-lock idempotency re-check prevents false-null on concurrent same-key
- **Append-only**: usage_ledger rows never UPDATEd or DELETEd; consume/release INSERT new terminal events
- **Terminal conflict**: consume-after-release → false; release-after-consume → false
- **Period validity**: active subscription must have current_period_end > now()
- **Uncertain safety**: 202 only returned when jobId + reservation both exist
- **No TOCTOU fallback**: release_quota RPC handles everything atomically

## Test Counts

- quota.test.ts: 27 tests (2 trusted adapter + 6 reserve + 7 consume + 7 release + 5 entitlement)
- generations.test.ts: ~98 tests (~65 migration assertions + ~33 behavioral)
- me.test.ts: 6 tests
- Total server: 154 passed, 0 failed
- Client: 49 passed, 0 failed

## Migration Status

- **NOT pushed to remote** — local draft only
- **SUPABASE_SECRET_KEY NOT configured** — user must set in server/.env
- **Price/quota/cycle NOT decided** — migration has no business defaults, only CHECK constraints
