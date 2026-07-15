# 生产上线门禁审计与执行计划 v2

> 日期：2026-07-14  
> 结论：当前版本是“本地测试通过、核心 SaaS 流程基本成型的 MVP”，**尚未达到生产发布条件**。本文件只记录审计与后续计划；本轮未部署、未切生产支付宝、未推送 Migration、未提交或推送 Git。

## 1. 本轮复验结论

### 已通过

- Client：27 个测试文件，353/353 通过。
- Server：22 个测试文件，509/509 通过。
- Client TypeScript + Vite production build 通过。
- Server TypeScript build 通过。
- Supabase 远端项目健康，区域为 `ap-northeast-1`（东京）。
- 支付代码已有沙箱下单、异步通知验签、订单/金额/AppID/Seller 校验、幂等入库、`trade.query` 补偿和“前端回跳不直接授予 Pro”的基础。

### 部署阻断项

| 编号 | 阻断项 | 当前证据 | 放行条件 |
| --- | --- | --- | --- |
| B1 | 支付宝沙箱真实 E2E 未完成 | 只有自动化和沙箱适配代码，没有真实付款→公网 notify→Pro 权益证据 | 用固定 staging 域名走完成功、取消、重复通知、错误签名、金额/AppID/Seller 不匹配、漏通知 query 补偿 |
| B2 | 生产支付宝被代码主动禁用 | `PAYMENT_MODE=production` 会 fail-closed | 单独开发并验收 production adapter/开关；取得生产 AppID、产品签约和生产密钥/证书后才允许开启 |
| B3 | 没有完整浏览器 E2E | Phase 0 仅有 Playwright smoke harness；完整业务 E2E 未建 | Phase 2 覆盖官网/Auth/工作台/额度/收藏/历史/管理员/结算/支付回跳 |
| B4 | Migration 历史漂移 | 本地 `20260714000000/000001` 不在远端；远端 `20260714052140/052414` 不在本地；**映射方案已出** | 授权后 rename 本地文件或 repair history，staging 从零重放（见 migration-drift-repair-plan） |
| B5 | 远端 Git 与发布基线缺失 | 当前无 Git remote，工作树有大量未提交变更，仓库仅 1 个基线 commit；**提交分组方案已出** | 用户确认后分组 commit、建 remote、release tag |
| B6 | 依赖安全门禁 | **Phase 0 已修复**：form-data 4.0.6、shell-quote 1.8.4、concurrently ^9.2.3；audit 0 vulns | 保持 overrides；禁止 audit fix --force |
| B7 | Supabase 安全门禁未收口 | Advisor 项仍在；**修复提案已出** | 开启 leaked password；确认 webhook grants；soft_delete 文档接受或收紧（需授权） |
| B8 | 生产环境与 Auth 邮件未验收 | 无 staging Supabase；Site URL/Redirect URLs/SMTP/邮件限频未做正式域名验证 | 独立 staging；正式域名完成注册确认、重置密码、回调、刷新会话、退出登录测试 |
| B9 | 托管与安全配置缺失 | 仅有 Netlify 配置；无 Vercel config/CI；服务端 `cors()` 仍需生产 allowlist | 部署配置、HTTPS、CORS allowlist、CSP、限频、错误监控、结构化日志和告警完成 |
| B10 | 运维闭环缺失 | 无备份恢复演练、回滚 runbook、支付对账/退款 SOP | staging 恢复演练、发布回滚、支付对账与异常订单人工处理流程留证 |

### 非阻断但应在首发前处理

- Client 主 bundle 约 812 KB，Vite 提示大于 500 KB；应按路由拆分管理员、历史、结算等低频页面。
- Supabase Performance Advisor：`payment_orders.plan_id` 缺覆盖索引；`user_feedback` 对 authenticated SELECT 有两条 permissive policy；若干索引尚未使用。首发前至少修复前两项，未使用索引在有真实流量后再判断。
- 根 `build` 脚本内部执行两次 `npm ci`，本地有运行中的 Vite 时会在 Windows 上产生原生模块 EPERM。CI 应拆为独立 `install -> test -> typecheck -> build`，构建脚本本身不再安装依赖。
- `supabase/config.toml` 缺失，本地 Supabase 无法直接 `db reset` 重放所有 migrations；需要补齐本地/staging harness。

