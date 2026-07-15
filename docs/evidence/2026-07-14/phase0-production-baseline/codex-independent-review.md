# Phase 0 Codex 独立验收

日期：2026-07-14  
范围：本地工程基线；不包含部署、远端 Migration 写入、真实支付宝生产支付或完整业务 E2E。

## 独立复跑结果

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 全量门禁 | `npm run verify` | PASS，exit 0 |
| Client tests | `npm run test:client` | 27 files / 353 tests PASS |
| Server tests | `npm run test:server` | 22 files / 509 tests PASS |
| 双端 typecheck | `npm run typecheck` | PASS |
| 双端 production build | `npm run build` | PASS；主 JS bundle 812.25 kB，存在非阻断 chunk warning |
| Production audit | `npm run audit:prod` | 0 vulnerabilities |
| Full audit | `npm run audit:all` | 0 vulnerabilities |
| Playwright test discovery | `npx playwright test --list --config=playwright.config.ts` | 1 test discovered，PASS |
| Playwright Chromium install | `npx playwright install chromium` | PASS；用户已明确授权，Chromium/Headless Shell v1228 安装成功 |
| Playwright smoke execution | `npm run test:e2e:smoke` | PASS；1/1，Chromium，3.6s |
| 首页桌面证据 | `npx playwright screenshot --full-page --viewport-size="1440,900" ...` | PASS；`homepage-smoke.png` |
| Phase 0 secret pattern scan | 对 `.env.example` 与本轮 evidence 扫描常见 secret/private-key 模式 | 无匹配 |

## 审阅修正

1. 删除 smoke 的“前端不可达自动 skip”逻辑；现在连接失败或 5xx 会真实失败。
2. 工作树提交分组中的 W2 Migration 文件名已改为当前真实版本：
   - `20260714052140_w2_case_library.sql`
   - `20260714052414_harden_w2_case_library_function.sql`
3. 未修改 Migration SQL 语义，未执行 `migration repair` / `db push`。

## 判定

**Phase 0 本地工程基线通过，Playwright 公开首页 smoke 已真实运行。**

这不等于产品可生产发布。完整 E2E、staging、支付宝沙箱真实闭环、生产商户配置、远端 Migration 漂移处理和 Vercel Preview/Production 仍须按发布计划逐项完成。

## 当前停点

Chromium 安装门禁已解除；公开首页 smoke 已通过。下一阶段仍需单独处理 Free staging、完整业务 E2E、支付宝沙箱真实闭环与 Vercel Hobby Preview，不能用本条公开页 smoke 替代这些门禁。
