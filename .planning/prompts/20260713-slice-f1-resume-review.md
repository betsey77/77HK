# Slice F1 / G1-R 中断恢复与阻断修复

在 `D:\work\77港话通社媒文案\77` 当前工作树原地继续。禁止 worktree/切分支/reset/clean/checkout；保留所有中断改动。禁止远端 Migration、角色写入、真实付款、生产网关、secret 读取/输出。先读 README/CLAUDE/AGENTS、原始 F1 prompt 和当前 diff。

当前 tsc 与已有 Server 401 tests、Reference UX 19 tests 通过，但测试没有覆盖以下真实阻断。先补失败测试，再修复。

## 1. 官方 SDK 与 ESM

- `alipay-sdk@4.14.0` 是 ESM，使用静态 `import { AlipaySdk } from 'alipay-sdk'` 和真实类型；禁止 `require()`/`any` 掩盖错误。
- 电脑网站支付必须使用 `sdk.pageExec`/`pageExecute` 生成 HTML 表单，禁止对 page pay 使用 deprecated `sdk.exec`。
- 交易查询可以使用 SDK 支持的 `exec`，按 4.14.0 的真实返回结构实现并测试。
- 配置 `gateway` 字段名称须与 SDK 4.14.0 类型一致；以本地 node_modules 声明为准。

## 2. 回调 URL 与配置安全

- Sandbox 模式禁止从 `req.protocol/Host` 构造 return/notify URL（Host header injection）。必须从服务端配置 `APP_PUBLIC_URL` 或分别 `ALIPAY_RETURN_URL` / `ALIPAY_NOTIFY_URL` 获取；sandbox 缺失时 fail closed 503。
- mock 模式可保持本地内部跳转，但不得假装真实支付。
- key 文件读取支持 raw PEM；错误信息只能说明变量/文件不可用，禁止回显文件内容或 key。
- `validateNotifyIds`：配置 sellerId 时，通知 seller_id 缺失也必须失败；appId 必须精确匹配。

## 3. notify 解析、验签、金额和重复通知

- `express.urlencoded` 只能挂载到 `/api/billing/alipay/notify`，限制 body 大小；不得全局解析 form。
- 流程必须是：解析 → SDK 验签 → app/seller/status/订单/严格金额校验 → 创建/读取去重事件 → 原子 RPC。验签前不做 DB mutation。
- 金额使用严格十进制解析为分；拒绝 `19`、`19.0`、`19.00abc`、指数、负数、超过范围；接受官方两位小数格式如 `19.00`。
- 重复有效 notify：若已有事件已 applied/duplicate 且订单已 paid，必须返回纯文本 `success`，避免支付宝无限重试；processing 状态需安全幂等。
- notify 的任何非成功响应必须为纯文本 `fail`，不泄露原因。

## 4. 订单与权益一致性

- checkout 前查询 subscriptions：活跃且未到期的 Pro 必须 409，避免重复扣费。
- 不能出现用户已付款但 RPC 因 active Pro 将订单 closed 且不给权益。对竞态场景采用资金安全策略：已验证付款必须将订单标 paid，并将现有 Pro 的结束时间从 `greatest(current_period_end, paid_at)` 延长 1 month（或首次开通从 paid_at + 1 month）；不得重置已用 quota，除非这是首次从 Free 升级。写清合同并测并发/重复。
- RPC 必须验证订单 plan_id 就是 Pro plan_id、金额匹配 DB plan price、provider trade number 不冲突。
- reconcile 的可信查询若返回 success/finished，也必须走同一原子 apply service；同步 return 页面本身不授予权益。
- reconcile 加内存基础限频至少每用户/订单 10 秒，并测 429；生产分布式限频标为后续限制。

## 5. 前端真实沙箱路径

- 现有 `/billing/checkout` mock 保持兼容；当服务端/页面判定 sandbox 模式时调用 `/billing/alipay/checkout`，提交 `pro + idempotencyKey`。
- 不要把任意服务端 HTML 直接 `innerHTML` 注入页面。对 SDK formHtml 使用受控整页导航/提交方案并说明 CSP 风险；若安全完成困难，本切片返回可导航 URL/服务端中转 endpoint，避免 XSS。
- BillingResultPage 的 sandbox success return 显示“等待服务端确认”，轮询订单/调用 reconcile；只有服务端订单 paid 才显示成功。同步 URL 参数不能直接成功。
- 类型和测试同步；Mock 仍显示 Mock，Sandbox 明确显示支付宝沙箱。

## 6. G1-R 真实路由行为

- 确认 `/api/admin/stats` 路由实际可达：无 token 401、普通 user 403、admin 200。使用 Supertest + middleware/DB mock 的行为测试，不只源码字符串。
- 不赋予远端角色。

## 7. Migration 审计

- 检查表/RLS/grants/unique/check/search_path/锁/幂等。
- webhook events 不存完整 payload；authenticated 无读写。
- 修复 RPC 的 active Pro 资金安全、plan/price/provider_trade_no 校验。
- Migration 仅本地草案，不 push。

## 8. 清理与验证

- 删除 debug route `/billing/plans-test` 和 console debug。
- `.env.example` 只保留占位符，不创建重复 `server/.env.example`，除非项目已有明确规则；优先更新根 `.env.example`。
- 更新权威 spec/acceptance/changelog/status/task_plan/regression matrix，明确本地 F1、未推 migration、未做真实 sandbox E2E。
- 写 `docs/evidence/2026-07-13/slice-F1/verification.md`。
- 运行 server/client tsc、全部 tests、build、secret scan、git diff review。

完成后停止并报告精确测试数、未验证项和下一门禁。不要提交、不要推送、不要执行 admin 授权。
