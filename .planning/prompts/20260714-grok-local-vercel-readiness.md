# 本地部署适配切片：官网滚动证据 + 双项目 Vercel Hobby readiness

项目：`D:\work\77港话通社媒文案\77`

## 背景与已确认事实

- React 19 + Vite 前端位于 `client/`；Express 5 后端位于 `server/`。
- 本轮只做本地配置与代码适配，不执行 Vercel/Netlify/Render/Cloudflare 部署，不写远端 Supabase，不改 Migration，不切支付宝生产模式。
- `homepage-smoke.png` 下半部分为空是 `IntersectionObserver` reveal 未经真实滚动触发；真实分段滚动后 29/29 节点激活，页面内容完整。
- 部署基线选“两项目 Vercel”：前端项目 Root Directory=`client`；API 项目 Root Directory=`server`。原因：Express 官方零配置支持，Hobby Fluid Compute 300s，适合等待外部 AI；东京 region 靠近现有 Supabase Tokyo。
- 该方案只用于当前用户确认的个人/非商业内部试用及支付宝 sandbox。真实商户收款前必须重新审查 Vercel 商业使用条款。

## 本轮目标

### A. 官网滚动 smoke（先测试）

更新 `e2e/smoke.spec.ts`：

1. 保留公开首页 HTTP/正文 smoke。
2. 新增或扩展真实分段滚动检查：滚动覆盖完整页面后，所有 `[data-reveal]` 节点均应拥有 `is-in`，且 computed opacity 不为 0。
3. 不使用精确节点数量 29 作为硬编码，只要求总数 > 0 且 activated === total、hidden === 0。
4. 运行 `npm run test:e2e:smoke`；不得以 skip 代替失败。

### B. 前端可配置 API origin（TDD）

当前多个文件把 `/api` 写死。建立一个最小共享 helper（例如 `client/src/services/apiBase.ts`）：

- 未设置 `VITE_API_BASE_URL` 时保持现有 `/api/...`，现有本地测试不能回归。
- 设置 `VITE_API_BASE_URL=https://api.example.com` 时输出 `https://api.example.com/api/...`。
- 如果值已经以 `/api` 结尾，不重复拼接。
- 去除多余尾斜杠；path 必须稳定处理前导 `/`。
- 禁止把任何 secret 放进 `VITE_` 变量。

把所有运行时代码中的 API fetch 统一改用该 helper，包括但不限于：

- `client/src/services/api.ts`
- `client/src/services/cloudSync.ts`
- `client/src/services/caseLibraryApi.ts`
- Billing/BillingResult 页面
- Feedback、Inspiration、PersonaManager、ConsumerFeedback、ResultsPanel 中的直接 `/api` fetch

测试默认相对 URL不变，并新增 helper 的独立测试。

### C. 后端 CORS 显式配置（TDD）

当前 `app.use(cors())` 过宽。做最小配置：

- 新增空值环境变量契约 `ALLOWED_ORIGINS=`，逗号分隔、严格 exact origin。
- 本地默认允许常用开发源：`http://localhost:5173`、`http://127.0.0.1:5173`；如现有测试依赖无 Origin 请求，无 Origin 的服务器到服务器/支付宝 webhook 请求应允许。
- 生产/Preview 通过 `ALLOWED_ORIGINS` 显式加入前端 URL，不要默认放行任意 `*.vercel.app`。
- 被拒 Origin 必须得到可识别 CORS 失败，不得泄露密钥。
- 添加服务端行为测试：允许 origin、拒绝 origin、无 Origin webhook/server-to-server。

不要借机大改 middleware。

### D. 支付回跳/通知分域（TDD）

目前 `APP_PUBLIC_URL` 同时拼 return 与 notify。增加兼容性变量：

- `APP_FRONTEND_URL=`：用于 `/billing/success`
- `APP_API_URL=`：用于 `/api/billing/alipay/notify`
- 显式 `ALIPAY_RETURN_URL` / `ALIPAY_NOTIFY_URL` 优先级最高。
- 旧 `APP_PUBLIC_URL` 继续作为兼容 fallback。
- 本地 fallback 保持 5173/3001。
- sandbox 缺少相应 frontend/API 配置时 fail closed，并给出正确变量名提示。

补服务端测试证明前后端不同 origin 时分别生成正确 URL。不得改变“同步回跳不授予 Pro；只信 webhook/query”的安全规则。

### E. 本地 Vercel 配置，不部署

1. `client/vercel.json`：Vite SPA deep-link fallback，确保静态 assets 不被错误改写。
2. `server/vercel.json`：Express Node function，Tokyo `hnd1`，maxDuration 300；配置必须符合当前 Vercel Express/Functions 规范。
3. 不硬编码任何实际项目 URL、token、Supabase key 或支付宝 key。
4. 写 `docs/release/2026-07-14-hosting-platform-decision.md`：
   - Vercel Hobby（当前 sandbox/internal primary）
   - Netlify Free（300 credits/月、同步函数 60s，现有 adapter，fallback）
   - Render Free（15 分钟休眠、约 1 分钟唤醒，不适合支付 webhook）
   - Cloudflare Workers Free（100k/day、10ms CPU、128MB、需 Express/Alipay SDK 改造）
   - Railway Free（约 $1 credit/月，仅实验）
   - 明确真实支付宝商户收款会触发商业托管重新决策。
5. 写 `docs/release/2026-07-14-vercel-two-project-setup.md`，只列 Dashboard 配置与空变量清单，不执行命令、不包含真实值。

### F. 文档与证据

- 更新 `.env.example`（全部空值）。
- 更新 `spec/SDD.md`、`spec/TEST_PLAN.md`、`spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`、`.planning/status.md`、`.planning/progress.md`。
- 新建 `docs/evidence/2026-07-14/local-vercel-readiness/verification.md`，记录命令结果，不写 secret。

## 验收命令

1. `npm run test:e2e:smoke`
2. 新增/相关 client tests
3. 新增/相关 server tests
4. `npm run verify`
5. 校验两个 `vercel.json` 为合法 JSON
6. 常见 secret/private-key pattern 扫描本轮新增配置与 evidence，应无匹配

## 严格禁止

- 禁止运行 `vercel`、`netlify deploy`、`render`、`wrangler deploy`。
- 禁止安装新 CLI/依赖（本轮不需要）。
- 禁止 `supabase db push` / migration repair / 远端 SQL。
- 禁止读取、打印、复制真实 `.env`、Supabase secret、支付宝 key、Server酱 sendkey。
- 禁止 git commit/push、删除用户文件、大范围重构。
- 禁止修改收费规则、套餐额度、RLS、管理员权限或生成 Prompt。

完成本切片后输出改动文件、测试数字、未完成项，然后停止。
