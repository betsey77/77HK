# 2026-07-14 部署就绪审计与上线计划

> 结论：当前版本是“本地可运行、可回归验证的 SaaS MVP”，**不是可直接生产上线版本**。本文件只记录审计与计划；没有执行部署、迁移、真实支付、密钥修改或 Git 推送。

## 本次审计证据

| 检查项 | 结果 |
| --- | --- |
| 客户端全量回归 | 27 个测试文件，353/353 通过；TypeScript 检查、生产构建通过 |
| 服务端全量回归 | 22 个测试文件，509/509 通过；TypeScript 检查、生产构建通过 |
| 敏感文件 | .env 未被 Git 跟踪；.env.example 中敏感字段为空 |
| 依赖审计 | Client 生产依赖 0；root/server 各有 1 个 high：传递依赖 form-data@4.0.5（来自 alipay-sdk/openai/superagent 链）；上线前必须先通过受控升级或风险处置关闭 |
| 现有托管配置 | 仓库只有 Netlify 配置，没有 Vercel 配置；当前 Express API 没有生产托管配置 |

## 已具备的基础

- Supabase Auth、用户数据隔离/RLS、额度、收藏、历史、后台审阅与审计的实现和自动化回归基础。
- 支付宝**沙箱前置代码**：电脑网站支付下单、异步通知验签、幂等订单处理与 trade.query 兜底；同步回跳不直接授予 Pro 权益。
- 真实生产私钥没有进入浏览器代码；支付密钥由服务端配置加载。

## 上线阻断项

1. **真实支付宝沙箱 E2E 未完成。** 必须实际走一次“登录 → 创建订单 → 支付 → 外网 notify_url → 验签/幂等入库 → Pro 权益 → 成功页”的闭环，并保存脱敏证据。
2. **生产支付尚不能开启。** 当前 PAYMENT_MODE=production 被代码明确禁止；这符合现阶段安全门禁。生产 AppID、产品签约、生产证书/密钥、退款与对账策略尚未经过专门切片和用户授权。
3. **生产域名与安全边界未完成。** APP_PUBLIC_URL、ALIPAY_RETURN_URL、ALIPAY_NOTIFY_URL 仍待配置；服务端当前为宽松 cors()，生产需改为显式来源 allowlist、HTTPS、CSP、错误监控与速率限制复核。
4. **认证生产化未完成。** Supabase 的 Site URL、生产/预览 Redirect URLs、确认邮件/密码重置邮件送达与限频恢复，需要在正式域名上人工验收；生产应使用可控 SMTP 发件服务。
5. **交付基础设施未完成。** 没有 staging/production 双环境、CI、迁移发布管道、备份恢复演练、告警、日志留存与回滚 runbook。
6. **依赖安全门禁未通过。** form-data high 漏洞必须在单独依赖升级切片中定位可升级上游并回归；不得在生产前以忽略审计代替修复/处置。

## 推荐部署架构

浏览器
  ├─ 前端静态站点：Vercel（预览 + 生产）
  ├─ API：现有 Express，部署到常驻 Node 托管（先不改写为 serverless）
  │     └─ /api/billing/notify 对支付宝公网开放
  └─ Supabase：Auth + Postgres + RLS

### 为什么不是“Supabase 只能配 Vercel”

Supabase 与 Vercel 的预览环境、环境变量和 Auth Redirect URL 能很好配合，但它们是可组合的服务，不是绑定关系。Vercel 可以运行 Express，但现有服务依赖公开 webhook、订单协调与持续的 Node 行为；第一版更稳妥的选择是 **Vercel 托管前端 + 独立常驻 Express API 托管**。待真实沙箱 E2E 和压测通过后，再单独评估是否迁移为 Vercel Functions 或 Supabase Edge Functions。

对于以中国大陆用户和支付宝 PC 支付为主的商业站点，还要在选定域名和托管区域后核对支付宝产品的商户/网站要求、可达性及备案要求；不要假设 Vercel 自动满足这些条件。

