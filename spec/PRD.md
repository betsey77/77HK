# PRD：77港话通 SaaS MVP

> 2026-07-14 待开发需求：工作台内容控制与个人案例库。案例标题为选填；普通管理员可受审计地查看收藏正文，超级管理员额外可受审计地查看案例正文。详情及验收范围见 spec/WORKBENCH_CONTENT_CONTROLS.md。

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

## R1 — 审核分组 + 管理员收藏批注（2026-07-14）

### 用户故事

| ID | 用户故事 | 可观察验收 |
|---|---|---|
| US-REVIEW-01 | 作为普通管理员，我只能查看/复制/审核与自己 `review_group` 相同的用户收藏 | 越组列表不出现；越组详情 404；复制仅来自已授权详情 |
| US-REVIEW-02 | 作为超级管理员，我可跨组处理全部收藏（含未分组用户） | 列表/详情/审核不按组过滤 |
| US-REVIEW-03 | 作为管理员，我可把收藏标记为已采纳或需修改，并填写修改建议 | 状态与意见写入后，列表 chip 与详情一致 |
| US-REVIEW-04 | 作为收藏所属用户，我能在收藏卡上看到管理员审核结果 | bootstrap 带回只读 `adminReview`；折叠态可见高亮；用户不可改审核字段 |
| US-REVIEW-05 | 作为官网访客，我能看到团队管理员审核功能的联系电话 | footer 提示 + `tel:18595680518` |

### 产品规则

- 每个普通用户/普通管理员最多一个审核组；格式 `^[a-z0-9][a-z0-9_-]{0,31}$`（如 `group1`）。
- `review_group IS NULL` = 未分组：未分组普通管理员看不到任何用户收藏，也不得审核；未分组用户的收藏仅 `super_admin` 可处理。
- 本切片分组边界**仅**作用于用户收藏列表/搜索/详情/复制/审核写入；不改变其它管理员统计页。
- 审核状态：`adopted`（已采纳）| `changes_requested`（需修改）；允许清除回到未审核。
- `changes_requested` 必须有非空意见；`adopted` 意见可选；意见最多 2000 字，trim 后空串写 null。
- 用户卡只读展示状态 +「管理员审核意见」+ 更新时间；不暴露管理员邮箱/角色/组名。
- 无实时订阅；用户刷新/重新 bootstrap 后看到最新审核。
- 操作文档：`docs/admin/review-group-management.md`（Table Editor / SQL 模板）；远端 migration **未推送**。

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

## Change Request - 2026-07-13 - 生成历史完整恢复左侧输入配置

- Type: bug + recovery guidance
- Risk: medium
- Why: “载入工作台”只恢复平台、语气和强度等顶层字段，结构化写作、消费者画像、收藏案例、话题日历等左侧配置回到默认值；用户也缺少生成文字意外消失后的恢复指引。

Acceptance criteria:

1. 旧历史记录恢复其 `brief` 中已经持久化的结构化写作、消费者画像、收藏案例和话题日历选择。
2. 新生成记录在现有 `brief` JSON 中保存完整 `workbenchSettings`，载入时恢复全部 `AppSettings`；不新增表字段或 Migration。
3. 历史列表与详情页显示：若生成过程中页面文字消失，可打开对应历史并点击“载入工作台”恢复。
4. 损坏或类型不合法的历史配置安全回退默认值，不影响已生成正文、诊断、审核和反馈的载入。

## Change Request - 2026-07-13 - 收藏卡片显示品牌与产品

- Type: UI usability
- Risk: low
- Why: 用户在收藏库浏览多条文案时，只有平台标签无法快速识别对应品牌与产品。

Acceptance criteria:

1. 收藏记录存在品牌名或产品名时，以红色文字在高亮平台标签左侧显示已有字段，两个字段之间使用 ` · ` 分隔。
2. 品牌名与产品名都为空时不显示占位符，平台、时间和卡片操作保持原行为。
3. 长名称可截断但不挤压平台标签；悬停可查看完整品牌/产品文本。

## Change Request - 2026-07-13 - 高影响操作确认与批量删除

- Type: safety + usability
- Risk: medium
- Why: 退出登录、复原创作配置和删除记录会中断当前使用或移除用户数据；逐条删除大量历史/收藏效率低，且容易误操作。

Acceptance criteria:

