# 77 港话通：下一 Codex 会话交接（2026-07-15）

> 入口目录：`D:\work\77港话通社媒文案\77`。先读本文件，再读 `README.md`、`.planning/status.md` 与相关 spec 小节；不要重新扫描全部聊天历史。

## 1. 项目目标

香港粤语社媒文案 SaaS：普通话/书面中文输入 → 原文诊断 → 5 个港式平台变体 → 质量审核 → 消费者模拟反馈；同时具备公开邮箱账户、云端收藏/配置/历史、额度、支付宝支付、团队分组审核与管理员后台。

## 2. 当前目录结构

```text
77/
├─ client/                 React 19 + TypeScript + Tailwind v4 + Vite
├─ server/                 Express 5 + OpenAI SDK + DeepSeek/本地模型/规则兜底
├─ supabase/migrations/    权威数据库迁移
├─ spec/                   PRD / SDD / TEST_PLAN / ACCEPTANCE / CHANGELOG
├─ docs/                   设计、证据、运维、release、handoff、资源
├─ e2e/                    Playwright smoke
├─ .planning/              状态、任务、上下文包、代理 prompt
└─ package.json            双端 test/typecheck/build 统一入口
```

本地默认：官网/工作台 `http://localhost:5173`，API `http://localhost:3001/api`。交接时两个端口均未运行。

## 3. 已完成功能

- 官网、登录/注册/忘记密码、Supabase Auth 邮箱确认、受保护 `/app`。
- 工作台：诊断、5 变体、审核评分、消费者反馈、复制/Diff、终端式生成进度。
- 收藏库、配置管理、生成历史恢复、检索/分页/批量删除、Free 容量限制。
- 正反例案例库与 Prompt 注入；参考高评分收藏案例与话题日历注入。
- Free/Pro 额度、支付宝 sandbox checkout/notify/reconcile、支付结果页；Pro 权益只由异步通知或服务端查单确认。
- 用户反馈 + Server酱 Turbo；管理员用户/生成/反馈/订阅/收藏/审计界面。
- `review_group` 隔离：普通管理员仅审核同组，超级管理员可跨组。
- R2：用户可直接编辑收藏正文；内容改变后旧审核/句子批注失效并显示“修改后待审核”。管理员可选中句子批注，用户收藏库红色高亮显示。
- R2 Migration `20260714190200_r2_inline_review_favorite_edit.sql` 已于 2026-07-15 推送至 Supabase 项目 `qiotocumkbwckiezuptr`；列、trigger、RPC ACL 已复核。
- 最近自动化：Client 370/370、Server 554/554、双端 typecheck/build 通过。

## 4. 正在开发/待人工验收

- R2 代码与数据库已完成，但尚未在浏览器人工走通：编辑收藏 → 管理员“修改后待审核” → 句子批注 → 用户刷新查看高亮。
- 尚未生产部署；Vercel/独立 API 方案仅有 readiness 文档。
- 支付宝仍为 sandbox 配置，真实商家生产参数、生产回调域名和真实支付 E2E 未完成。
- 下列 2026-07-15 新需求已写入 PRD/TEST_PLAN/CHANGELOG/task plan，**尚未实现**。

## 5. 关键技术与安全边界

- Client：React 19、TypeScript 5.7、Tailwind v4、Vite 6；单 `AppContext/useReducer` + owner-scoped localStorage/Supabase sync。
- Server：Express 5；DeepSeek 主力、自部署 CantoneseLLM、rules fallback。
- 数据：Supabase Auth/Postgres/RLS；前端只能使用 publishable key，secret/service role 仅后端。
- 管理员：角色 + `profiles.review_group` 双重校验；正文访问需审计，审核写入使用 service-role-only 原子 RPC。
- 支付：后端 `checkNotifySignV2` 先校验支付宝异步通知签名，签名失败零数据库写入；同步 return URL 不能授予 Pro。
- R2 文本批注使用 Unicode code-point offset + quotedText 校验，避免 emoji 位置错位和旧锚点误标。

## 6. 重要文件

