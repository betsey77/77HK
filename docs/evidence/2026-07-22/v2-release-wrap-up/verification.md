# V2.1 发布收尾验证记录

日期：2026-07-22

## 已通过

- `node scripts/staging-auth-rls-acceptance.mjs`
  - 临时 staging 用户可注册/登录、错误密码失败、登出再登录成功。
  - 新用户保持 `user/Free`，不能自行提升管理员、review_group 或 Pro。
  - owner RLS、跨用户读写、伪造归属、管理员 API、组范围、RPC 直调、跨组请求均按预期 fail-closed。
  - 脚本结束已清理临时用户和测试数据。
- 旧 staging 脚本引用已删除的 `server/src/index.ts`；已切换至当前本地入口 `server/src/local.ts`，未恢复已删除文件。
- `node scripts/staging-review-notifications-ui.mjs`
  - 临时管理员、待审核收藏、桌面一次性提醒、390px 待审核队列和审核保存全部通过。
  - 用户桌面“审核通过”与 390px“需修改”通知均可点击“立即查看”，并定位到对应收藏。
  - 审核结果出现时显式断言“每日签到”数量为 0；审核结果优先，签到在关闭后恢复，避免全屏遮罩拦截按钮。
  - 脚本结束已清理临时管理员、审核记录和验收收藏。
- 前端回归：相关 3 个测试文件 17/17、全量 Client 486/486、typecheck、production build 通过。
- Grok 只读复核无 P0；其指出的“签到晚挂载会错过事件”P1 已通过 owner-scoped 粘性状态和第二条回归测试关闭。

## UI 证据

截图位于 `docs/evidence/2026-07-16/staging-auth-rls/screenshots/`：

- `admin-pending-reminder-desktop-1440-staging.png`
- `admin-pending-queue-mobile-390-staging.png`
- `admin-review-saved-mobile-390-staging.png`
- `user-review-adopted-desktop-1440-staging.png`
- `user-review-immediate-favorite-desktop-1440-staging.png`
- `user-review-changes-mobile-390-staging.png`
- `user-review-immediate-favorite-mobile-390-staging.png`

## 发布影响

本轮通知 UI staging 阻塞已关闭，但 V2.1 仍为 No-Go：尚需 DeepSeek Bad Case 与 Slice E 真实写入/审计闭环、统一人工验收、Dirty Worktree 发布清单、CI/Preview 和生产授权。未执行 commit、push、生产 Migration、部署或 Promote。
