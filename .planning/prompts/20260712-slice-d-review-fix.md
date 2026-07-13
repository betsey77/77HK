# Slice D 审计修复任务（发布阻断）

你正在 `D:\work\77港话通社媒文案\77` 的真实工作目录继续 Slice D。用户已授权本轮使用 Agent Teams 和 bypass/yolo，但**禁止创建 git worktree**，禁止覆盖/回滚用户已有改动，禁止读取或输出任何密钥。先完整阅读 `README.md`、`AGENTS.md`、`CLAUDE.md`、`spec/` 与现有 Slice D 文件，再行动。

本轮只做：修复云同步发布阻断、补可靠测试、更新准确证据。不要做支付、套餐权益、UI 大改或其他新功能。不要推送远端 Migration；完成后停止并汇报，等待 Codex 独立复核。

## 已确认的发布阻断

1. `server/src/services/cloudSyncService.ts` 的 mapper 已写入可信 `owner_id`，随后 `sanitizeOverpost(dbRow)` 又把它删除，导致 favorite/config/brand/import 的 INSERT/UPSERT 违反 NOT NULL。修复后测试必须精确断言发送给 Supabase 的 payload 包含认证用户的 `owner_id`，且请求体伪造 owner/id 会被拒绝、永不进入 DB payload。
2. `client/src/hooks/useCloudSync.ts` 的 hydration effect 依赖 `state.syncStatus`，effect 自己把 idle 改为 hydrating 后 cleanup 会把当前请求标记 cancelled，可能永久卡在 hydrating。实现 owner-scoped、可重复进入但不会自我取消的明确状态机。
3. 收藏/备注/评分/删除、配置新增/替换/删除、品牌新增/修改/清空的 mutation helper 没有接到实际 reducer 行为。建立一个小而清晰的同步 facade/outbox：先本地乐观更新，再把变化可靠同步到云端；失败保留本地并可显式重试，不能再声称“自动重试”却没有重试。避免 hydration 阶段把空状态写回云端。
4. bootstrap hydration 必须校验每条返回记录 `ownerId === 当前 ownerId`；不匹配即拒绝显示并进入受控错误。认证 session 的 user id 必须与 hook ownerId 一致。
5. legacy global 数据只能显式确认后导入；必须实际使用 `isLegacyImported(ownerId)`，导入成功或选择跳过后该账号不再重复提示。提示需说明“可能来自本浏览器旧版本/旧账号”。导入成功后当前状态应可见。namespaced 本地数据迁移也不能在未来把云端已删除记录静默复活；采用一次性、可记录的迁移语义或更小的持久 outbox/tombstone 方案，并用测试证明删除后重新 hydration 不复活。
6. logout 必须 `await logout()` 成功/结束后再跳转，避免旧 session 恢复。
7. `server/src/app.ts` 的健康/连通性接口绝不能返回 `HTTP_PROXY/HTTPS_PROXY` 原值或带 key 的 URL；只返回布尔配置状态。`/api/connectivity` 在生产环境禁用或用现有认证中间件保护，避免匿名消耗外部 API。
8. 手写 JSON parser 要有明确大小上限（建议 1 MiB）：超限 413、非法 JSON 400，不得静默改成 `{}`。未知服务端异常固定返回通用 500，不把数据库/SDK 原始 message 暴露给客户端。

## Migration 必须加固（仍只保留本地）

处理 `supabase/migrations/20260713000000_slice_d_cloud_sync.sql`，并把文件改名为当前日期且晚于 C2a 的 `20260712070000_slice_d_cloud_sync.sql`：

- 三表 DB 级约束 `client_id` 非空且 <= 256。
- JSON 字段限制序列化大小；`reason_tags` 限制数组元素为字符串、数量和单项长度（可改成 `text[]`，同步更新映射）。
- `saved_configs` 的每账号 20 条上限必须由数据库原子执行、无法通过直接 Data API、bulk import 或并发绕过；已有同 `(owner_id, client_id)` 的 upsert 在 20 条时仍应允许更新。可用 owner-scoped advisory transaction lock + BEFORE INSERT trigger，函数固定 `search_path`，最小权限，并补 SQL/集成测试。
- bulk import 限制批次数量并完整验证所有可选字段；不能借 import 突破 20。
- 移除 Slice D 中已被 UNIQUE 覆盖的冗余索引，只保留确有排序价值的 `(owner_id, saved_at desc)`。
- 保持 owner RLS 的 SELECT/INSERT/UPDATE/DELETE；不能让用户改变 owner。不要使用能绕过 owner 校验的宽泛 SECURITY DEFINER。

## 数据一致性与校验要求

- cloud 是 hydration 的基准；字段为 null 时必须能清空旧本地品牌，不能用旧值复活。云端无品牌而本地有品牌时，使用明确的一次性迁移/同步路径。
- 配置默认 fallback 与正式规范一致：结构化关、创作自由度 1、粤语程度 4、中英夹杂 1、无目标用户。
- 单条与 import 均验证 favorite 的 `variantMeta/scores/consumerFeedback/savedAt/notes/rating/favoriteReason/reasonTags`，限制 JSON 大小/数组长度；import 有总批次上限。
- 配置 20 条限制的错误应是受控 4xx；数据库未知错误只能是通用 500。
- import 真正调用两次并证明幂等；不能用一次请求冒充“两次”。

## TDD / 必须新增的行为测试

先写失败测试再修复。至少覆盖：

- hook 实际 render：hydration 从 idle -> hydrating -> ready，不会永久转圈；失败后点击重试成功且错误清除。
- 在 `AppProvider` 中 dispatch 实际收藏新增、备注/评分修改、删除，分别观察正确 upsert/delete；配置新增/替换/删除与品牌新增/修改/清空同理。
- hydration 前不写；空初始状态不会覆盖云端；云端 null 清空本地字段。
- A/B owner 切换、伪造不同 ownerId 的 bootstrap 被拒绝；legacy 每账号最多提示一次，导入和跳过均有测试。
- 网络失败后本地保留；重试成功；删除后 reload/hydration 不会被本地旧数据复活。
- Server mock 必须记录 `.eq()`/`.upsert()`/`.delete()` 等参数；断言可信 owner_id、owner filter 与 conflict key。补真实连续两次 import。
- 19 条后并发新增两条最多成功一条；20 条时更新已有配置成功；import/直接 Data API 均不能超过 20（数据库行为可先写可在远端事务执行的 SQL 验收脚本，远端由 Codex 复核后执行）。
- invalid JSON 400、超大 body 413、超大 import 400、未知异常通用 500、health/connectivity 不含代理 URL/凭据。

## 完成门槛

在本地依次运行并记录：

- Server 全量 Vitest
- Server `tsc --noEmit` 与 build
- Client 全量 Vitest
- Client `tsc --noEmit` 与 build
- `git diff --check`
- `npx supabase db push --linked --dry-run`（只允许看到新的 Slice D Migration；不得真正 push）

更新 `spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`、`.planning/task_plan.md`、`.planning/progress.md`、`.planning/findings.md`、`.planning/status.md` 和 `docs/evidence/2026-07-12/slice-D-cloud-sync/notes.md`，但不能把尚未远端推送/未做真实双账号 RLS 验收写成已完成。

最终汇报：修改文件、逐项测试输出、仍有风险、dry-run 结果。然后停止。
