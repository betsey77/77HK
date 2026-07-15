# Grok Build 前端设计与实现交接（受控增量版）

> 日期：2026-07-13  
> 项目根目录：`D:\work\77港话通社媒文案\77`  
> 交接目标：先交付可交互的前端设计稿，再按用户确认的切片做**小范围增量实现**。这不是重写项目的授权。

---

## 0. 给 Grok Build 的首要约束

本项目已经是可运行的 SaaS MVP。请把自己当作受现有架构约束的设计工程师，而不是从零搭建新产品的生成器。

### 必须保留

- 原验证入口与路由不变：官网 `http://localhost:5173/`，工作台 `http://localhost:5173/app`，服务端 API `http://localhost:3001/api`。
- 开发与验收仍从项目根目录执行 `npm run dev`；不要改变端口、Vite 配置或路由策略。
- 现有技术栈：React 19、TypeScript 5.7、Tailwind CSS v4、Vite 6；服务端为 Express 5；认证/数据为 Supabase；生成服务为 DeepSeek → 自部署 CantoneseLLM → rules fallback。
- 现有三栏工作台结构、生成数据流、Supabase RLS、额度预留、支付可信状态、历史、收藏、配置、管理员审计与测试均必须保留。
- 品牌图标必须直接复用 `client/public/brand/77-logo.png`。它是用户确认过的“黑底荧光绿 77”资产；不得重画、CSS 仿制、改色，且不得产生白边。
- 深色主题以荧光绿（现有 `emerald-*`）为品牌辅色；浅色主题以白色为主、橙色（现有 `orange-*`）为品牌辅色。不要把深色主题改成橙色，也不要在浅色主题继续使用绿色作为品牌强调色。

### 明确禁止

- 禁止删除、移动或覆盖 `client/src`、`server/src`、`supabase`、`spec`、`.planning` 中已有文件；禁止“为了更好看”而把既有交互替换成静态页面。
- 禁止更换框架、状态方案、CSS 方案、路由方案或引入大型 UI 框架；项目遵循已有 shadcn/ui 风格规范，但**没有**授权整体迁移到 shadcn/ui。
- 禁止新增/泄露任何 `.env`、Supabase、DeepSeek、支付宝、Server 酱密钥；禁止数据库迁移、RLS 变更、支付逻辑变更、部署、git push 或安装依赖。
- 禁止把“预估进度”描述成真实 SSE/模型逐 token 流式进度；当前后端尚无 SSE。
- 禁止清除本地存储、用户历史、收藏、配置或真实账户数据。

若任何要求与本文件冲突，优先级为：**用户最新明确指令 > 本文件 > `docs/design-system.md` > 现有代码风格**。

---

## 1. 先读的项目事实源

在写任何页面或建议修改前，按以下顺序阅读，不要只看截图猜测：

1. `README.md`：本地启动和验证入口。
2. `CLAUDE.md`、`AGENTS.md`：小切片、最小改动与安全边界。
3. `docs/design-system.md`：品牌、深浅主题、三栏布局、组件密度与交互规范。
4. `spec/PRD.md`、`spec/SDD.md`、`spec/TEST_PLAN.md`：产品门禁、接口与验收要求。
5. `.planning/status.md`、`.planning/context_pack.md`：已完成切片和当前基线。
6. 本交接涉及的现有实现：
   - `client/src/components/results/GenerationProgress.tsx`
   - `client/src/components/results/ResultsPanel.tsx`
   - `client/src/hooks/useGenerate.ts`
   - `client/src/components/input/PersonaManager.tsx`
   - `client/src/services/api.ts`
   - `client/src/context/AppContext.tsx`
   - `client/src/context/PlanAccessContext.tsx`

### 当前可依赖的产品能力

- 已完成：诊断 → 5 个平台变体 → 审核 → 消费者反馈；收藏、评分、参考收藏案例注入、话题日历、生成历史、配置保存/恢复、反馈墙、管理员只读查看收藏详情、套餐/订单/支付宝沙箱链路。
- 已完成：Free 每滚动 7 天 20 次完整生成；Pro 为 ¥19/月、每月 400 次。Free 收藏可访问最近 10 条、历史可访问最近 15 条；Pro 解锁全部。
- 已完成：用户账户使用真实 Supabase Auth 与邮箱确认；客户端会恢复已持久化会话。
- 已完成：生成过程有 `generationProgress` 状态，含 `diagnosis`、`generation`、`audit`、`feedback` 四阶段；它是**本地预估状态**，不是服务端流式事件。
- 已完成：支付成功只以服务端 webhook / `trade.query` 的可信结果为准；前端不得自行授予 Pro。

