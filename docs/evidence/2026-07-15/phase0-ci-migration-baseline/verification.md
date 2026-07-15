# Phase 0 CI 与 Migration 基线验证

日期：2026-07-15

## 范围

- 新增 Supabase CLI 本地项目配置，不连接新的远端项目。
- 新增只读 GitHub Actions CI，不部署、不读取 secrets、不执行 Migration 写入。
- 只读核对当前 linked Supabase 的 Migration history。

## 安全边界

- CI 的 `GITHUB_TOKEN` 仅有 `contents: read`。
- `actions/checkout` 与 `actions/setup-node` 固定到官方 v4 引用对应的 40 位 SHA。
- checkout 关闭凭据持久化；工作流不引用 `${{ secrets.* }}`。
- 工作流不包含 `db push`、`migration repair`、部署或支付命令。
- `supabase/config.toml` 只使用本地项目 ID 和本地回调地址，不包含远端项目 ref 或密钥。

## 验证结果

- 聚焦门禁：`server/src/__tests__/phase0-ci-config.test.ts`，2/2 通过。
- Migration 只读核对：15/15 个版本的 LOCAL 与 REMOTE 一致；包括 `20260714052140`、`20260714052414`、`20260715113350`、`20260715121000`。
- Client：37 个测试文件，400/400 通过。
- Server：31 个测试文件，571/571 通过。
- Client/Server TypeScript：通过。
- Client/Server production build：通过；主入口 JS 471.47 kB，无 500 kB 警告。
- `npm audit --omit=dev`：0 vulnerabilities。
- `npm audit`：0 vulnerabilities。

## 外部辅助

Grok Build 按只读、禁止改文件的范围调用一次；其目录工具返回 `tool_output_error`，未形成可靠审查结论，也未修改工作区。最终实现与验收均由 Codex 本地独立完成。

## GitHub Actions 在线验证

- 首次运行 `29402714802` 失败：CI 使用 Node 20，Supabase Realtime 初始化时缺少原生 WebSocket；Client 400/400 通过，Server 为 570/571。
- 修复：CI 改用 Node 22，并用静态门禁锁定；没有增加 WebSocket 垫片或依赖。
- 后续完整运行 `29402932310` 全绿，确认 Node 22 修复有效。
- 官方 `checkout/setup-node` 再升级至固定 SHA 的 v5，消除旧 Action Node 20 runtime 弃用警告。
- 最终运行 `29403089055` 全绿，quality job 1 分 15 秒完成，install/test/typecheck/build/两次 audit 全部通过。
- 最终运行链接：`https://github.com/betsey77/77HK/actions/runs/29403089055`

## 尚未验证

- 未创建 staging Supabase，未执行本地 Docker `db reset` 或 staging 从零重放。
- 未执行任何 `db push`、`migration repair`、部署或真实支付。
