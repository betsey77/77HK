# R2/R2.1 本地验收证据（2026-07-14）

## 范围

- 用户在收藏库直接编辑并保存正文。
- 正文实际变化后旧审核/旧句子批注失效，进入“修改后待审核”。
- 管理员选中文字添加句子级修改建议；用户端安全高亮或降级显示失效锚点。
- 保持 R1 的审核分组、service-role-only RPC 和审计边界。

## TDD 与回归

- Server R2 契约：3/3 passed。
- Client R2 单元/编辑行为：4/4 passed。
- R1/R2 管理员相关回归：Server 14/14；Client 11/11，新增句子选择行为测试后 8/8 聚焦复跑通过。
- Client 全量：30 files / 370 tests passed。
- Server 全量：27 files / 554 tests passed。
- `npm run typecheck`：passed。
- `npm run build`：passed；仅保留既有 Vite chunk > 500 kB 警告。

## 安全边界

- owner 来源只取 JWT；正文更新同时匹配 `owner_id + client_id`。
- 客户端不能写管理员审核、批注、revision 或 edited timestamp。
- `admin_save_favorite_review` 为 `SECURITY DEFINER SET search_path = ''`，仅授予 `service_role`。
- 普通管理员按 `review_group` 限制；越组返回 not found；超级管理员沿用 R1 跨组权限。
- 审核/批注/审计由单一 RPC 原子写入，审计 diff 不记录正文或批注内容。

## 远端推送（2026-07-15）

- `supabase db push --dry-run` 仅预览 `20260714190200_r2_inline_review_favorite_edit.sql`。
- 经用户明确授权后，`supabase db push --linked --yes` 成功。
- 远端 migration history 包含 `20260714190200 / r2_inline_review_favorite_edit`。
- `content_revision`、`content_edited_at`、`annotations` 与 `trg_favorites_content_review_reset` 均存在。
- `admin_save_favorite_review`：anon/authenticated 无 EXECUTE；service_role 有 EXECUTE。
- Security Advisor 未新增 R2 告警；仍有既存的 `payment_webhook_events` 无 policy（INFO）、`soft_delete_generation_job` authenticated 可执行（WARN）与 leaked-password protection 关闭（WARN）。
- 尚未完成浏览器人工验收，留给下一会话在当前本地地址执行。

## 浏览器人工验收（2026-07-15）

- 用户实操完成管理员句子批注与审核保存，并在用户收藏库刷新查看结果。
- 用户端可见“需修改”、整篇管理员审核意见、三条句子批注；被批注正文按锚点显示红色高亮。
- 截图：`manual-user-review-highlight-2026-07-15.png`。
- 结论：R2/R2.1 浏览器完整链路通过。
