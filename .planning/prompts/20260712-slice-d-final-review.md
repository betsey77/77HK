# Slice D 最终收尾（余额恢复后继续）

在 `D:\work\77港话通社媒文案\77` 原目录继续，启用 Agent Teams，但禁止 worktree、禁止读取/输出密钥、禁止真正 push Migration。用户已恢复 Claude Code 余额。本轮是同一 Slice D 的最终收尾，不扩大功能。

Codex 已在你中断后修复并验证：

- 重写 `client/src/hooks/useCloudSync.ts`：内容快照可检测现有收藏备注/评分与配置修改；串行 sync queue；owner-scoped API；持久 outbox；真实 retry；品牌 reducer 修改/清空同步；一次性本地迁移。
- `client/src/services/cloudSync.ts` API 增加 optional `expectedOwnerId`，并修正配置 fallback 默认值为 creativity=1、cantonese=4。
- `client/src/test/slice-d-hook.test.tsx` 已新增现有收藏修改、配置修改/删除、品牌修改/清空测试。
- 当前客户端 Slice D 两文件：58/58 tests PASS，`tsc --noEmit` PASS。

先只读复核这些改动，不要回退为 ID-only snapshot，也不要删除新增行为测试。若发现确定性 bug，可做最小修复并补测试。

## 仍需完成的明确项

### Server

1. 删除 `cloudSyncService.ts` 已无调用的 `sanitizeOverpost`。
2. 升级 `server/src/__tests__/sync.test.ts` 的 Supabase chain mock，必须记录 `.upsert(payload, options)`、`.eq(column,value)`、`.delete()` 参数；新增精确断言：
   - favorite/config/brand/import payload 均含 `owner_id: user-001`
   - conflict key 正确
   - delete 同时包含 owner_id 与 client_id filter
   - 伪造 owner/id 被 400 拒绝且没有进入 upsert
3. 单条和 import 完整验证 `variantMeta`、`scores` 为 object/null；`consumerFeedback` 为 array/null且长度受限；`savedAt` 为有效 ISO timestamp；所有 JSON 字段按 UTF-8 byte 限制。import favorites+savedConfigs 总数 <=200，而不是各 200。
4. 修正 `assertJsonSize`：不能 catch 自己抛出的超限错误；使用 `Buffer.byteLength(JSON.stringify(value),'utf8')`。
5. 统一 route error responder：只回传本模块显式构造的受控 4xx；未知错误/SDK/DB message 一律 `{error:'Internal server error'}` 500。数据库 `config_limit_exceeded` 映射受控 400/409，但不泄漏 SQL/constraint。
6. body parser >1MiB 要稳定返回 JSON 413，不因 `req.destroy()` 导致 socket reset；invalid JSON 400。补 supertest 测试。
7. `/api/connectivity` 目前只返回布尔/Node 版本、不探测外部 API，可以公开，但修正“authenticated only”误导注释并测试绝不出现 proxy URL/key。

### Migration

修正 `supabase/migrations/20260712070000_slice_d_cloud_sync.sql`：

- `settings/variant_meta/scores/consumer_feedback/config` 增加 DB `octet_length(field::text)` 上限，防直接 Data API 绕过。
- `reason_tags` 改为 `varchar(100)[] not null default '{}'`，CHECK `cardinality <=20` 且禁止空字符串。
- `check_config_limit()` 固定空 search_path、保持 security invoker。`revoke all ... from public, anon, authenticated, service_role` 后不要再 grant authenticated/service_role 直接执行；trigger 已由 migration owner 创建。
- 保持 per-owner advisory transaction lock、20 条上限和“20 条时 upsert 已有 client_id 仍成功”。不要改成非原子 count-then-insert。
- 增加静态测试断言这些 SQL 属性，并在 evidence 写明远端事务验收仍待 Codex push 后执行。

### Client 最终复核

- 为 `getAuthHeaders(expectedOwnerId)` 增加测试：session user 不匹配时在 fetch 前拒绝。
- 确认 hook 测试的 retry 真正等到第二次 bootstrap/outbox 清空，避免命中旧的 ready snapshot。
- 全量测试不得有未处理的 React act warning（如果现有 hook polling 导致 warning，改用 Testing Library `waitFor`/正确 act）。

## 完成门槛

实际执行并记录：

- Server 全量 Vitest + `tsc --noEmit` + build
- Client 全量 Vitest + `tsc --noEmit` + build
- `git diff --check`
- `npx supabase db push --linked --dry-run`，只能列出 Slice D；不得真实 push

更新 evidence/spec/planning，但不得写“远端已部署”或“双账号 RLS 已验收”。最后停止，逐条汇报。不要运行 `npm ci`。
