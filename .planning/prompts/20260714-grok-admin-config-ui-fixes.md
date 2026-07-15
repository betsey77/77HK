# 管理员审阅、配置保存与左侧标签 UI 修复（仅前端/现有 API）

## 目标

在既有 `D:\work\77港话通社媒文案\77` 做一个最小修复切片，解决以下三个问题：

1. 管理员查看长收藏正文时，弹窗必须始终可关闭、可复制；审阅摘要更紧凑清晰。
2. 管理员收藏中的文案类型、平台必须显示中文可读标签，而不是 `spoken` / `all`；缺失字段仍显示“未填写”。
3. 左侧输入模块标签视觉统一（合适 emoji）；保存配置完整保存、加载完整恢复发布日期与话题日历；“复原创作配置”将发布日期恢复为**执行当日香港日期**，不能沿用过去日期。

## 强制边界

- 只增量修改现有项目；不新建平行应用、替换路由或删除原有功能。
- 不读取、打印或修改 `.env`、密钥、Supabase/支付宝配置。
- 禁止 Migration、RLS、远端写入、支付服务端改动、部署。
- 不改 `/api/billing/*` 或 `BillingPage` 的跳转行为；支付速度由主代理另行取得用户确认后处理。
- 禁止左侧折叠页、Accordion、`details`、`CollapsibleSection` 或重组 InputPanel 信息架构。
- 不改管理员只读/审计权限：收藏详情与案例详情的 existing → audit → body 顺序必须保持；不新增管理员写接口、批量导出、编辑或删除。
- 必须 `--no-subagents`。先写失败测试，再实现。不得 git reset/checkout/clean/stash/rebase/commit/push/worktree。

## A. 管理员收藏详情弹窗

文件重点：`client/src/pages/AdminPage.tsx`。

1. 遮罩层保留；弹窗容器必须有 `max-height`（视口内留出边距）、`flex flex-col`、`overflow-hidden`。
2. 标题/关闭按钮固定在弹窗顶部可见（不可被长正文挤出）；正文区域成为独立 `flex-1 min-h-0 overflow-y-auto` 滚动区。
3. 复制按钮固定在弹窗底部可见，或在同一可见 footer；不能随正文滚到屏幕外。复制仍只复制正文。
4. 审阅摘要保持正文上方，但压缩为响应式两列网格（窄屏一列）；视觉层级为小标题 + 紧凑 label/value，避免占用过多高度。保留：用户、变体、品牌、产品、文案类型、平台、评分、收藏时间、用户备注、收藏原因、标签；缺失为“未填写”。
5. 保持浅色橙色、深色荧光绿和现有 shadcn 风格。

## B. 管理员中文显示

只在展示层映射，**不要改变数据库或 API 的稳定枚举值**。

- copyType：`social`→`社媒文案`，`spoken`→`口播稿`，`poster`→`海报短文`，`advertorial`→`软文章`，`poetry`→`诗歌`，`custom`→`自定义`；未知或空→`未填写`。
- platform：`all`→`全部平台`，`ig`→`IG`，`facebook`→`Facebook`，`shorts`→`Shorts`；`standardHK`→`标准繁中`，`lightCantonese`→`轻粤语`；未知或空→`未填写`。
- 列表的“类型/平台”和详情摘要都必须使用中文映射。`platform` 缺失时可回退映射 `variantKey`，但不能显示原始 `all` / `spoken` 英文枚举。

## C. 左侧标签 emoji（不改变布局/逻辑）

给左侧输入区已存在的主要模块 label 前添加语义合适的 emoji，至少覆盖：文案类型、目标平台、主语气、发布日期；并与现有模块保持统一紧凑字号。建议：📝 文案类型、📱 目标平台、🎭 主语气、🗓️ 发布日期。可为相邻未带图标的参数标签补充图标，但不应添加装饰性大图、不可改变输入顺序或折叠。

## D. 保存配置与日期恢复

1. `ConfigManager.saveConfig` 必须写入 `targetDate` 与 `selectedCalendarEventIds`（拷贝数组），保存配置。
2. `hasUnsavedChanges` 必须比较这两个字段，避免用户选择日期/日历后仍显示“未储存”。
3. `LOAD_CONFIG` 已有恢复逻辑，保留并测试其恢复日期和话题日历。
4. `RESTORE_DEFAULT_GENERATION_SETTINGS` 必须重设 `targetDate` 为调用时的香港自然日 `YYYY-MM-DD`（不得用模块初始化时的旧 `DEFAULT_SETTINGS.targetDate`；不得受 UTC 导致香港日期落后）；将 `selectedCalendarEventIds` 重设为空。保留既定默认：结构化写作 false、创作自由度 1、粤语 4、中英 1、无目标用户。
5. 旧配置没有这两个字段时，要兼容：恢复为当前默认日期、空日历；不得报错。
6. 同步/本地配置既有 schema 已支持字段；本切片不得改数据库。确认云同步保存的 config payload 仍带这两个字段即可。

## TDD 验收

- 长正文下，详情弹窗包含 max-height/flex 布局、可见关闭按钮与固定/可见复制操作；摘要位于正文前。
- `spoken/all` 在管理员收藏列表和详情摘要渲染为“口播稿/全部平台”；缺失显示“未填写”。
- 配置保存对象包含 targetDate 和 selectedCalendarEventIds，未保存判断纳入两项，LOAD_CONFIG 恢复两项。
- 恢复默认配置以模拟香港日期为准，并清空日历选择。
- 目标标签包含指定 emoji；不引入 Accordion/details。
- 运行相关 Client Vitest、Client `tsc --noEmit` 与 production build；Server 的现有 Admin 测试/tsc/build 作为回归。更新 ACCEPTANCE、CHANGELOG、status 与 `docs/evidence/2026-07-14/admin-config-ui-fixes/verification.md`。

## 完成汇报

仅写：修改文件、行为变化、测试精确结果、未做项。不要宣称改过支付、数据库、RLS、远端或密钥。