## 分阶段执行计划（每阶段独立授权）

### P0：上线前准备与安全修复

- 创建 Git 远端和受保护的 main/staging 分支；现有本地工作树先由用户确认后再提交。
- 单独处理 form-data high 漏洞：确定上游兼容升级路径，运行全量回归，不接受盲目 npm audit fix --force。
- 明确数据备份、恢复目标、日志留存、退款/取消订阅规则、隐私与服务条款。
- 建立环境变量清单：前端只放 publishable 值；Supabase secret/service-role 和支付宝私钥只在服务端/密钥管理中保存。

验收：依赖审计无未处置 critical/high；密钥扫描无泄露；回滚和事故联系人文档已就绪。

### P1：支付宝真实沙箱 E2E（先于生产支付）

- 固定一个可公开访问的 staging API 域名与 HTTPS notify_url，不得使用会过期的临时隧道作为正式回调。
- 以 alipay_sandbox 模式验证：成功、取消、重复 notify、错误签名、金额/AppID/Seller 不匹配、notify 未到而 query 补偿、已是 Pro 用户拦截下单、订单初始化失败。
- 验证回跳页面只展示状态，只有 webhook 或 trade.query 才能授予权益；核对订单、订阅、审计记录和管理员展示一致。

验收：每个场景有脱敏请求/数据库状态/浏览器证据；不产生生产交易。

### P2：真实商家支付准备

- 用户完成支付宝电脑网站支付产品签约，并确认网站主体、域名、商品/套餐展示、生产 AppID、生产密钥或证书模式。
- 新建“生产支付开关”切片：生产网关、证书、订单过期/关闭、退款、对账、异常人工处理；保留 Mock 与 sandbox 的隔离。
- 不复用沙箱密钥；由密钥管理/托管平台的生产环境变量注入；前端不得读取任何私钥。

验收：生产支付 checklist 全部通过；用户明确批准生产支付开关。

### P3：Staging 与预览部署

- 建立独立 Supabase staging 项目（或正式启用 Branching），不要用生产数据库测试迁移。
- 前端部署到 Vercel Preview；Express API 部署到 staging 常驻 Node 服务；配置严格 CORS、HTTPS、CSP、可信 APP_PUBLIC_URL/支付宝回调 URL。
- Supabase 配置 staging/production Site URL 与 Redirect URLs，验证注册确认、重置密码、登录退出和刷新会话。
- 用 CI 在合并前运行 client/server 测试、类型检查、构建、依赖审计与迁移 dry-run；生产 migration 仅由批准的 CI 身份执行。

验收：一条预览部署可完整演示核心生成、登录、额度、后台和沙箱支付；失败可回滚到前一版本。

### P4：生产灰度上线

- 先发布官网、登录与核心生成；支付生产开关默认关闭，完成生产付款小额人工验收后再逐步打开。
- 接入错误监控、结构化日志和支付/登录/生成失败告警；每天对账支付订单和 Pro 权益。
- 记录发布版本、数据库 migration、环境变量变更人和回滚步骤；首周每日检查 auth 邮件送达率、支付回调成功率和 quota 失败率。

## 官方依据

- 支付宝电脑网站支付要求使用服务端下单；以异步通知或交易查询确认结果，并对通知验签、校验订单与金额、幂等处理：https://ideservice.alipay.com/cms/site/0iztfv
- Supabase Auth 的生产 Site URL 与 Redirect URLs 对确认邮件/重置密码至关重要；生产建议使用精确 URL：https://supabase.com/docs/guides/auth/redirect-urls
- Supabase 推荐开发、staging、production 分环境，并建议通过 CI/CD 发布生产 migration：https://supabase.com/docs/guides/deployment/managing-environments
- Vercel 可部署 Express，但需要适配 serverless 的运行边界；是否迁移应作为独立架构切片：https://examples.vercel.com/kb/guide/using-express-with-vercel
