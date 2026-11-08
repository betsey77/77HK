# Slice E7c DeepSeek Bad Case 分析验证

日期：2026-07-22  
范围：本地代码、自动测试、构建与只读配置检查；不含 staging 写入、生产迁移或部署。

## 修复结论

- 已复现并确认根因：旧实现只重跑确定性规则；`completed` 直接幂等返回，前端丢弃返回值，因此点击无可见反馈。
- 新实现先重建可审阅规则证据，再调用 DeepSeek；返回建议必须绑定已有 criterion ref，通过白名单/长度/置信度校验后才写入对应 Finding。
- AI 输出为 review-only suggestion；不会直接修改或发布 Prompt、规则、知识或模型策略。
- 分析完成用 `deepseek-1.0.0` 审计事件作幂等标记；旧 deterministic-only `completed` 记录可升级一次。
- 前端显示明确成功、幂等、pending 和安全失败提示，并在 Finding 内显示诊断、修复建议、置信度与建议 Owner。

## 自动验证

```text
focused client: 13/13 passed
client full: 483/483 passed
server full: 806/806 passed
client/server typecheck: passed
client/server production build: passed
npm audit --omit=dev: 0 vulnerabilities
npm audit: 0 vulnerabilities
preview-readiness: passed
localhost web: HTTP 200
localhost API health: ok; DeepSeek configured; model deepseek-v4-flash
isolated Playwright workbench smoke: 12/12 passed; 24 screenshots; no residual process
```

## 未证明的边界

- 未使用真实 super_admin 在 staging 点击 DeepSeek 分析，因此尚未证明真实 JWT、远端 DB 写入、审计顺序和真实 provider 返回的浏览器闭环。
- 未执行生产 Migration、Vercel Preview/Production、Git commit 或 push。
- 当前 Dirty Worktree 约 230 条记录；发布前必须形成显式文件清单，禁止盲目 `git add .`。

## 手册与发布状态

- `docs/admin/2026-07-22-bad-case-review-pack-guide.md`
- `docs/release/2026-07-22-v2.1-release-readiness.md`
