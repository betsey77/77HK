# Slice C1 v4 — Evidence Summary

**Date:** 2026-07-11
**Status:** ✅ PASSED
**Trigger:** C1 v3 独立复核发现 1 个客户端阻断项

## Blocking Issue Fixed

`client/src/services/api.ts::generateCopy` 对所有 2xx 直接 cast 为 `GenerateResponse`。服务端返回 202 (pending/processing) 或 200 `body.status='failed'` 时，缺少 `diagnosis/variants/audit` 的对象被 `SET_RESULTS` 写入 UI。

## Changes (6 files modified)

| File | Change |
|------|--------|
| `client/src/types/index.ts` | +4 discriminated response types (`GenerateSuccessBody`, `GeneratePendingBody`, `GenerateFailedBody`, `GenerateApiResponse`) |
| `client/src/services/api.ts` | `generateCopy` 重写：idempotencyKey 独立参数 + 网络重试 1 次 + 202 轮询 (120s 上限) + 200 failed 抛错 + `mapJobToGenerateResponse` helper |
| `client/src/hooks/useGenerate.ts` | UUID fallback + 幂等键生命周期修正 + 注释对齐 + 移除未使用 ref |
| `client/src/test/slice-c1.test.tsx` | +11 tests: 网络重试同 key、200 failed 抛错、202 轮询 completed/failed/超时、dispatch 行为、key 再生 |
| `spec/ACCEPTANCE.md` | +19 C1v4 标准 + Known Limitations |
| `spec/CHANGELOG.md` | +v4 条目 |

## Test Results

- **Client Vitest:** 49/49 (12 A + 15 B + 11 C1 + 11 C1v4), 0 unhandled rejections
- **Server Vitest:** 45/45
- **Client tsc:** 0 errors
- **Server tsc:** 0 errors
- **Client build:** 616 KB JS, 78 KB CSS
- **Server build:** pass

## New Tests Detail

1. `generateCopy — network retry` (2 tests): 首次网络错误→同 key 重试成功；两次失败→抛错
2. `generateCopy — 200 failed body` (2 tests): body.status='failed'→抛错；不返回不完整数据
3. `generateCopy — 202 polling` (3 tests): 轮询→completed→返回完整 GenerateResponse；轮询→failed→抛错；轮询超时→jobId 在错误消息中
4. `useGenerate — dispatch behaviour` (4 tests): SET_RESULTS 完整数据；SET_ERROR→永不 SET_RESULTS；不完整对象从不入 UI；每次点击新 key

## Migration Status

**UNPUSHED.** `20260711213000_slice_c1_generation_jobs.sql` 仅本地，dry-run 通过。
