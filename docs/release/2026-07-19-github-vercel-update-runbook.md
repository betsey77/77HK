# GitHub → Vercel 版本更新手册（本地验收后执行）

> 日期：2026-07-19  
> 适用仓库：`betsey77/77HK`，当前本地分支 `master`，Frontend/API 为两个 Vercel 项目。  
> 本文是执行手册，不代表已经 commit、push、迁移或部署。

## 一句话结论

本地验收通过后可以较快更新 GitHub 和 Vercel，但**不应把当前 Dirty Worktree 直接 `git add .` 后推到生产**。推荐流程是：整理明确文件清单 → 全量自动门禁 → D1/D4 Migration 在 staging 验证并获单独授权 → 推 release 分支 → 两个 Vercel Preview 验收 → API 先、Frontend 后地晋升生产 → 生产 smoke 与回滚观察。

> 2.1 更新（2026-07-22）：D1/D4 已在 staging 验证；`20260722100000_slice_e_bad_case_review_packs.sql` 已应用到 staging 并完成结构/RLS/ACL 只读核验。2.1 发布流程当前为：完成 E8 真实角色/API/浏览器验收 → 统一人工验收 → release 分支/CI → Vercel Preview → 生产 Migration 单独授权 → API 先、Frontend 后 → 生产 smoke → 最后填写并显示 2.1 更新日志。

