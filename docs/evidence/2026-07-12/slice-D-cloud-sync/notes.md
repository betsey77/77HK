# Slice D — Cloud Sync Evidence (Audit Fix v2 → Final)

## Final Remote Acceptance — 2026-07-12（权威状态）

- Mutation：收藏备注/评分/删除、配置修改/删除、品牌修改/清空均通过真实 hook 行为测试。
- Reliability：内容快照、串行同步队列、owner-scoped outbox、真实 retry 与一次性迁移已启用。
- Migration：`20260712070000_slice_d_cloud_sync` 已推送。
- Tests：Server 209/209；Client 113/113；双端 `tsc --noEmit` 与 production build 通过。
- Remote rollback smoke：A/B 隔离、伪造 owner 拒绝、第 21 个配置拒绝、20 条时更新已有项成功、超大 JSON/空标签拒绝。
- Rollback：favorites/saved_configs/brand_profiles 均保持 0 条测试数据。
- Advisors：无 Slice D 新安全警告；仅保留既有 soft-delete RPC 与泄露密码保护警告。Performance 只有 unused-index INFO。
- Remaining：双真实浏览器 UI 验收；Free/Pro feature entitlements 尚未实施。

Generated: 2026-07-12
Project: D:\work\77港话通社媒文案\77

## Final State

### Test Results

| Suite | Tests | Files |
|-------|-------|-------|
| Server Vitest | **201** | 4 (me + generations + quota + sync) |
| Client Vitest | **113** | 6 (slice-a + slice-b + slice-c1 + slice-c2a + slice-d + slice-d-hook) |
| **Total** | **314** | 10 |

### Verification

| Check | Result |
|-------|--------|
| Server `tsc --noEmit` | ✅ 0 errors |
| Client `tsc --noEmit` | ✅ 0 errors |
| `supabase db push --linked --dry-run` | ✅ Only `20260712070000_slice_d_cloud_sync.sql` |
| `git diff --check` | ✅ No whitespace errors |
| No act() warnings in client tests | ✅ |

### Migration (20260712070000)

- 3 tables: `favorites`, `saved_configs`, `brand_profiles` with full RLS
- `octet_length` checks on `settings`, `variant_meta`, `scores`, `consumer_feedback`, `config`
- `reason_tags varchar(100)[]` with `cardinality <= 20`
- Atomic 20-config limit trigger with `pg_advisory_xact_lock`
- No execute grants on trigger function

### Server: All fixes applied

1. ✅ `sanitizeOverpost` removed
2. ✅ Test mock records `.upsert()`, `.eq()`, `.delete()` parameters with assertions for owner_id, conflict key, delete filters
3. ✅ Full route validation: variantMeta, scores (object|null), consumerFeedback (array|null), savedAt (ISO), JSON byte size (Buffer.byteLength)
4. ✅ `assertJsonSize` uses `Buffer.byteLength(JSON.stringify(value),'utf8')`
5. ✅ Error responder: controlled 4xx pass through, generic 500 for unknown
6. ✅ Body parser: 413 JSON (no req.destroy), invalid JSON 400, supertest tests
7. ✅ `/api/connectivity`: "public health endpoint" comment, no proxy/key leak
8. ✅ Import total ≤ 200 items

### Client: All fixes applied

1. ✅ Hook rewritten with migration marker, outbox, diff-based mutation sync, retryNonce
2. ✅ `getAuthHeaders(expectedOwnerId)` session mismatch rejection
3. ✅ 2 new tests for auth mismatch (reject + succeed)
4. ✅ 16 hook behavior tests in `slice-d-hook.test.tsx`
5. ✅ Legacy import dispatches items into current UI state
6. ✅ `retryHydration` properly re-runs via retryNonce

### Still Pending (requires human/Codex)

