# 前端路由级代码拆分验证

日期：2026-07-15

## 目标

在不改变现有路径、认证、支付、管理员权限和工作台状态的前提下，降低首次加载的主 JavaScript 包体积，消除 Vite 超过 500 kB 的构建警告。

## 实现

- `client/src/App.tsx` 使用 `React.lazy` 动态加载营销页、认证页、历史、结算、管理员页面及工作台重组件。
- 路由根部使用一个 `Suspense` 边界，复用既有会话恢复加载态。
- 未改路由匹配顺序、Provider 层级、鉴权重定向或页面业务代码。
- 新增源码契约测试，防止关键页面恢复为静态导入而重新合并进首屏主包。

## 构建结果

- 修改前主入口：`857,028 bytes`。
- 修改后主入口：`471,335 bytes`。
- 减少：`385,693 bytes`，约 `45.0%`。
- 最大 JS chunk：`471,335 bytes`，低于 Vite 默认 500 kB 警告线。
- 构建生成独立的 Marketing、Admin、History、Billing 和工作台组件 chunk。
- Vite 超大 chunk 警告已消失。

## 自动验证

- 新增测试先失败，再由实现转绿。
- 受影响路由/支付/管理员提醒/用户审核通知：19/19 通过。
- Client full：393/393 通过。
- Client TypeScript：通过。
- Client production build：通过。
- `http://localhost:5173/`：200。
- `http://localhost:5173/admin`：200。
- `http://localhost:5173/app`：200。
- 当前切片文件 `git diff --check`：通过。

## Grok Build

- 按用户要求调用 Grok Build 进行只读发布准备审阅。
- 连续两次调用均成功退出，但只返回 CLI 配置/skill 警告，没有生成审阅结论；按两次无有效输出上限停止。
- Grok Build 未修改任何文件，最终切片由本地构建证据确定并实现。

## 人工复测

1. 刷新 `/`，确认官网正常显示。
2. 刷新 `/admin`，确认加载态结束后管理员后台正常显示。
3. 刷新 `/app`，确认会话恢复、云同步和工作台正常显示。
4. 打开 `/app/history`、`/app/billing`，确认页面按需加载且无空白页。

## 边界

- 无安装、Migration、远端数据写入、真实支付、部署、Git commit/push、reset/clean 或 Worktree。

