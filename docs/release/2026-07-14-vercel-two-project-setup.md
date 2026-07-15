# 2026-07-14 两项目 Vercel Dashboard 配置清单（不执行部署）

> 仅清单。**不要**在本文粘贴真实 URL、token、私钥、Supabase secret 或支付宝 key。  
> **不要**在本切片运行 `vercel` CLI。由人工在 Dashboard 创建项目并粘贴空变量名对应的真实值。

## 项目 A — Frontend

| 字段 | 建议值 |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | `client` |
| Build Command | `npm run build`（或 monorepo 约定的 client build） |
| Output Directory | `dist` |
| Install Command | 按 monorepo 需要（根 `npm ci` 或 client 目录） |
| Node | 与本地一致的 LTS |

### Frontend Environment Variables（值由人工填写，此处仅名）

| Name | 说明 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase 项目 URL（publishable 侧） |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 浏览器可公开的 publishable key |
| `VITE_API_BASE_URL` | API 项目公网 origin（**不要**尾斜杠；不要密钥）。未分域本地可空 |

**禁止**放入任何 `VITE_` 变量：`SUPABASE_SECRET_KEY`、支付宝私钥/公钥、Server酱 SendKey。

### Frontend 本地配置文件

- `client/vercel.json`：SPA deep-link fallback 到 `index.html`。  
  Vercel 对**已存在的静态文件**（如 `/assets/*`、`/brand/*`）优先直接响应，再应用 rewrite。

---

## 项目 B — API

| 字段 | 建议值 |
| --- | --- |
| Framework | Other / Node |
| Root Directory | `server` |
| Entry | `src/app.ts` default export Express app（Vercel 零配置识别） |
| Region | **Tokyo `hnd1`** |
| maxDuration | **300**（Hobby Fluid Compute） |

### API Environment Variables（空名清单）

#### 模型 / 出站

- `CANTONESE_API_URL`
- `CANTONESE_API_KEY`
- `FEATHERLESS_API_KEY`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`
- `HF_API_KEY` / `HF_MODEL`（可选）
- `OPENROUTER_API_KEY`（可选）
- `YOUTUBE_API_KEY`（可选）
- `META_ACCESS_TOKEN`（可选）
- `HTTPS_PROXY` / `HTTP_PROXY`（可选）

#### Supabase（仅服务端）

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`（或 `SUPABASE_SECRET_KEY_FILE` 指针；Dashboard 直填 secret 即可）

#### CORS

- `ALLOWED_ORIGINS`  
  例：逗号分隔**完整 Origin**（协议+主机+端口），如前端生产 URL 与 Preview URL。  
  **不要**写 `*.vercel.app`。本地默认已覆盖 `localhost:5173` / `127.0.0.1:5173`（仅当此变量为空时）。

#### 支付（sandbox）

- `PAYMENT_MODE`（sandbox 填 `alipay_sandbox`；勿在未授权时用 production）
- `ALIPAY_APP_ID`
- `ALIPAY_SELLER_ID`
- `ALIPAY_PRIVATE_KEY` / `ALIPAY_PUBLIC_KEY`（或 file 指针变量，若部署环境支持）
- `APP_FRONTEND_URL` — 前端项目公网 origin（拼 `/billing/success`）
- `APP_API_URL` — 本 API 项目公网 origin（拼 `/api/billing/alipay/notify`）
- `APP_PUBLIC_URL` — 兼容旧单域名（可选）
- `ALIPAY_RETURN_URL` / `ALIPAY_NOTIFY_URL` — 完整 URL 覆盖（最高优先，可选）

#### 其他

- `SERVERCHAN_SENDKEY`（可选，反馈通知）
- `PORT`（Vercel 通常不需要）

### API 本地配置文件

- `server/vercel.json`：`$schema` + `regions: ["hnd1"]` + `functions["src/app.ts"].maxDuration: 300`（无 legacy `builds`/`routes`/文件内 `memory`）

---

## Supabase Auth 回调（人工 Dashboard）

在 Supabase Auth URL 配置中加入（值由部署后填写）：

- Site URL → 前端生产 origin
- Redirect URLs → 前端 `/auth/callback`、重置密码路径、Preview origin（如需要）

---

## 部署后 smoke（人工，本切片不执行）

1. 打开前端 `/`：HTTP <500，滚动后内容可见。  
2. `GET {API}/api/health`：200，不返回密钥。  
3. 浏览器跨域：前端 origin 在 `ALLOWED_ORIGINS` 内；错误 Origin 被 CORS 拒绝。  
4. 沙箱支付：return 到前端 success 页；notify 打到 API；**同步回跳不授予 Pro**。

---

## 明确未做

- 未创建 Vercel 项目、未 `vercel deploy`、未绑定域名。  
- 未配置真实环境变量值。  
- 未改支付宝生产模式、未 migration、未 git push。
