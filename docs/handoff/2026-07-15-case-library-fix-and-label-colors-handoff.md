# Codex 交接：个人案例库修复 + 副标题配色 + 功能说明澄清

日期：2026-07-15
项目：`D:\work\77港话通社媒文案\77`
GitHub：`betsey77/77HK`
基线：`master` dirty worktree（**禁止** reset/clean 丢用户改动）

---

## 给 Codex 的结论（先读）

1. **个人案例库功能已按 W2/W3 实现，不是“暂时不能用”**
   - 实际设计：前端**只提交 ID**；服务端用用户 JWT + RLS **读取正文并注入 Prompt**（W3）。
   - 用户可见文案已缩短（见 §C），**不要**再写回冗长的「只传 ID / 防伪造」技术说明。

2. **保存案例 500 的根因已在远端修复**（见下文 DB），本地服务端也改了软删除与错误信息。
   **无需重复开发**该 DB 权限修复；若再改 `case_library` 权限，先读本文件与 migration。

3. **左侧字段副标题配色已统一**（暗色 emerald / 亮色 orange）。
   标准类名见 `client/src/components/input/fieldLabel.ts`。
   **不要**再把这些 label 改回 `text-gray-400`。

4. **个人案例库 UI 已可折叠**（对齐「参考收藏案例」）：默认折叠；点标题展开/收起；「新增」自动展开并打开表单。
   文件：`client/src/components/input/CaseLibraryPanel.tsx`。**不要**再改回常开全量列表。

5. **建议冒烟范围（最小）**——不必重跑整套 public E2E：
   - 登录 → `/app` → 个人案例库 **折叠/展开** + **新增并保存** 正/反例
   - 勾选 ≤3 条 → **生成文案**（确认不 500）
   - 删除案例
   - 亮/暗主题下扫一眼左侧字段标题颜色

6. **不要**把 `e2e/user-authored-review-queue.spec.ts` 的 localStorage mock 当 Auth 验收。
   工作台 shell mock smoke 见 `docs/evidence/2026-07-15/workbench-shell-local-smoke/`（与本切片无关）。

---

## A. 个人案例库：规格 vs 实现

| 规格 | 状态 |
| --- | --- |
| W2 CRUD + BFF + RLS + 最多选 3 | ✅ 已有 `CaseLibraryPanel` + `/api/case-library` |
| W3 生成只传 ID，服务端 resolve + Prompt 注入 | ✅ `useGenerate` → `selectedCaseLibraryIds`；`generate.ts` → `resolveCaseLibraryContext` → `buildCaseLibraryPromptSection` |
| 历史 brief 案例快照 | ✅ 规格要求在 generation brief；勿改为客户端传 body |

**用户如何用：**

1. 新增正例/反例（正文 ≥20 字、原因必填）
2. 勾选最多 3 条
3. 点「生成文案」→ 服务端注入风格约束（正例技法 / 反例回避），**不是**前端把正文塞进请求体

---

## B. 保存失败 bug 修复（已完成，勿重复）

### 现象

保存个人案例时 UI 显示 **`Internal server error`**（表单校验已通过）。

### 根因

`case_library_entries.tags` 的 CHECK 调用 `private.case_library_tags_valid(jsonb)`，
但 W2 migration **REVOKE ALL EXECUTE** 对该函数，导致 authenticated INSERT 报：

`42501 permission denied for function case_library_tags_valid`

### 远端已执行

迁移文件：

`supabase/migrations/20260715150000_fix_case_library_tags_function_grant.sql`

内容要点：

- `GRANT USAGE ON SCHEMA private` → `authenticated`, `service_role`
- `GRANT EXECUTE ON FUNCTION private.case_library_tags_valid(jsonb)` → 同上
- 新增 `public.soft_delete_case_library_entry(p_id uuid)`（SECURITY DEFINER）—— 因直接 `UPDATE deleted_at` 在 authenticated RLS 下也会失败

已通过 `npx supabase db query --linked -f ...` 应用到项目 `qiotocumkbwckiezuptr`。
`supabase db push` 曾因 TLS 失败，**以 SQL 已生效 + 实网插入验证为准**；若 Codex 要补 migration history，可用 `db push`/`schema_migrations` 对齐，**不要再改权限语义**。

### 服务端代码（已改）

- `server/src/services/caseLibraryService.ts`
  - create：更清晰错误映射 / 日志
  - softDelete：改调 `rpc('soft_delete_case_library_entry')`
- `server/src/routes/caseLibrary.ts`：透传 403/明确 500 message
- 测试：`server/src/__tests__/case-library.test.ts` **10/10**

### 实网验证（Grok）

临时用户 + JWT：

- INSERT 正/反例 ✅
- soft_delete RPC ✅

---

## C. UI：案例库折叠 + 说明文案（后续增量，已完成）

文件：`client/src/components/input/CaseLibraryPanel.tsx`

### C.1 折叠交互（对齐 ReferenceCaseSelector）