- 产品/架构：`spec/PRD.md`、`spec/SDD.md`、`spec/TEST_PLAN.md`、`docs/comprehensive-spec-v2.md`。
- 设计规范：`docs/design-system.md`。
- 收藏/R2 UI：`client/src/components/favorites/FavoritesPanel.tsx`。
- 管理员审核：`client/src/pages/AdminPage.tsx`、`server/src/routes/admin.ts`、`server/src/services/adminService.ts`。
- 云同步：`client/src/services/cloudSync.ts`、`server/src/routes/sync.ts`、`server/src/services/cloudSyncService.ts`。
- 支付：`server/src/routes/billing.ts`、`server/src/services/alipayAdapter.ts`、`server/src/services/alipayService.ts`、`client/src/pages/BillingPage.tsx`。
- R2 Migration：`supabase/migrations/20260714190200_r2_inline_review_favorite_edit.sql`。
- R2 证据：`docs/evidence/2026-07-14/r2-inline-review-and-favorite-edit/verification.md`。
- 团队版二维码素材：`docs/assets/wechat-team-contact-qr.png`。
- 管理员分组操作：`docs/admin/review-group-management.md`。

密钥只引用位置，禁止读取后写入聊天、日志或仓库：

- Supabase secret：`D:\API\Supabase\77\SUPABASE_SECRET_KEY.txt`
- 支付宝 sandbox：`D:\API\Alipay\77`
- Server酱：`D:\API\微信推送\sendkey.txt`

## 7. 已知问题与踩坑

- Git 当前 `master@857a5ff`，工作区极脏：约 80 个 tracked modified、107 个 untracked；未 commit/push。不要 reset/clean。新 worktree 只包含 HEAD，**不会包含这些未提交和未跟踪成果**，会造成“功能消失”。先征得用户授权做可回退基线。
- Grok CLI 在 `C:\Users\35308\.grok\bin\grok.exe`；Grok 4.5 曾连续返回 429 capacity，未写代码。相同容量错误最多重试一次，然后本地处理或换会话。
- Supabase 迁移必须先比较远端 history，再 `db push --dry-run`。为保留本地时间戳使用 CLI `db push`；不要用会生成不同版本号的 migration API 制造 drift，也不要超时后盲目重推。
- 当前远端 history 已对齐到 `20260714190200`。Advisor 仍有既存项：`payment_webhook_events` RLS 无 policy（INFO，service-only 设计需确认）、`soft_delete_generation_job` authenticated 可执行（WARN）、Leaked Password Protection 关闭（WARN）。
- Supabase 邮件发送有 rate limit；重复注册测试应复用账号或等待，不要把限流当代码失败。
- PowerShell 下不要把 `server/src/services/alipay*.ts` 直接传给 `rg`；先 `Get-ChildItem -Filter` 或使用 `rg -g`。统一类型检查用根目录 `npm run typecheck`，避免错误的 `npm --prefix ... exec tsc -- --noEmit` 只打印帮助。
- Vite build 仍提示单 chunk 约 828 kB；不是当前阻断，但上线前应按页面 lazy-load 拆包。
- `.planning/status.md` 含历史切片信息，可能落后于本文件；以 migration history、最新 evidence 和本交接为准。
- 首页/支付/管理员已有多轮改动，后续不得大范围重写或以新设计稿覆盖既有路由、RLS、支付和 Prompt 功能。

## 8. 下一步（按顺序）

1. 启动 `npm run dev`，先人工验收 R2 完整链路；发现问题先写复现测试。
2. 请求用户授权建立 Git 基线提交；未授权前继续局部修改，禁止 worktree/reset/clean。
3. 低风险切片：把所有用户可见 `Shorts` 改成 `Shorts/TK`，内部 key 继续为 `shorts`；补全 Prompt 对 TikTok 的语义。
4. PRD 决策后再改 Pro 额度：需用户确认“存量 Pro 当前周期立即变 250，还是下一周期生效”；涉及 Migration 时再次明确授权。
5. 团队协作版前端切片：￥99、管理员能力介绍、复制微信号、二维码弹窗；CTA 不走支付宝。需确认 ￥99 是一次性定制价还是月费展示。
6. 高风险独立切片：用户自写收藏文案 + 是否需审核 + 管理员待审计数/角标/toast。先设计数据状态、分组 RLS、计数 API 和提醒去重，再申请 Migration 授权。MVP 建议先“页面加载/聚焦时刷新 + count 增量 toast”，不要一开始引入 Realtime。
7. 完成真实支付宝商家配置、sandbox/生产 E2E、部署门禁与上线。