---

## 2. 本次需求与边界

### A. 生成时可视化：四阶段 + Agent Terminal 科技感

用户提供的参考图表达的是：

- 清晰的 4 步流程：`诊断原文 → 生成变体 → 质量审核 → 消费者反馈`；
- 当前步骤醒目、已完成/待处理一眼可辨；
- 旁边或下方有低干扰的终端日志，带模块标签、光标/扫描感和有限动效；
- 不要炫技压过文案结果，更不能伪造模型真实内部思考或实时服务端日志。

#### 现有基础与允许的实现方式

- 已有组件：`client/src/components/results/GenerationProgress.tsx`；`ResultsPanel.tsx` 在 `uiState === 'loading'` 时显示它。
- 已有状态与标签：`useGenerate.ts` 中四个阶段及预估时长；完成/失败时会清理进度。
- 目标是将现有组件**视觉升级**，并可新增一个很小的同目录终端展示子组件；不要改写 `useGenerate` 的生成、轮询、额度、历史保存逻辑。
- 日志必须是用户可理解的阶段说明，且由当前 `StageProgress.status` 推导，例如：
  - `[DIAGNOSE] 正在识别原文语言与品牌约束…`
  - `[VARIANT_ENGINE] 正在生成 5 个平台版本…`
  - `[QUALITY_GATE] 正在检查港味、平台适配与品牌安全…`
  - `[AUDIENCE_SIM] 正在汇总目标消费者反馈…`
- 不显示 prompt、API key、原始异常、模型内部推理、伪造精确耗时、伪造消息数或虚假后端 agent 名称。可以明确标注“预估流程”或“阶段状态”。

#### 视觉与可用性要求

- 保持工作台紧凑密度：加载态在中栏居中，可在宽屏显示“进度条在上、终端面板在下”，不得挤压左右栏。
- 深色：深石墨/蓝黑终端表面，荧光绿为活动状态与光标；浅色：白色/浅灰表面，橙色为活动状态与连线。终端可使用极少量语义色区分标签，但不得建立新的紫色主品牌。
- 复用 Tailwind 与 Lucide；避免 inline style、任意 HEX、厚重玻璃拟态和大面积渐变。
- 动画只用于活动步骤、轻微光标和日志新增；支持 `prefers-reduced-motion`，不自动滚动整个页面。
- 提供 `aria-live="polite"` 的状态文字；只用颜色区分状态是不合格的。
- 成功、失败、重试、网络慢和刷新页面时不得遗留“永远加载”的终端。

#### 验收标准

1. 点击“生成文案”后，四步骤至少有一个 active；完成后按现有逻辑进入结果，不残留加载 UI。
2. 失败时显示现有错误路径，不假装成功。
3. 深浅主题都符合既有双色规则；不影响已有结果卡、审核栏和历史保存。
4. 至少增加针对 active/done/failed、可访问文本、浅色橙色类名的行为测试；现有 UX-F1 测试不得被删改为“通过”。

### B. 修复“示例消费者画像重复添加”

现状：`client/src/components/input/PersonaManager.tsx` 的预设模板按钮每次点击都会调用 `addPersona(template)`；目前没有按模板或内容去重。因此同一示例可被重复添加。

期望：用户连续点击同一示例消费者画像时，列表中只保留一条该示例；不同示例、用户手工创建的不同画像和用户编辑后的画像仍可共存。重复点击可：

- 让既有项短暂获得 focus/高亮，或
- 显示简短提示“该示例已加入”。

不要用“禁止所有同名画像”的粗暴规则，也不要改写由 AI 解析得到的 `consumerPersonas`。推荐只针对预设模板，使用稳定的模板标识或模板字段指纹判断，而非 `Math.random()` 生成的实例 id。

验收：同一预设点两次只得到一条；不同预设可各得到一条；删除后再次添加可成功；AI 解析与手工编辑不回归。请为该行为新增测试。

### C. Free 额度用尽时的升级弹窗

现状：服务端 `POST /api/generate` 在额度预留失败时返回 HTTP `402`；`client/src/services/api.ts` 当前把所有非成功响应转成普通 `Error`，`useGenerate.ts` 只显示错误文字。