| 行为 | 说明 |
| --- | --- |
| 默认 | `isExpanded = false`，只显示标题行 |
| 标题行 | 图标 +「个人案例库（N 条 · 已选 x/3）」+ Chevron 展开/收起 |
| 新增 | 右侧「新增」始终可见；点击会 `setIsExpanded(true)` 并打开创建表单 |
| 编辑 | 同样强制展开后再打开编辑表单 |
| 展开内容 | 短说明、notice、已选摘要、搜索/筛选、表单、列表 |
| 样式 | 边框/底与参考收藏一致：`border-emerald-500/20` / light orange 系（已从 violet 迁出） |

`data-testid`：`case-library-toggle`（展开按钮）、其余原有 `case-library-*` 仍在展开区域内。

### C.2 用户可见说明（最终）

仅保留短句：

> 新增/编辑正例与反例，生成前最多勾选 3 条；勾选后会参与生成。

**已删除**（勿恢复）：
「前端只提交案例 ID，服务端再按你的登录身份读取正文并注入 Prompt（防止客户端伪造他人案例，不是功能未完成）。」

技术事实仍由 W3 实现保证，只是不写在用户 UI 上。

### C.3 Prompt 注入（供 Codex / 答疑，非 UI 文案）

勾选后生成时**会**注入模型提示词（`buildCaseLibraryPromptSection` → `diagnoseGenerate`）：

| 类型 | 注入内容要点 |
| --- | --- |
| 正例 good | 标题/标签/原因/正文；要求抽 Hook/结构/句式/氛围/CTA；**学技法禁止照抄** |
| 反例 bad | 原因转负向约束 + 正文仅作「不要怎么写」；**禁止复述/模仿反例**；五平台均须遵守 |

工程上：未勾选则不注入。模型侧非 100% 硬约束，原因写得越具体越有效。

---

## D. UI：左侧字段副标题统一配色（本切片）

**规范：** 暗色 `text-emerald-400`，亮色 `text-orange-600`，`text-xs font-medium`

常量：`client/src/components/input/fieldLabel.ts`（`FIELD_LABEL_CLASS`）

| 字段 | 文件 |
| --- | --- |
| 文案类型 | `CopyTypeSelector.tsx` |
| 品牌/产品名称 | `BrandInput.tsx` |
| 品牌表达红线 | `BrandRedLinesInput.tsx` |
| 发布日期 | `TargetDatePicker.tsx` |
| 竞品分析 | `CompetitorSearchInput.tsx` |
| 结构化写作简报 | `StructuredBriefToggle.tsx` |
| 创作自由度 / 粤语 / 中英夹杂 / 长度档位 | `Slider.tsx`（统一改 label）+ 各 slider 入口 |
| 目标平台 | `PlatformSelector.tsx` |
| 长度控制 | `LengthControl.tsx` |
| 主语气 / 修饰语气 | `ToneSelector.tsx` |
| 目标消费者画像 | `PersonaManager.tsx` |
| 参考收藏案例 | `ReferenceCaseSelector.tsx` |
| 个人案例库 | `CaseLibraryPanel.tsx` |
| 配置管理 | `ConfigManager.tsx` |

**未改：** 折叠分组大标题（品牌与内容场景 / 文案参数 / …）仍为灰白主标题；若也要统一可另开切片。

---

## E. 相关文件清单（本会话累计）

### 案例库 bug + 软删除

- `supabase/migrations/20260715150000_fix_case_library_tags_function_grant.sql`
- `server/src/services/caseLibraryService.ts`
- `server/src/routes/caseLibrary.ts`
- `server/src/__tests__/case-library.test.ts`

### 文案 + 副标题配色 + 折叠

- `client/src/components/input/CaseLibraryPanel.tsx`（折叠/展开、短说明、品牌色边框）
- `client/src/components/input/fieldLabel.ts`（新建）
- `client/src/components/shared/Slider.tsx`
- 以及 §D 表各 input 组件

### 既有 E2E / harness（勿当成本切片未完成项）

- Public smoke：`scripts/e2e-public-smoke.ps1`，证据 `docs/evidence/2026-07-15/e2e-harness-hardening/`
- Workbench shell mock：`scripts/e2e-workbench-shell.ps1`，证据 `docs/evidence/2026-07-15/workbench-shell-local-smoke/`
- Codex review 例：`.planning/prompts/20260715-221800-codex-review.md`

---

## F. 明确不要做的事

- 不要再实现「案例正文由前端塞进 generate 请求」——违反 W3。
- 不要 revoke `case_library_tags_valid` 的 EXECUTE。
- 不要用 service_role 解析用户案例库（必须用户 JWT + RLS）。
- 不要 commit/push/部署/migration（除非用户新授权）；本切片远端 GRANT 已由 Grok 在授权修 bug 时执行。
- 不要把 dirty worktree 里的 Playwright/runtime 文档当冲突删掉。

---

## G. 建议 Codex 验收命令（可选）

```powershell
cd D:\work\77港话通社媒文案\77\server
npx vitest run src/__tests__/case-library.test.ts

# 人工：登录 /app
# - 案例库默认折叠；点标题展开/收起；新增自动展开
# - 保存 + 勾选 + 生成
# - 主题切换：左侧字段标题暗绿亮橙
```

---

## H. 给用户的一句话

个人案例库**已经可用**（含折叠）；保存 500 已修；左侧字段副标题暗绿/亮橙；正反例勾选后会注入 Prompt（学正例技法 / 避反例原因）。
