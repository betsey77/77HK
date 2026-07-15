# Phase 0 生产发布基线 — 验证证据

日期：2026-07-14  
执行者：Grok Build  
范围：Phase 0 only — 未部署、未切生产支付宝、未 `db push`、未 history repair、未 commit/push。

## 自动化结果

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| Client tests | `npm run test:client` | **PASS** 27 files / **353** tests |
| Server tests | `npm run test:server` | **PASS** 22 files / **509** tests |
| Client typecheck | `npm run typecheck:client` | **PASS** |
| Server typecheck | `npm run typecheck:server` | **PASS** |
| Client build | `npm run build:client` | **PASS**（主 bundle ~812 KB，chunk warning 非阻断） |
| Server build | `npm run build:server` | **PASS** |
| Prod audit | `npm run audit:prod` | **PASS** 0 vulnerabilities |
| Full audit | `npm run audit:all` | **PASS** 0 vulnerabilities |

## 依赖处置

| 包 | 前 | 后 | 方式 |
| --- | --- | --- | --- |
| `form-data` | 4.0.5 (high) | **4.0.6** | root `overrides` |
| `concurrently` | 9.2.1 | **9.2.4** | devDependency 升级 |
| `shell-quote` | 1.8.3 (critical) | **1.8.4** | root `overrides`（≥ patched） |

禁止使用：`npm audit fix --force`（未使用）。

## 脚本

根 `package.json`：

- `install:all` = `npm ci`
- `test` / `test:client` / `test:server`
- `typecheck` / `typecheck:client` / `typecheck:server`
- `build` / `build:client` / `build:server` — **内不含 `npm ci`**
- `audit:prod` / `audit:all` / `verify` / `test:e2e:smoke`

详见 `scripts/verify/commands.md`。

## Migration 漂移

- 映射文档：`migration-drift-mapping.md`
- 本地文件已重命名对齐远端 version：`20260714052140` / `20260714052414`
- **远端无写入**；repair 待授权

## Supabase Advisor

- 仅提案：`supabase-advisor-proposals.md`
- **无 Dashboard/SQL 变更**

## Playwright

- 依赖 + `playwright.config.ts` + `e2e/smoke.spec.ts`
- 方案：`playwright-smoke-plan.md`
- 完整业务 E2E **未**扩展
- Codex review fix：删除「前端不可达则 skip」分支；连接拒绝 / 5xx 时 smoke **真实失败**（门禁语义）

## 工作树

- 分组与回滚点：`worktree-commit-groups.md`
- **未 commit / push**

## 成本

- 仍按 Vercel Hobby + Supabase Free 设计
- 未购买付费服务；未发现本轮必须升级的 Free 层硬阻断（S2 开启密码泄露保护若需 Pro 则另记阻断）

## 判定

**Phase 0 本地基线目标达成**，等待 Codex 独立验收。  
整体产品仍 **NOT READY FOR PRODUCTION**（B1 支付宝 E2E、B2 生产支付、B8 Auth 邮件、B9 托管配置、B10 运维等未做）。
