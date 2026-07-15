# 登录视觉、收藏信息布局与工作台左侧折叠分组

## 目标

在 `D:\work\77港话通社媒文案\77` 做一个前端小切片。必须保留既有认证、生成、收藏、配置、云同步、额度和管理员安全逻辑；本次仅优化视觉布局和左侧信息架构。

## 必读

1. `README.md`
2. `CLAUDE.md`
3. `docs/design-system.md`
4. `spec/PRD.md`、`spec/SDD.md`、`spec/TEST_PLAN.md`
5. `.planning/status.md`、`.planning/context_pack.md`

## 严格边界

- 不更改数据库、Migration、RLS、Supabase、`.env`、密钥、支付服务端、订单、Webhook、额度或权限。
- 不删除、重置或覆盖已有用户改动；不运行 git reset/checkout/clean/stash/rebase/commit/push/worktree。
- 不增加依赖，不引入新的 UI 框架；复用 React、Tailwind、Lucide 与现有组件。
- 深色使用荧光绿/emerald 强调，浅色以白色为主、橙色强调；Logo 必须继续使用 `/brand/77-logo.png` 且无白边。
- 不做移动端专项重构；桌面工作台现有三栏布局必须可用。

## A. 登录页视觉（基于当前官网，而不是另做营销页）

目标 URL：`/login?next=%2Fapp`。

1. 参考现有官网 `MarketingPage.tsx` 的克制、专业、深色科技感结构：黑灰基底、细边框/微弱格栅或光晕、紧凑品牌识别、明确主行动。不能把官网整段营销内容复制进登录页。
2. 在 `AuthLayout` / `LoginPage` 做精致但克制的认证体验：
   - 左栏清晰展示 77 Logo、名称、英文副标题和不超过 3 条简短产品能力（例如五平台变体、审核评分、消费者反馈）；
   - 右栏有明确「欢迎回来」/登录说明、统一输入框和 CTA；
   - 顶栏保留回官网和主题切换；
   - 浅色为白底 + 橙色，深色为深黑 + 荧光绿；
   - 视觉应与官网同属一个产品，但登录表单仍是重点；不要大标题撑满屏幕或添加冗余装饰。
3. 保留并测试现有登录行为：email/password、错误提示、加载态、`next` 白名单跳转、忘记密码、注册入口、主题切换和无障碍 label/id 关联。不要修改 AuthContext / Supabase 调用。
4. 如共享 `AuthLayout` 被优化，注册、忘记/重置密码页面必须不回归。

## B. 收藏库卡片：修复头部文本重叠

文件重点：`client/src/components/favorites/FavoritesPanel.tsx`。

截图中的问题来自卡片头部同时出现文案类型、变体、发布平台 select、日期及三个图标操作，窄桌面宽度时互相覆盖。

1. 改为可收缩/可换行的元信息布局：
   - 左侧元信息可换行；品牌/产品、类型、变体、发布平台仍清楚可见；
   - 日期不能被下拉/图标盖住，必要时放到第二行；
   - 复制、载入参数、删除操作必须固定在右侧，不被文本遮挡，也不超出容器；
   - 发布平台 select 仍可编辑、可键盘操作，有可访问 label；
   - 不能删除现有品牌/产品红色强调、评分、备注、批量管理、删除确认或参数载入。
2. 使用设计系统紧凑尺寸（10–12px 辅助信息），避免无意义的增大卡片。

## C. 管理员收藏表：备注和标签高亮

文件重点：`client/src/pages/AdminPage.tsx`。

1. 修正表头与列内容在窄宽时的可读性；「备注 / 标签」可在表头换行，列本身保持可读，横向表格滚动仍可用。
2. 每条收藏的备注（若存在）用低饱和强调容器显示；标签显示为中文的多个紧凑 chip，不能再是纯灰色长文本。
3. 继续使用现有 `formatAdminReasonTags`：不能展示英文 key；未知标签仍显示「自定义标签」。
4. 不改管理员读正文的审计先行/fail-closed 安全路径、检索字段、权限或 API。

## D. 已授权：工作台左侧折叠页

文件重点：`client/src/components/input/InputPanel.tsx`。这是用户已授权的功能；在完成后应能给用户做一轮功能验收。

### 信息架构

- 保持 `SourceEditor`、`LanguageToggle` 在最上方，始终可见。
- 将其余现有组件按以下四个**大折叠页**组织；不可丢失任一组件或改变它们的 state/action：
  1. `品牌与内容场景`：CopyTypeSelector、BrandInput、BrandRedLinesInput、TargetDatePicker、CompetitorSearchInput。
  2. `文案参数`：StructuredBriefToggle、CreativitySliderComponent、PlatformSelector、LengthControl、ToneSelector、CantoneseSlider、EnglishMixingSlider。
  3. `目标受众与参考`：PersonaManager、ReferenceCaseSelector、CaseLibraryPanel。
  4. `配置管理`：ConfigManager。
- 默认展开「品牌与内容场景」和「文案参数」；默认收起「目标受众与参考」「配置管理」。
- 折叠头显示合适 Lucide 图标、标题、简短数量/说明和 Chevron；有 hover/focus/键盘与 `aria-expanded`。
- 已展开内容使用原组件与原间距；收起时不应产生大段空白。可以隐藏但尽量保持组件挂载，避免案例库加载/选择、保存配置、输入草稿被意外清空。
- 生成按钮仍固定在所有折叠页之后；配置保存/载入、发布日、话题日历、参考收藏案例、正反例案例库、所有 W1 参数必须保持原有可用性和保存能力。
- 不实现任何新的字段或业务规则；只改输入侧的布局和可发现性。

## 测试与验收

先更新/补测试，再实现。

1. Login：显示品牌 logo/欢迎回来，既有输入、忘记密码、注册、next 跳转、认证行为测试通过。
2. 收藏卡片在窄容器中：发布平台 select、日期和三个操作均存在且不重叠；元信息能换行；保留可访问 label。
3. 管理员表：备注高亮、标签 chip 中文化，表头可换行/不重叠，且不影响管理员详情安全回归。
4. InputPanel：四个折叠页存在；默认展开/收起符合上述要求；点击能切换；Source/Language 一直可见；已保存配置和现有参数组件仍在 DOM/可访问（不得因为折叠丢 state）。
5. 完整回归：
   - `cd client && npx vitest run && npx tsc --noEmit && npm run build`
   - `cd server && npm test && npx tsc --noEmit && npm run build`

## 文档交付

1. 新建 `docs/evidence/2026-07-14/login-admin-accordion/notes.md`，记录修改范围、测试命令、结果和未做项。
2. 更新 `.planning/status.md`、`.planning/progress.md`、`.planning/task_plan.md`、`spec/CHANGELOG.md`。
3. 清楚注明：无 Migration/RLS/支付/服务端业务逻辑变更；左侧折叠页只重组现有控件，用户保存配置的字段保持不变。
4. 不提交或推送 Git。
