# PRD：77港话通 SaaS MVP

状态：Slice A 已验收；用户已批准执行 Slice B 的真实 Auth/RLS、必要依赖安装、Supabase 项目连接和本切片数据库迁移。支付和生产部署仍受高风险门禁约束。完整业务 PRD 见 `..\..\开发日志\02-PRD-77港话通社媒文案器-SaaS.md`。

## PRD Gate

- 目标用户：需要把普通中文转成香港社媒表达的品牌市场人员、代理商和内容创作者。
- 当前痛点：通用翻译缺少港味、平台适配、品牌审核和可复用反馈闭环。
- MVP：官网、公开邮箱账户、生成/审核/反馈、历史/收藏、Free/Pro 额度、支付宝沙箱支付、基础后台。
- 不做：团队/席位/SSO、RAG、高级报表、自动发布社媒、生产支付直连。
- 核心指标：首次成功生成率、生成完成率、文案采用/复制率、7日复用、Free→Pro 沙箱闭环成功率。
- 风险门禁：数据库迁移、真实支付、权限和生产部署前必须获得明确确认。

Gate status：ready for prototype。Slice A 完成后，Slice B 进入 commercial strict work 前重新过门禁。

## One-Line Positioning

面向香港市场营销人员的 AI 社媒文案 SaaS：把普通中文诊断并重写成 5 类港式平台文案，再提供质量审核、消费者反馈和持续复用。

For 需要进入香港市场的品牌营销人员，77港话通是一款港式社媒文案 SaaS，通过诊断、5 类平台改写、质量审核和消费者反馈解决通用翻译不地道且难以定稿的问题。

## Target Users

- Who: 品牌市场人员、代理商内容团队和独立内容创作者。
- Current behavior: 使用通用大模型、翻译工具或人工粤语编辑，在多个工具间复制和审核。
- Pain: 结果常是普通繁体或机械粤语，缺少平台节奏、品牌安全和可复用反馈。
- Desired outcome: 在一张工作台得到可解释、可审核、可复用且适合发布的香港社媒文案。

## Real Need And MVP Gate

- Current workflow: 接收普通中文 brief，人工改成港式表达，分别适配社媒平台，再找同事或编辑审核。
- Current workaround or competitor: ChatGPT/Claude、翻译工具、Jasper/Copy.ai、人工粤语编辑。
- Switching reason: 同一次完成香港语感、5 平台版本、审核、反馈和历史复用。
- Pain / delight / itch: 这是降低本地化错误和人工审核成本的痛点，不只是视觉或娱乐需求。
- Willingness-to-pay or value signal: 高频营销用户愿意为更高额度、品牌档案、历史和稳定质量付费；价格仍需真实用户验证。
- Smallest usable MVP: 公开邮箱账户 + 核心生成/审核/反馈 + 历史/收藏 + 服务端额度；支付可先沙箱。
- What stays manual for MVP: 最终发布、品牌批准、退款人工处理和违规内容判断。

## 买家与日常用户

- 买家：品牌负责人、市场团队负责人、代理商负责人或个人创作者。
- 日常用户：需要高频生成、审核和复用香港社媒文案的内容/营销人员。
- 当前替代：通用大模型、人工粤语编辑、翻译工具、Jasper/Copy.ai 等通用营销工具。
- 切换理由：香港语感、5 平台版本、审核/反馈闭环和品牌上下文在同一工作台完成。

## MVP Scope

### Must Have

1. 官网与 Free/Pro 套餐预览。
2. 公开邮箱注册、验证、登录、退出、忘记/重置密码。
3. 受保护的生成工作台，输出 5 类版本、审核和消费者反馈。
4. 服务端任务归属、历史、删除和跨设备收藏。
5. 服务端 Free/Pro 权益与额度台账。
6. 支付宝沙箱订单、异步通知验签、幂等授予 Pro 权益。
7. 管理后台基础页：用户、任务、订单/权益、模型健康、审计。
8. 用户注销 30 天删除计划；管理员正文只读、违规可删、访问必审计。

### Later

- 异步 Worker/SSE 深度可视化、团队/席位/SSO、RAG、高级分析、自动发布社媒。

### Not Doing

- MVP 不做生产自动发布、复杂审批流、无限套餐、前端决定金额或伪造支付成功。

## Success Metrics

