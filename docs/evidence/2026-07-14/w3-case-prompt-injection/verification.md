# W3 正反例 Prompt 注入 — 验收证据

日期：2026-07-14  
范围：仅 W3；不含 W4、折叠页、Migration/RLS/支付/部署。

## 实现摘要

| 层 | 变更 |
|---|---|
| Server | `services/caseLibraryContext.ts`：normalize / resolve / prompt section / fallback style / budget / snapshots |
| Server | `routes/generate.ts`：JWT resolve → `caseLibraryContext`；brief 写 `resolvedCaseLibrarySnapshots`；partial warning |
| Server | `prompts/diagnoseGenerate.ts`：DeepSeek + Cantonese 注入共享 section |
| Server | `deepseekService` / `cantoneseService` / `fallbackService` 透传上下文 |
| Client | `useGenerate` 发送 `selectedCaseLibraryIds`（仅 ID）；types 文档化 |
| Tests | server `w3-case-prompt-injection.test.ts`；client `slice-w3-case-prompt-injection.test.ts` |

## 安全与行为要点

1. 客户端不发送 / 不伪造 case body、reason。
2. 服务端仅用用户 JWT 创建的 Supabase 客户端读取（RLS）；不用 service role。
3. 异主 / 不存在 / 软删除 ID：不返回存在性细节，生成继续；`warnings: ['部分已选案例不可用']`。
4. 历史 brief 仅保留经 JWT/RLS 实际解析到的快照；客户端伪造的 `caseLibraryEntries`、`caseLibraryContext` 或快照正文会在持久化前剔除；UI 载入只恢复 ID。
5. 未选案例时三引擎输出与 W3 前行为一致（无案例 section）。

## 验证命令

```powershell
# Server
cd server
npx vitest run src/__tests__/w3-case-prompt-injection.test.ts `
  src/__tests__/w2-no-prompt-injection.test.ts `
  src/__tests__/w1-parameters.test.ts `
  src/__tests__/reference-cases.test.ts `
  src/__tests__/case-library.test.ts
npx tsc --noEmit
npm run build

# Client
cd client
npx vitest run src/test/slice-w3-case-prompt-injection.test.ts `
  src/test/slice-w2-case-library.test.tsx `
  src/test/slice-w1-parameters.test.ts `
  src/test/slice-history-settings.test.ts
npx tsc --noEmit
npm run build
```

## 结果

| 检查 | 结果 |
|---|---|
| Server 相关 vitest | ✅ 45/45（见 `server-vitest.txt`） |
| Client 相关 vitest | ✅ 通过（见 `client-vitest.txt`） |
| Server tsc + build | ✅ |
| Client tsc + build | ✅ |

## 独立复验补充（2026-07-14）

- 新增回归：伪造的案例正文不会进入 `generation_jobs.brief`；仅服务端实际解析的快照可持久化。
- Server 定向 W3：19/19；Client 定向 W3：4/4。
- Server 全量：20 files、484 tests 通过；Client 全量：23 files、322 tests 通过。
- 两端生产构建均通过。客户端构建仅保留既有 bundle 大小警告，不影响构建结果。

## 明确未做

- W4 管理员审阅摘要 / 案例正文查看与审计
- 左侧折叠页（Accordion / details / CollapsibleSection / InputPanel 重组）
- 新 Migration、RLS 改动、支付、部署、`.env`

## 手动烟测建议（可选）

1. 登录用户创建 1 正例 + 1 反例，勾选后生成 → 三引擎任一路径应受技法/负向约束影响（可看服务端 prompt 日志或 rules 输出风格线索）。
2. 勾选他用户/已删 ID → 生成成功 + 提示「部分已选案例不可用」。
3. 打开历史 → 仅恢复案例 ID；编辑/删除当前案例库条目后，旧历史仍可通过 brief 快照解释。
4. 同时勾选参考收藏案例与案例库 → 总数风格上下文合理，五平台均受约束。