1. 退出登录与复原创作配置先显示可访问确认弹窗；取消不退出、不重置，确认后才执行。
2. 生成历史的单条删除和详情页删除继续通过确认弹窗，确认前不调用删除接口。
3. 收藏库和生成历史支持进入多选、选择单项、全选当前已加载列表、退出多选及批量删除。
4. 批量删除前只确认一次并显示选中数量；零选择时删除按钮禁用，异步删除期间禁止重复提交并显示处理中状态。
5. 历史批量删除允许部分成功：成功项从列表移除，失败项保留并显示可重试提示；不伪装为全部成功。
6. 收藏批量删除复用 owner-scoped 本地状态与既有云同步/outbox，不新增数据库表、RLS 或 Migration。

### 同切片补充：检索与分页收纳

1. 收藏库与生成历史默认每页展示 10 条，内容较多时提供上一页、下一页与页码状态。
2. 收藏库可按品牌名、产品名、原文与收藏文案检索；生成历史可按品牌名、产品名与原文检索。
3. 检索后从第 1 页开始展示；清空检索恢复完整列表。
4. “全选当前”仅选择当前页可见项目，已跨页选择的项目继续保留，直至完成或退出批量管理。
5. 生成历史必须使用用户身份与 owner 过滤的服务端检索和分页，不得仅对当前已加载记录做前端过滤。

## Change Request - 2026-07-13 - Free 收藏与生成历史容量权益

- Type: monetization entitlement
- Risk: medium
- Why: Free 与 Pro 目前只在生成次数上有差异，收藏和历史无限使用，缺少清晰的升级价值；同时不能为了新权益直接删除用户既有数据。

Acceptance criteria:

1. Free 用户最多新增 10 条收藏；达到上限后不创建第 11 条，显示明确的 Pro 解锁入口。删除后低于上限可继续收藏。
2. Free 收藏库只开放最新 10 条；既有超额收藏继续保留并显示锁定数量，不静默删除、不覆盖最旧记录；Pro 可访问全部收藏。
3. Free 生成历史只开放最新 15 条；超额历史继续保留并显示锁定数量，升级 Pro 后恢复访问。
4. 历史检索只在 Free 可访问的最新 15 条内进行，不能通过关键词或详情 URL 绕过；Pro 仍可检索全部历史。
5. 收藏容量与历史访问均有服务端套餐门禁，客户端提示不是唯一安全边界。
6. 套餐读取失败时 fail closed 为 Free 权益；所有删除操作仍可用，用户可通过删除收藏释放容量。
7. 本切片不修改生成额度、价格、支付验签、RLS 或数据库结构，不推送 Migration。


## Change Request - 2026-07-14 - R1.1 管理员审核保存与正文审阅修复

- Type: bug
- Risk: high
- Why: 远端 RPC 将 text 角色写入 app_role 枚举导致审核事务回滚；正文区域只能滚动，长文审阅困难。

Acceptance criteria:

1. 管理员保存已采纳或需修改时不再返回 500，审核与审计记录原子写入。
2. 收藏正文区域可拖拽增高，弹窗关闭、审核编辑与复制仍可访问。
3. 失败信息可访问且不暴露数据库细节。

High-risk item: confirm with the user before implementation.


## Change Request - 2026-07-14 - R2 收藏文案句子级管理员批注

- Type: feature
- Risk: high
- Why: 整篇审核意见无法准确指出需要修改的句子，用户理解和修改成本高。

Acceptance criteria:

1. 管理员可选中收藏正文片段并添加修改建议，整篇审核状态继续独立保留。
2. 收藏所属用户能看到红色高亮片段、状态文字和批注意见，不能修改管理员批注。
3. 普通管理员仅能批注同 review_group 用户收藏，super_admin 可跨组；越权请求不可读取或写入。
4. 原文锚点不匹配时降级为批注列表并标记定位失效，不把批注错误套到其他句子。

High-risk item: confirm with the user before implementation.


## Change Request - 2026-07-14 - R2.1 收藏正文直接编辑与重新送审

- Type: feature
- Risk: medium
- Why: 用户需要在收藏库直接修正文案，保存后应避免沿用针对旧正文的管理员审核与句子锚点，并让管理员明确识别为修改后待审核。

Acceptance criteria:

