# Grok Build 任务：W3 正反例 Prompt 注入（三引擎一致）

## 任务目标

在 `D:\work\77港话通社媒文案\77` 中，增量实现 W3：用户主动选择的个人案例库正例/反例通过安全的服务端解析，影响当前生成请求的技法与负向约束；DeepSeek、CantoneseLLM、rules fallback 三条路径行为一致。

W2 Migration/RLS 已在远端存在。完成 W3 后立即停止。

## 核心流程（不得改变）

1. 客户端只发送 `selectedCaseLibraryIds`，最多 3 个 UUID；**不得发送案例 body/reason 或由客户端伪造的案例正文**。
2. 服务端使用当前用户 JWT 创建的 Supabase 客户端，按 owner、未软删除、所选 ID 读取案例；不得使用 service role 绕过 RLS。
3. 异主、不存在或已删除 ID 不泄露存在性：忽略该条，生成继续；如有用户可见提示，使用通用“部分已选案例不可用”。
4. 仅当前请求使用解析到的案例；生成任务的 `brief.workbenchSettings` / 最小案例快照记录实际解析案例的 `id/caseType/title/body/reason/tags`，供历史解释。不得让 W2 后续编辑/删除改写旧历史含义。
5. 未选择案例时，生成输出与现有行为保持一致。

## Prompt 与安全规则

- 正例：抽取 Hook、结构、句式节奏、表达氛围、CTA 或情绪技巧；明确禁止逐句复制、复述专有事实/品牌名、将示例的促销承诺当作当前品牌事实。
- 反例：将 `reason` 转为清晰的负向约束；禁止复述、模仿、反向拼接反例正文。
- 结构化案例如实传入 Prompt，但提示应防止模型照抄正文；不应把正反例标题当成用户当前产品资料。
- 与参考收藏案例共存：总上下文至多 5 条，其中案例库至多 3 条；用户刚选择的案例库优先，再按现有评分逻辑保留参考收藏案例。
- 节日/话题日历和参考收藏案例的既有注入必须保留，且每一个平台版本都应受相关约束，不能仅 Shorts 提及。
- DeepSeek、CantoneseLLM、fallback 必须使用同一个结构化 `caseLibraryContext`/约束构建器。fallback 不得逐字复制案例；应将正例可观察技巧转为安全的表达线索，将反例转为显式避免规则。

## 严格范围

- 不创建或推送数据库 migration，不改 RLS、表、支付、登录、管理员权限、部署、`.env` 或密钥。
- 不实现 W4 管理员审阅摘要/案例正文查看。
- 不实现折叠页、Accordion、`details`、`CollapsibleSection`，不重组 InputPanel。
- 不删除或覆盖 W1/W2、参考收藏、节日、五平台输出、生成进度、历史、收藏、套餐功能。
- 不使用 git reset/checkout/clean/stash/rebase/commit/push/worktree。

## TDD 验收

先补测试，再实现。至少覆盖：

1. 客户端只发送 selected IDs，不能把 case body/reason 放入请求；
2. 服务端 owner-scoped 解析：同用户、异主、已删除/不存在、超过 3、非 UUID；
3. DeepSeek/CantoneseLLM/fallback 都包含等价的正例/反例结构化约束；未选案例不出现此约束；
4. 正例不复制、反例不复述的明确规则；fallback 不回显案例正文；
5. 生成历史快照保留实际解析的案例最小快照；历史载入仅恢复 ID，删除后保持历史可解释；
6. 参考收藏案例、节日注入对五个平台均无回归；
7. W1 的类型/长度/语气、W2 CRUD/RLS 行为、收藏/历史回归通过。

运行相关测试和双端 tsc/build；更新 `spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`、`.planning/status.md` 与 `docs/evidence/2026-07-14/w3-case-prompt-injection/`。记录 W4 与折叠页仍未开发。
