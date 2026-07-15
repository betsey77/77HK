# 用户审核结果弹窗验收

日期：2026-07-15

## 完成范围

- 当前 owner 的云端收藏同步成功后，右下角显示最新一条尚未提示的审核结果。
- `adopted` 显示已通过，`changes_requested` 显示未通过并可附带审核意见；品牌为空时显示“你的文案”。
- 只有点击“稍后查看”或“立即查看”才标记已见；身份键包含 owner、收藏、正文版本、审核时间与状态，最多保留 100 条。
- “立即查看”幂等打开收藏库，清空搜索、切换分页、滚动并高亮对应收藏 3 秒。
- 工作台窗口重新聚焦时重新执行 owner-scoped bootstrap；不引入 Realtime、管理员列表查询或跨组推断。

## 自动化验证

- 新增通知/定位行为：5/5。
- 受影响审核回归：22/22。
- 完整客户端：34 文件，388/388。
- Client TypeScript 通过。
- Client production build 通过。
- `git diff --check` 通过；仅有工作区既有 LF/CRLF 提示。
- 本地 `http://localhost:5173/app` 与 `http://localhost:3001/api/health` 均返回 200。

## Grok Build

- 实现前完成一次有边界的只读设计审查，确认 owner 隔离、完整审核身份键、用户操作后标记已见和分页定位竞态处理。
- 实现后第二次只读复审因 Grok CLI `max turns reached` 未产出审查结论；没有让 Grok 修改文件或创建 Worktree。

## 浏览器验收边界

- 上一切片 Playwright runner 连既有 smoke 共 3 次启动超时，已触发停止规则；本切片不再重复执行，也不把截图写成通过。
- 当前 UI 证据为 jsdom 行为测试、TypeScript、production build 与本地 HTTP 健康检查。
- 待用户使用现有已审核收藏刷新 `/app`，人工确认右下角文案、稍后查看和立即定位的视觉效果。

## 边界

- 无数据库 Migration、后端 API、Realtime 或依赖变更。
- 未部署、未 Git commit、未 Git push，未 reset/clean，未创建 Worktree。
