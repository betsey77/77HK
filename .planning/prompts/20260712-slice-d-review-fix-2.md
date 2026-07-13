# Slice D 第二轮审计修复（第一次未通过验收）

继续在 `D:\work\77港话通社媒文案\77` 原目录工作。启用 Agent Teams 但禁止 worktree、禁止远端 push、禁止读取/输出密钥。先读本文件涉及的现有代码。本轮是同一问题第 2 次尝试，必须用真实行为测试证明修复，不能再用“helper 可用”代替“业务已接通”。

## 独立复验发现第一次修复仍未通过

### 客户端 P0

1. `rg` 证明 `syncFavoriteToCloud/syncFavoriteDeleteToCloud/syncConfigToCloud/syncConfigDeleteToCloud/syncBrandProfileToCloud` 仍只在 `useCloudSync.ts` 内定义并 return；全项目没有业务调用。新收藏、备注/评分、删除、配置、品牌仍不会写云端。
2. `retryHydration()` 只把 `hydratedRef=false` 和 reducer status=idle，但 hydration effect 不依赖 status/retry token，owner/auth 没变化时 effect 不会重跑；按钮是假重试。
3. namespaced local-only 数据每次 mount 都自动 import，没有任何实际 migration marker/tombstone；注释写“ONCE”但代码未实现。云端删除可能被旧本地数据重新上传。
4. 当前 `client/src/test/slice-d.test.tsx` 没有 import/render `useCloudSync`，仍然 0 个 hook/业务行为测试。第一次报告的 92/92 不能证明修复。
5. hydration 先 dispatch cloud-only state、再 import local-only，导入项当次 UI 不可见；legacy import 成功后也没有把返回/本地项目 hydrate 到当前 state。
6. mutation 同步失败没有真正的 pending queue；重试 hydration 不能重放失败操作。

### 服务端/SQL P1

1. `sync.test.ts` 的 query mock 仍完全忽略 `.upsert()` 与 `.eq()` 参数；没有断言 DB payload 含可信 `owner_id`，所以 owner 修复仍是假覆盖。
2. migration 没有 JSON 序列化大小 CHECK；`reason_tags text[]` 没有单项长度约束；trigger function 不应显式 grant 给 authenticated/service_role（触发器执行不需要用户直接调用它）。
3. route 未完整验证单条/import 的 `variantMeta/scores/consumerFeedback/savedAt`，import 也缺这些 JSON size/type/array 限制；两个数组各 200 可合计 400，应限制总量。
4. `assertJsonSize` 在 try 内抛出的 size 错误会被自己的 catch 吞掉并误报“not serializable”，且按字符数而非 UTF-8 bytes。
5. routes 的 catch 仍把任何 `err.message` 原样回传；必须只放行自定义受控 4xx，未知 500 固定通用文案。数据库 config_limit 错误映射为受控 400/409。
6. app body parser 超限后立刻 `req.destroy()` 可能在响应 flush 前重置连接；用可测试且不会 socket reset 的实现。`/api/connectivity` 注释说 authenticated 但实际未鉴权；要么加现有 `requireAuth`，要么明确改成公开且仅布尔健康状态，注释/测试一致。
7. `sanitizeOverpost` 已不再使用，应删除，避免误导。

## 必须采用的最小可验收方案

### A. 真正接通 mutation

- 在 `useCloudSync` 内实现 hydration 后启用的 state-diff 同步器，或建立同等清晰的 mutation facade。必须观察 `state.bookmarkedCopies`、`state.savedConfigs`、品牌三字段，与“最后成功云端快照”比较：
  - 新增/修改（包括备注、评分） -> upsert
  - 消失 -> delete
  - 配置新增/替换/删除 -> upsert/delete
  - 品牌新增/修改/清空 -> upsert（null 也要发送）
- hydration 期间禁止任何反向写；初始空 local 不能覆盖 cloud。
- 用 owner-scoped、持久化在 localStorage 的小型 pending outbox（只存操作类型/clientId/payload）保存失败写。成功后删除；显式“重试”要先重放 outbox，再重新 bootstrap/hydrate并清除错误。
- 不需要做复杂 CRDT；MVP 冲突规则保持 cloud hydration 为基准，之后本机乐观写。

