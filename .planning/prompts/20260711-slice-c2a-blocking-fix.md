# Slice C2a 独立验收阻断修复

上一轮报告不能通过验收。先完整读取 `.planning/prompts/20260711-slice-c2a-local.md`、当前 C2a 新增文件、测试与文档，再做本轮最小修复。继续使用 Claude Code Agent Teams、auto mode；Leader 独占共享入口/文档，Database agent 只改 Migration/SQL 断言，Backend agent 只改 adapter/quota service/unit tests，Review agent 最后只读复核。

## 独立验收发现（必须全部修复）

1. **阻断：reserve 非原子。** `quotaService.reserveQuota` 当前 SELECT subscription → INSERT ledger → UPDATE quota_used，是 check-then-act 竞态，违反原始 C2a 的原子预占验收条件。
2. **阻断：ledger 并非 append-only。** consume/release 当前 UPDATE 原 reserve 行的 `event_type`，但 Migration 又只向 service_role 授予 ledger SELECT/INSERT；远端会直接失败，且账本语义自相矛盾。
3. **阻断：release 有 TOCTOU fallback。** 禁止任何 SELECT quota_used → 应用内计算 → UPDATE 的回退路径。
4. **阻断：使用已停用的 legacy key 命名。** 适配器、注释、测试和文档必须只接受现代 server secret 环境变量 `SUPABASE_SECRET_KEY`。不得读取、兼容、请求或提及 `SUPABASE_SERVICE_ROLE_KEY`/legacy key。SQL 中 PostgreSQL 数据库角色 `service_role` 可保留，因为它是授权角色，不是密钥名。
5. **阻断：未知超时逻辑与注释不一致。** generate.ts catch 对所有错误都会 failJob + release。对不确定的 timeout/network interruption 必须保留 job 为 processing、reservation 为 reserve，返回可恢复的 202/jobId（或与现有客户端轮询协议一致的等价响应），不能 fail/release；已知业务失败才 fail + release。
6. **阻断：Migration 中 3 个 job SECURITY DEFINER 函数只允许 service_role，却依赖 `auth.uid()`，以 modern secret 调用时 auth.uid() 为 null，因此是死代码。选择一个最小一致方案：删除这 3 个未使用函数并保留 service_role 表写权限 + BFF owner WHERE；不要留下不可调用安全函数。
7. **文档失真。** 不能在同一份文档里同时称“原子预占/本地完成”又记录 medium 非原子缺陷。修复后才可标 done；未修复则标 blocked。

## 目标设计（不要另起复杂方案）

- `usage_ledger` 每个事件一行，永不 UPDATE/DELETE。
- reserve/consume/release 由三个 PostgreSQL 函数在数据库事务内原子执行，仅 `service_role` 可 EXECUTE；函数固定 `search_path = ''`。
- 函数显式接收 `_user_id`，因为 trusted server secret 调用没有用户 `auth.uid()`；调用权限仅 service_role，BFF 的 authenticated JWT 已由 `requireAuth` 验证，userId 来自已验证 token，禁止来自 request body。
- reserve：先按 `(user_id,idempotency_key)` 返回已有 reservation；锁定 active subscription（`FOR UPDATE`），检查额度，INSERT reserve event，并原子递增 quota_used；余额不足返回 null/明确结果。并发下不可超卖。
- consume：锁定 reservation；若已有 terminal event 则幂等返回；仅对 reserve 插入新的 consume event，不修改 reservation，不改 quota_used。
- release：锁定 reservation；若已有 terminal event 则幂等返回；插入新的 release event，并在同一事务原子递减 quota_used；绝无 fallback。
- 增加 `reservation_id` 自引用和约束/索引，确保同一 reservation 最多一个 terminal event（consume 或 release），禁止 consume/release 互相并存。
- quotaService 只调用上述 RPC，不直接跨多语句改 subscriptions/usage_ledger。
- 价格、额度、周期继续不写生产数值；测试 fixture 可使用明确的非生产值。

## TDD 必须新增/修正

- 并发/原子性静态断言：reserve function 内 `FOR UPDATE` + 余额检查 + ledger insert + quota increment；service 只调用 reserve RPC。
- append-only：代码和 SQL 不存在 `usage_ledger.update/delete`；consume/release 都插入 terminal event。
- terminal uniqueness：同 reservation 不可同时 consume/release；重复调用幂等。
- release 没有 fallback。
- adapter 只读 `SUPABASE_SECRET_KEY`；源代码/测试/文档中不再出现 `SUPABASE_SERVICE_ROLE_KEY`。
- timeout/uncertain error：不调用 failJob、不调用 releaseQuota，返回 202/jobId；known error 才释放一次。
- 无额度不调用任何模型；幂等键不重复模型/扣额；全量回归。

## 边界

- 仍禁止 `supabase db push`、远端 SQL/写入、secret 检索或配置、部署、支付、依赖安装、git commit、大范围重构。
- Migration 仍是本地草案。
- 最多 3 轮修复；完成后停止。

## 验证与报告

运行 server/client 全量 Vitest、两侧 tsc、两侧 build；覆盖 `docs/evidence/2026-07-11/slice-C2a-fix/`。同步修正 `spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`、`.planning/task_plan.md`、`.planning/progress.md`、`.planning/findings.md`、`.planning/status.md`、`.planning/loop_log.md`，不得保留虚假“已知 medium 但完成”表述。

最终报告必须明确：RPC 名称、原子/append-only 不变量、modern secret env 名、timeout 行为、测试计数、Migration 未推送、secret 未配置、价格/额度/周期未决定。
