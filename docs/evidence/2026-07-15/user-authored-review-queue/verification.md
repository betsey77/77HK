# 用户自写收藏与待审核队列验收

日期：2026-07-15

## 完成范围

- 收藏库可新增用户自写文案；品牌、文案类型、发布平台、正文必填，备注选填，审核采用显式二选一。
- 收藏卡可编辑发布平台、文案类型和审核请求；自定义类型只在 2-20 字有效值时同步。
- 管理员收藏列表支持“只看待审核”、待审核行高亮、标签页与右上角菜单圆形计数角标。
- 新任务按 `count + latestRequestedAt` 合并提醒；数量下降不误报，新时间或数量增加才再次提醒。
- 管理员汇总与列表继续按 `review_group` 限制；汇总只返回计数和最新时间，列表不返回正文。

## Migration

- 文件：`supabase/migrations/20260715121000_user_authored_review_queue.sql`
- 用户明确授权后已执行一次 `supabase db push`。
- 本地与远端 migration history 均包含 `20260715121000`，无漂移。
- 远端列、时间一致性约束、部分索引和 `BEFORE INSERT OR UPDATE` 触发器均存在。
- 远端数据复核：16 条收藏，4 条安全回填 `review_requested`，0 条时间不一致，0 条非目标回填。
- Advisor 未发现本 Migration 新增警告；保留既有 RLS/安全函数/密码保护和未使用索引提示。

## 自动化验证

- 新增客户端行为：5/5。
- 受影响客户端回归：40/40；最终边界回归：25/25。
- 受影响服务端回归：83/83。
- 完整客户端：33 文件，383/383。
- 完整服务端：30 文件，569/569。
- Client/Server TypeScript 均通过。
- 完整双端 production build 通过；最终客户端 production build 再次通过。
- `npm audit --omit=dev --audit-level=high`：0 vulnerabilities。
- 远端真实 Supabase/PostgREST 只读调用：summary 0、pending list 0、无 `content` 字段；证明 anti-join 查询可执行。

## 浏览器验收边界

- 已新增 `e2e/user-authored-review-queue.spec.ts`，覆盖桌面/390px 表单溢出和管理员待审核深链。
- 本机 Playwright runner 连现有公开首页 smoke 也在启动阶段挂起；功能用例、DEBUG 单用例、既有 smoke 共 3 次均无测试输出后超时，按停止规则不再重试。
- 因此本切片没有伪造截图，也不把 Playwright 截图判为通过；当前 UI 证据为 jsdom 行为测试、TypeScript 和真实 production build。

## 边界

- 未创建真实 QA 账号，未写入远端 QA 收藏或审核记录。
- 未部署、未 Git commit、未 Git push，未 reset/clean，未创建 Worktree。
- 用户审核结果弹窗属于后续独立切片，本切片未实现。
