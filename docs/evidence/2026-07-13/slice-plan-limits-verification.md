# Free 收藏与生成历史容量权益 — 验证证据

日期：2026-07-13

## 实现范围

- Free 最多新增 10 条收藏；已有超额数据保留，最新 10 条可访问，Pro 全部解锁。
- Free 最新 15 条生成历史可访问；搜索和详情均由服务端限制，Pro 全部解锁。
- 收藏按钮、收藏库、参考案例选择和 Prompt 注入共享同一可访问收藏范围。
- 收藏新增与 legacy import 由 BFF 复核套餐和 owner-scoped 数量，超限返回 `403 PLAN_LIMIT`。
- 套餐解析异常 fail closed 为 Free。

## 自动化结果

- 定向 Client：33/33 passed。
- 定向 Server：178/178 passed。
- 全量 Client：276/276 passed（16 files）。
- 全量 Server：433/433 passed（15 files）。
- Client `npx tsc --noEmit`：PASS。
- Server `npx tsc --noEmit`：PASS。
- Client `npm run build`：PASS，1700 modules transformed。
- Server `npm run build`：PASS。
- 一次全量复跑中既有 `/api/me` 非法 JWT 用例在 5 秒处超时；隔离复验 6/6 通过，随后全量 433/433 通过，判定为非本切片的瞬时测试波动。

## 安全与数据边界

- 未执行数据库 Migration、部署、Git push 或远端写入。
- 未修改生成额度、套餐价格、支付宝验签、Webhook 或 RLS。
- 超额旧数据只锁定、不删除；删除收藏可释放新增容量。
- Vite 仍提示单 chunk 大于 500 kB（约 740.85 kB），为既有非阻断性能提醒。
