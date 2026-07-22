# Slice D5 模型调用遥测本地验证

Date: 2026-07-19  
Scope: DeepSeek/CantoneseLLM 每次真实尝试的 usage、耗时、错误分类与重试编号  
Evidence level: local automated verification only

## 结论

Slice D5 已在本地完成。生成、审核、复审、原文评分、消费者反馈、画像解析、翻译、卖点港化、建议应用与粤语自然度评分均接入同一套可选 `ModelCallContext`。没有上下文的既有服务调用保持原行为，不写遥测。

- 每次供应商尝试记录 operation/provider/model、成功或错误、错误类别、耗时和 attempt。
- DeepSeek 官方响应中的 `prompt_tokens`、`completion_tokens`、`total_tokens`、`prompt_cache_hit_tokens`、`prompt_cache_miss_tokens` 原样规范化；缺失字段保持 `null`，不估算。
- 供应商响应到达但 JSON/内容校验失败时，仍保留已返回的 usage，并将结果归类为 `invalid_response`。
- 遥测只保存白名单字段，不保存 Prompt、回复正文、原始错误、用户邮箱、JWT 或密钥。
- 遥测校验、数据库或超时失败均不会改变原模型成功值或原模型异常。
- 生成路由共用一个 request context；质量重试使用 DeepSeek attempt 2。CantoneseLLM 切换到 DeepSeek fallback 时，DeepSeek attempt 从 1 开始。
- 修复旧冷启动循环：此前 `MAX_RETRIES=0` 会使 cold-start `continue` 后直接退出；现在初次尝试加两次冷启动重试确实执行为 attempt 1/2/3。

## Grok Build 评审

Grok Build 在只读边界内完成 D5 设计评审，建议采用共享 attempt wrapper、显式 request/job context、供应商级 attempt 编号，并指出 CantoneseLLM 冷启动重试实际只调用一次的问题。实现采用这些建议；Grok 未修改项目文件。

评审提示：`.planning/prompts/20260719-grok-slice-d5-model-telemetry-review.md`

## TDD 与验证

初始红灯：2 个文件中 24 项测试有 9 项失败，分别对应缺失的 usage/error wrapper、路由上下文和冷启动实际重试。

最终结果：

- `npx vitest run src/__tests__/telemetryService.test.ts src/__tests__/model-service-telemetry.test.ts`：24/24 通过。
- `npx tsc --noEmit`：通过。
- `npm test`：46 个文件、669/669 通过。
- `npm run build`：通过。
- 本地 Web `http://localhost:5173/app`：HTTP 200。
- 本地 API `http://localhost:3001/api/health`：HTTP 200。

全量回归首轮仅有一条卖点港化路由旧断言仍要求服务函数只有一个参数；业务响应未改变。断言已更新为同时验证匿名 request context，随后 669/669 全绿。

## 边界

- 测试全部使用 Mock，没有发起真实 DeepSeek/CantoneseLLM 请求，也没有消耗真实 Token。
- D1 与 D4 Migration 仍未应用，因此当前不证明真实数据库插入、RLS 或 RPC 运行时行为。
- 未执行 Supabase dry-run/push、数据库或 staging 写入、清理任务、部署、安装、commit、push、reset、clean 或新建 Worktree。
- 下一推荐小切片是 D6：分组运营指标与 `super_admin` 模型健康页；进入前先做权限和指标口径的聚焦设计/测试。
