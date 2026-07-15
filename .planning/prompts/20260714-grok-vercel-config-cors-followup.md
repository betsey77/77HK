# Grok Build 小修：Vercel 当前配置语义 + CORS 403

项目：`D:\work\77港话通社媒文案\77`

只修以下两项；不要扩展范围，不部署、不安装、不迁移、不提交、不推送。

## 1. 修正 API Vercel 配置

当前 `server/vercel.json` 使用 legacy `builds`，且在 Fluid Compute 下通过文件写 `memory`。根据 Vercel 当前官方配置：

- Express 可从 `src/app.ts` 的 default export 零配置识别；
- `functions` 不应与 legacy `builds` 混用，优先使用 `functions`；
- Fluid Compute 下不要在 `vercel.json` 写 `memory`；
- maxDuration 用 `functions` 配置；Hobby 当前上限 300 秒；
- region 保留 `hnd1`。

请把 `server/vercel.json` 改为最小、当前语义的 Express 配置：加入 `$schema`，保留 `regions: ["hnd1"]`，用 `functions` 针对实际 Express entry `src/app.ts` 设置 `maxDuration: 300`；删除 legacy `builds`、自定义 catch-all `routes` 和文件内 `memory`。

`server/api/index.ts` 是本切片刚新增、修正后不再需要的适配文件，请删除，避免 Vercel 同时识别两个入口。不要删除任何其他文件。

同步修正文档中关于 `server/api/index.ts`、`@vercel/node builds`、memory 的陈述：

- `docs/release/2026-07-14-hosting-platform-decision.md`
- `docs/release/2026-07-14-vercel-two-project-setup.md`
- `docs/evidence/2026-07-14/local-vercel-readiness/verification.md`
- 如 spec/changelog/planning 中有同类错误，也只改对应句子。

## 2. CORS 拒绝返回明确 403

当前 disallowed Origin 通过 Express 默认错误处理成为 500。保持 exact allowlist 与“无 Origin 允许”不变，增加最小的错误处理中间件，使 `Not allowed by CORS` 返回：

- HTTP 403
- 不泄漏内部变量/密钥
- JSON 可使用通用错误，如 `{ "error": "Origin not allowed" }`

更新 `server/src/__tests__/cors.test.ts`：拒绝来源必须断言 403，而不是 `>=400`。不要改变已允许 origin/no-Origin 行为。

## 验证

1. `server/vercel.json` JSON 可解析，且不含 `builds`、`routes`、`memory`；含 `$schema`、`regions`、`functions`、`maxDuration: 300`。
2. `server/api/index.ts` 已删除。
3. `cd server && npx vitest run src/__tests__/cors.test.ts src/__tests__/alipayUrls.test.ts`
4. `npm run typecheck:server`
5. `npm run build:server`

完成后停止，按“改动 / 验证 / 未做”汇报。
