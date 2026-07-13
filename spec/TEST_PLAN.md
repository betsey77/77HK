# TEST PLAN：77港话通 SaaS MVP

## 固定命令

```powershell
cd client; npx tsc --noEmit; npm run build
cd server; npx tsc --noEmit; npm run build
```

新增测试框架、浏览器自动化或安全扫描工具前先说明依赖并获得用户同意。

## 证据策略

| 区域 | 等级 | 最小证据 |
|---|---|---|
| 文档/索引 | basic | diff/进度记录 |
| 官网/工作台 UI | strict UI | 构建、桌面截图、交互/焦点说明 |
| Auth/Session/RLS | strict | 行为测试、浏览器证据、User A/B 隔离 |
| 生成持久化/额度 | strict | API/DB 状态、失败释放、幂等 |
| 支付/Webhook | strict | 沙箱请求、验签、重放、订单和权益状态 |
| 管理员/审计 | strict | 非管理员拒绝、正文访问/删除审计 |

## Slice A：账户壳 Mock

- `/`、`/login`、`/signup`、`/forgot-password`、`/reset-password` 可访问。
- 未登录访问 `/app` 重定向 `/login`。
- 合法 mock 登录后返回 `/app`；刷新恢复；退出后受保护页再次重定向。
- 非法邮箱、密码规则、必填、loading、disabled、错误和成功状态可见。
- 现有工作台仍渲染；生成相关类型检查和构建不回归。
- 截图：1440、1024、窄桌面；登录 loading/错误/成功三态。

## Slice B：真实 Auth 与 RLS

- 注册、邮箱验证、登录、错误密码、退出、忘记/重置、过期 session。
- 重复邮箱和注册限频有清晰错误。
- 公开注册无法指定 admin 或 plan。
- User A 不能读取/修改 User B 的 profile、task、favorite、brand。
- non-admin 不能访问 `/api/admin/*`。
- service role 不出现在浏览器 bundle、日志或证据中。

## Slice C/D：任务、历史、收藏与额度

- 同一幂等键只创建一个任务。
- 无额度不调用模型；预占、消费、失败释放与超时 reconciliation 正确。
- 刷新恢复 pending/running；成功显示 5 类结果；失败可重试且不重复扣额。
- 删除正文后用户常规查询不可见；审计/支付记录不随正文误删。
- localStorage 导入幂等；收藏和配置跨设备；参数恢复不修改原任务。

## Slice E：套餐/订单/支付 Mock

- 定价页展示 Free/Pro 双卡、价格、配额、功能和 [MOCK] 标签。
- 结算页受保护，显示当前套餐、使用进度条、升级 CTA 和订单记录。
- 结算页支持 loading/empty/error/列表 四种状态。
- 支付结果页（成功/取消）显示订单摘要和 [MOCK] 标签。
- 服务端 entitlements/checkout/orders 端点通过 requireAuth 保护。
- checkout 校验 planId；拒绝 Free→Free；拒绝 Pro→Free。
- GET orders 按 userId 隔离；GET orders/:id 拒绝非所有者访问。
- GET /api/billing/plans 公开无需鉴权。
- 所有 API 响应和页面均含 isMock 或 [MOCK] 标记。
- 不走真实支付宝、不写 DB Migration、不创建远端订单、不修改真实 subscription/usage。
- 证据等级：strict mocked billing — server/client 测试、TS/build 验证。

## Slice E/F：支付

- 前端篡改 plan/amount 不影响服务端订单金额。
- success/cancel 跳转页不直接授予权益。
- 无效签名、错误金额、错误商户、未知订单、closed/refunded 均 fail closed。
- 有效异步通知将 pending→paid，并以事务授予一次权益。
- 同一通知重放、并发通知和乱序通知不重复授予。
- 退款/到期/失败后的权益符合用户已确认规则。
- 所有证据使用沙箱并脱敏；不得调用生产支付。

## Slice G：管理员

- user、admin、super_admin 路由/API 权限矩阵。
- 管理员正文查看自动写 audit_log；正文默认不可编辑。
- 违规删除、封禁、额度调整、角色变更有二次确认和审计。
- 管理员不能删除/修改 audit_log，不能读取密码/完整密钥，不能伪造 paid。
- 超级管理员的业务权限不绕过支付验签和审计。

## 上线前安全检查

- Git 跟踪文件无真实密钥；疑似暴露密钥已轮换。
- 依赖审计无未解释的 critical/high。
- CORS/CSP/HTTPS/环境变量/回滚方案已记录。
- Auth、RLS、支付、Webhook、管理员证据链接到 `ACCEPTANCE.md`。
- 未确认高风险决策没有被默认写入生产。

## Slice UX-F1：生成进度 + Header 菜单收纳

- 四阶段进度：诊断原文→生成变体→质量审核→消费者反馈，标注"预估"
- 每个阶段有 pending/active/done/failed 四态，视觉区分
- 暗色 emerald、亮色 orange 遵循设计系统
- Header：历史、收藏库、引擎状态直接可见
- HeaderMenu：官网、复原配置、主题、退出收纳到下拉
- HeaderMenu 键盘可访问，Escape/点击外部关闭，aria-expanded/haspopup 正确
- ReferenceCaseSelector 始终渲染，无四星收藏时显示空状态
- 不修改数据库、支付、Supabase Migration、真实微信通知或任何 secret
- 证据等级：strict UI — 截图、行为测试、构建验证

