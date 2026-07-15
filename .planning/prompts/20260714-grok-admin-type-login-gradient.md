# Grok Build — 管理员类型高亮与登录标题渐变

## 当前小目标（仅此范围）

在不改动认证、数据、RLS、支付、路由或配置的前提下，完成并验证两项前端展示优化：

1. `client/src/pages/AdminPage.tsx` 的“用户收藏”列表中，文案类型也要作为明显的彩色 chip 高亮；平台 chip 维持当前绿色/浅色橙色语义，二者必须清晰区分。类型中文映射保持现有 `formatAdminCopyType`，不要重新引入英文枚举。
2. `client/src/components/auth/AuthLayout.tsx` 左侧产品标题“77港话通社媒文案器”使用官网现有渐变规则：深色 `from-emerald-300 to-lime-300`，浅色 `light:from-orange-600 light:to-amber-500`，并使用 `bg-clip-text text-transparent`。不要改变标题文案、字号、认证逻辑或登录流程。

## 必读与约束

- 先读 `README.md`、`CLAUDE.md`、`docs/design-system.md`、`.planning/status.md`。
- 仅允许修改与以上两项及其聚焦测试、必要交接记录直接相关的文件。
- 现有工作树有用户/其他 agent 未提交改动：不得覆盖、回退、清理、格式化无关文件。
- 不执行 Supabase 迁移/RLS 推送、部署、真实支付、`.env` 或密钥改动、git commit/push。
- 使用现有 Tailwind 设计 token；不得添加依赖，不得大重构。
- `Badge` 如需新增变体，采用语义化、可读的色彩（推荐 sky/blue），确保深浅主题都有足够对比度，类型与平台不能仅靠位置区分。

## TDD 与验收

先补/调整一个聚焦测试，再实现，最终至少执行：

```powershell
cd client
npx vitest run src/test/slice-login-admin-accordion.test.tsx
npx tsc --noEmit
npm run build
```

验收：

- 管理员收藏表的类型为明显非灰色 chip，且仍显示中文。
- 平台高亮保持现有行为。
- 登录页左侧标题在深色为绿→黄绿渐变，浅色为橙→琥珀渐变。
- 不改变 AuthContext/Supabase 调用、页面路由、支付和服务器代码。
- 在 `docs/evidence/2026-07-14/admin-type-login-gradient/` 记录命令与结果，并追加更新 `spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`、`.planning/progress.md`、`.planning/status.md`、`.planning/task_plan.md`（只追加，不覆盖历史）。

## 交付

结束时列出改动文件、测试命令与结果、未做事项。不要自行提交或推送 git。