- User-visible success: 新用户能在注册后完成第一轮生成，并得到 5 类文案、审核和消费者反馈。
- Business or operational success: 记录首次成功率、7 日复用、复制/采用率和 Free→Pro 沙箱闭环成功率。
- Quality / reliability success: 生成成功率、P95 时长、失败类型、任务恢复和额度账本一致性可观测。

## 分阶段范围

| Slice | 内容 | 当前状态 | 证据等级 |
|---|---|---|---|
| 0 | 官网与 `/app` 入口 | 已完成 | strict UI |
| A | 正式路由 + 登录/注册 Mock 壳 | 已完成，二次复测通过 | strict UI |
| B | Supabase Auth + profiles/roles/RLS | 已完成并远端验收 | strict |
| C | generation_jobs + history + 服务端额度 | 已完成并远端验收 | strict |
| D | favorites/brand/config 云同步 | ✅ 已完成 | strict data |
| UX-F1 | 四阶段预估生成进度 + Header 菜单收纳 | ✅ 已完成 2026-07-12 | strict UI |
| H1 | 用户反馈中心 + Server酱通知 + 收藏删除防误触 | ✅ 本地已完成 2026-07-12 | strict |
| E | 套餐/订单/支付 Mock | ✅ 已完成 2026-07-12 | strict mocked billing |
| F | 支付宝沙箱真实闭环 | 未开始，决策未齐 | strict billing |
| G | 管理后台与审计 | 未开始 | strict admin |

## User Stories

| ID | 用户故事 | 可观察验收 |
|---|---|---|
| US-AUTH-01 | 作为访客，我能公开注册并登录 | 验证、登录、退出、重置路径可用；未登录不能访问 `/app/*` |
| US-GEN-01 | 作为用户，我能创建并恢复生成任务 | 只创建一个归属当前用户的任务；刷新可恢复；成功显示 5 类结果 |
| US-HISTORY-01 | 作为用户，我能管理历史与收藏 | 用户 A 不能访问用户 B；删除后正文不可查询；收藏跨设备存在 |
| US-PLAN-01 | 作为用户，我能理解额度和升级 | 额度由服务端计算；不足时不调用模型并引导套餐页 |
| US-PAY-01 | 作为用户，我能通过支付宝沙箱升级 | 只有验签异步通知可把订单置为 paid；重复通知不重复授予 |
| US-ADMIN-01 | 作为管理员，我能安全运营 | 非管理员被拒绝；正文查看/违规删除/额度或角色变更均有审计 |

## Risks and Open Questions

- 支付宝具体产品、商户主体/资质、沙箱和生产应用仍未确认。
- 单次购买或周期方案、价格、额度、退款/到期/失败权益仍未确认。
- Supabase 开发项目已链接；后续 Migration 继续保持独立文件、dry-run、显式授权和远端回滚验收。
- 服务端 secret 仅通过仓库外文件指针加载；不得复制到仓库、浏览器 bundle、日志或证据。
- Google OAuth、模型数据政策、支付/审计/备份清理 SLA 待确认。

## 已确认业务规则

- 套餐：Free、Pro，数据模型允许以后新增第三档。
- 币种：CNY；金额由服务端套餐配置决定。
- 注册：任意有效邮箱公开注册，默认仅 user 角色。
- 正文：保留至用户主动删除；注销后 30 天删除。
- 管理员：默认可只读正文、删除违规内容，所有访问和变更写审计。
- 超级管理员：拥有业务管理权限，但不能查看密码/完整密钥、删除审计或伪造支付成功。

## 尚未确认且不得进入生产

- 支付宝具体产品、商户主体/资质、沙箱和生产应用。
- 单次购买还是周期方案；价格、额度、退款/到期/失败后的权益。
- 是否启用 Google OAuth；默认邮箱首发。
- 第三方模型的数据保留/训练政策。
- 支付、审计、备份与已删除正文的最终清理 SLA。


## Change Request - 2026-07-12 - 参考收藏案例入口在无四星收藏时消失 ✅ COMPLETED (UX-F1)

- Type: bug
- Risk: low
- Why: 用户无法发现该能力及其启用条件
- Status: ✅ 已修复。入口始终渲染；无可用案例时展开显示空状态说明。回归测试通过。

Acceptance criteria:

1. 入口始终显示；无可用案例时展开显示评分四星条件


## Change Request - 2026-07-12 - 用户反馈中心与管理员微信通知 ✅ COMPLETED (Slice H1)