## 2. 推荐生产架构

### 当前低成本基线：Vercel Hobby + Supabase Free

```text
用户浏览器
  └─ Vercel（同一项目 / 同一主域名）
      ├─ Vite React 静态前端
      └─ Express 5 API → Vercel Node Function（东京 hnd1）
           ├─ DeepSeek / 远端模型 API
           ├─ 支付宝 page.pay / notify / trade.query
           └─ Supabase 东京区（Auth + Postgres + RLS）
```

选择理由：

- Supabase 不绑定 Vercel；它是独立 Auth/Postgres 服务，Netlify、Vercel 或独立 Node 主机都能使用。
- 当前 Supabase 在东京；Vercel Function 放 `hnd1` 可减少 API 到数据库的跨区延迟。
- Vercel 已支持 Express 部署，当前 Express 可作为一个 Node Function；同域部署能减少 CORS 和回调地址复杂度。
- 当前按用户确认的“个人/非商业、低频内部试用”定位，先使用 Vercel Hobby 免费层；若后续成为正式业务系统、扩大团队协作或对外收费，应重新核对 Vercel 条款并迁移到 Pro。
- Supabase Free 当前允许 2 个 active projects，刚好可用于 1 个 staging + 1 个 production；但 Free 项目一周无活动会暂停，且没有自动备份，发布计划必须包含手工备份和唤醒检查。

### 切换到“Vercel 前端 + 独立常驻 API”的触发条件

若 staging 出现任一条件，则 Express 改部署到 Railway/Render/Fly/Cloud Run 等常驻 Node 服务，Vercel 只托管前端：

- 生成请求 P95 超过 240 秒，或需要超过 Vercel Function 时限。
- 后续实现长连接/SSE 且需要跨请求持续状态。
- 自部署 CantoneseLLM 4B 需要 GPU、固定内网或本机模型进程。
- 支付/生成需要常驻队列消费者，或函数冷启动影响不可接受。

## 3. 执行顺序

### Phase 0：冻结、整理与安全基线

1. 盘点当前 dirty worktree，按功能切片形成提交；创建远端 Git、`main`、`staging` 与 release tag。
2. 对齐 Supabase 本地/远端 migration history，并在新的 staging 项目从零重放。
3. 修复 high/critical 依赖；补齐 `.env.example` 的实际变量名（只放空值）。
4. 将 CI 拆成：`npm ci` → Client/Server test → typecheck → build → audit → migration dry-run。
5. 修复/处置 Supabase Advisor 警告并保存脱敏证据。

完成标准：干净工作树、可回滚 commit、迁移可从零重放、无未处置 high/critical、CI 全绿。

### Phase 1：Staging 基础设施

1. 建立独立 Supabase staging 项目；禁止 Vercel Preview 连接生产数据库。
2. 建立 Vercel Hobby 项目，以 Preview deployment 作为 staging；Function 先放东京，`maxDuration` 先设 300 秒并监控真实耗时。
3. 配置环境分层：Development、Preview/Staging、Production；服务端 secret 不得使用 `VITE_` 前缀。
4. 配置 Supabase Site URL、Redirect URLs、自定义 SMTP、CORS allowlist、CSP、限频、Sentry/日志告警。
5. 支付宝沙箱 `notify_url` 使用稳定 HTTPS staging API 地址，不再依赖临时 cloudflared URL。

完成标准：staging 可注册、确认邮箱、登录、生成、保存、管理员审阅，且生产数据完全隔离。

### Phase 2：E2E 与安全验收

Playwright 至少覆盖：

- 公开页：官网→定价→登录/注册→受保护路由 next 回跳。
- Auth：错误密码、未验证邮箱、确认邮箱、重置密码、刷新会话、退出。
- 核心工作台：生成 loading/进度、五平台结果、收藏/历史/配置/正反例、恢复工作台。
- 权益：Free 额度、收藏 10 条、历史 15 条、超限弹窗、Pro 解锁。
- RLS：用户 A 不能读写用户 B 的收藏、历史、案例、订单；普通用户不能进入管理员 API。
- 管理员：普通管理员与超级管理员的正文权限差异、审计日志。
- 支付：下单、取消、回跳 pending、已支付弹窗、重复 notify 幂等、query 补偿。

