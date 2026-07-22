# 1.1.4.5 Slice D3 签到 UI 本地验证

日期：2026-07-19  
状态：客户端合同与隔离浏览器验收完成；D1 Migration 未应用

## 交付范围

- 云同步进入 `ready` 且存在登录 owner 后展示每日签到弹窗。
- 通过 `GET /api/me/check-in` 读取权威状态，通过 `POST /api/me/check-in` 幂等签到，通过 `POST /api/me/membership-grants/:id/claim` 领取待领取奖励。
- 显示 7 日进度、今日签到、奖励已发放、有效 Pro 待领取和到期后可领取状态。
- 关闭状态只写入 `hk-cantonese-checkin-dismissed:<ownerId>:<YYYY-MM-DD-HK>`；同日不再打扰，香港日期跨日后重新出现。
- 客户端不提交 owner、签到日期或连续天数，也不自行推导会员结果；签到响应替换完整状态，领取响应只合并其实际返回字段。

## 安全与交互边界

- API 层运行时校验成功响应；错误只保留安全消息、HTTP 状态、业务代码和会员到期时间。
- 重复签到/领取期间按钮禁用；旧 owner/已关闭弹窗的异步响应不会覆盖当前状态。
- 弹窗支持 Escape、焦点循环、滚动锁、可访问名称，主要点击目标至少 44px。
- 390px 视口下弹窗保持在屏幕内并禁止文档横向溢出。
- 非签到 E2E 用账号+香港日期 dismissal fixture 隔离，避免新弹窗遮挡既有回归；所有非 localhost 请求 fail-closed。

## 验证结果

| 层级 | 命令/范围 | 结果 |
| --- | --- | --- |
| TDD red | 新增 API/组件测试后聚焦运行 | 预期失败：两个模块尚不存在 |
| 聚焦 | `npx vitest run src/test/check-in-api.test.ts src/test/slice-d3-check-in.test.tsx` | 2 files，14/14 |
| 影响面 | 签到 + cloud sync focus + review polling + slice-a | 5 files，27/27 |
| Client 全量 | `npx vitest run` | 46 files，437/437 |
| Client build | `npm run build` | TypeScript + Vite production build 通过 |
| Harness 自检 | `scripts/e2e-workbench-shell.ps1 -SelfTest` | 通过：fixture/外网/junction fail-closed |
| 本地 E2E | 同一 harness `-Twice` | 11/11 × 2；18 张截图；无非 localhost 请求；无残留 Vite/Playwright |
| 目视检查 | 桌面 applied + 390px claim 截图 | 文案、7 日进度、奖励状态清晰；无截断/横溢 |

完整 Playwright 输出：`test-output.txt`。

关键截图：

- `screenshots/check-in-applied-desktop-1440-local-mock.png`
- `screenshots/check-in-claim-mobile-390-local-mock.png`
- `screenshots/signup-confirmation-dialog-desktop-1440-local-mock.png`

## Grok Build

- D3 功能阶段使用一次有界 headless 只读评审，只开放仓库读取/检索能力；建议已用于运行时 API 校验、账号/香港日期关闭键、领取部分响应合并、可访问交互和 E2E mock 隔离。
- 视觉返修阶段又发起两次更小的 Grok 调用，但当前 CLI 均在扫描本机失配的旧 skill 元数据时超时，未进入模型推理、没有返回建议，也没有改文件；按停止规则不再重试。
- Grok 结论未替代 Codex 的逐行检查、测试、构建和浏览器验收。

## 注册确认返修

- 根因：公开路由把注册动作触发的 `isLoading` 误当首次会话恢复，整页 loader 卸载了 `SignupPage`；异步注册完成后表单以空状态重新挂载，旧组件无法打开确认弹窗。
- 修复：`PublicAuthRoute` 只在首次 Auth 恢复完成前显示整页 loader，后续 login/signup 操作保持页面挂载。
- 路由级单元测试先复现失败，再验证提交中输入保留和成功弹窗；localhost `/signup` E2E 验证弹窗邮箱、垃圾邮件提示及关闭后的“请检查邮箱”状态。

## 未证明与停止边界

- `supabase/migrations/20260719090000_slice_d1_checkin_rewards.sql` 仍未在本地或远端 PostgreSQL 应用。
- 本证据只证明浏览器对隔离 API mock 的 UI 合同，不证明真实 Auth、RLS、RPC、并发事务或会员写入。
- 未执行 staging/production 写入、Migration、部署、安装、commit、push、reset、clean 或新 worktree。
- D3 当前小目标完成并停止。下一功能切片 D4/D5 进入前须确认 P1-2（DAU/WAU/MAU 窗口）、P1-3（bad case 分数字段）和 P1-4（日志/聚合保留期）；D7 数据库验证仍需单独授权。
