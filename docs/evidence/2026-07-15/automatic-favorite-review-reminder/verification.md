# 收藏自动送审与管理员提醒修复验证

日期：2026-07-15

## 问题与结论

- 只读远端核对确认：最新品牌“11”的普通收藏和自写收藏均已同步，但 `review_requested=false`，所以管理员待审核数为 0；不是管理员查询漏数。
- 新生成文案点击收藏后，现在会直接写入 `reviewRequested=true`。
- 收藏正文修改时，owner-scoped 更新接口会在同一笔数据库更新中写入 `review_requested=true`；数据库 trigger 负责刷新送审时间并清除旧审核结果。
- 自写收藏的“提交管理员审核”开关仍通过云同步发送 `reviewRequested=true`，新增 hook 测试锁定该负载。
- `/admin` 页面新增右下角待审核提醒；页面初次加载、窗口重新聚焦、浏览器标签重新可见时刷新。点击“立刻审核”进入“用户收藏 > 只看待审核”。
- 提醒高水位在同一管理员会话内共享，已有数量下降不会误报，只有数量增加或最新送审时间推进才再次提醒。

## 数据边界

- 本次没有执行远端数据写入、Migration、部署、Git commit 或 push。
- 修复不批量改写历史收藏。修复前已保存且 `review_requested=false` 的记录保持原状；再次收藏、修改正文或显式勾选送审后进入队列。

## 自动验证

- Client targeted：32/32 通过。
- Server targeted：58/58 通过。
- Client full：392/392 通过。
- Server full：569/569 通过。
- Client/Server TypeScript：通过。
- Client/Server production build：通过。
- `http://localhost:5173/admin`：200。
- `http://localhost:3001/api/health`：200。

## 人工复测

1. 用户在 `/app` 对一条未收藏的生成文案点击星标。
2. 等待约 1 秒，切换到已登录管理员的 `/admin` 标签。
3. 右下角应显示“N 条文案待审核”；点击“立刻审核”。
4. 页面应切换到“用户收藏”的“只看待审核”，数量大于 0，并显示刚收藏的文案元数据。
5. 也可对已有自写收藏勾选“提交管理员审核”，或修改任意收藏正文，重复第 2-4 步。

