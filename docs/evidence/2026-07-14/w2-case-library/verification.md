# W2 个人案例库 — 验证证据（2026-07-14）

## 范围

- 本地实现个人正/反例案例库 CRUD、RLS Migration 草案、工作台选择与配置持久化。
- **不含** W3 Prompt 注入、W4 管理员正文、左侧折叠页。
- 初始本地验收时 Migration/RLS 尚未推送；后续已在同日获授权推送并完成远端复核，详见 `remote-verification.md`。

## 命令与结果

### Client

```powershell
cd client
npx vitest run src/test/slice-w2-case-library.test.tsx
# → 10/10 passed

npx vitest run src/test/slice-w2-case-library.test.tsx src/test/slice-w1-parameters.test.ts src/test/slice-config-reference.test.tsx src/test/slice-history-settings.test.ts
# → 24/24 passed

npx tsc --noEmit
# → pass

npm run build
# → pass (vite production build)
```

### Server

```powershell
cd server
npx vitest run src/__tests__/case-library.test.ts src/__tests__/w2-case-library-migration.test.ts src/__tests__/w2-no-prompt-injection.test.ts
# → 22/22 passed

npx vitest run ... + w1-parameters + reference-cases + calendar-validation
# → 71/71 passed

npx tsc --noEmit
# → pass

npm run build
# → pass
```

原始输出：`server-vitest.txt`、`client-vitest.txt`。

## 关键边界断言

| 项 | 结果 |
|---|---|
| 远端 Migration 推送 | 未执行 |
| 案例 body 进入生成 Prompt | 未实现（测试断言不注入） |
| 管理员案例正文 API | 未实现 |
| 折叠页 | 未实现 |
| `.env` / 密钥 | 未读取修改 |

## 人工验收路径（本地）

1. 登录工作台 `/app`。
2. 左侧「个人案例库」：新增正例/反例（标题可空），校验短正文错误。
3. 搜索、勾选最多 3 条；第 4 条选择按钮 disabled。
4. 删除走确认弹窗；软删除后列表消失。
5. 储存配置 → 清空选择 → 载入配置恢复 `selectedCaseLibraryIds`。
6. 若配置含已删除 ID：出现「已忽略 N 个已删除案例」提示，其余 ID 保留。
7. 生成文案：请求中仅 settings 含案例 ID（若有），不传案例正文（W3 前无技法注入）。

## 远端闭环（已完成）

1. 已推送 `20260714000000_w2_case_library.sql`。
2. 已推送 `20260714000001_harden_w2_case_library_function.sql` 安全补丁。
3. 已远端复核表、RLS、owner-only 策略与 `search_path=pg_catalog`；详情见 `remote-verification.md`。
4. W3 已在此基础上完成，不再是后续前置条件。
