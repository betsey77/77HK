# Phase 0：Migration 历史漂移映射与修复方案

> 日期：2026-07-14  
> 状态：**只读分析 + 本地修复方案**  
> **任何 history repair / `db push` / 远端 SQL 写入均需用户明确授权后另开任务执行**

## 1. 现象

来源：`npx supabase migration list --linked`（已记录于 production-readiness-audit）

| 侧 | Version | 文件/名称 |
| --- | --- | --- |
| 本地有、远端无 | `20260714000000` | `supabase/migrations/20260714000000_w2_case_library.sql` |
| 本地有、远端无 | `20260714000001` | `supabase/migrations/20260714000001_harden_w2_case_library_function.sql` |
| 远端有、本地无 | `20260714052140` | （远程 history 名，内容对应 W2 案例库主迁移） |
| 远端有、本地无 | `20260714052414` | （远程 history 名；审计记作 `052414`，即 `20260714052414`） |

说明：审计原文写 `20260714052140/052414`。按 14 位 timestamp 惯例，第二项应补全为 **`20260714052414`**（同日 05:24:14）。执行 repair 前应用只读 `migration list` 再确认一次完整 version 字符串。

## 2. 内容映射（一一对应）

依据：

- `docs/evidence/2026-07-14/w2-case-library/remote-verification.md`：远端已应用 `w2_case_library` + `harden_w2_case_library_function`
- `docs/evidence/2026-07-14/w2-case-library/verification.md`：推送时本地文件名为 `20260714000000_*` / `20260714000001_*`
- 远端复核结果与本地 SQL 目标一致：`case_library_entries` 表、RLS、owner 策略、无 authenticated DELETE、`private.case_library_tags_valid` search_path 锁定

| 序号 | 本地 version + 文件 | 远端 version | SQL 意图 | 映射置信度 |
| --- | --- | --- | --- | --- |
| 1 | `20260714000000` `*_w2_case_library.sql` | `20260714052140` | 创建 `private.case_library_tags_valid`、`public.case_library_entries`、触发器、索引、RLS、owner policies、grants | **高**（结构复核一致；version 因 CLI/推送时刻不同） |
| 2 | `20260714000001` `*_harden_w2_case_library_function.sql` | `20260714052414` | `alter function private.case_library_tags_valid(jsonb) set search_path = pg_catalog` | **高**（安全顾问提示消失与文件内容一致） |

更早的 migrations（Slice B → F1）本地与远端已对齐，不在本次漂移范围。

## 3. 为何出现漂移

最可能原因：W2 通过 Supabase CLI/`db push` 或 Dashboard 应用时，**远端 schema_migrations 登记的 version 取了实际应用时间戳**（`20260714052140` / `20260714052414`），而仓库文件名保留开发时的逻辑序号（`…000000` / `…000001`）。对象已在远端，但 **history 键不一致**，导致：

- 新环境从仓库重放：只会跑 `000000/000001`
- 已链接生产/当前项目：list 显示双向 missing
- 再次 push 可能尝试重复创建对象 → 失败

## 4. 修复策略（推荐：以远端 version 为准对齐本地文件名）

**原则：** 不改 SQL 语义；不 DROP 已有表；不 rewrite 远端对象；只让 history 键与文件名一致。

### 步骤 0 — 只读确认（授权后执行）

```powershell
npx supabase migration list --linked
# 记录完整 LOCAL / REMOTE version 列
```

可选：用 SQL Editor **只读**查询：

```sql
select version, name, inserted_at
from supabase_migrations.schema_migrations
where version like '20260714%'
order by version;
```

### 步骤 1 — 本地文件重命名（无 DB 写入）

在 git 中：

```text
20260714000000_w2_case_library.sql
  → 20260714052140_w2_case_library.sql

20260714000001_harden_w2_case_library_function.sql
  → 20260714052414_harden_w2_case_library_function.sql
```

同步更新：

- 引用旧 version 的测试（如 `w2-case-library-migration.test.ts` 中的路径断言）
- 证据/文档中的文件名

### 步骤 2 — 验证 list 对齐（仍只读）

```powershell
npx supabase migration list --linked
```

期望：W2 两行 LOCAL 与 REMOTE 均为同一 version，无 missing。

### 步骤 3 — staging 从零重放（需独立 staging 项目 + 授权）

1. 新建 Supabase Free staging（不连生产）。
2. `supabase link` 到 staging。
3. `supabase db push` 或 `db reset`（仅 staging）。
4. 验证 `case_library_entries` / RLS / soft_delete / payment 表仍按顺序建立。

### 步骤 4 — 若重命名后仍不匹配

仅当远端 version 字符串与猜测不一致时：

- **方案 A（优先）**：本地文件名改为远端真实 version（仍不改远端）。
- **方案 B（需强授权）**：`supabase migration repair` 标记 history（风险：错误 repair 会导致“以为已应用但未应用”或重复应用）。  
  - 示例（**禁止在未授权时执行**）：  
    `supabase migration repair --status applied 20260714000000`  
    或对错误 version `reverted` 后再对齐。  
  - repair **不执行 SQL**，只改 history 表；用错方向会造成后续 push 灾难。

## 5. 禁止事项

- 不在生产执行 `db reset`
- 不 DROP `case_library_entries` 再重建
- 不自动 `migration repair` 而不先 diff SQL
- 不把本地未应用的新 SQL 混进 repair
- 不升级付费 Supabase 档位来“解决”漂移（Free 足够做 history 对齐）

## 6. 验收标准（修复任务完成后）

| 检查 | 通过条件 |
| --- | --- |
| `migration list --linked` | W2 两行双向一致 |
| 本地 migrations 目录 | 仅保留与远端 version 对齐的文件名 |
| staging 重放 | 全量 migrations 顺序成功 |
| 回归 | Client/Server 测试与依赖 W2 的 schema contract 测试通过 |
| 生产数据 | 无用户数据丢失/变更 |

## 7. 本轮状态

- ✅ 建立一一映射与推荐修复步骤
- ❌ 未执行 rename（避免与未提交工作树/测试路径冲突而未静默改；**建议用户授权后与 Group B commit 一并做**）
- ❌ 未执行 `migration repair`
- ❌ 未 `db push` / 未连接写入远端
- 本机策略：`npx supabase` 在当前 Agent 环境被权限策略拦截，无法复跑 list；映射依据既有 audit 证据

## 8. 待用户决策

1. 是否授权本地文件重命名为远端 version（推荐）？  
2. 是否授权只读 `migration list` 复核完整 14 位 version？  
3. 是否创建 Free staging 做从零重放（推荐在 rename 后）？  
4. 在 1–3 完成前，**不要**把 migration repair 当作下一步默认动作。
