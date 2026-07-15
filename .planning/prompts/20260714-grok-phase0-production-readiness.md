# Grok Build 交接：Phase 0 生产发布基线

项目：`D:\work\77港话通社媒文案\77`

先读：

1. `CLAUDE.md`
2. `docs/comprehensive-spec-v2.md`
3. `spec/PRD.md`
4. `spec/SDD.md`
5. `spec/TEST_PLAN.md`
6. `spec/ACCEPTANCE.md`
7. `docs/release/2026-07-14-production-launch-plan-v2.md`
8. `.planning/status.md` 与 `.planning/regression_matrix.md`

目标：只完成 Phase 0，不部署、不切生产支付宝、不推送 Migration、不覆盖已完成产品能力。

成本约束：当前先按 Vercel Hobby + Supabase Free 设计，不购买付费服务；若发现免费层无法满足功能或条款，请只记录阻断并停止，不得自动升级。

必须完成：

- 审阅 dirty worktree，给出可提交分组和回滚点；未经用户确认不得 commit/push。
- 对照远端 migration history，分析本地 `20260714000000/000001` 与远端 `20260714052140/052414` 的 SQL 映射；产出修复方案。任何 history repair 或远端写入先停下请求授权。
- 受控修复 `form-data` high 和 `concurrently`/`shell-quote` critical，禁止 `npm audit fix --force`；更新 lockfile 后跑全量回归。
- 重构根验证脚本，使安装与构建分离；增加明确的 Client/Server test、typecheck、build 命令，不能在 `build` 内执行 `npm ci`。
- 补齐 `.env.example` 的变量名契约，所有值为空；不得读取、复制或输出真实密钥。
- 增加 Playwright 依赖和最小 smoke harness 的方案，但本轮不要扩展完整业务 E2E。
- 检查 Supabase Advisor：SECURITY DEFINER RPC、Leaked Password Protection、payment webhook table grants；只先形成修复提案，数据库写操作需授权。

验收：

- Client 353+ tests、Server 509+ tests、双端 typecheck/build 全通过。
- `npm audit --omit=dev` 无未处置 high/critical；完整 audit 无未处置 high/critical。
- 迁移漂移有可验证的一一映射和修复步骤；未经授权没有远端变化。
- 更新 `spec/TEST_PLAN.md`、`spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`、`.planning/progress.md` 和 `docs/evidence/`。
- 停止汇报，等待 Codex 独立验收。
