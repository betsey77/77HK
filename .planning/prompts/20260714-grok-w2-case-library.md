# Grok Build 任务：W2 个人正反例案例库（不含 Prompt 注入与折叠页）

## 任务目标

在现有项目 `D:\work\77港话通社媒文案\77` 内，增量实现 `spec/WORKBENCH_CONTENT_CONTROLS.md` 的 **W2**：每个已登录用户管理自己的正例/反例案例库，并可选择案例 ID 保存进配置。完成后停止。

## 授权与高风险边界

- 用户已批准 W2 开发及本地 Migration/RLS 脚本编写。
- **不得执行 Supabase 远端 Migration/RLS 推送、部署、真实支付或任何 `.env`/密钥修改。** 远端推送由 Codex 在本地复验后单独取得确认。

## 必须实现

### 1. 数据库迁移（仅新增本地 SQL 文件）

新增时间戳正确的 `supabase/migrations/*_w2_case_library.sql`：

- 创建 `public.case_library_entries`：`id uuid`、`owner_id uuid references auth.users(id)`、`case_type`（`good` / `bad`）、可空 `title`、`body`、`reason`、`tags jsonb` 默认空数组、`created_at`、`updated_at`、`deleted_at`。
- 约束：title 为空或最多 120 字；body 20–5,000 字；reason 1–500 字；tags 最多 8 个、每个 1–30 字，且仅字符串；`case_type` 仅 good/bad。
- 提供 `updated_at` 触发器并启用 RLS。
- RLS 只允许已登录用户对 `owner_id = auth.uid()` 且未软删除记录进行 select/insert/update；更新不能越权更改 owner；删除走软删除，不能物理删除。
- 不增加 public SELECT；不可添加可绕过 RLS 的匿名策略。

### 2. 服务端 BFF（用户本人 CRUD）

- 复用当前认证和错误响应惯例，实现登录用户的列表、创建、更新、软删除 API；校验所有字段与 ID 归属。
- 列表支持 `query` 与 `caseType`，按 `updated_at desc`，不返回已软删除记录。
- 标题为空时显示名由客户端推导为“未命名正例”/“未命名反例”，并用正文前 24 个字符做辅助摘要；不要把此显示名写回数据库。
- 一次生成最多选择 3 条案例；选择的只是 ID。
- 严禁把案例正文注入生成 Prompt、传给 DeepSeek/CantoneseLLM/rules fallback，或加入 generation job 快照——这些属于 **W3**，本轮不做。
- 本轮不得新增管理员或超级管理员案例正文接口/权限；那是 W4。也不得改已有管理员收藏逻辑。

### 3. 工作台 UI 与保存配置

- 在当前左侧输入面板下半部、`ReferenceCaseSelector` 与 `ConfigManager` 附近以增量方式加入“个人案例库”入口和选择器。**禁止任何折叠页、Accordion、`details`、`CollapsibleSection` 或重组 InputPanel。**
- 支持新增、编辑、软删除自己的正例和反例；删除必须复用现有确认弹窗。
- 创建/编辑表单：标题可选，正文与原因必填，tags 可选；呈现长度与数量校验错误。
- 可搜索标题、正文、标签和类型；选择状态展示类型、标题或未命名显示名、原因摘要；最多 3 条。
- `selectedCaseLibraryIds` 必须进入 AppSettings、未保存状态、保存配置、云同步与历史工作台载入；如果被选案例后来删除，加载配置时忽略并给出非阻塞提示，不做静默替换。
- 保留现有参考收藏案例、节日、文案类型、长度、语气、进度、收藏、历史、额度、支付与管理员交互。

## 禁止项

- 不实现 W3 正反例 Prompt 注入，不改生成 Prompt/模型服务（除非类型同步的编译需要，且不得传正文）。
- 不实现 W4 管理员审阅摘要或案例正文访问。
- 不实现左侧折叠页；不新增平行应用、路由替换、端口修改或大重构。
- 不读取、打印、编辑 `.env` 或任意密钥；不使用 git reset/checkout/clean/stash/rebase/commit/push/worktree。

## TDD 与交付

先写测试再实现，至少覆盖：

1. 字段验证、title 选填、tags 限制、未命名显示名；
2. 所有 CRUD API 的登录、owner 隔离、软删除及非法 ID；
3. migration/RLS 静态策略检查；
4. UI 的新增/编辑/删除确认、搜索、最多选择 3 条；
5. 配置保存与载入选择；已删除选项的非阻塞提示；
6. 断言 W2 不把案例 body/reason 传入生成请求或 Prompt；
7. 既有参考收藏案例、节日、W1 与历史/收藏回归。

执行并记录：

```powershell
cd client; npx vitest run <相关测试>; npx tsc --noEmit; npm run build
cd ..\server; npx vitest run <相关测试>; npx tsc --noEmit; npm run build
```

更新 `spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`、`.planning/status.md`，并在 `docs/evidence/2026-07-14/w2-case-library/` 记录脱敏证据。明确说明远端 Migration/RLS 尚未推送、W3/W4/折叠页未开发。

最终仅报告改动文件、测试结果、未做事项与可人工验收路径。
