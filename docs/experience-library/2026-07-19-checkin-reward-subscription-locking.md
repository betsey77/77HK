# 签到奖励与订阅/额度的复用规则

适用范围：1.1.4.5 Slice D1-D3。

- 签到奖励不建立第二套订阅或额度账本；会员状态继续写现有 `subscriptions`，额度事实继续来自 `usage_ledger`。
- 有效 Pro 不能直接顺延 30 天，因为现有额度周期与 `current_period_end` 绑定；先保存 pending grant，到期后领取更符合额度语义。
- 奖励周期是固定 `interval '30 days'`，不同于支付宝购买使用的自然月。
- 同用户写操作统一使用：D1 advisory lock → `subscriptions FOR UPDATE` → 签到/奖励表。advisory lock 只串行 D1；真正与额度/支付互斥的是 subscription 行锁。
- “有效 Pro”必须同时满足计划为 Pro、状态 active、周期已开始且 `current_period_end > now()`；不能只看 status，因为过期 Pro 可能仍标为 active。
- Migration 草案的静态测试不能替代真实 PostgreSQL 执行、RLS A/B 和并发测试；后者必须留到经授权的独立 staging 门禁。
