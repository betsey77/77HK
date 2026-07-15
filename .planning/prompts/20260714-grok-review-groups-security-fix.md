# R1 审阅修复 — 仅修 Migration 阻断问题

请在当前工作区只修复下面 3 个问题，不扩展功能、不改 UI、不推送远端、不执行 git 操作、不使用子代理。

## 1. audit_log.entity_id 类型错误

现有 `public.audit_log.entity_id` 是 `uuid`，但 `20260714190000_review_groups_admin_notes.sql` 的 RPC 两处写入使用 `_favorite_id::text`。改为 UUID 类型表达式（直接 `_favorite_id`），并补 migration 静态测试，明确禁止 `entity_id` 使用 `_favorite_id::text`。

## 2. 删除未使用且会泄露分组的 helper

Migration 中的 `private.profile_review_group(_user_id uuid)` 未被 RLS/RPC 使用，却允许调用者传任意用户 UUID 查询分组。完整删除该函数定义、revoke/grant，不以另一个公开函数替代。保留真正需要的 `private.same_nonnull_review_group`，并继续保持最小权限。

补测试：migration 不得包含 `profile_review_group`；RLS 仍只能通过角色校验 + `same_nonnull_review_group` 判断。

## 3. reviewer 账户删除不应阻塞注销清理

产品已有“注销后 30 天删除”规则。当前 `reviewer_id uuid not null references auth.users(id)` 默认 RESTRICT，删除管理员账号会被历史审核记录阻塞。改为 `reviewer_id uuid null references auth.users(id) on delete set null`；审核写入时仍必须填写当前 actor。用户端和管理员 API 均不得返回 reviewer 身份。

补 migration 测试覆盖 `on delete set null`，并确认 RPC insert/upsert 仍写 reviewer_id。

## 验证

- 运行 `server/src/__tests__/review-groups-migration.test.ts` 和 `review-groups-admin-notes.test.ts`。
- 运行 server typecheck。
- 不修改 Grok 已记录的全量测试数字；不要声称重新跑了全量测试。
- 在 `docs/evidence/2026-07-14/review-groups-admin-notes/verification.md` 追加“独立审阅修复”小节，说明上述 3 点和实际命令结果。

完成即停止，只汇报修改文件和确切测试结果。