- Type: feature
- Risk: high
- Why: 早期用户可提交需求、Bug和其他建议，管理员能及时获知
- Status: ✅ 已实现。FeedbackCenter drawer（HeaderMenu 入口）、Server酱 Turbo best-effort 通知、SERVERCHAN_SENDKEY_FILE 外部文件指针、仓库零泄露。Migration 已通过认证 Supabase MCP 推送并完成远端结构验收。

Acceptance criteria:

1. 已登录用户可提交需求反馈、Bug反馈或其他反馈 ✅
2. 反馈先持久化，再异步尝试微信通知；通知失败不丢失反馈 ✅
3. 通知密钥仅保存在服务端环境变量，客户端和日志不得出现 ✅


## Change Request - 2026-07-12 - 工作台 Header 信息架构收纳 ✅ COMPLETED (UX-F1)

- Type: change
- Risk: medium
- Why: 右上角功能横排过多，降低识别效率
- Status: ✅ 已实现。Header 保留 Logo、历史、收藏库、引擎状态；官网、复原配置、主题、退出收纳到 HeaderMenu 下拉。

Acceptance criteria:

1. Header 只保留高频入口，低频官网、复原配置、主题与退出收纳到菜单 ✅
2. 键盘、Escape、点击外部关闭和焦点状态可用 ✅


## Change Request - 2026-07-12 - 反馈提交返回 Internal server error ✅ REMOTE PREREQUISITE FIXED

- Type: bug
- Risk: high
- Why: 原因为 H1 Migration 未应用，且通知状态写回与 SendKey 解析存在阻断；代码修复与远端 Migration 现已完成

Acceptance criteria:

1. 反馈可持久化并返回 201；通知状态可信；SendKey 文件格式兼容；限流返回 429

Status: 远端表、RLS、策略、授权与触发器已验证；待用户从已登录工作台提交一条普通反馈完成浏览器端验收。真实微信通知测试仍需单独确认。


## Change Request - 2026-07-12 - 进入生成历史后工作台结果丢失

- Type: bug
- Risk: medium
- Why: 工作台状态只在内存中，整页路由导航会重建 AppProvider

Acceptance criteria:

1. 进入历史再返回工作台保留当前结果；刷新同一标签页也能恢复


## Change Request - 2026-07-12 - 从生成历史载入工作台

- Type: feature
- Risk: medium
- Why: 用户需要继续编辑、复用过去生成的完整结果

Acceptance criteria:

1. 完成的历史记录可一键载入原文、参数、变体、诊断、审核、评分和消费者反馈


## Change Request - 2026-07-12 - 四星收藏参考案例在工作台不可发现

- Type: bug
- Risk: low
- Why: 用户已有两条四星收藏，但生成区无法确认或选择参考案例；现有测试只验证入口存在，未覆盖云端水合与可用案例列表

Acceptance criteria:

1. 云端或本地收藏中有两条评分>=4时，工作台明确显示2条可用；展开后两条均可选择；所选案例随下一次生成请求注入且跨账号不串数据


## Change Request - 2026-07-12 - 节日话题未覆盖五个平台版本

- Type: bug
- Risk: low
- Why: 用户在话题日历选择节日后，实际输出只有Shorts提及；全局Prompt虽存在强制指令，但缺少五版本输出覆盖验证与防回归测试

Acceptance criteria:

1. 选中节日后，standardHK/lightCantonese/IG/Facebook/Shorts五个返回版本都明确融入至少一个所选事件角度或hook；所有生成引擎路径有测试，未选择事件时不改变输出


## Change Request - 2026-07-12 - 官网Pricing与结算转化链路未接通

- Type: bug
- Risk: low
- Why: Pricing是孤立路由，官网套餐预览没有进入Pricing的链接，未登录用户点击Pro后也不能在登录后返回结算页

Acceptance criteria:

1. 官网导航和套餐区可进入/pricing；Pricing的Free/Pro CTA分别进入正确注册或结算流程；未登录结算保留安全next路径，登录后回到/app/billing且拒绝外部open redirect


## Change Request - 2026-07-12 - 已开发功能规格沉淀与防覆盖门禁

- Type: change
- Risk: low
- Why: 连续切片可能在新增页面或功能时弱化既有参考案例、话题注入、Header信息架构和转化链路

Acceptance criteria:

1. 权威PRD/SDD/TEST_PLAN列出已完成能力与不变量；每个后续Slice运行跨域回归矩阵；未经需求变更不得删除、隐藏或降级既有能力
