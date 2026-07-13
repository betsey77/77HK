# Slice G1 验收阻断修复（单 Claude 顺序执行）

你正在直接修复当前工作目录 `D:\work\77港话通社媒文案\77`。**禁止创建 git worktree、禁止切换分支、禁止 git clean/reset/checkout；当前大量未提交文件就是完整产品现状，必须原地保留。** 先读 README、CLAUDE.md、权威 spec、`.planning/regression_matrix.md` 与所有 Supabase migrations。不要新增 migration、不要推送远程数据库、不要更改角色、不要接触/输出 secrets。保持现有功能，不做大重构。

## 背景

上一轮测试通过但独立验收失败：测试 mock 了错误的数据库结构；日历覆盖只记录 warn，没有修正最终输出。请先写能失败的测试，再做最小修复。

## A. 节日/话题日历必须进入五个平台最终结果

当前 `validateCalendarCoverage` 仅告警，用户仍会收到只有 Shorts 提及节日的结果。

要求：

1. 新增纯函数（可命名 `ensureCalendarCoverage`），对 `standardHK/lightCantonese/ig/facebook/shorts` 逐一检查。
2. 有选中 calendar events 时，任何缺失的平台都必须在最终返回/persist 的文案中获得自然、平台适配的节日桥接句；已有覆盖不得重复；无 event 时严格保持原结果。
3. 不额外调用模型、不重试、不额外消耗 quota。可从事件 `titleZh`、`angles`、`narrativeHooks` 生成确定性短句。不要只检查过短的 2 字片段造成误判。
4. 修正必须发生在审核结果落库与 HTTP 返回之前，确保持久化与返回内容一致。若 audit 是针对生成文案，保证它使用修正后的 variants；如当前并行结构无法重跑 audit，至少明确记录最终覆盖并确保返回/落库一致，不新增模型调用。
5. 测试：只有 shorts 命中时其余四项被补全；全部命中不变；无 event 不变；五个 key 全部存在；生成路由使用修正后的结果完成持久化/返回。

## B. Admin API 必须严格匹配现有 migrations

当前实现错误使用 `profiles.email/last_sign_in_at/deleted_at`、`subscriptions.owner_id/quota_used`、`audit_log.actor_id/resource/metadata`、不存在 RPC，并使用 `select('*')`。请按 migration 的真实字段修正。

要求：

1. `profiles` 只使用实际字段：`id,display_name,status,deletion_requested_at,purge_after,created_at,updated_at`。
2. `subscriptions` 使用实际 `user_id` 及真实周期/配额字段；`plan_id` 通过 `plans` 映射到真实 plan 名称。不要假装 profiles 有 email；G1 用 displayName + 脱敏 user id 即可。
3. generation list 只选真实元数据字段，禁止读取 `source/variants/diagnosis/audit/consumer_feedback` 来计算 preview/长度；使用现有软删除字段名。
4. feedback 默认列表禁止查询或返回 `content`/正文 preview，只返回真实 schema 中的元数据（type/title/status/created_at 等）。
5. audit log 使用真实列：`actor,actor_role,action,entity,entity_id,reason,diff,request_id,created_at`。
6. 禁止 `select('*')`，禁止不存在的 RPC。
7. 本 G1 可以完全移除/禁用生成正文 detail endpoint（推荐），因为它不是首屏必需；若保留，必须显式字段 allowlist、先确认资源存在、audit 写入失败则 fail closed，且真实列完全匹配。默认 list 绝不能含正文。
8. Supabase 查询 error 不能静默伪装成空数据；抛出后由路由返回统一 500。不得泄露内部 DB 错误。
9. 添加 schema contract tests：从 `supabase/migrations` 读取真实 SQL，断言 service 使用字段存在；至少让旧错误字段、`select('*')`、正文读取、不存在 RPC 会导致测试失败。不要只构造 TypeScript 对象自证。
10. 客户端 AdminPage/API 类型同步；不展示 email/正文预览等不存在或不允许的数据。

## C. Pricing 与安全 next 回归

1. `/` 顶部/套餐区域至少一处可到 `/pricing`；pricing Free/Pro CTA 必须进入真实 `/signup` 或 `/login` 流程，并带 allowlist 内的 next。
2. Signup 也必须调用 `resolveNextPath` 后才透传到 login；当前直接透传 raw next，需修复并测试外链、`//evil`、路径穿越均被丢弃。
3. 登录成功跳转仍只允许 allowlist。

## D. 收藏参考案例与沉淀

1. 保留上一轮的云端 HYDRATE、跨账户隔离、4/5 星筛选、备注、最多 3 条选择测试。
2. 确保折叠状态也能看见“可用 N 条”，有 2 个四星收藏时显示 2；不要修改收藏资格定义。
3. 更新权威 spec、ACCEPTANCE、CHANGELOG、`.planning/regression_matrix.md`：写成不可回归约束，明确日历是“最终五平台强制覆盖”，不是“仅告警”。不要覆盖或删掉旧功能说明。

## 验证与停止

依次运行：

- server `npx tsc --noEmit`
- server 全部测试
- server build
- client `npx tsc --noEmit`
- client 全部测试
- client build
- 检查 git diff，只保留本任务相关改动
- 搜索敏感信息，输出中绝不打印 key/token/.env 内容

完成后停止，汇报：根因、修改文件、测试计数、仍有限制、证据路径。若真实 schema 不清楚，停止并指出 migration 文件与冲突，不要猜字段。
