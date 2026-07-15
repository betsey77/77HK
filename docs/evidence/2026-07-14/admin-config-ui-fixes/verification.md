# 管理员审阅、配置保存与左侧标签 UI 修复 — 验证证据

日期：2026-07-14  
范围：仅前端 / 展示层增量；无 Migration、无 RLS、无远端写入、无支付、无部署、无 `.env` 读写。

## 实现摘要

### A. 管理员收藏详情弹窗

- 弹窗容器：`max-h-[min(90vh,880px)]` + `flex flex-col` + `overflow-hidden`
- 顶栏固定：标题 + 关闭按钮（`shrink-0`）
- 正文：`flex-1 min-h-0 overflow-y-auto`（`data-testid="favorite-review-body"`）
- 底栏固定：复制仅正文（`data-testid="favorite-review-footer"`）
- 审阅摘要在正文前，紧凑两列网格；保留全部既有字段

### B. 中文展示映射（不改 API 枚举）

- `client/src/utils/adminDisplayLabels.ts`
- copyType：`social/spoken/poster/advertorial/poetry/custom` → 中文；空/未知 → 未填写
- platform：`all/ig/facebook/shorts/standardHK/lightCantonese` → 中文；空/未知 → 未填写
- 列表与详情摘要均使用映射；platform 可回退 `variantKey`

### C. 左侧标签 emoji

- 📝 文案类型 / 📱 目标平台 / 🎭 主语气 / 🗓️ 发布日期
- 未引入 Accordion / details / CollapsibleSection / 折叠信息架构

### D. 配置保存与日期

- `ConfigManager.saveConfig` 写入 `targetDate` 与 `selectedCalendarEventIds`（数组拷贝）
- `hasUnsavedChanges` 比较上述两项
- `LOAD_CONFIG` 恢复；缺字段 → 调用时香港自然日 + 空日历
- `RESTORE_DEFAULT_GENERATION_SETTINGS`：`getHongKongDateString()` 重置日期、清空日历，保留五项默认

## 测试命令与结果

```powershell
cd client
npx vitest run src/test/slice-admin-config-ui-fixes.test.tsx src/test/slice-w4-admin-review.test.tsx src/test/slice-c2a.test.tsx src/test/slice-config-reference.test.tsx
# → 4 files, 13 passed

npx vitest run
# → 25 files, 330 passed

npx tsc --noEmit
npm run build
# → exit 0（Vite production build OK）

cd ..\server
npx vitest run src/__tests__/admin.test.ts src/__tests__/w4-admin-review.test.ts
# → 2 files, 56 passed

npx tsc --noEmit
npm run build
# → exit 0
```

## 明确未做

- Migration / RLS / Supabase 远端写入
- 管理员编辑/删除/导出/写接口
- 左侧折叠页 / Accordion / details
- `/api/billing/*` 与 BillingPage 跳转
- 支付 E2E、部署、`.env` 修改

## 手测建议

1. `/admin` → 用户收藏 → 打开长正文详情：关闭按钮与「复制文案」始终可见；仅正文被复制。
2. 列表/详情：`spoken` 显示「口播稿」，`all` 显示「全部平台」；空字段「未填写」。
3. 工作台：改发布日期/话题日历后出现「未储存」；储存后加载可恢复；「复原创作配置」日期为当日香港日期。
