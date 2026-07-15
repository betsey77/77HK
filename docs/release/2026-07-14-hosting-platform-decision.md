# 2026-07-14 托管平台决策（本地 readiness，未部署）

> 本文件只记录决策与边界。**未**执行 `vercel` / `netlify deploy` / `render` / `wrangler`，未购买付费服务，未写入远端。

## 当前主选：两项目 Vercel Hobby（sandbox / 内部试用）

| 项目 | Root Directory | 用途 |
| --- | --- | --- |
| Frontend | `client` | Vite 静态 SPA |
| API | `server` | Express Node Function（Fluid Compute） |

**选择理由（用户已确认）：**

- Express 官方零配置路径成熟；仓库已有 `serverless-http` 与 Netlify adapter，Vercel 侧用默认 export Express app。
- Hobby Fluid Compute **maxDuration 300s**，适合等待外部 AI（生成链路可能较长）。
- Region **`hnd1`（东京）**，靠近现有 Supabase Tokyo。
- 前后端分项目，便于分别配置 `VITE_*`（仅 publishable）与服务端密钥。

**适用范围（硬边界）：**

- 仅用于当前用户确认的 **个人 / 非商业内部试用** 与 **支付宝 sandbox**。
- **真实商户收款前必须重新审查 Vercel 商业使用条款** 与托管选型；不得默认认为 Hobby 可承载商业收款。

配置清单见：`docs/release/2026-07-14-vercel-two-project-setup.md`。  
本地配置文件：`client/vercel.json`、`server/vercel.json`（无真实 URL/token）。

---

## 备选与否决原因

### Netlify Free — Fallback

- 仓库已有 `netlify.toml` + `netlify/functions/api.mjs`（serverless-http）。
- Free：**约 300 credits/月**；同步函数默认超时 **60s**，长 AI 生成更容易撞墙。
- 适合作为短时预览或静态+轻 API 的 fallback，不作为当前 AI 生成主路径首选。

### Render Free — 不适合支付 webhook 主路径

- Web Service Free：**约 15 分钟无流量休眠**，冷启动约 **1 分钟**。
- 支付宝异步 notify 在休眠窗口可能超时/失败；订单补偿依赖 query 虽存在，但不宜作为生产/沙箱主回调通道。
- 可作实验性常驻对比，不作为当前支付回调基线。

### Cloudflare Workers Free — 需改造

- Free 量级约 **100k req/day**、**10ms CPU**（付费更高）、**128MB** 内存量级限制（以官方当前文档为准）。
- 现有 Express + `alipay-sdk` + 较长 Node 计算路径 **不能零改动**上 Workers；需独立 adapter 切片。
- 本轮不做。

### Railway Free — 仅实验

- 约 **$1 credit/月** 级别试用额度，不稳定作为团队基线。
- 仅实验用途；不纳入当前 sandbox 主路径。

---

## 真实支付宝商户收款触发条件

当出现以下任一情况，必须 **停止沿用 Hobby 内部试用假设**，单独做商业托管与合规决策：

1. 切换 `PAYMENT_MODE` 生产适配器 / 真实商户 AppID。
2. 面向付费客户公开放量收款。
3. 需要 SLA、发票、合同主体与备案/支付产品网站要求。

届时重新评估：Vercel 商业计划、常驻 Node（Render/Fly/自有 VPS）、域名与 CORS/CSP、监控与回滚。

---

## 本轮已落地（代码/文档 only）

- 前端 `VITE_API_BASE_URL` + `apiUrl()` 统一请求源。
- 后端 `ALLOWED_ORIGINS` 显式 CORS；无 Origin 的 webhook/S2S 允许。
- 支付 `APP_FRONTEND_URL` / `APP_API_URL` 分域 + `ALIPAY_*` 优先 + `APP_PUBLIC_URL` 兼容。
- `client/vercel.json` SPA fallback；`server/vercel.json` Express entry `src/app.ts`、region `hnd1`、`functions.maxDuration: 300`（无 legacy builds/memory）。
- 官网 Playwright smoke 含真实分段滚动 reveal。

**未做：** 部署、migration、真实密钥配置、真实支付宝 E2E、git commit/push。