### B. 一次性本地迁移，防复活

- 增加 per-owner marker，例如 `hk-cantonese-cloud-migrated:${ownerId}`。
- marker 不存在时，允许把该 owner namespaced local 数据做一次迁移；只有 import 成功才写 marker，并让导入项立即出现在本次 UI/baseline。
- marker 已存在时，bootstrap 的 cloud 数据是唯一基准，绝不再次把 local-only 自动上传。测试必须证明“云端已删除 + 本地残留 + marker=true”不会复活。
- legacy global 继续显式导入/跳过；导入成功后当前 UI 立即可见。

### C. 可重跑状态机

- 把 hydrate 做成稳定 callback，并使用 `retryNonce` state 或明确调用该 callback；owner 变化时完整重置 owner-scoped refs/outbox/baseline。
- 取消 5 秒后假装 ready 的逻辑。失败就保持 error，用户可点击真实重试。
- 请求前/后都验证当前 Supabase session user id 与 ownerId 一致；旧 owner 的异步结果不能写入新 owner state。

## 强制新增测试（测试文件必须真的变化）

新增 `client/src/test/slice-d-hook.test.tsx`（或等价新文件），用 Testing Library `renderHook`/测试壳 + `AppProvider`：

1. idle -> hydrating -> ready；不会永久转圈。
2. retry 首次 bootstrap 失败、点击/调用 retry 后第二次 bootstrap 成功。
3. hydration 不触发任何 upsert/delete。
4. dispatch 实际 ADD/UPDATE/REMOVE bookmark，断言 upsert/delete；UPDATE 必须覆盖备注和评分。
5. SET_SAVED_CONFIGS 的新增/替换/删除分别触发正确写操作。
6. 品牌新增、修改、清空发送正确 payload。
7. 写失败进入持久 outbox；retry 成功重放并清空错误/outbox。
8. marker=true 时，cloud 无记录而 local 残留不会 import/复活；首次迁移成功只执行一次且当前 UI 可见。
9. 不同 ownerId bootstrap 数据被拒绝；owner A/B 切换不交叉写。
10. legacy 每 owner 只提示一次，import/skip 均立即隐藏；import 后数据当前可见。

服务端测试升级 mock，使其记录 chain 方法参数，并新增断言：

- favorite/config/brand/import upsert payload 中 `owner_id === verified user-001`；伪造值被拒绝。
- delete 的两个 `.eq()` 是 `owner_id=user-001` 与正确 client_id。
- import 连续发两次真实 HTTP 请求，第二次不增加行数（可用有状态 mock）。
- invalid JSON 400、>1MiB 413（连接正常返回 JSON）、未知异常只回通用 500。
- optional favorite 字段单条/import 全部非法类型、数组过长、无效 savedAt、JSON 超限、总 batch >200。

### SQL 修正

- 为 JSON 字段增加 DB `octet_length(field::text)` 上限，防止直接 Data API 绕过。
- `reason_tags` 使用能从类型层限制元素长度的 `varchar(100)[]`，并 CHECK cardinality <=20、禁止空字符串。
- trigger function 固定 search_path、保持 invoker/owner RLS；revoke direct execute 后不要再 grant 直接调用权限。
- 保持原子 20 条触发器，并新增静态测试/远端事务验收脚本说明：19+并发2、20时 upsert已有、直接 Data API 第21条失败。

## 完成门槛

必须实际运行并记录：Server 全量 tests + tsc + build；Client 全量 tests + tsc + build；`git diff --check`；Supabase dry-run（仅 Slice D）。如果 build 被文件锁阻断，不得写“完成”，先查并停止仅属于本项目的 dev server，再重跑；禁止运行 `npm ci`。

文档只写真实通过项。Migration 不得真正 push。最后停止并给出新增测试名称、数量、关键断言与仍未通过项。
