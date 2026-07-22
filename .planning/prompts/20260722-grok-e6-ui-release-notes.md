# Grok Agent Team — 2.1 Slice E6 管理端 UI 与更新日志外壳

你是 Grok leader，当前目录是由 Codex 显式创建的 detached worktree。先阅读 `README.md`、`AGENTS.md`、`docs/plans/2026-07-22-2.1-bad-case-review-pack-plan.md`、`spec/SDD.md`、`spec/TEST_PLAN.md`，以及现有 `AdminPage`、`AdminMetricsPanel`、`BadCaseDetailDialog`、`HeaderMenu`、通用 dialog 样式和客户端 API 测试。

先并行创建最多两个 `slice-e-worker` 一级成员，只读调研：

1. 成员 A 给出管理端审阅包最小信息架构、390px/键盘/内部滚动风险和与现有低分任务入口的接法。
2. 成员 B 给出 HeaderMenu 更新日志 drawer/dialog 的焦点、Escape、body scroll lock 与“仅 deployed”静态数据模型。

成员不得写代码或继续派生 agent。leader 汇合后独自修改。

## 目标

基于冻结 API 草案实现 E6 客户端，后端未接通时具备明确错误/空态，不伪装真实数据：

- 管理端新增审阅包列表与详情界面，包含：概览、样本、Trace、验收、工件、Findings、审计七个可访问标签/折叠区；支持筛选、加载、空、错误、legacy/trace unavailable、超长正文与组件内滚动。
- 操作 UI 覆盖指派、状态和 finding disposition；调用单独 API client，所有响应运行时做最小校验，不展示 raw server error。
- 仅 super_admin 能看到入口；前端隐藏不是权限边界，文案不能声称已经授权。
- 工作台 `HeaderMenu` 增加“更新日志”，打开静态 dialog/drawer，不跳转、不重置工作台状态；支持 Escape、焦点恢复、body scroll lock、390px 内滚动。
- 静态发布数据只渲染 `status: 'deployed'`；不要添加 2.1 已部署条目。可显示空态“2.1 更新将在正式上线后公布”。
- Footer/可见版本号统一为 `2.1`。

## 允许修改

- `client/src/services/badCaseReviewPackApi.ts`（新）
- `client/src/components/admin/BadCaseReviewPackPanel.tsx`（新）
- `client/src/components/admin/BadCaseReviewPackDialog.tsx`（新）
- `client/src/components/layout/ReleaseNotesDialog.tsx`（新）
- `client/src/constants/releaseNotes.ts`（新）
- `client/src/pages/AdminPage.tsx`
- `client/src/components/layout/HeaderMenu.tsx`
- `client/src/components/layout/Footer.tsx`
- `client/src/test/bad-case-review-pack-api.test.ts`（新）
- `client/src/test/slice-e6-bad-case-review-pack.test.tsx`（新）
- `client/src/test/slice-e6-release-notes.test.tsx`（新）

不要修改后端、Migration、共享 package lock、规格或 Git 配置。尽量复用现有样式，不大范围重构 AdminPage。

## 冻结 API

- `GET /api/admin/bad-case-review-packs`
- `GET /api/admin/bad-case-review-packs/:id`
- `POST /api/admin/bad-case-review-packs/:id/assign`
- `POST /api/admin/bad-case-review-packs/:id/status`
- `POST /api/admin/bad-case-findings/:id/review`
- `POST /api/admin/bad-case-review-packs/:id/analyze`
- `POST /api/admin/bad-case-findings/:id/proposal`

## 验收

- 先写失败测试再实现；运行新增测试、client typecheck 和 build。
- 不做截图伪验收；只报告自动测试事实与仍需最终人工浏览器验收项。
- 最终报告成员结论、改动文件、测试输出和后端对接假设。

禁止 commit/push、reset/clean、部署、运行 Migration、删除 worktree、读取 secrets 或修改允许范围之外文件。
