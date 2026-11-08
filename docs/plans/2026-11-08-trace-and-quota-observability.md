# 2026-11-08 Trace 与配额可观测性升级（草案）

> 状态：迁移草案已编写 + dry-run 通过；代码 wiring 已实现（未应用迁移、未部署）
> 关联：`supabase/migrations/20261108120000_quota_denial_reason_and_trace.sql`
> 触发事件：2026-11-08 Pro 周期过期导致全量 402，但系统只能记录 `QUOTA_EXHAUSTED`，无法区分原因

## 1. 目标

让每一次"不能生成"都能回答四个问题，且不依赖用户正文：

1. 为什么被拒？（无订阅 / 非 active / 周期未开始 / 付费过期 / 额度用完）
2. 这次请求跨 API → job → 模型 → 坏包的同一条 trace 是什么？
3. 模型失败是 provider、HTTP、还是 schema 解析？
4. 坏包列表能否直接看到真实 error code？

## 2. 迁移内容（追加式，向后兼容）

- `generation_jobs` / `model_call_logs` / `bad_case_review_packs` 增加 `trace_id uuid`（可空）+ 部分索引。
- `model_call_logs` 增加 `http_status`、`finish_reason`、`request_hash`、`prompt_version`、`is_fallback`。
- 新增 `quota_denial_events`（append-only，无正文）：`user_id, job_id, trace_id, reason, plan_name, period_end, created_at`；
  RLS 仅本人可读，service_role 可写。
- 新增 `reserve_quota_v2`：账务不变量与 v1 完全一致，但返回
  `{reserved:false, reason}`；v1 不动，旧部署继续可用。
- `bad_case_review_packs` 增加 `error_code text`（可选，用于列表过滤；当前 summary 已带 `error=`）。

## 3. 代码 wiring（本次已实现）

| 层 | 文件 | 变更 |
|---|---|---|
| 配额服务 | `server/src/services/quotaService.ts` | `reserveQuotaWithReason()` 调 v2；函数缺失时回退 v1，reason='unknown' |
| 配额证据 | `server/src/services/quotaDenialService.ts` | `recordQuotaDenial()` 写 `quota_denial_events`，表不存在时静默失败 |
| 生成路由 | `server/src/routes/generate.ts` | 每请求生成 `traceId`；拒绝时写事件、failJob 带 reason、402 body 带 `reason/traceId` |
| 任务 | `server/src/services/generationJobsService.ts` | insert/select `trace_id`；列不存在时自动降级重试 |
| 遥测 | `server/src/services/telemetryService.ts` | `trace_id/http_status/finish_reason/request_hash/prompt_version/is_fallback`；旧库自动降级 |
| 客户端 | `client/src/services/api.ts`、`hooks/useGenerate.ts`、`InputPanel.tsx` | `ApiError.reason`；402 文案按 `period_expired/quota_exhausted` 精确展示 |
| 坏包 | `badCaseReviewPackAssembler` / `badCaseAnalysis` | 配额拒绝不建包；真实失败包带 `error=`、`runtime.errorCode`、criteria evidence；通过 `generation_job_id` 关联 job 的 `trace_id` |

## 4. 发布顺序（关键）

1. **先应用迁移**（本文件对应 migration），v1 继续服务，线上无行为变化；
2. 部署 API（Vercel `77hk-api-preview`），先只写 trace/denial，不改 402 status；
3. 验证：受控账号触发一次配额拒绝，确认 `quota_denial_events` 有原因、job 有 trace、日志可串联；
4. 部署 Web（`77hk-cantonese-aicopywriter`），402 文案按 reason 展示；
5. 观察 24h：`quota_denial_events` 按 reason 分布、模型失败按 `http_status/finish_reason` 分布。

不得先部署依赖 v2 的代码再补迁移；v2 不存在时配额服务必须回退 v1（fail closed 到"拒绝"而不是放行）。

## 5. 验证 SQL（只读）

```sql
-- 拒绝原因分布（近 7 天）
select reason, count(*) from public.quota_denial_events
where created_at > now() - interval '7 days' group by 1 order by 2 desc;

-- 一次请求的完整链路
select j.id, j.trace_id, j.status, j.error_code, m.operation, m.status, m.http_status, m.finish_reason
from public.generation_jobs j
left join public.model_call_logs m on m.trace_id = j.trace_id
where j.trace_id = '<trace_id>';
```

## 6. 风险与回滚

- v2 的锁范围比 v1 略宽（非 active 也会锁该用户单行），锁持有时间仍是微秒级，同一用户串行，不会跨用户阻塞。
- 迁移只做 `add column if not exists` / `create ... if not exists`，可安全重放。
- 回滚：先停写，再用后续 forward-fix 迁移删除新表/列；不改已应用迁移历史。
- `request_hash` 只存哈希，不存 prompt 原文；坏包仍保持 review-only。
