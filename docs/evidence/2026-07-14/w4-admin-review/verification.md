# W4 管理员收藏审阅与超级管理员案例正文 — 验证证据

日期：2026-07-14  
范围：本地增量实现；无 Migration、无 RLS 变更、无远端写入、无支付、无部署、无 `.env` 读写。

## 实现摘要

### A. 管理员收藏审阅（admin + super_admin）

- 列表/详情从 `favorites.settings` 安全提取：`brandName` / `productName` / `copyType` / `platform`；缺失为 `null`。
- 详情弹窗正文上方固定「审阅摘要」卡；客户端缺失显示「未填写」。
- 保留顺序：`adminFavoriteExists` → `writeAdminAuditLog(admin_view_favorite_detail)` → `getAdminFavoriteDetail`；审计失败 500 且不读正文。
- 「复制文案」仅复制 `content`。

### B. 超级管理员案例正文（super_admin only）

- `GET /api/admin/case-library/:id` + `requireSuperAdmin`（依赖 `req.userRole`）。
- 顺序：`adminCaseLibraryExists`（id only，排除 soft-delete）→ audit `admin_view_case_library_detail` / entity `case_library_entries` → allowlist body read。
- 响应：owner display name（无 email）、caseType/title/body/reason/tags/created/updated。
- UI：「案例审阅」Tab 仅 `stats.role === 'super_admin'` 可见；按 ID 查询；摘要 + 正文 + 单条复制。

## 测试命令与结果

```powershell
# Server directed
cd server
npx vitest run src/__tests__/w4-admin-review.test.ts src/__tests__/admin.test.ts
# → 2 files, 56 passed

# Server full
npx vitest run
# → 21 files, 501 passed

npx tsc --noEmit
npm run build
# → exit 0

# Client directed
cd client
npx vitest run src/test/slice-w4-admin-review.test.tsx src/test/slice-g1-admin.test.tsx
# → 2 files, 22 passed

# Client full
npx vitest run
# → 24 files, 325 passed

npx tsc --noEmit
npm run build
# → exit 0（Vite production build OK）
```

## 明确未做

- Migration / RLS 变更 / Supabase 远端写入
- 跨用户案例列表或批量导出
- 管理员编辑/删除/评分收藏或案例
- 普通管理员读取案例正文
- 左侧折叠页 / Accordion / CollapsibleSection
- 支付 E2E、部署、`.env` 修改

## 手测建议

1. 以 ordinary admin 登录 `/admin`：可见「用户收藏」，不可见「案例审阅」；打开收藏详情可见审阅摘要与「未填写」。
2. 以 super_admin 登录：可见「案例审阅」；输入合法 UUID 可看正文；复制仅正文。
3. 审计失败路径需依赖故障注入/mock（自动化已覆盖 fail-closed）。
