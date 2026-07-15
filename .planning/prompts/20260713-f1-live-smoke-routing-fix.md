# F1 沙箱真实烟测阻断：公开 billing 路由与空 notify 超时

在当前工作树原地修复，禁止 worktree/切分支/reset/clean/提交/推送。禁止读取或输出 `D:\API` 中任何密钥，禁止修改 Migration、远端数据库、套餐、权益或支付金额。先读 README、CLAUDE、AGENTS 和当前 diff。只推进此小目标，TDD 后停止。

## 已复现事实

在 `PAYMENT_MODE=alipay_sandbox` 的真实本地进程：

- `GET /api/billing/plans` 无 token 返回 401；前端无法取得 `paymentMode=alipay_sandbox`。
- `POST /api/billing/alipay/notify` 空 `application/x-www-form-urlencoded` body 本地及 Cloudflare tunnel 均超时。
- 原因 1：`app.ts` 中 billingRouter 排在 `syncRouter` 后；syncRouter 顶部 `router.use(requireAuth)` 会拦截所有未匹配到它自身路径的后续请求。
- 原因 2：notify 的 `express.urlencoded` 已消费请求并把空 body 设为 `{}`，但 app 手写 JSON parser 只在 `Object.keys(req.body).length > 0` 时跳过，随后对已结束流继续等待。

## 必须先补失败行为测试

使用 Supertest 在 sandbox mode 覆盖：

1. 无 token `GET /api/billing/plans` 必须到达 billing handler，不得 401，并返回 `paymentMode='alipay_sandbox'`、`isMock=false`；DB 可控 mock 返回两项公开套餐。
2. 无 token、空 form body `POST /api/billing/alipay/notify` 必须快速返回 HTTP 200、`text/plain`、正文 `fail`，不得超时或进入 requireAuth。
3. 无 token `POST /api/billing/alipay/checkout` 仍为 401。
4. 现有 sync 路由仍要求认证，无回归。

## 最小实现约束

- 保持 billing 各受保护路由自己的 `requireAuth`；公开 plans/notify 不加认证。
- 调整 app router 顺序或做更小的明确 public route 分离，使 billing 公开路由不会经过带 catch-all `router.use(requireAuth)` 的 sync/feedback router。禁止大范围重构。
- 手写 parser 只要发现 body 已由前置 parser定义（即使是空对象）就必须 `next()`；同时保证普通 JSON body 仍可解析，1 MiB 限制不变。
- 修正 billing notify 过时注释（urlencoded 只在 app.ts 精确路径挂载）。
- 不改支付宝验签、订单、RPC、前端和 Migration，除非测试证明直接必需。

## 验证

运行 server 全部 Vitest、server tsc/build；再用真实启动进程烟测上述三条 endpoint。更新 `docs/evidence/2026-07-13/slice-F1/verification.md`、ACCEPTANCE/CHANGELOG/progress，明确该 live smoke 修复。完成后停止，报告测试数。不要开始下一任务。
