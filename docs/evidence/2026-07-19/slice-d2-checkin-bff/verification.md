# 1.1.4.5 Slice D2 签到 BFF 本地验证

日期：2026-07-19  
状态：本地 API、服务与自动化合同完成；D1 Migration 未应用

## 本轮目标

- 新增已鉴权的签到状态、幂等签到和奖励领取接口。
- 服务端只使用认证得到的 `req.userId`，忽略客户端传入的用户 ID 和日期。
- BFF 只通过受信任 Supabase 客户端读取 owner-scoped 状态或调用 D1 RPC。
- 对外统一 camelCase 状态模型，并脱敏数据库、RPC、密钥和内部订阅信息。

## 变更

- 路由：`server/src/routes/checkIn.ts`
  - `GET /api/me/check-in`
  - `POST /api/me/check-in`
  - `POST /api/me/membership-grants/:id/claim`
- 服务：`server/src/services/checkInService.ts`
  - 香港自然日与有效连续签到状态
  - `apply_daily_checkin(_user_id)` 结果规范化
  - `claim_checkin_membership_grant(_user_id,_grant_id)` 结果规范化
  - pending 奖励按当前 Pro 是否仍有效计算 `canClaim`
  - 临时服务故障返回脱敏 503；确定性无订阅/无 Pro 套餐状态返回通用 500
- 挂载：`server/src/app.ts`
- 测试：`check-in-service.test.ts`、`check-in-route.test.ts`

## 安全与契约覆盖

- 三个接口均经过 `requireAuth`；body/query 中伪造的 `userId`、日期不会进入服务调用。
- 所有状态读取显式添加 `user_id = req.userId`，领取 RPC 同时绑定当前用户与奖励 ID。
- 非 UUID 奖励 ID 返回 400；非当前用户或不存在的奖励统一返回 404；有效 Pro 冲突返回 409。
- RPC 不可用返回通用 503；未知错误或确定性账户状态异常返回通用 500，不回传 Supabase 原始消息。
- 响应不包含 `subscription_id`、邮箱、JWT、API Key 或 service-role key。
- 香港午夜边界、过期连续签到、active Pro 边界、重复领取和 snake_case 到 camelCase 映射均有单元合同。

## TDD 与验证结果

| 阶段 | 命令 | 结果 |
| --- | --- | --- |
| Red | `cd server; npm test -- --run src/__tests__/check-in-service.test.ts src/__tests__/check-in-route.test.ts` | 服务模块不存在且路由为 404，按预期失败 |
| Focused | 同上 | 2 文件，25/25 通过 |
| 受影响回归 | `npm test -- --run src/__tests__/me.test.ts src/__tests__/billing.test.ts src/__tests__/check-in-route.test.ts src/__tests__/check-in-service.test.ts` | 4 文件，63/63 通过 |
| Server 全量 | `cd server; npm test -- --run` | 43 文件，640/640 通过 |
| Server 构建 | `cd server; npm run build` | TypeScript 通过 |
| 本地无数据库写入冒烟 | `GET /api/health`；匿名 `GET /api/me/check-in` | HTTP 200；HTTP 401 |
| 空白门禁 | `git diff --check -- <D2 files>` | 通过；只有既有 `app.ts` LF/CRLF 提示 |

## Grok Build 使用与处置

- D2 设计审查使用有界 headless Grok，只开放 `read_file,grep`，在约 87 秒内正常完成。
- 第一轮实际实现复核达到 6-turn 上限，未形成最终结论；第二轮提高到 10 turn 后在约 173 秒内正常返回。
- Grok 确认未发现可利用的 IDOR、跨用户领奖或密钥泄漏，并指出两个中等契约问题：POST 的 `canClaim` 与 GET 不一致、确定性业务状态被归为 503。两项均已最小修复并加入回归。
- Grok 提到的应用/数据库时钟源偏差和全站 Pro 过期口径属于 D7 真实数据库/后续跨模块验证风险，本轮未扩大重构。
- Grok 全程只读；复核前后 Dirty Worktree 条目没有出现其额外业务文件改动。

## 尚未证明的边界

- D1 Migration 仍未在本地或远端 PostgreSQL 执行，因此没有真实表/RPC 往返、并发事务、RLS A/B 或回滚证据。
- 当前运行中的本地 API 连接的数据库尚无 D1 schema；不能把 HTTP 503 当作 D2 失败或成功的数据库证据。
- 未执行 Migration、dry-run、staging 写入、部署、commit、push、reset、clean 或创建 Worktree。
- 下一小切片是 D3：每日签到入口、关闭去扰、进度与领取 UI；在 D1 未应用前应使用隔离 API mock 完成前端合同与 E2E。