另做一轮低强度 k6/等价压测：登录、读取历史、生成并发、支付 notify；不得直接压生产。

完成标准：E2E 全绿，严格证据包含浏览器、API、数据库三侧状态；无跨用户数据泄漏。

### Phase 3：真实支付宝商家支付

1. 先确认 MVP 计费模型：建议首发使用“19 元购买 30 天 Pro、用户手动续费”，不宣称自动续费；自动续费需另行签约商家扣款产品和单独合规/取消订阅设计。
2. 商户侧完成电脑网站支付签约，准备生产 AppID、Seller/PID、RSA2 密钥或证书、正式域名与商品/套餐说明。
3. 新增 production payment adapter，保留 `mock` / `alipay_sandbox` / `production` 三环境硬隔离；生产开关默认关闭。
4. 服务端固定套餐金额；验签后校验 `out_trade_no`、`total_amount`、`app_id`、`seller_id`、`trade_status`；重复通知必须幂等。
5. 实现订单关闭/过期、退款、退款查询、每日对账与异常人工处理；前端回跳只展示状态，不授予权益。
6. 沙箱全场景通过后，在生产以最小金额/真实 19 元订单进行一次人工 canary；核对订单、订阅、额度、审计、退款与对账。

完成标准：生产 checklist 全通过，并由用户再次明确授权打开生产支付开关。

### Phase 4：预览、生产与灰度

1. PR 自动生成 Vercel Preview；staging E2E 通过后，将同一构建产物 promote 到 production。
2. 第一阶段上线官网/Auth/工作台，生产支付保持关闭。
3. 完成生产小额支付与退款演练后，再灰度打开支付入口。
4. 首周每日检查 Auth 邮件送达、生成失败率、支付回调成功率、quota reserve 失败率、订单/Pro 权益对账。
5. 预置一键回滚到上一 Vercel deployment；数据库 migration 使用 forward-fix，不对有用户写入的数据做盲目回滚。

## 4. 环境变量分层（只列名称）

### Browser 可见

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL`（若前后端不同域）

### Server only

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- 模型服务 keys
- `PAYMENT_MODE`
- `ALIPAY_APP_ID`
- `ALIPAY_SELLER_ID`
- `ALIPAY_PRIVATE_KEY` 或受控文件/secret mount
- `ALIPAY_PUBLIC_KEY` 或证书链
- `APP_PUBLIC_URL`
- `ALIPAY_RETURN_URL`
- `ALIPAY_NOTIFY_URL`
- `SERVERCHAN_SENDKEY`
- 监控、限频与内部任务所需 secret

## 5. 下一任务建议

下一轮不应直接部署生产。建议交给 Grok Build 的第一项任务为 **Phase 0：发布基线与 migration 漂移修复**；完成后由 Codex 做独立验收，再进入 staging 和 Playwright E2E。任何 Migration 修复、线上环境创建、生产支付或生产部署仍需单独授权。

## 6. 2026-07-15 checkpoint

- B4 已关闭：本地文件名已对齐，`migration list --linked` 显示 15/15 local/remote version 一致，无需 `migration repair`。
- B5 已关闭：Git remote 已建立，`master` 已推送至 `betsey77/77HK`；GitHub Actions `29403089055` 全绿。
- B6 已保持关闭：production/full audit 均为 0 vulnerabilities。
- 前端大 chunk 已处理：主入口降至约 471 kB，Vite 500 kB 警告消失。
- Phase 0 CI 已完成：新增只读 GitHub Actions workflow 和 Supabase local config；Client 400/400、Server 571/571、双端 typecheck/build 与两次 audit 在线通过。
- 仍未关闭：独立 staging 从零重放、完整浏览器 E2E、Auth 邮件、支付宝 sandbox 真实闭环、监控/备份/回滚与生产部署。