目标：仅当**服务器返回的 HTTP 402**时，前端展示确认弹窗，文案为：

- 标题：`账户配额不足`
- 说明：`当前 Free 套餐的生成额度已用完。升级 Pro 后可继续生成，并解锁完整收藏与历史访问。`
- 次按钮：`暂不充值`（关闭弹窗，保留用户已填写的工作台内容，不重试、不清空）
- 主按钮：`充值 Pro`（跳转 `/app/billing`）

实现门禁：

- 以 HTTP `402` 或显式的受控错误类型判断，不可通过匹配中文/英文错误文案判断。
- 不在客户端预扣或伪造额度；不修改 `reserve_quota`、`consume_quota`、订阅状态或支付成功判断。
- 非 402（网络异常、500、模型异常、认证异常）仍走原有错误提示，不能误弹升级弹窗。
- 优先复用项目已有确认弹窗交互；若需要新组件，保持小型、局部、可访问，支持 Escape/焦点管理。

验收：模拟 402 时弹窗出现；“暂不充值”关闭且输入仍在；“充值 Pro”跳往 `/app/billing`；模拟 500 时不弹；新增客户端测试。

### D. 前端设计稿交付（本阶段真正要先完成的产物）

请只在以下新目录创建文件，不触碰现有运行页面：

`D:\work\77港话通社媒文案\77\前端设计稿\grok`

最低交付文件：

1. `README.md`：设计方向、如何本地打开、与真实应用的边界、源资产路径。
2. `brand-spec.md`：写清 logo 路径、深色荧光绿/浅色橙色规则、字体/间距/圆角/图标规则；不得把图片重新画成 CSS。
3. `generation-progress-terminal.html`：带 mock 数据的四阶段终端交互稿；可切换 dark/light、idle/running/success/error 和 reduced motion。
4. `quota-insufficient-dialog.html`：带 mock 数据的额度弹窗交互稿；两个按钮有明确演示行为，且不伪造支付成功。
5. `workbench-ui-review.html`：对现有三栏工作台的统一优化提案，展示 idle/loading/result/error 至少四种状态。保留左输入、中结果、右审核的工作流，不要做成营销页。
6. `design-review.md`：说明每个页面的“保留点、修改点、未决点”；其中必须列出没有实施到运行项目的内容。

设计稿允许使用静态 mock 数据与原生 HTML/CSS/JS；不应依赖网络 API、真实账号、密钥或支付。建议一个主设计方向（紧凑、专业、工具感）并在 `workbench-ui-review.html` 内用开关呈现 3 个**受约束的局部变体**，而不是制作三个互不相干的产品。

---

## 3. UI 设计系统速查

完整规则以 `docs/design-system.md` 为准，以下是不得遗漏的部分：

| 项目 | 既定规则 |
| --- | --- |
| 主工作台 | 桌面优先的三栏：左输入、中央结果/灵感、右审核；不把当前任务扩展为移动端重构。 |
| 表面 | 深色 `gray-950/900/800` 分层；浅色白/灰分层；卡片/输入/面板以 `rounded-lg` 为主。 |
| 强调色 | dark 使用 `emerald-300/400/500`；light 使用对应 `orange-700/600/500` 或浅橙表面。 |
| 语义色 | 收藏/评分用 amber；危险/删除用 red；低严重度信息可用 blue。不能把语义色冒充主品牌。 |
| 字体与密度 | 正文 `text-sm`，辅助 `text-xs` / `text-[10px]`，4px/8px 节奏；避免“大而空”的营销式排版。 |
| 图标 | 新增结构性图标使用 Lucide；保留旧功能上的既有内容，不顺手做全项目 emoji 重构。 |
| 交互 | 每个按钮要有 hover/focus/disabled；可逆高影响操作需确认弹窗；无障碍焦点和颜色对比必须保留。 |
| 深浅主题 | 每个新增品牌强调 Tailwind class 都须同时写 light 对应项，例如 dark `emerald-*` + light `orange-*`。 |

---

## 4. 推荐执行顺序（必须分阶段停下）

### 阶段 0：只读核对

阅读第 1 节文件，记录你观察到的现有实现与不可变接口。不得修改代码。

### 阶段 1：仅生成设计稿

