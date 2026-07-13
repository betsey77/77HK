# Slice C1 Patch — Soft-Delete RLS Fix Evidence

**Date:** 2026-07-11
**Status:** ✅ PASSED (dry-run)
**Trigger:** 远端事务验收发现 soft-delete RLS 缺陷 (42501)

## Problem

`update generation_jobs set deleted_at=now()` 以本人 JWT 执行时失败：
`42501 new row violates row-level security policy for table generation_jobs`

UPDATE RLS policy 的 `WITH CHECK` 在远程 Supabase 上拒绝软删除操作。

## Fix

新建 `20260711223000_fix_generation_soft_delete.sql` — SECURITY DEFINER RPC：

```sql
create or replace function public.soft_delete_generation_job(_job_id uuid)
returns boolean language plpgsql security definer set search_path = ''
```

- 内部强制 `auth.uid() is not null` + `owner_id = auth.uid()` + `deleted_at is null`
- 所有对象全限定名
- REVOKE from public/anon; GRANT EXECUTE to authenticated, service_role

## Modified Files

| File | Change |
|------|--------|
| `supabase/migrations/20260711223000_fix_generation_soft_delete.sql` | **新建** — SECURITY DEFINER RPC |
| `server/src/services/generationJobsService.ts` | `softDeleteJob` 改为调用 RPC，返回 `Promise<boolean>` |
| `server/src/routes/generations.ts` | DELETE handler 使用 RPC boolean return；移除 `getJob` 预检查 |
| `server/src/__tests__/generations.test.ts` | +18 tests: 11 patch migration 断言 + 5 RPC delete + 2 regression |

## Test Results

- **Server Vitest:** 63/63 (45 original + 18 patch)
- **Client Vitest:** 49/49 (no regression)
- **Server tsc:** 0 errors
- **Client tsc:** 0 errors
- **Server build:** pass
- **Client build:** 616 KB JS, 78 KB CSS

## Dry-Run

```
$ supabase db push --dry-run
Would push these migrations:
 • 20260711223000_fix_generation_soft_delete.sql
```

Only the patch migration would be pushed — main migration `20260711213000` is already applied.

## Migration Status

- **Main:** `20260711213000_slice_c1_generation_jobs.sql` — ✅ pushed to remote
- **Patch:** `20260711223000_fix_generation_soft_delete.sql` — ⏸️ NOT pushed
