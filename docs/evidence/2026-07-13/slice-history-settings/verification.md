# 生成历史完整恢复工作台配置 — 验证记录

日期：2026-07-13  
证据等级：standard（用户可见恢复路径 + 客户端状态）

## 复现证据（RED）

命令：

```text
npx vitest run src/test/slice-history-settings.test.ts
```

修复前结果：3/3 failed。

- `structuredBriefEnabled` 实际恢复为 `false`。
- `targetDate` 实际回退为当天，而非历史值。
- 历史恢复提示常量不存在。

## 修复验证（GREEN）

```text
npx vitest run src/test/slice-history-settings.test.ts src/test/slice-h1-r-history.test.ts src/test/slice-c1.test.tsx
```

结果：3 files / 30 tests passed。

```text
npx vitest run
```

结果：15 files / 259 tests passed。

```text
npx tsc --noEmit
npm run build
```

结果：均通过；Vite production build 共转换 1698 modules。

## 覆盖范围

- 旧 `brief` 的结构化写作、消费者画像、参考案例 ID、日历事件 ID 恢复。
- 新 `brief.workbenchSettings` 的发布日期、竞品查询、参考案例、日历选择恢复。
- `useGenerate` 确实随生成请求发送完整 `workbenchSettings`。
- 历史列表与详情页均渲染可访问的恢复提示。
- 原有 owner-scoped session 快照、损坏 JSON 回退和已完成任务门禁继续通过。

## 已知边界

- 修复前的旧历史只能恢复当时已写入 `brief` 的字段；当时从未持久化的发布日期、竞品查询无法从数据库反推。
- 从本次修复后的新生成记录开始，完整 `AppSettings` 均可恢复。
- 当前环境没有可调用的浏览器自动化接口，未生成独立截图；UI 可见性由 React DOM 行为测试覆盖。