## 9. 不能改动/注意约束

- 不泄露 `.env`、Supabase secret、支付宝私钥、公钥原文或 Server酱 sendkey。
- 不允许前端 return URL、Mock order 或客户端字段直接授予 Pro；只信 webhook/服务端查单。
- 不放宽 owner RLS、review_group 隔离、正文访问审计和 service-role-only RPC。
- 不把收藏正文编辑同步回生成历史原文。
- 不把内部 `shorts` key 贸然改名；先只改展示/Prompt，避免历史和数据库迁移。
- 不删除用户文件，不做大范围重构，不在未授权时部署、推 Migration、commit/push、开多代理或建 worktree。
- 亮色主白/橙色辅助；暗色荧光绿辅助；保留 77 Logo 与现有设计系统。

## 2026-07-15 已记录的新需求摘要

1. 所有 Shorts 用户可见名称改为 `Shorts/TK`。
2. 用户可直接新增收藏库文案供审核：品牌/文案类型/发布平台必填，备注选填，可选是否需审核；文案类型也可在收藏库编辑。管理员同组待审内容高亮，管理员收藏 tab 与右上菜单显示未审圆形数字角标；新增时右下角提示“稍后审核/立刻审核”，审核后计数消失。
3. Pro 每自然月额度从 400 调整为 250。
4. 新增团队协作版 ￥99：介绍管理员审核功能，点击弹出微信号 `18595680518`（可复制）与二维码，不进入支付页。

## 2026-07-15 后续执行状态

- R2/R2.1 已由用户人工验收通过；Shorts/TK、Pro 250、团队协作版 ￥99/月、用户自写待审核队列均已按后续切片完成。
- 管理员右下角待审核合并提醒已完成；用户审核结果右下角弹窗也已本地完成，支持 owner 隔离、操作后去重、窗口聚焦刷新，以及“立即查看”定位分页收藏。
- 用户审核结果弹窗验证：Client 388/388、TypeScript、production build 通过；证据见 `docs/evidence/2026-07-15/user-review-result-dialog/verification.md`。
- 当前仍保持 Dirty Worktree；未部署、未 Git commit/push、未 reset/clean、未创建 Worktree。Playwright runner 沿用上一切片 3 次启动超时结论，待用户在现有登录页面做一次视觉人工确认。
- 管理员待审核空状态已澄清：远端当前真实 pending=0，4 条已提交收藏均已有审核结果；筛选按钮显示计数并解释已通过/需修改不会留在待审队列。测试提醒可将用户收藏“11”勾选“提交管理员审核”，等待同步后切回 `/admin`。
- 收藏自动送审与管理员后台提醒已修复：新生成文案点击收藏、已有收藏修改正文、以及自写收藏显式勾选送审都会把 `reviewRequested=true` 同步到云端；`/admin` 本身新增右下角提醒，并在窗口聚焦或标签重新可见时刷新，“立刻审核”进入待审核收藏。修复前已保存且 `review_requested=false` 的“11”记录没有批量回填。验证为 Client 392/392、Server 569/569、双端 typecheck/build 通过；证据见 `docs/evidence/2026-07-15/automatic-favorite-review-reminder/verification.md`。
- 前端路由级代码拆分已完成：营销、认证、历史、结算、管理员及工作台重组件改为按需加载，主入口 JS 由 857,028 bytes 降至 471,335 bytes，Vite 超大 chunk 警告消失；Client 393/393、typecheck/build、三个主路径 HTTP 200 通过。Grok Build 两次只读调用无有效结论后按上限停止。证据见 `docs/evidence/2026-07-15/route-code-splitting/verification.md`。