1. 用户只能编辑并保存自己的收藏正文，不能修改他人收藏或生成历史原文。
2. 正文保存成功后旧整篇审核和句子级批注失效，管理员列表与详情显示修改后待审核。
3. 管理员重新审核后，用户刷新收藏库可看到新的状态、整篇意见和句子级批注。
4. 取消编辑或关闭含未保存改动的编辑区时先确认，保存失败不覆盖本地已显示正文。


## Change Request - 2026-07-15 - Shorts 展示名统一为 Shorts/TK

- Type: change
- Risk: medium
- Why: 产品同时面向 YouTube Shorts 与 TikTok，现有 Shorts 展示名会误导用户。

Acceptance criteria:

1. 所有用户可见的 Shorts 文案统一显示为 Shorts/TK，包括工作台、结果、收藏、历史、管理员页、官网和定价说明。
2. 内部持久化 key 暂继续使用 shorts，避免无必要数据库迁移和历史数据失配；API/Prompt 语义需同时覆盖 Shorts 与 TikTok。


## Change Request - 2026-07-15 - 用户自写收藏文案与待审核队列

- Type: feature
- Risk: high
- Why: 用户需要提交自己撰写的文案给团队管理员审核，并让管理员快速识别新增待审核任务。

Acceptance criteria:

1. 用户可在收藏库新增自写文案；品牌、文案类型、发布平台必填，备注选填，并明确选择是否需要审核。
2. 收藏库现有文案的发布平台和文案类型均可编辑；需要审核的文案进入该用户 review_group 的管理员队列并高亮。
3. 管理员用户收藏页和首页右上角折叠菜单显示未审核圆形数字角标；审核完成后计数消失或递减。
4. 每次出现新增待审核任务时，管理员右下角收到合并提醒，可选稍后审核或立刻审核并跳转用户收藏页；不得跨 review_group 泄露数量或正文。

High-risk item: confirm with the user before implementation.


## Change Request - 2026-07-15 - Pro 月额度调整为 250 次

- Type: change
- Risk: high
- Why: 将 Pro 套餐从每月 400 次调整为每月 250 次。

Acceptance criteria:

1. 官网、Pricing、结算页、数据库 plans、额度服务和管理员订阅页统一显示 Pro 每自然月 250 次。
2. 存量 Pro 用户在当前周期立即调整为 250 次，后续周期同样为 250 次。

Implementation note: Migration 已于 2026-07-15 获用户明确授权并执行；存量 `quota_used` 保留不变。

High-risk item: confirm with the user before implementation.


## Change Request - 2026-07-15 - 团队协作版 99 元/月联系定制

- Type: feature
- Risk: medium
- Why: 为需要管理员审核能力的内部团队提供人工开通入口，不走自动支付宝结算。

Acceptance criteria:

1. 官网和定价页新增团队协作版 ￥99/月，并说明审核分组、管理员批注、待审核队列等团队功能。
2. CTA 不进入支付页；弹窗显示联系 vx：18595680518，号码可一键复制，并展示项目内保存的微信二维码。
3. 弹窗具备关闭、复制成功/失败状态与键盘可访问性；不把电话或二维码错误描述为支付宝收款入口。

## Change Request - 2026-07-15 - 用户审核结果弹窗

- Type: feature
- Risk: medium
- Why: 管理员收到待审提醒后，提交文案审核的用户也需要及时知道审核结果，并能直接定位到对应收藏。

Acceptance criteria:

1. 管理员保存审核后，文案 owner 在下次页面加载、窗口重新聚焦或主动刷新时收到一次审核结果弹窗。
2. `adopted` 显示“你的{品牌}文案已通过审核，请立即查看”；`changes_requested` 显示“你的{品牌}文案未通过审核，请立即查看”。品牌为空时使用“你的文案”，不得显示空占位。
3. “立即查看”打开收藏库并定位对应收藏；关闭或稍后查看不删除审核结果，用户仍可在收藏卡查看整篇意见和句子批注。
4. 通知以 owner + favorite + content revision + review updated time 去重；刷新不得重复轰炸，新的审核结果必须再次提醒。
5. 服务端与客户端均不得向其他用户或 review_group 泄露品牌、正文、审核状态或未读数量。

Implementation note: 与“用户自写收藏文案与待审核队列”的管理员提醒一并设计，但用户侧审核结果弹窗必须作为独立验收项。

Implementation status: 2026-07-15 已本地完成。通知只读取当前 owner 完成云同步后的收藏；不新增后端接口、Migration、Realtime 或跨组查询。