只创建 `前端设计稿\grok` 中的文件。完成后交付截图/路径与设计说明，并**停止等待用户确认**。这一阶段不应改动 `client/src` 或 `server/src`。

### 阶段 2：经用户明确确认后，只实现 A

只增强生成进度视觉与终端展示，先写/更新测试，再实现，再运行客户端检查。不要顺带修改消费者画像、额度弹窗或全局样式。

### 阶段 3：经确认后，只实现 B

用测试复现并修复预设画像重复；不要触及 AI 解析、数据表或配置云同步。

### 阶段 4：经确认后，只实现 C

按 402 做受控升级弹窗；不得改变服务器额度/支付可信边界。

### 阶段 5：经确认后，再从设计稿挑选少量已批准的全局 UI 优化

每次最多一个清晰子目标，并说明受影响页面、视觉回归风险和验证方法。

---

## 5. 每个实现切片的最低验证

在本地验证，且不得以删除测试、跳过测试或改配置来“通过”。建议命令：

```powershell
cd "D:\work\77港话通社媒文案\77\client"
npx vitest run
npx tsc --noEmit
npm run build

cd "D:\work\77港话通社媒文案\77\server"
npm test
npx tsc --noEmit
npm run build
```

浏览器人工核验至少包括：

1. `http://localhost:5173/app`：普通生成、加载、失败、深浅主题。
2. `/app`：预设画像重复点击、输入内容保持、结果与历史未丢失。
3. `/app/billing`：额度弹窗跳转路径正确；不修改/伪造会员状态。
4. `/app/history`、收藏库、配置管理：既有数据和访问限制仍可用。

每次交付需报告：创建/修改文件列表、未修改的受保护范围、测试命令及结果、浏览器核验步骤、已知限制。若需要迁移、密钥、依赖安装、支付或部署，必须停止并向用户单独请求授权。

---

## 6. 可直接粘贴给 Grok Build 的任务提示

```text
你在已有项目 D:\work\77港话通社媒文案\77 中工作。先完整阅读 docs\handoff\GROK_BUILD_FRONTEND_HANDOFF_2026-07-13.md、README.md、CLAUDE.md、AGENTS.md、docs\design-system.md、spec\PRD.md、spec\SDD.md、spec\TEST_PLAN.md 和 .planning\status.md。

这是受控增量任务，不是重构授权：必须保留 http://localhost:5173、React 19 + TypeScript + Tailwind + Vite、Express + Supabase、三栏工作台、已有路由/状态/接口/RLS/支付/测试。禁止删除或覆盖现有 client/src、server/src、supabase、spec、.planning 文件；禁止改端口、框架、路由、状态方案、支付/额度可信逻辑、数据库和依赖；禁止暴露任何密钥。复用 client/public/brand/77-logo.png，保持深色荧光绿、浅色橙色的既定双主题。

先只完成“设计稿阶段”：在 D:\work\77港话通社媒文案\77\前端设计稿\grok 创建 README.md、brand-spec.md、generation-progress-terminal.html、quota-insufficient-dialog.html、workbench-ui-review.html、design-review.md。设计稿要是带 mock 数据、可交互的 HTML，覆盖：
1) 四阶段生成可视化（诊断原文→生成变体→质量审核→消费者反馈）+ 克制的终端科技感；注意现有进度是预估状态，不是 SSE 或真实模型推理日志；
2) Free 额度不足的“暂不充值 / 充值 Pro”弹窗；
3) 保持三栏工作台的全局 UI 优化提案和 idle/loading/result/error 状态。

设计稿阶段严禁修改运行项目。交付后停止，给出创建文件路径、如何打开、设计决策、与现有应用的差异及需要用户确认的点。不要继续实现代码。

后续只有在用户明确确认后才按单独切片实现：A 进度终端视觉、B 预设消费者画像去重、C HTTP 402 配额弹窗。实现前写测试，完成后执行 client/server 的 test、tsc、build，并保持 localhost:5173 可验证。
```

---

## 7. 当前登录态说明（供产品/设计理解）

项目使用 Supabase Auth 的浏览器持久化会话：`persistSession` + `autoRefreshToken` + `getSession()` 恢复，且只有邮箱已确认的用户视为已登录；前端没有硬编码“登录 N 天”，实际可保持多久取决于 Supabase 项目配置的 JWT 与 refresh-token 会话策略，用户退出、令牌失效或服务端撤销会结束会话。
