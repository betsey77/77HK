# Grok Build：R1.1 管理员审核保存与正文审阅修复

项目：`D:\work\77港话通社媒文案\77`

本轮只完成一个小切片：修复现有 R1 审核保存失败，并让收藏正文区域可拖拽增高。不要开发句子级批注；那是下一轮 R2。

## 开始前必须阅读

- `README.md`
- `AGENTS.md`（若存在）
- `.planning/status.md`
- `spec/PRD.md` 中 R1 与 R1.1
- `spec/TEST_PLAN.md` 中 R1.1
- `docs/design-system.md`
- `supabase/migrations/20260714190000_review_groups_admin_notes.sql`
- `client/src/pages/AdminPage.tsx`
- `server/src/services/adminService.ts`

## 已确认根因

Supabase PostgreSQL 远端日志连续出现：

`column "actor_role" is of type public.app_role but expression is of type text`

R1 RPC `public.admin_update_favorite_review` 内 `_actor_role` 声明为 `text`，写入 `public.audit_log.actor_role public.app_role` 时失败，导致审核和审计同一事务整体回滚。

## 实现范围

### A. 数据库热修复（仅本地 migration）

- 使用已经由 Supabase CLI 创建并调整到 R1 之后的文件：
  `supabase/migrations/20260714190100_fix_review_actor_role_type.sql`
- 不修改已经推送的 `20260714190000_review_groups_admin_notes.sql`。
- 在新 migration 中 `create or replace function public.admin_update_favorite_review(...)`，保持原有参数、返回值、权限检查、同组规则、原子审核+审计、固定空 `search_path` 与返回 JSON 完全不变。
- 唯一数据库行为修复：两处写入 `audit_log.actor_role` 时使用 `_actor_role::public.app_role`（或等价的强类型变量方案）。
- migration 末尾重新执行最小权限：撤销 `public/anon/authenticated` 执行权，只授予 `service_role`。
- 禁止 `db push`、MCP apply migration、远端 SQL、Dashboard 修改。

### B. 正文审阅体验

- `AdminPage` 收藏详情中的正文保持只读、保留换行、可复制。
- 正文区域支持纵向拖拽调整高度（`resize-y` + 非 hidden overflow）。
- 为避免正文放大后遮住审核区：正文/审核内容所在主区域必须可以纵向滚动；顶栏关闭按钮与底栏复制按钮继续可访问。
- 正文默认高度不要明显变大；只给用户自主放大的能力。
- 增加简短可见提示或可访问描述，例如“拖动右下角调整正文高度”。
- 保持深色荧光绿、浅色橙色的现有规范；不要重做弹窗。

### C. 测试

- 先补失败测试再修复。
- server migration 静态契约至少验证：
  - 新 migration 位于 R1 之后；
  - RPC 仍为 `SECURITY DEFINER` + 空 `search_path`；
  - 两处审计写入不会再把未转换的 text 写入 `app_role`；
  - execute 权限仍仅 `service_role`。
- client 行为测试至少验证：
  - 正文区域存在 `resize-y` 和可滚动行为；
  - 关闭、保存审核、复制按钮仍存在；
  - 保存失败使用可访问错误提示（`role="alert"` 或 `aria-live`），不得暴露数据库原始错误。
- 运行定向测试、client/server `tsc --noEmit` 和 build。不要伪造结果。

## 禁止范围

- 不开发 R2 句子级批注。
- 不改支付、登录、生成 Prompt、收藏容量、套餐、部署配置。
- 不改真实 `.env` 或读取密钥。
- 不删除用户文件，不做大范围重构，不运行 git commit/push。
- 不推送任何 Migration。

## 交付

- 更新 `spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`、`.planning/progress.md`。
- 证据写入 `docs/evidence/2026-07-14/r1-review-save-hotfix/`。
- 最后明确列出：改动文件、测试结果、未执行的远端动作、需要 Codex 复核的点，然后停止。
