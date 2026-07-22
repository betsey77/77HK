# 模型可观测性与 Token 成本建议

日期：2026-07-22  
范围：DeepSeek 调用监控、错误定位、Token 人民币估算、DAU/WAU/MAU

## 1. 当前“成功/错误率”代表什么

当前后台按 `provider + model` 聚合每一次模型调用 attempt：

- 成功：该次供应商调用返回了应用可接受的结果。
- 错误：该次 attempt 抛错，按 `timeout / rate_limited / authentication / unavailable / network / invalid_response / provider_error / unknown` 分类。

它能回答“模型链路总体是否健康”，但不能单独回答“用户最后是否生成成功”或“错误发生在哪一步”。一次用户生成会包含 `generate`、`audit`、`score_source`、`translate` 等多个 operation，也可能重试或 fallback；把这些 attempt 混成一个总错误率，会掩盖真正故障点。

2026-07-22 对 staging 的只读快照共 15 个 attempt，按发生位置拆开后为：

- `audit`：成功 1，`invalid_response` 1。
- `generate`：成功 2，`unknown` 2。
- `score_naturalness`：成功 2。
- `score_source`：成功 2。
- `translate`：成功 5。

所以当前不是“所有模型随机出错”，而是错误集中在 `audit` 的返回解析和 `generate` 的尚未细分错误。下一步应优先把两条 `unknown` 的错误分类补细，但仍不能保存原始供应商错误正文或用户文案。

## 2. 推荐的监控优先级

第一层应直接定位故障：

1. `operation × errorClass` 次数和占比，并同时显示样本数。
2. 首次成功率、重试挽回率、fallback 率、每个最终成功任务的平均 attempt 数。
3. 最终任务成功率：用户的一次生成最终是否拿到结果，而不是某次底层调用是否报错。
4. bad case 详情时间线：按 attempt 展示时间、operation、provider/model、错误类、耗时和 Token；当前低分任务详情已经具备这些安全字段。

第二层关注性能与成本：

- 按 operation/provider/model 的 P50/P95 耗时；当前只有平均/P95，建议补 P50。
- 每个最终成功任务的 Token、人民币成本、缓存命中率。
- 每 100 个成功任务成本，而不是只看总 Token。
- `usage_source=unavailable` 占比；否则成本看起来会被低估。

第三层关注产品质量：

- 港味总分 `<50` 比例、分数分布和趋势。
- 用户重新生成率、复制/采用率、编辑幅度、审核退回率。
- 固定人工标注集的离线回归。模型自评分只能作筛查，不能替代人工质量基准。

DeepSeek 官方错误码本身也值得单独拆开：400 是请求格式、401 是认证、402 是余额不足、422 是参数、429 是速率、500 是供应商内部错误、503 是过载。当前 `provider_error` 会把其中若干项合并；若要精确定位，后续应以 forward migration 扩展错误类别，而不是修改已应用的 D4 Migration。[DeepSeek 错误码](https://api-docs.deepseek.com/zh-cn/quick_start/error_codes/)

## 3. Token 能否换算成人民币

可以做“版本化估算”，公式是：

```text
费用（人民币）=
  缓存命中输入 Token / 1,000,000 × 命中单价
+ 缓存未命中输入 Token / 1,000,000 × 未命中单价
+ 输出 Token / 1,000,000 × 输出单价
```

DeepSeek 明确说明实际 Token 以 API 返回的 `usage` 为准；当前日志已经保存 prompt、completion、cache hit、cache miss 和 total Token，因此具备估算基础。[Token 用量计算](https://api-docs.deepseek.com/zh-cn/quick_start/token_usage)

截至 2026-07-22，官方页面列出的每百万 Token 人民币单价为：

| 模型 | 缓存命中输入 | 缓存未命中输入 | 输出 |
| --- | ---: | ---: | ---: |
| `deepseek-v4-flash` | ¥0.02 | ¥1 | ¥2 |
| `deepseek-v4-pro` | ¥0.025 | ¥3 | ¥6 |

官方同时声明价格可能变化，因此只用当前价格回算历史账单会失真。[DeepSeek 模型与价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)

按当前价格对 2026-07-22 staging 已存的 DeepSeek 快照估算：缓存命中 19,968、未命中 14,156、输出 5,637 Token，对应约 **¥0.0258**。另有 2 次自托管 `cantonese-4b` 调用没有 usage，不能从这张表估算成本。这个数字只是当前 13 次 DeepSeek attempt 的技术估算，不是账户账单，也不代表累计充值扣款。

推荐做法：日志旁保存 `price_version` 或本次适用的三项单价，后台显示“估算成本”；官方账单/余额变化作为财务事实源。若缺少 usage，就显示“无法估算”，不要按 0 元处理。

## 4. DAU/WAU/MAU 为 0 是否正常

Migration 刚应用且 `app_activity_daily` 为空时，0 是正常的。但代码复核发现活动服务没有生产调用点，所以此前即使有登录用户也不会增长，这不是长期正常状态。

现已修复为：登录用户的云同步首次成功后，客户端异步请求 `POST /api/me/activity`；数据库按香港日期 upsert，同一用户同一香港日只计一次。修复上线并有真实登录访问后：

- DAU：香港当天至少一次成功活动上报的去重用户数。
- WAU：含当天滚动 7 个香港自然日的去重用户数。
- MAU：含当天滚动 30 个香港自然日的去重用户数。

如果本地页面仍显示 0，先确认使用的 API/客户端都指向已应用 D4 的 staging、登录后 bootstrap 成功、`POST /api/me/activity` 返回 204；真实环境尚未部署本次客户端代码时，线上继续为 0 仍属预期。

## 5. 参考文章边界

用户提供的微信公众号链接受到平台访问限制，直接打开和按文章 ID 检索均未取得正文，因此本文没有声称引用或复述该文内容。建议如需逐条对照，将文章正文或截图另行提供。
