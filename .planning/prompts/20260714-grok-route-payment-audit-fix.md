# Grok Build：路由与结算体验定向修复（2026-07-14）

在 `D:\work\77港话通社媒文案\77` 工作。先阅读 `README.md`、`AGENTS.md`、`CLAUDE.md`、`docs/design-system.md`、`docs/handoff/GROK_BUILD_FRONTEND_HANDOFF_2026-07-13.md`，以及本提示全文。

这是一个**小切片的定向修复**，不是重构授权。不要使用子代理。

## 已核实事实（不要重新猜测）

1. 真实应用运行入口是当前 `http://localhost:5173`，工作台为 `/app`，结算为 `/app/billing`，定价说明为公开 `/pricing`。
2. `前端设计稿/grok/homepage-v2.html` 是静态设计稿。它若被静态服务器（例如 `5175`）打开，`href="/app"` 和 `href="/app/billing"` 会落在静态服务器，而不是原 React/Express 应用，造成错误或 Mock 跳转的错觉。
3. 当前真实接口 `GET /api/billing/plans` 返回 `paymentMode: "mock"`，原因是本机运行环境未设置 `PAYMENT_MODE=alipay_sandbox`。这是配置状态，**本切片禁止修改**。
4. `client/src/pages/BillingPage.tsx` 当前已用 `!isPro` 隐藏升级按钮；Pro 用户不应能再创建 Pro 订单。它在创建订单成功后的通用文案仍写“即将跳转到模拟支付页面”，在支付宝沙箱模式下不准确。
5. 官网中以下语义是正确产品规则，必须保持：
   - “进入工作台 / 免费开写 / 开始免费创作” → `/app`（受登录保护）
   - “充值 Pro” → `/app/billing`（受登录保护）
   - “查看完整定价与额度 / 了解套餐详情 / 定价” → `/pricing`（公开说明页，**不应**强制跳登录）
   - Pricing 页中真正的 Pro CTA：未登录时 → `/login?next=%2Fapp%2Fbilling`。

## 允许修改的范围

1. `前端设计稿/grok/homepage-v2.html` 及其必要的同目录 README/design-review 文档；
2. `client/src/pages/BillingPage.tsx`；
3. 仅为本修复新增/修改最小的客户端测试文件；
4. 必要时更新 `.planning/progress.md`、`.planning/status.md` 与 `spec/CHANGELOG.md`，只追加本切片事实。

## 禁止修改

- `.env`、`client/.env`、任何密钥文件或支付配置；禁止输出/读取密钥内容。
- `server/src/**`、`supabase/**`、数据库迁移、RLS、支付/额度服务端逻辑、端口、Vite 配置、依赖、package lock、路由架构。
- 删除或重命名既有文件、全局重构、替换现有设计系统、git 操作、部署。

## 要做的工作

### A. 消除静态设计稿的错误跳转风险

在 `homepage-v2.html` 中集中定义设计稿专用的应用入口常量，例如 `APP_ORIGIN = 'http://localhost:5173'`，并让所有“进入真实应用”的 CTA 通过这一常量跳转到真实应用的绝对地址：`/app`、`/app/billing`、`/pricing`。

- 页内锚点（如 `#lab`、`#flow`、`#pricing`、`#faq`）保留相对页内跳转。
- 增加克制但可发现的“静态设计稿 / 不连接登录、支付或 Supabase”说明，避免用户把 `5175` 预览误认作真实应用。
- 不伪造任何支付成功，也不要把静态设计稿变成真正的结算页。
- 在设计稿 README 和 design-review 中写清：设计稿固定默认指向当前真实验证地址 `http://localhost:5173`；若将来端口变化，应仅修改这一处常量。

### B. 修正真实结算页的支付模式提示

在 `BillingPage.tsx` 中保留现有 endpoint 选择逻辑，不得改动 paymentMode 判断。只修正订单创建成功后的提示：

- `paymentMode === 'alipay_sandbox'`：显示“订单已创建，即将跳转到支付宝沙箱支付页…”；
- `paymentMode === 'mock'`：显示“订单已创建，即将跳转到模拟支付页面…”。

Pro 用户仍不得看到“升级到 Pro”按钮，不得能触发 checkout。

### C. 加入最小回归验证

新增或扩展客户端 Vitest 测试，覆盖：

1. 官网 CTA 路由矩阵：公开定价链接保持 `/pricing`，工作台/Pro 仍是既定受保护路径；
2. BillingPage：mock 与 sandbox 的订单创建成功提示不同；
3. BillingPage：Pro entitlement 时不呈现升级 CTA，不能触发 checkout。

不要通过字符串替换、删除旧测试或只做快照让测试“看似通过”。

## 验证与停点

运行：

```powershell
cd client
npx vitest run
npx tsc --noEmit
npm run build
```

再用本地浏览器/HTTP 做如下核验：

- `http://localhost:5173/` 的公开链接矩阵；
- 静态 `homepage-v2.html` 中所有真实应用 CTA 不再指向静态预览服务器；
- `GET http://localhost:5173/api/billing/plans` 的 `paymentMode` 只做观察，不改配置。

完成后立刻停止，报告：修改文件、每项测试结果、真实支付仍为 mock 的配置原因、没有改动的高风险范围。不要继续做任何新功能。
