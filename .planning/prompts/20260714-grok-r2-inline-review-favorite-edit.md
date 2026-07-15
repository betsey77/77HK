# Grok Build 受控任务：R2 句子级批注 + R2.1 收藏正文编辑

在 `D:\work\77港话通社媒文案\77` 工作。本仓库有大量属于用户的未提交改动，必须保留。先完整阅读：

- `README.md`
- `AGENTS.md`、`CLAUDE.md`
- `docs/design-system.md`
- `spec/PRD.md` 中 R1、R1.1、R2、R2.1
- `spec/SDD.md`、`spec/TEST_PLAN.md`
- `supabase/migrations/20260714190000_review_groups_admin_notes.sql`
- `supabase/migrations/20260714190100_fix_review_actor_role_type.sql`
- 收藏同步、管理员收藏审核、`FavoritesPanel`、`AdminPage` 及相应测试

## 唯一目标

完成一个内聚的小切片：

1. 用户可在文案收藏库直接编辑自己的收藏正文并显式保存；不修改生成历史原文。
2. 正文实际发生变化后，旧整篇审核与旧句子批注必须原子失效；管理员列表和详情显示“修改后待审核”。
3. 管理员可在收藏正文中选中文字片段，添加/编辑/删除句子级批注；批注与整篇审核状态一起保存。
4. 收藏所属用户刷新/bootstrap 后看到审核状态、整篇意见，以及红色高亮的句子批注；无权修改管理员字段。
5. 锚点不再匹配时不要错误高亮，降级到批注列表并显示“定位失效”。

## 必须遵守的边界

- 只允许增量修改，不大范围重构，不创建第二套前端或 Mock 工程。
- 保持现有 React 19、Express 5、Supabase、shadcn-like 视觉和亮色橙/暗色荧光绿规范。
- 用户只能编辑自己 owner-scoped 的收藏。普通管理员只能审核同 `review_group`；`super_admin` 可跨组。
- authenticated 浏览器端不得直接写管理员审核或批注；管理员写入继续走 BFF + service-role-only 原子 RPC。
- 不在日志、测试、文档中输出任何密钥。
- 禁止 `git reset/checkout/clean/stash/rebase/commit/push/worktree`。
- 禁止执行 `supabase db push`、远端 SQL、部署、安装依赖、修改支付或登录逻辑。
- 不删除用户文件，不清理无关代码，不重排无关格式。
- 必须 `--no-subagents`；本任务不要再启动代理。

## 建议的最小数据设计（可在不降低安全性的前提下微调）

- 新增且仅新增一份后续本地 Migration，建议名：
  `supabase/migrations/20260714190200_r2_inline_review_favorite_edit.sql`。
- `favorites` 增加可判断“修改后待审核”的元数据，例如 `content_revision`、`content_edited_at`。
- `favorite_admin_reviews` 增加受约束的 `annotations jsonb`，每项至少包含稳定 id、`startOffset`、`endOffset`、`quotedText`、`note`。
- 收藏 `content` 发生实际变化时，在数据库事务内递增 revision、写 edited_at，并删除当前 `favorite_admin_reviews`；内容未变化不得误清审核。
- 新增 service-role-only 原子 RPC 保存整篇审核和 annotations；保留旧 RPC，避免破坏已部署调用。RPC 必须固定 `search_path=''`、校验角色/分组/状态/长度/offset/quotedText 与当前正文一致，并 revoke PUBLIC/anon/authenticated。
- owner 继续只能通过 RLS 读取自己的审核；不得获得审核写权限。

## API 与状态要求

- 增加明确的 owner 收藏正文保存 API（例如 `PUT /api/sync/favorites/:clientId/content`），使用用户 JWT/RLS，不接受 ownerId、审核字段或批注字段。
- 空正文、超长正文、他人收藏、无效 clientId 返回稳定的 4xx，不把数据库细节发给客户端。
- 保存成功返回当前收藏/必要元数据；客户端只在 API 成功后提交正文状态，失败时保留编辑框内容并显示可访问错误。
- `FavoriteRecord` / `BookmarkedCopy` / admin meta/detail 类型传递 `contentEditedAt` 与只读 annotations。
- 现有通用 favorite upsert 不得成为绕过“正文修改后清审核”规则的路径；数据库不变量应覆盖所有真实 content UPDATE。

## UI 要求

- 收藏卡增加紧凑的“编辑文案”操作；进入后使用可纵向拉伸 textarea，提供保存/取消。
- 有未保存改动时取消/关闭应使用现有 `ConfirmDialog` 二次确认；无改动直接退出。
- 管理员现有可拉伸正文框支持选中文字（可使用 textarea 的 selectionStart/selectionEnd），再添加批注意见；列出已有批注并允许删除/重选。
- 管理员未审核但 `contentEditedAt` 存在时显示“修改后待审核”，普通新收藏仍显示“未审核”。
- 用户收藏卡中审核状态与整篇意见保持现有位置；有效批注用红色文本/底色高亮，并在下方列出意见；不能只靠颜色表达状态。
- 交互元素有中文 label/aria，键盘可用；不要使用 emoji 代替按钮图标。

## TDD 与验证

先写会失败的测试，再实现。至少覆盖：

1. Migration 静态契约：列/触发器或等价事务不变量、JSON 约束、RPC 权限、RLS 不扩大。
2. owner API：成功、空正文、超长、他人数据/不存在、数据库错误；不得接受审核字段。
3. content 实际变更清旧 review/annotations；相同内容不清除。
4. 管理员同组保存批注成功；越组 404；普通用户 403；无效 offset/quote/note 400。
5. bootstrap 正确回传 annotations/contentEditedAt，sync request 不上传管理员字段。
6. reducer/API 成功后更新正文并清旧 review；失败时不覆盖当前收藏。
7. 收藏编辑保存/取消确认；管理员 textarea 选择批注；用户有效红色高亮；失效锚点回退。
8. 现有 R1/R1.1、收藏平台/备注/批量删除/分页检索测试不回归。

先跑相关定向测试和 typecheck。不要为了让测试通过而降低断言。不要声称运行未执行的测试。

## 文档与停止条件

- 在 `spec/SDD.md` 补充实际数据流、RLS/RPC、失效规则和前端状态。
- 更新 `spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`、`.planning/progress.md`，只追加/修正本切片事实。
- 把命令与结果写入 `docs/evidence/2026-07-14/r2-inline-review-and-favorite-edit/`。
- 完成定向验证后立即停止，输出：改动文件、测试结果、尚未推送的 Migration、需要 Codex 复核的风险。

