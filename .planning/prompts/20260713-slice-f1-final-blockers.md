# Slice F1 / G1-R 最终阻断修复（第 3 次，完成后停止）

在当前工作树原地修复，不得 worktree、切分支、reset、clean、提交或推送。禁止读取/输出任何 secret，禁止远端 Migration、角色写入、真实付款或部署。先读 README、CLAUDE、AGENTS、上一份 F1 prompt 和当前 diff。遵守 TDD：先补会失败的行为测试，再改实现。

独立复核发现以下阻断，必须逐项解决：

1. `BillingPage.tsx` 仍固定调用 `/api/billing/checkout`，导致支付宝沙箱路径不可达。页面先从公开 plans 响应取得 `paymentMode`；mock 保持原路由，`alipay_sandbox` 调 `/api/billing/alipay/checkout` 并提交稳定的 `idempotencyKey`。不得注入 SDK HTML，使用受控整页导航 URL。
2. `GET /api/billing/orders`、`GET /api/billing/orders/:id`、`GET /api/me/entitlements` 在 sandbox 仍只读内存 Mock。按 `PAYMENT_MODE` 分流：mock 保持兼容；sandbox 使用可信 BFF 查询数据库、严格 owner 限制并映射为现有 camelCase DTO。`GET /api/billing/plans` 在 sandbox 从 DB `plans` 读取（只返回公开安全字段），并返回 mode；不可只写注释。
3. checkout 的 return URL 必须包含服务端生成的 `orderId` 和 `paymentMode=alipay_sandbox`，但不能信任 Host。可在 service 创建 order 后，用 WHATWG URL 给配置的 return URL追加参数，再交给 adapter。
4. `BillingResultPage` 必须在订单尚未 fetch 时也从服务端生成的 `paymentMode` 查询参数识别 sandbox，sandbox 失败/404 不得降级显示绿色 Mock“订单创建成功”；只有 DB order.status=`paid` 才显示支付成功。pending/created 均显示等待服务端确认。
5. `express.urlencoded` 当前在 `app.ts` 和 billing router 重复挂载。只保留 `app.ts` 中、且仅 notify 精确路径的 parser；删除 router 重复项与过期注释。
6. notify 当前验签前 INSERT DB，违反既定安全顺序。改为：解析 → SDK 验签 → app/seller/status → 严格金额 → 查订单并验证金额 → 创建/读取去重事件 → 原子 RPC。无效签名不得产生任何 DB mutation。重复有效通知仍须幂等并最终返回纯文本 success。
7. SDK 4.14 源码 `#formatExecHttpResponse` 已直接返回 camelCase 业务对象（`tradeStatus/outTradeNo/tradeNo/totalAmount`），修复 `tradeQuery`，不得读取 `alipay_trade_query_response`，避免 `any`；新增 adapter 单测覆盖真实返回形状。
8. reconcile 调用 RPC 后必须检查 `rpcErr` 和返回 `success`，不能吞错后仍报告 paid；成功后返回服务端已应用状态。继续保留 10 秒限频。
9. Admin Supertest 的 admin 场景必须通过可控 service/DB mock 精确断言 200，不接受“不是 401/403”。保持 no token=401、普通 user=403。
10. 将必要的 PAYMENT/ALIPAY 占位符合并到根 `.env.example`，删除新建的重复 `server/.env.example`。所有内容只能是占位符。
11. 更新 `spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`、`.planning/status.md`、`.planning/task_plan.md`、`.planning/progress.md`、回归矩阵（存在的准确文件）和 `docs/comprehensive-spec-v2.md`，明确 F1 仅本地实现、Migration 未推、真实支付宝 sandbox E2E 未执行。保留并更新 evidence。

测试至少覆盖：mock/sandbox checkout 路由选择；sandbox 订单列表/详情 owner 隔离；sandbox result 初始 pending/错误不会假成功；invalid signature 零 DB mutation；SDK query camelCase；reconcile RPC 失败不报成功；admin 401/403/200。完成后运行 server/client 全部 test、tsc、build、secret scan 和 diff review。

完成后立即停止，报告精确测试数与仍需用户授权的门禁。不要开始下一 Slice。
