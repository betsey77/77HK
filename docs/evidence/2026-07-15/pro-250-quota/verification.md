# Pro 250 额度验收记录

日期：2026-07-15

## 结果

- Pro 价格保持 ￥19/月，额度统一为每自然月 250 次。
- Migration `20260715113350_pro_250_quota.sql` 已推送至远端项目。
- 存量有效 Pro 用户当前周期立即从 10/400 变为 10/250；没有清零或改写已使用额度。

## 自动化验证

- 定向 Client：31/31 通过。
- 定向 Server：62/62 通过。
- 全量 Client：372/372 通过。
- 全量 Server：560/560 通过。
- Client/Server TypeScript、生产构建通过。
- `npm audit --omit=dev` 与 `npm audit` 均为 0 vulnerabilities。

完整命令输出：[`../slice-03/test-output.txt`](../slice-03/test-output.txt)

## 远端验证

- Migration 历史：local/remote 均包含 `20260715113350`。
- Pro plan：`quota_per_cycle=250`、`period_unit=month`、`period_count=1`。
- 当前有效 Pro：1；`max_quota_used=10`；达到或超过 250 的用户为 0。
- 在单一远端事务内临时设置同一订阅用量并调用真实 `reserve_quota`：
  - 249：成功预留，事务内递增为 250。
  - 250：返回额度耗尽。
  - 251：返回额度耗尽。
- 事务已回滚；`qa-pro-250-boundary-*` ledger 记录为 0，真实用户用量仍为 10。

## 浏览器验收

- Pricing 桌面与 390px 手机视图均显示“250 次生成”，页面不再出现“400 次”。
- 两个视图均满足 `scrollWidth === clientWidth`，无横向溢出。

截图：

- [桌面视图](../slice-03/frames/pro-250-pricing-desktop.png)
- [手机视图](../slice-03/frames/pro-250-pricing-mobile.png)

## 未执行

- 未部署应用。
- 未执行 Git commit 或 push。
