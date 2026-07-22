# Vercel Hobby Preview 就绪清单

日期：2026-07-16  
状态：本地配置已准备，**未部署**。

## 结论

首个 Preview 使用两个 Vercel Hobby 项目：

| 项目 | Root Directory | 用途 |
| --- | --- | --- |
| Frontend | `client` | Vite 静态 SPA |
| API | `server` | Express Function，Tokyo `hnd1` |

Vercel Hobby Fluid Compute 当前默认和上限为 300 秒。`server/vercel.json` 仅指定 `hnd1`，由 Vercel 官方 Express 零配置入口发现 `src/app.ts`；不得增加只匹配 `api/` 目录的 `functions["src/app.ts"]`。第一版必须配置 DeepSeek V4 Flash，使用 `REQUIRE_REAL_MODEL=true`、mock 支付和已验收的 staging Supabase；不配置自部署粤语模型，rules fallback 不计为成功。

官方依据：

- [Express on Vercel](https://vercel.com/kb/guide/ship-a-express-app-on-vercel)
- [Function duration](https://vercel.com/docs/functions/configuring-functions/duration)
- [Function regions](https://vercel.com/docs/functions/configuring-functions/region)
- [Preview environments](https://vercel.com/docs/deployments/environments)

## 环境变量

所有值只在 Vercel Dashboard 的 **Preview** 环境填写，不写入仓库或聊天。

### Frontend 必填

| Name | 值类型 |
| --- | --- |
| `VITE_SUPABASE_URL` | staging Supabase URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | staging publishable key |
| `VITE_API_BASE_URL` | 稳定 API Preview origin，无尾斜杠 |

### API 必填

| Name | 值类型 |
| --- | --- |
| `SUPABASE_URL` | staging Supabase URL |
| `SUPABASE_PUBLISHABLE_KEY` | staging publishable key |
| `SUPABASE_SECRET_KEY` | staging secret，标记为 Sensitive |
| `ALLOWED_ORIGINS` | 精确 Frontend Preview origin |
| `PAYMENT_MODE` | `mock` |
| `APP_FRONTEND_URL` | Frontend Preview origin |
| `APP_API_URL` | API Preview origin |
| `DEEPSEEK_API_KEY` | DeepSeek 服务端密钥，标记为 Sensitive |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` |
| `REQUIRE_REAL_MODEL` | `true` |

代码对 V4 调用统一设置 `thinking=disabled`。V4 默认开启 thinking；结构化文案链路关闭它以避免推理 token 挤占 JSON 正文，并缩短 Hobby 函数耗时。

### 第一版明确不填

- `CANTONESE_*`、`FEATHERLESS_*`、`HF_*`、`OPENROUTER_*`；
- `YOUTUBE_API_KEY`、`META_ACCESS_TOKEN`、代理变量；
- `SERVERCHAN_*`；
- 全部 `ALIPAY_*`。

不得把任何服务端 secret 放进 `VITE_*`。DeepSeek API 按 token 产生独立费用；Preview 使用现有服务端密钥并限制为内部团队。

## URL 配置顺序

实际部署需再次获得明确授权，并使用非生产 Preview 分支：

1. 创建/连接 API 项目，Root=`server`，先得到稳定的分支 Preview origin。
2. 给 Frontend Preview 配置 `VITE_API_BASE_URL`，部署 Root=`client`。
3. 得到 Frontend 稳定分支 origin 后，给 API 配置 `ALLOWED_ORIGINS`、`APP_FRONTEND_URL`、`APP_API_URL` 并重新部署。
4. 在 staging Supabase Auth Redirect URLs 增加 Frontend Preview 的 `/auth/callback` 和 `/reset-password`；不删除 localhost 回调。
5. 使用稳定分支 URL，不把每次变化的 commit URL写入 CORS 或 Auth。

`VITE_*` 是构建时变量，修改后必须重新构建 Frontend。API 环境变量修改后必须重新部署 API。

## Preview 验收

1. `/`、`/pricing`、`/login` 和受保护路由返回正常，无 SPA 404。
2. `GET {API}/api/health` 返回 200，响应不含 secret。
3. Frontend origin 的 CORS 通过；其他 Origin 被拒绝。
4. staging 邮箱登录、退出、密码重置、owner RLS 与管理员入口正常。
5. 真实模型生成完成，记录 `generationEngine=deepseek`；任何 `generationEngine=rules` 都判定失败。
6. mock 结算回跳 Frontend Preview，不出现 localhost。
7. 浏览器 bundle、Network、Vercel logs 和截图无 secret/JWT/cookie。

## 停止条件

- 任一项目连接 production Supabase；
- Vercel 操作将创建 Production deployment；
- 需要通配 `*.vercel.app` CORS 或宽泛 Auth 回调；
- 真实模型请求超过应用 51 秒预算或出现静默 rules fallback；
- 需要配置支付宝 key、生产域名或真实收款。

模型链路需要稳定超过当前同步请求设计时，后续单独评估流式响应、常驻 worker/队列或 Vercel Pro 扩展时长，不在本切片处理。
