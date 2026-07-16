# Grok Build 交接：Playwright 运行时基线返工

日期：2026-07-15
项目：77 港话通社媒文案
仓库：`D:\work\77港话通社媒文案\77`
GitHub：`betsey77/77HK`

## 结论

上一轮“Playwright runner 稳定化 + 公开路由冒烟”不能通过 Codex 独立验收。测试发现可用，但实际执行阶段仍会无输出挂起，且禁用 `webServer` 后同样复现。因此下一步不是继续开发业务功能，而是先建立与 CI 一致、可重复的本地 Node 22 Playwright 基线。

可直接交给 Grok Build 的 prompt：

`D:\work\77港话通社媒文案\77\.planning\prompts\20260715-190000-grok-playwright-runtime-repair.md`

## Codex 独立复验事实

| 检查 | 结果 |
| --- | --- |
| 本机 Node | `v26.1.0`，路径为 `C:\Program Files\nodejs\node.exe` |
| CI Node | `.github/workflows/ci.yml` 固定 Node 22 |
| `playwright test --list` | 通过，4 秒内列出 10 条用例 |
| focused public/protected E2E | 64 秒无 reporter 输出后超时 |
| 禁用 `webServer` 后的同一 E2E | 仍无 reporter 输出，手动终止 |
| `localhost:5173` | HTTP 200 |
| 进程现象 | 中断会留下 Playwright CLI 子进程；Codex 已仅清理自己启动的精确 PID |
| `git diff --check` | 目前有两处文档尾随空格：`.planning/status.md`、`spec/TEST_PLAN.md` |
| 运行产物 | 上轮曾将 `test-results/` 显示为未跟踪目录；当前 `.gitignore` 未包含该目录，失败时仍会造成工作区噪声 |

这不是业务页面或 Vite 不可访问的问题。Node 26 与 Playwright 执行阶段的兼容性是最可能的差异，但必须在现有 Node 22 上证实，不能把 `.mjs` 配置迁移当作根因已解。

## 当前工作区注意事项

当前 worktree 已包含上一轮 Grok 的未提交改动，以及两份上一轮交接文档。所有这些改动都应视为用户保留内容。

不得执行：

- `git reset`、`git clean`、`git checkout --`
- 创建 worktree
- Node、浏览器、npm 依赖或工具安装/下载
- Supabase 远端读写、Migration、部署、支付、真实登录
- commit 或 push

如果本机没有可用 Node 22，Grok 必须停止并请求用户明确允许安装 Node 22 LTS，不能下载替代运行时或宣称测试已通过。

## 后续开发顺序

1. 本次：修复并验收 Node 22 Playwright 本地基线。
2. 基线通过后：单独规划“完全隔离、无真实 Supabase 网络的已登录工作台壳层 smoke”，不能复用历史 project-ref localStorage mock。
3. 然后：回到既有 Slice B 的真实 Supabase Auth、`profiles/user_roles` 与 RLS；这是严格安全切片，需要独立的远端/迁移授权复核。
4. 最后才继续额度、订阅、支付或更大范围管理员 E2E。

## 用户完成 Grok 后回传给 Codex

请提供 Grok 生成的：

1. `.planning/prompts/*-codex-review.md` 路径。
2. `docs/evidence/2026-07-15/playwright-runtime-repair/verification.md` 路径。
3. `test-output.txt` 与截图目录路径。
4. 最终 `git status --short`。
5. 明确说明本机是否已有 Node 22，以及是否执行了安装（预期未安装）。

Codex 会再次独立运行两次 focused E2E；未满足连续通过、正常退出和无残留进程前，不会接受该测试基线，也不会把后续业务功能交给它。
