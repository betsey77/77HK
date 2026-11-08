# 1.1.4.5 Slice D7 staging 验收

日期：2026-07-22  
环境：Supabase staging `wzpaghnxlpfjojvuxplx`（非生产）  
范围：D1 签到奖励、D4 活跃/模型遥测、活动上报缺口修复

## 结论

Slice D7 自动化 staging 门禁通过。已应用的 `20260719090000` 与 `20260719120000` 在真实 PostgreSQL、RLS、RPC、并发和 API 路径上符合当前合同；临时账号和测试数据均已清理。

本轮还发现并修复了一个真实产品缺口：`recordAppActivity` 原先只有服务实现而没有生产调用点，因此即使用户登录，DAU/WAU/MAU 也会长期为 0。现在云同步首次成功后会异步调用 `POST /api/me/activity`；上报失败不会阻塞工作台，后续成功同步可以重试。

## 实行为验收

`node scripts/staging-slice-d7-acceptance.mjs`

| 编号 | 结果 |
| --- | --- |
| D7-1 | 两个临时 staging 用户创建、确认并登录成功 |
| D7-2 | 新用户触发器自动创建 active Free subscription |
| D7-3 | Free 用户第 7 天 8 路并发仅生成 1 条当日签到、1 个终身奖励和 1 次固定 30 天 Pro 升级 |
| D7-4 | owner 只读隔离有效；跨用户读取为空；浏览器伪造签到和直调 RPC 均失败 |
| D7-5 | 有效 Pro 仅获得 pending 奖励；提前领取和跨 owner 领取失败；到期后只应用一次且重复领取幂等 |
| D7-6 | 活跃 API 匿名 401；认证请求忽略客户端伪造 owner/date；同一香港日去重；私表不可由浏览器直读/直写 |
| D7-7 | service-role 模型遥测合法行可写；不合法 usage 组合被约束拒绝；浏览器不可直读/直写 |

原始输出：`runtime.txt`。

## 清理复核

使用唯一 model request ID 精确删除合成遥测行后，只读复核结果：

- 临时用户：0
- 合成模型日志：0
- 临时签到：0
- 临时会员奖励：0
- 临时活跃记录：0

没有调用真实 DeepSeek，因此没有产生供应商 Token 费用；模型日志测试使用合成 Token 数值，仅验证表约束、ACL 和读取合同。

## 回归

- 全量 Client：50 files，447/447
- 全量 Server：53 files，703/703
- 双端 TypeScript：通过
- Client production build：通过
- Server build：通过

原始输出：`full-test.txt`、`typecheck.txt`、`build.txt`。

## Advisor 与边界

- `app_activity_daily`、`model_call_logs` 的 “RLS enabled, no policy” 为刻意的私表设计；仅 `service_role` 拥有显式权限。
- Performance Advisor 指出 `membership_grants.subscription_id` 外键没有覆盖索引。当前奖励读取走 `(user_id, source)` 唯一索引，数据量低且没有按该外键查询，因此本轮不追加 Migration；如未来频繁按 subscription 查询或删除 subscription，再用新的 forward migration 加索引。
- 未部署、未 commit、未 push、未 reset/clean、未创建 Worktree，也未接触生产 Supabase。
- 自动化数据门禁已通过；签到和管理指标的最终视觉/业务人工验收仍应在发布前完成。