|CR-2026-07-12-bug|参考收藏案例入口在无四星收藏时消失|无收藏状态下可找到折叠入口和空状态说明|✅ COMPLETED — UX-F1|client tests 135/135 and build passed|入口始终显示；无可用案例时展开显示评分四星条件|✅ PASSED|

|CR-2026-07-12-feature|用户反馈中心与管理员微信通知|覆盖成功、无权限、限流、非法输入、通知失败和跨用户隔离|Feature branch or local dev state|Run the relevant behavior path and boundary checks|已登录用户可提交需求反馈、Bug反馈或其他反馈; 反馈先持久化，再异步尝试微信通知；通知失败不丢失反馈; 通知密钥仅保存在服务端环境变量，客户端和日志不得出现|strict: API tests, RLS tests, redacted notification evidence, UI screenshot|

|CR-2026-07-12-change|工作台 Header 信息架构收纳|Header 菜单行为与原有功能无回归|✅ COMPLETED — UX-F1|client tests 135/135 and build passed|Header 只保留高频入口，低频官网、复原配置、主题与退出收纳到菜单; 键盘、Escape、点击外部关闭和焦点状态可用|✅ PASSED|

## Slice H1：用户反馈中心 + Server酱通知 + 收藏删除防误触

- 收藏删除先弹出符合 shadcn-like 规范的可访问确认对话框
- 取消不删除，确认才触发云同步删除
- HeaderMenu 增加"意见反馈"入口，打开 FeedbackCenter drawer
- 支持 4 种反馈类型、标题/内容必填且有长度限制
- 自动附带 page_path 与 app_version
- 提交 loading/success/error 状态 + 最近自己的反馈列表
- Server 受 requireAuth 保护的 POST/GET /api/feedback
- 反馈持久化优先，Server酱通知 best-effort
- 通知失败不回滚，记录 notify_status/attempts/last_error/notified_at
- 反馈正文不写入普通 server log
- Migration 已起草但绝不推送远端
- SendKey 通过外部文件指针加载，仓库和前端零泄漏
- 证据等级：strict — 测试覆盖确认删除、表单校验、成功/失败、未登录隔离、通知失败仍 201、密钥不泄漏

|CR-2026-07-12-bug|反馈提交返回 Internal server error|真实表/RLS前置、trusted写回、SendKey=格式、限流和通知失败不丢数据|Feature branch or local dev state|Run the relevant behavior path and boundary checks|反馈可持久化并返回 201；通知状态可信；SendKey 文件格式兼容；限流返回 429|strict server tests, dry-run, redacted ServerChan result|

|CR-2026-07-12-bug|进入生成历史后工作台结果丢失|owner-scoped session snapshot round-trip and account isolation|Feature branch or local dev state|Run the relevant behavior path and boundary checks|进入历史再返回工作台保留当前结果；刷新同一标签页也能恢复|client behavior tests and browser smoke|

|CR-2026-07-12-feature|从生成历史载入工作台|completed job loads; incomplete/failed job cannot masquerade as usable result|Feature branch or local dev state|Run the relevant behavior path and boundary checks|完成的历史记录可一键载入原文、参数、变体、诊断、审核、评分和消费者反馈|client behavior tests and browser smoke|

|CR-2026-07-12-bug|四星收藏参考案例在工作台不可发现|Verify 四星收藏参考案例在工作台不可发现|Feature branch or local dev state|Run the relevant behavior path and boundary checks|云端或本地收藏中有两条评分>=4时，工作台明确显示2条可用；展开后两条均可选择；所选案例随下一次生成请求注入且跨账号不串数据|docs/evidence/YYYY-MM-DD/slice-NN/|

|CR-2026-07-12-bug|节日话题未覆盖五个平台版本|Verify 节日话题未覆盖五个平台版本|Feature branch or local dev state|Run the relevant behavior path and boundary checks|选中节日后，standardHK/lightCantonese/IG/Facebook/Shorts五个返回版本都明确融入至少一个所选事件角度或hook；所有生成引擎路径有测试，未选择事件时不改变输出|docs/evidence/YYYY-MM-DD/slice-NN/|

|CR-2026-07-12-bug|官网Pricing与结算转化链路未接通|Verify 官网Pricing与结算转化链路未接通|Feature branch or local dev state|Run the relevant behavior path and boundary checks|官网导航和套餐区可进入/pricing；Pricing的Free/Pro CTA分别进入正确注册或结算流程；未登录结算保留安全next路径，登录后回到/app/billing且拒绝外部open redirect|docs/evidence/YYYY-MM-DD/slice-NN/|

|CR-2026-07-12-change|已开发功能规格沉淀与防覆盖门禁|Verify 已开发功能规格沉淀与防覆盖门禁|Feature branch or local dev state|Run the relevant behavior path and boundary checks|权威PRD/SDD/TEST_PLAN列出已完成能力与不变量；每个后续Slice运行跨域回归矩阵；未经需求变更不得删除、隐藏或降级既有能力|docs/evidence/YYYY-MM-DD/slice-NN/|