- Migration NOT pushed to remote (requires `npx supabase db push`)
- Real two-browser RLS test with two accounts
- SQL transaction verification (BEGIN...ROLLBACK with real user UUIDs)
- Dev server EPERM blocks full build (tsc --noEmit + vitest verified instead)

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260713000000_slice_d_cloud_sync.sql` | 3 new tables (favorites, saved_configs, brand_profiles) with RLS, indexes, constraints |
| `server/src/services/cloudSyncService.ts` | Supabase query layer: bootstrap, CRUD, import with snake→camel mapping |
| `server/src/routes/sync.ts` | 7 REST endpoints with auth, validation, overpost protection |
| `server/src/__tests__/sync.test.ts` | 37 server tests (auth gate, CRUD, validation, import, sanitization) |
| `client/src/services/cloudSync.ts` | 17 exported functions: API calls, data conversion, legacy key detection |
| `client/src/test/slice-d.test.tsx` | 39 client tests (API, conversion, legacy keys, error handling) |
| `client/src/hooks/useCloudSync.ts` | Hydration + mutation sync orchestration hook |

## Files Modified

| File | Change |
|------|--------|
| `server/src/app.ts` | +2 lines: import + register syncRouter |
| `server/src/types/index.ts` | +Slice D types (FavoriteRecord, SavedConfigRecord, BrandProfileRecord, API types) |
| `client/src/types/index.ts` | +Slice D types + sync actions + sync state fields |
| `client/src/context/AppContext.tsx` | +sync state, +7 new actions (SYNC_STATUS, HYDRATE_*, LEGACY_*, etc.) |
| `client/src/App.tsx` | +CloudSyncGate + LegacyImportBanner components |

## Test Results (All Passing)

| Suite | Tests | Result |
|-------|-------|--------|
| Server (4 files) | 193 | ✅ PASS (156 existing + 37 sync) |
| Client (5 files) | 92 | ✅ PASS (53 existing + 39 slice-d) |
| **Total** | **285** | ✅ **ALL PASSING** |

Server TypeScript: ✅ `npx tsc --noEmit` — 0 errors
Client TypeScript: ✅ `npx tsc --noEmit` — 0 errors

## Supabase Dry-Run

```
npx supabase db push --dry-run
→ Would push these migrations:
   • 20260713000000_slice_d_cloud_sync.sql
```

Only our Slice D migration would be applied. No other migrations pending.

## Migration Schema

### `favorites`
- PK: id (uuid), FK: owner_id → auth.users ON DELETE CASCADE
- UNIQUE(owner_id, client_id) for idempotent import
- JSONB fields: settings (required), variant_meta, scores, consumer_feedback, reason_tags
- CHECK: variant_key IN standardHK/lightCantonese/ig/facebook/shorts
- CHECK: content/source >0 and ≤5000, notes ≤2000, favorite_reason ≤1000
- CHECK: rating 1-5 (nullable)
- RLS: authenticated SELECT/INSERT/UPDATE/DELETE own rows
- Indexes: owner_id, owner_id+client_id, owner_id+saved_at desc

### `saved_configs`
- PK: id (uuid), FK: owner_id → auth.users ON DELETE CASCADE
- UNIQUE(owner_id, client_id)
- CHECK: name >0 and ≤200, config is object
- RLS: authenticated SELECT/INSERT/UPDATE/DELETE own rows
- Indexes: owner_id, owner_id+client_id

### `brand_profiles`
- PK: id (uuid), FK: owner_id → auth.users ON DELETE CASCADE
- UNIQUE(owner_id) — MVP: one per user
- CHECK: brand_name/product_name ≤200, brand_red_lines ≤2000
- RLS: authenticated SELECT/INSERT/UPDATE/DELETE own rows
- Index: owner_id

## API Endpoints (all require auth)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/sync/bootstrap | Return all user cloud data |
| POST | /api/sync/favorites | Upsert a favorite |
| DELETE | /api/sync/favorites/:clientId | Delete a favorite |
| POST | /api/sync/configs | Upsert a saved config |
| DELETE | /api/sync/configs/:clientId | Delete a saved config |
| PUT | /api/sync/brand-profile | Upsert brand profile |
| POST | /api/sync/import | Bulk idempotent import |

## Security

- All routes protected by `requireAuth` middleware (Supabase JWT verification)
- `owner_id` always taken from verified JWT, never from request body
- Body overpost protection: `owner_id`, `ownerId`, `id` fields rejected with 400
- Cross-user operations return 404 (indistinguishable from not-found)
- All DB errors sanitized — no table/constraint names leaked
- No secrets, tokens, or keys in any new code (verified via grep)
- RLS on all 3 tables: anon=no access, authenticated=own rows only, service_role=minimal grants

## Known Limitations

- Build (`npm run build`) fails due to EPERM on root `node_modules` (pre-existing; dev server file lock)
- Individual `tsc --noEmit` passes on both client and server
- Migration NOT pushed to remote Supabase (requires user authorization)
- No real two-browser RLS test (requires human with two accounts)
- Cloud sync mutations are fire-and-forget (no retry queue); sync error shown as non-blocking banner
- Feature entitlements not yet enforced (Free users can still use favorites; separate slice)
