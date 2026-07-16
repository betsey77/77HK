# 77港话通社媒文案器

香港粤语社媒文案 AI SaaS。当前仓库已经包含官网、匿名生成工作台和 Express AI 服务；账户、服务端数据、额度、支付和管理后台按 `spec/` 的切片顺序继续开发。

## 本地运行

```powershell
npm run dev
```

- 官网：`http://localhost:5173/`
- 工作台：`http://localhost:5173/app`
- API：`http://localhost:3001/api`

端口被占用时以 Vite/Express 终端输出为准。

## 验证

```powershell
cd client; npx tsc --noEmit; npm run build
cd ..\server; npx tsc --noEmit; npm run build
```

## 开发事实源

1. `spec/PRD.md`：MVP 范围和业务门禁。
2. `spec/SDD.md`：最终架构、页面、数据、接口和安全边界。
3. `spec/TEST_PLAN.md`：每个切片的严格证据要求。
4. `.planning/status.md`：当前状态和下一步。
5. `.planning/context_pack.md`：Claude Code/Codex 交接上下文。
6. `docs/design-system.md`：前端设计规范。
7. `docs/comprehensive-spec-v2.md`：生成域权威规格。

父目录项目导航：`D:\work\77港话通社媒文案\README.md`。

## 当前下一步

截至 2026-07-16，核心产品切片、审核通知本地隔离 E2E、独立 staging 的 18 个 Migration、真实邮箱 Auth、owner/review-group RLS 和双端审核通知均已验收通过。

当前进入 Dirty Worktree 功能切片基线整理与 preview 部署准备；生产部署和支付宝沙箱 E2E 仍需单独明确授权。staging 验收过程与安全边界详见 `docs/release/2026-07-16-staging-auth-rls-acceptance-runbook.md`。
