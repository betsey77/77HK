# R1 — 审核分组 + 管理员收藏批注（2026-07-14）

## 范围

本地增量：`profiles.review_group`、`favorite_admin_reviews`、管理员同组 scope、审核写 RPC、用户 bootstrap 只读同步、管理后台编辑区、收藏卡高亮、官网 tel 提示、运维文档。

## 未执行（门禁）

- 推送前未执行 `supabase db push`；用户确认后已完成推送，详见后文“Supabase 远端 Migration 推送”。
- **未** Dashboard 角色或 `review_group` 写入
- **未** 部署、支付 E2E、git commit/push
- **未** 读取或修改 `.env` 密钥

## 命令与结果

| 命令 | 结果 |
| --- | --- |
| `npx vitest run src/__tests__/review-groups-migration.test.ts src/__tests__/review-groups-admin-notes.test.ts`（server） | **18 passed**（7 + 11） |
| `npx vitest run src/test/slice-review-groups-admin-notes.test.tsx`（client） | **6 passed** |
| `npm run test:server` | **545 / 545 passed**（26 files） |
| `npm run test:client` | **364 / 364 passed**（29 files） |
| `npm run typecheck` | **通过**（client + server） |
| `npm run build` | **通过**（client vite + server tsc） |
| `npm run audit:prod` | **0 vulnerabilities** |

## 实现要点

- service_role 管理查询显式重复同组校验（`resolveAdminFavoriteOwnerScope`）
- 越组详情：404，不写 audit，不读 body
- 审核写：仅 `PUT /api/admin/favorites/:id/review` → `admin_update_favorite_review` 原子 RPC
- bootstrap：用户 JWT + RLS 读 review；upsert 不发送/覆盖 admin review
- 远端 migration 文件已创建但**未推送**

## 人工确认项

1. 授权推送 `20260714190000_review_groups_admin_notes.sql`
2. 按 `docs/admin/review-group-management.md` 配置同组用户与管理员
3. 双账号同组/越组实机验收（列表、详情、审核、用户 bootstrap 刷新）

## 独立审阅修复（R1 阻断项）

仅修 migration 三处阻断；未扩展功能、未改 UI、未推送远端、未执行 git。

| # | 问题 | 修复 |
| --- | --- | --- |
| 1 | `audit_log.entity_id` 为 uuid，RPC 两处写 `_favorite_id::text` | 改为 `_favorite_id`；静态测试禁止 `entity_id` / `_favorite_id::text` |
| 2 | 未使用的 `private.profile_review_group` 可按任意用户 UUID 查分组 | 完整删除函数定义与 revoke/grant；RLS 仅 `has_any_role` + `same_nonnull_review_group` |
| 3 | `reviewer_id not null` 默认 RESTRICT 阻塞管理员注销清理 | 改为 `uuid null … on delete set null`；RPC insert/upsert 仍写当前 `_actor_id` |

### 本轮验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `cd server; npx vitest run src/__tests__/review-groups-migration.test.ts src/__tests__/review-groups-admin-notes.test.ts` | **22 passed**（2 files；migration 11 + admin-notes 11） |
| `cd server; npx tsc --noEmit` | **通过**（exit 0） |

未重跑全量 client/server 套件；上文 Grok 记录的 545/364 等数字不作本轮复测声明。

## Codex 独立全量复验

安全修复完成后，从仓库根目录重新执行统一验证命令 `npm run verify`，不是沿用 Grok 自报结果。

| 验证项 | 独立结果 |
| --- | --- |
| Client Vitest | **364 / 364 passed**（29 files） |
| Server Vitest | **549 / 549 passed**（26 files） |
| Client + Server TypeScript | **通过** |
| Client Vite + Server tsc build | **通过** |
| `npm audit --omit=dev` | **0 vulnerabilities** |
| `npm audit` | **0 vulnerabilities** |

构建仅出现既有的 Vite 单 chunk 大于 500 kB 提示，不阻断本切片；仍未执行远端 Migration 或真实双账号浏览器验收。

## Supabase 远端 Migration 推送

用户明确回复「确认推送 R1 Migration」后执行：

1. CLI `migration list --linked`：本地与远端前 10 条完全一致，唯一 pending 为 `20260714190000_review_groups_admin_notes.sql`。
2. CLI `db push --linked --dry-run`：只列出 R1。
3. CLI `db push --linked --yes`：成功应用 R1。
4. Supabase MCP 复核：远端 migration history 包含 `20260714190000 / review_groups_admin_notes`。
5. 元数据检查：`profiles.review_group` 存在；`favorite_admin_reviews` 存在且启用 RLS；owner/admin 两条 SELECT policy 存在。
6. 权限检查：`authenticated` 只有 SELECT、无 INSERT/UPDATE/DELETE；`anon` 无 SELECT；RPC 对 anon/authenticated 不可执行，仅 service_role 可执行；函数为固定空 `search_path` 的 SECURITY DEFINER。
7. Security Advisor 未发现 R1 新增安全问题；Performance Advisor 提示两条 SELECT policy 可合并，属于非阻断优化，未未经授权追加补丁。

远端当前为 3 个 profile、1 个普通管理员、0 个 super_admin、0 个已分组 profile、0 条审核记录；尚未写入任何用户分组或测试批注。
