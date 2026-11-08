# V2.1 Slice E8 staging 真实闭环验收

日期：2026-07-22  
目标：staging Supabase `wzpaghnxlpfjojvuxplx`  
脚本：`node node_modules/tsx/dist/cli.mjs scripts/staging-slice-e8-acceptance.mjs`

## 结论

真实 API/数据闭环 **7/7 通过**：

1. 临时 owner、普通 admin、super_admin 均通过真实 Supabase Auth 取得 JWT。
2. 真实 `afterGenerationPersistReviewPack` 对低分完成任务与失败任务建包，并证明重复调用不重复建包/事件。
3. 匿名/无效 JWT 返回 401；普通用户与普通 admin 返回 403；浏览器角色不能直读 E8 表。
4. super_admin 列表仅返回元数据；详情先完成 scope 与审计，隐藏任务返回 404 且不写详情审计。
5. deterministic-only 旧 `completed` 记录由真实 DeepSeek 升级一次；第二次请求幂等且不追加重复事件。
6. 指派、状态迁移、Finding 人工结论、旧哈希 409、有效 review-only 提案、诊断指标和领域事件全部通过。
7. 无效 DeepSeek 密钥进入 `analysis_unavailable`，只返回安全 failure class 并写入 `analysis_failed` 事件。

测试结束后临时 Auth 用户、generation jobs、snapshot、review pack、finding、event 与详情 audit 均已清理。模型遥测按既有 90 天保留设计留下，但删除任务后 `job_id` 已变为 `null`，不再关联 QA 用户或任务。

## 测试期间发现并修复

- 工件详情原先对 `{artifactType, manifest}` 计算哈希，而提案构建器对 `manifest` 本体计算哈希，导致前端使用详情返回值创建提案必然返回 400。现统一为 manifest 本体哈希，并保留 artifact type 校验。
- 生成后 hook 的 `Promise.race` 成功后未取消 timeout，导致成功任务稍后仍打印 `review_pack.timeout` 假告警并拖慢进程。现于 `finally` 清除定时器。
- staging 脚本最初只读取 `server/.env`，未复用本地 API 的 root `.env` 补缺规则；现改为 server 值优先、root 仅补缺，且不输出或复制密钥。

## 自动验证

```text
focused server before staging: 39/39 passed
regressions after fixes: 38/38 passed
server full: 65 files, 809/809 passed
server typecheck: passed
server production build: passed
focused client Bad Case/API: 22/22 passed
staging acceptance: E8-1 through E8-7 passed
cleanup: CLEANUP_ZERO_RESIDUE passed
```

## Grok Build 记录

Grok 以 plan/no-subagents/no-worktree 方式执行两次只读测试审查。第一次触发 `max turns reached`；第二次仅完成初始化且没有输出测试矩阵。连续两轮无有效产出后按停止规则不再重试。Grok 未修改文件，闭环由仓库合同和红绿测试完成。

## 尚未证明

- 尚未在真实 staging 浏览器中由 super_admin 实际点击“运行 DeepSeek 分析”并保存截图；本轮证明的是相同公开 HTTP API、真实 JWT、真实 provider 与真实 DB 闭环，不能替代浏览器/人工验收。
- 未执行 Vercel Preview、生产 Migration、部署、commit、push、reset/clean 或 Worktree。