Vercel Git 集成会为分支 push/PR 自动创建 Preview；生产分支合并通常会自动生成 Production deployment。若希望先验证再上线，可手工 Promote。官方说明：Preview Promote 会使用 Production 环境变量重新构建，不能把 Preview 环境变量原样带到生产。  
参考：[Vercel Git deployments](https://vercel.com/docs/git)、[Promote Preview to Production](https://vercel.com/docs/deployments/promote-preview-to-production)。

## 当前仍需关闭的门禁

| 门禁 | 当前情况 | 放行条件 |
| --- | --- | --- |
| Dirty Worktree | 大量已修改和未跟踪文件，包含多天开发成果 | 按功能切片检查差异，禁止盲目 `git add .` |
| D1/D4 数据库结构 | 已在 staging 验证，production 是否同步仍须发布前盘点 | 生产 migration list/dry-run 与单独授权 |
| 2.1 Slice E 数据库结构 | staging 已应用，迁移历史/RLS/ACL 已核验 | 完成生成 hook、真实角色、审计顺序、提案拒绝、诊断与零残留验收；production 再次单独授权 |
| 最终人工验收 | 用户要求后续功能完成后统一验收 | 桌面、手机、普通用户、管理员、超级管理员关键路径通过 |
| CI | 已有 GitHub Actions：test → typecheck → build → 两次 audit | release 分支/PR 对应 CI 全绿 |
| Vercel 环境 | Frontend/API 两项目，环境变量分层 | Preview 与 Production 变量名、域名、CORS、Auth 回调逐项核对，不打印值 |
| 回滚准备 | Vercel 可回滚应用，数据库不能盲目回滚 | 记录两个项目上一稳定 deployment；DB 采用 forward-fix |

## 阶段 0：冻结范围与只读盘点

在仓库根目录执行：

```powershell
git status --short
git branch --show-current
git remote -v
git diff --check
git diff --stat
git ls-files --others --exclude-standard
```

检查原则：

- 保留现有 Dirty Worktree；禁止 `reset`、`clean`、`checkout --` 和新建 worktree。
- 不打印 `.env`、Vercel token、Supabase secret、DeepSeek key 或支付宝密钥。
- 不使用 `git add .`、`git add -A`；先形成“本次发布文件清单”，再逐组显式暂存。
- `server/src/index.ts` 当前显示为删除项，发布前必须确认它由 `server/src/local.ts`/Vercel 入口替代，而不是误删。

## 阶段 1：本地质量门禁

```powershell
npm run verify
node scripts/verify/preview-readiness.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/e2e-workbench-shell.ps1 -SelfTest
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/e2e-workbench-shell.ps1 -Twice -EvidenceDir "D:\work\77港话通社媒文案\77\docs\evidence\release-candidate\workbench"
```

放行条件：

- Client/Server 测试、双端 typecheck/build、production/full audit 全通过。
- 浏览器无横向溢出、关键弹窗可关闭、无未处理页面 JS error。
- `/api/health` 200；注册/登录、工作台生成、历史、收藏、签到、管理员、结算的本地验收通过。
- 自动化 fixture 只能证明 UI 合同，不能代替真实 Supabase/RLS/模型验证。

## 阶段 2：2.1 Slice E Migration 门禁（高风险，单独授权）

> 2026-07-22 状态：staging Migration、迁移历史、RLS 与 ACL 核验已完成；以下 dry-run/应用步骤保留为审计记录和生产前参考。当前尚待本节第 2、3 项的真实角色/API/浏览器与零残留验收。

先做只读/不落库检查：

```powershell
npx supabase migration list --linked
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/supabase-linked-dry-run.ps1
```

确认 dry-run 只包含预期的 `20260722100000_slice_e_bad_case_review_packs.sql`，没有 DROP、TRUNCATE、历史 repair 或意外对象。随后：

1. 用户明确授权后，先应用到独立 staging Supabase。（已完成）
2. 跑真实生成成功/失败 hook、审阅包列表/详情、严格审计顺序、普通 admin 403、super_admin 写操作、提案快照哈希拒绝与诊断聚合。
3. 保存脱敏 SQL/API/浏览器证据；确认 Advisor 无新增严重问题。
4. 生产 Migration 再次单独授权；先备份/记录恢复点，再采用向前兼容 Migration。

禁止 Grok/Codex 自动执行 `supabase db push`、`migration repair` 或生产 SQL。

## 阶段 3：整理提交并推送 release 分支

建议从当前 `master` 建 release 分支，按功能切片显式暂存；以下只是模板，文件清单必须按当时 `git status` 重新确认：

```powershell
git switch -c release/2026-07-19-d-slices

# 示例：逐个目录/文件显式加入，不要 git add .
git add -- client/src/components/admin client/src/services/adminMetricsApi.ts
git add -- server/src/routes/admin.ts server/src/services/adminMetricsService.ts
git diff --cached --check
git diff --cached --stat
git diff --cached

git commit -m "feat(admin): add audited bad-case diagnostics"
```

其他 D1–D6、Auth/UI、文档和 Migration 应按可回滚边界拆分 commit。每个 commit 都要能解释“改了什么、如何验证”。提交前再做：

```powershell
git status --short
git log --oneline --decorate -10
npm run verify
```

用户确认 commit 历史和差异后才 push：

```powershell
git push -u origin release/2026-07-19-d-slices
```

推荐在 GitHub 发 PR 到 `master`，要求 `CI / quality` 通过后才能合并。GitHub 的 branch protection 可禁止 force push，并把状态检查设为合并前置条件：  
参考：[GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)、[GitHub status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks)。

## 阶段 4：两个 Vercel Preview 验收

若两个 Vercel 项目都已连接同一 Git 仓库，release 分支 push 后应各自产生 Preview：

1. API 项目（Root=`server`）：确认 deployment 为 READY，`/api/health` 200。
2. Frontend 项目（Root=`client`）：确认页面加载，`VITE_API_BASE_URL` 指向正确的 Preview API 稳定地址。
3. API `ALLOWED_ORIGINS` 精确包含 Frontend Preview origin，不使用 `*.vercel.app`。
4. Supabase staging Redirect URLs 包含 Preview `/auth/callback` 与 `/reset-password`。
5. Preview 必须连接 staging 数据库；禁止连接 production Supabase。
6. DeepSeek key 只存在 API 项目的 Sensitive 变量中，不进入 Frontend、浏览器 bundle、截图或日志。

Preview smoke：

- 公开页、注册、邮箱确认、登录、退出、重置密码。
- 工作台真实模型生成，`generationEngine=deepseek`；卖点进入文案。
- 历史/收藏/工作台恢复；用户 A 无法读取用户 B 数据。
- 签到并发、额度账本、会员状态。
- 普通管理员只见本 review group；超级管理员模型指标和低分任务详情可用，详情读取产生审计记录。
- 结算先保持 `PAYMENT_MODE=mock`；不在本次开启生产支付。
- Vercel Function logs、Network、浏览器 bundle 中无 secret/JWT/cookie。

## 阶段 5：晋升生产（再次明确授权）

生产发布顺序：

1. 若有生产 Migration：先备份/记录恢复点，授权后应用兼容性 Migration。
2. 晋升 API 项目，先验证生产 `/api/health`、CORS、数据库和模型调用。
3. 晋升 Frontend 项目，验证生产页面和真实 API 连接。
4. 跑生产只读/小流量 smoke，观察 error logs 15–30 分钟。

Dashboard 可对目标 Preview 选择 **Promote to Production**。若用 CLI，必须先确认已链接到正确的项目和团队，再执行；不要在自动化中默认带 `--yes`：

```powershell
vercel list --environment preview --status READY
vercel inspect <deployment-url>
vercel logs --deployment <deployment-url> --level error --limit 50
vercel promote <deployment-url>
vercel promote status
```

注意：Frontend 和 API 是两个独立项目，需要分别检查、晋升和回滚。不要因为一个项目 READY 就认为整套系统已发布。

## 阶段 6：生产验证与回滚

生产 smoke 至少包含：

- Frontend 首页/Auth/工作台可访问；API health 200。
- CORS 只接受生产 Frontend origin。
- 一次最小真实模型生成成功；Token/错误率/延迟日志可见。
- 普通用户、普通管理员、超级管理员权限边界正常。
- 新版低分任务详情显示完整 UUID，正文读取有审计；日志不暴露 prompt、response、request ID、raw error。

若应用故障，分别对 Frontend/API 使用 Vercel Instant Rollback。Hobby 通常只能回到紧邻的上一生产 deployment；回滚不会自动恢复数据库或外部服务状态，环境变量也可能与旧构建不一致。数据库采用 forward-fix，不做破坏性 down migration。  
参考：[Vercel Instant Rollback](https://vercel.com/docs/instant-rollback)、[Vercel rollback CLI](https://vercel.com/docs/cli/rollback)。

## 给 Grok Build 的部署提示词模板

```text
接手 D:\work\77港话通社媒文案\77 的发布准备。先完整阅读 README.md、AGENTS.md、.planning/status.md、
docs/release/2026-07-19-github-vercel-update-runbook.md 和最新 verification.md。

严格保留现有 Dirty Worktree：禁止 reset/clean/checkout --，禁止新建 worktree，禁止删除用户文件。
先只做只读盘点：git status/diff/branch/remote、CI 与 Vercel 配置；不要读取或打印任何 .env 值、token、key、cookie。
禁止 git add . 或 git add -A；先输出本次发布的显式文件清单与分组 commit 方案，等待我确认。
未获得我逐项明确授权前，禁止 supabase db push/migration repair/生产 SQL、commit、push、Vercel deploy/promote/rollback、修改环境变量或域名。

自动门禁必须执行：npm run verify、preview-readiness、Playwright 双跑；fixture 证据不能冒充真实 Supabase/RLS/模型证据。
获得 push 授权后只推 release 分支并等待 GitHub CI 与两个 Vercel Preview READY；完成 Preview 验收后再次停下，等待生产 Migration/Promote 授权。
每一步报告：执行命令、退出码、关键脱敏结果、证据路径、剩余风险；连续两轮无进展立即停止。
```

## 最终 Go / No-Go 清单

- [ ] 发布文件清单已人工检查，没有混入临时文件、证据中的 secret 或误删。
- [ ] `npm run verify` 与 CI 全绿。
- [ ] D1/D4 staging Migration、RLS、并发与遥测真实验收通过。
- [ ] 两个 Vercel Preview 都 READY 且完整 smoke 通过。
- [ ] Preview/Production 环境变量名与域名已逐项核对，未打印值。
- [ ] 上一稳定 Frontend/API deployment 已记录，可立即回滚。
- [ ] 用户明确授权生产 Migration（如有）。
- [ ] 用户明确授权 API Promote。
- [ ] API 生产 smoke 通过后，用户明确授权 Frontend Promote。
- [ ] 生产观察期无异常；发布证据已脱敏归档。
