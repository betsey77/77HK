# R1.1 本地验证证据

日期：2026-07-14  
范围：审核保存热修复、正文审阅框可拉伸，以及授权后的远端 Migration 推送与事务验证。

## 根因与修复

- 根因：`public.admin_update_favorite_review` 内 `_actor_role` 为 `text`，写入枚举列 `public.audit_log.actor_role` 时触发类型错误，导致审核与审计所在事务整体回滚。
- 修复：追加 `20260714190100_fix_review_actor_role_type.sql`，两个审计写入点使用 `_actor_role::public.app_role`。
- 权限不变：函数继续 `SECURITY DEFINER SET search_path = ''`，撤销 `public/anon/authenticated` 执行权限，仅授权 `service_role`。
- UI：正文框默认高度 14rem，可纵向拉伸并内部滚动；详情内容区可滚动；关闭和复制操作位于固定头尾；错误提示使用 `role="alert"`。

## TDD

红测：

- Server：后续 Migration 文件不存在，R1.1 两项契约测试失败。
- Client：缺少 `role="alert"`、可拉伸正文框与可滚动内容区，两项行为测试失败。

绿测：

- `server: npx vitest run src/__tests__/review-groups-migration.test.ts` → 13/13。
- `client: npx vitest run src/test/slice-review-groups-admin-notes.test.tsx` → 7/7。

## 全量门禁

执行：`npm run verify`

- Client：29 files，365/365 tests passed。
- Server：26 files，551/551 tests passed。
- Client/Server TypeScript：passed。
- Client/Server production build：passed。
- `npm audit --omit=dev`：0 vulnerabilities。
- `npm audit`：0 vulnerabilities。

非阻断提示：Vite 仍报告既有主 bundle 大于 500 kB；Node 测试环境仍报告既有 localStorage experimental warning。本切片不处理这些非相关问题。

## 远端推送与验证

- 推送前 `supabase migration list --linked`：远端最新为 `20260714190000`，本地仅多出 `20260714190100`。
- `supabase db push --linked --dry-run`：只会推送 `20260714190100_fix_review_actor_role_type.sql`。
- `supabase db push --linked --yes`：应用成功。
- 远端 migration history：包含 `20260714190100 / fix_review_actor_role_type`。
- 远端函数定义：两个审计写入点均为 `_actor_role::public.app_role`。
- 远端函数 ACL：`postgres=X/postgres, service_role=X/postgres`；`public/anon/authenticated` 无执行权限。
- service-role 事务调用：`candidate_count=1`、`rpc_ok=true`、`status_ok=true`。
- 事务回滚复核：`persisted_test_reviews=0`，未留下测试审核内容。
- Security Advisor：未报告 `admin_update_favorite_review` 新问题；仍有 3 条既有提示，本切片未越范围修改。

## 仍需手工复验

- 用户刷新 `/admin`，对一条收藏执行“已采纳”或“需修改”保存，确认 UI 显示“审核已保存”。
- 未实现 R2 句子级批注。
