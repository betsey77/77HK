# Migration 历史漂移：一一映射与修复方案

日期：2026-07-14  
状态：**仅本地文件名对齐；未执行 history repair、未 `db push`、未改远端 `schema_migrations`。**

## 1. 现象

| 侧 | Version | Name |
| --- | --- | --- |
| 本地（漂移前） | `20260714000000` | `w2_case_library` |
| 本地（漂移前） | `20260714000001` | `harden_w2_case_library_function` |
| 远端（`migration list --linked`，2026-07-14 审计） | `20260714052140` | 对应 W2 主迁移 |
| 远端 | `20260714052414` | 对应 W2 harden |

`supabase migration list` 因此显示：本地有远端无、远端有本地无 → **history drift**。

证据来源：

- `docs/evidence/2026-07-14/production-readiness-audit/verification.md`
- `docs/evidence/2026-07-14/w2-case-library/remote-verification.md`（远端表/RLS/策略已存在且复核通过）

## 2. SQL 内容一一映射

| # | 本地内容文件（漂移前文件名） | 远端 version | 语义 / 主要 DDL | 等价性 |
| --- | --- | --- | --- | --- |
| M1 | `20260714000000_w2_case_library.sql` | `20260714052140` | `private.case_library_tags_valid`；`public.case_library_entries`；owner RLS select/insert/update；soft-delete via update；authenticated 无 DELETE grant | **内容等价**（同一切片、同一结构；version 仅时间戳不同） |
| M2 | `20260714000001_harden_w2_case_library_function.sql` | `20260714052414` | `alter function private.case_library_tags_valid(jsonb) set search_path = pg_catalog` | **内容等价** |

判定依据：

1. 远端复核文档只描述了上述两段 W2 能力，无第三段同日迁移。
2. 推送记录：`verification.md` 写明已推送本地 `000000` / `000001` 两文件；CLI/MCP 登记为 `052140` / `052414`（常见于远端实际 apply 时间戳）。
3. 结构证据：`case_library_entries` RLS、grants、`search_path` 硬化与本地 SQL 目标一致。

> 严格证明还需：`supabase migration list --linked` 输出截图 + 远端 `supabase_migrations.schema_migrations` 的 `version,name` 只读查询。本轮环境对 `npx supabase` 有策略限制，映射以既有审计证据为准；**Codex 验收时应再跑一次 list 核对。**

## 3. 本轮已做的本地修复（无远端写入）

| 动作 | 结果 |
| --- | --- |
| 重命名 `20260714000000_w2_case_library.sql` → `20260714052140_w2_case_library.sql` | 本地 version 对齐远端 |
| 重命名 `20260714000001_harden_w2_case_library_function.sql` → `20260714052414_harden_w2_case_library_function.sql` | 本地 version 对齐远端 |
| 更新 `server/src/__tests__/w2-case-library-migration.test.ts` 文件名常量 | 静态测试指向新文件名 |
| 注释中记录对齐原因 | 可追溯 |

**未做：** `supabase migration repair`、手动 UPDATE `schema_migrations`、`db push`、任何 DDL。

## 4. 待授权的后续步骤

### 步骤 A（推荐，先验证映射）

```powershell
# 只读
npx supabase migration list --linked
```

期望：`20260714052140` 与 `20260714052414` 的 Local/Remote 列均为已应用/已存在，无 orphan。

### 步骤 B（若 list 仍显示 Remote 有、Local 无）

说明文件名仍不匹配 name 字段。需只读查询：

```sql
select version, name, statements
from supabase_migrations.schema_migrations
where version like '20260714%'
order by version;
```

将 `name` 与本地文件 suffix 对齐；**禁止**在未授权时改表。

### 步骤 C（仅当 history 行损坏时 — 高风险，需单独授权）

```text
# 示例，勿擅自执行
supabase migration repair --status applied 20260714052140
supabase migration repair --status applied 20260714052414
```

风险：错误 repair 会导致 CLI 认为未应用而重复执行 DDL，或跳过真实缺口。

### 步骤 D（staging 从零重放 — Phase 1）

1. 新建 **独立** Supabase staging 项目（Free 额度内；勿连生产）。
2. `supabase db push` / `migration up` 全量重放（含对齐后的 W2 文件）。
3. 跑 RLS/结构 smoke；通过后再谈生产。

## 5. 回滚

- 本地重命名可用 git 还原文件名（当前仍 untracked 时用备份/再 rename）。
- 因未改远端，**无远端回滚需求**。

## 6. 授权门禁

| 操作 | 需要用户明确授权 |
| --- | --- |
| 本地文件名对齐 | 否（本轮已完成） |
| `migration list` 只读 | 否 |
| `migration repair` / 写 `schema_migrations` | **是** |
| `db push` 到任何远端 | **是** |
| 新建 staging 项目 | **是**（Phase 1） |
