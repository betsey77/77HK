# 生产上线门禁复验

日期：2026-07-14  
范围：只读/本地验证与 Supabase Advisor 查询；未部署、未切生产支付、未推送 Migration、未 commit/push。

## 自动化结果

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| Client tests | `cd client && npx vitest run` | PASS：27 files，353 tests |
| Server tests | `cd server && npm test` | PASS：22 files，509 tests |
| Client production build | `cd client && npm run build` | PASS；主 JS bundle 约 812 KB，有 chunk size warning |
| Server build | `cd server && npm run build` | PASS |
| Production dependency audit | `npm audit --omit=dev` | FAIL：`form-data` high，fix available |
| Full dependency audit | `npm audit` | FAIL：`form-data` high；`concurrently`、`shell-quote` critical |
| Migration history | `npx supabase migration list --linked` | DRIFT：本地 `20260714000000/000001` 不在远端；远端 `20260714052140/052414` 不在本地 |

## Supabase Advisor

Security：

- WARN：`public.soft_delete_generation_job(uuid)` 为 authenticated 可执行的 SECURITY DEFINER RPC。
- WARN：Leaked Password Protection 未开启。
- INFO：`payment_webhook_events` 已启用 RLS 但无 policy；需结合 grants 证明它仅由可信服务端访问。

Performance：

- INFO：`payment_orders.plan_id` 外键缺覆盖索引。
- WARN：`user_feedback` 对 authenticated SELECT 有两条 permissive policy。
- 其余未使用索引需等真实访问数据后再决定，不应在上线前盲删。

## 本地工具链说明

- 当前有 Vite 进程占用 Windows 原生模块，根 `npm run build` 内部执行 `npm ci` 时曾出现 EPERM；恢复依赖后分项 tests/build 均通过。
- 该问题说明 CI 应把安装与构建拆开；构建脚本本身不应再次执行 `npm ci`。
- 本地 Supabase 未启动，`migration list --local` 无法连接；远端 linked migration list 可读取。

## 验收判定

**NOT READY FOR PRODUCTION**。详细阻断与分阶段计划见 `docs/release/2026-07-14-production-launch-plan-v2.md`。

