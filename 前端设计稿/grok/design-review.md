# Design Review — 2026-07-13

对照 handoff 与现有运行代码的评审记录。

---

## 1. generation-progress-terminal.html

### 保留点

- 四阶段标签与顺序：诊断原文 → 生成变体 → 质量审核 → 消费者反馈（与 `useGenerate` / `STAGE_LABELS` 一致）
- 状态机：`pending` / `active` / `done` / `failed`
- 文案「预估阶段 · 实际耗时可能因 AI 响应速度而异」
- 双主题：dark emerald / light orange
- 不伪造 SSE、token 流、真实后端 agent 名

### 修改点（相对现 `GenerationProgress.tsx`）

| 项 | 现状 | 提案 |
| --- | --- | --- |
| 视觉 | 仅圆点 + 连线 | 圆点 + 连线 + 状态文案 `aria-live` |
| 终端 | 无 | 下方 Agent Terminal 面板，按阶段推演日志 |
| 日志标签 | — | `[DIAGNOSE]` / `[VARIANT_ENGINE]` / `[QUALITY_GATE]` / `[AUDIENCE_SIM]` |
| 动效 | pulse 圆点 | 活动点 + 光标闪烁；`prefers-reduced-motion` 可关 |
| 布局 | 中栏居中竖排 | 进度上、终端下，紧凑不挤压左右栏 |

### 未决点 / 未实施到运行项目

- 是否在窄中栏折叠终端为「展开日志」？
- 日志最大行数与是否自动滚动到最新（设计稿默认自动滚终端内部，不滚页面）
- 失败时终端是否保留最后 N 行（建议：是，与错误 UI 并存）

---

## 2. quota-insufficient-dialog.html

### 保留点

- 触发条件语义：仅服务器 **HTTP 402**（实现时不得用文案匹配）
- 工作台输入内容不被清空
- 支付成功仍只信 webhook / `trade.query`（本弹窗不授予 Pro）
- 交互模式对齐 `ConfirmDialog`（Escape、焦点、遮罩不关）

### 修改点（相对现状）

| 项 | 现状 | 提案 |
| --- | --- | --- |
| 402 处理 | `api.ts` 普通 Error + 中栏错误字 | 专用弹窗 |
| 标题 | — | 账户配额不足 |
| 次按钮 | — | 暂不充值 → 关弹窗 |
| 主按钮 | — | 充值 Pro → `/app/billing` |

### 未决点 / 未实施

- 弹窗是否复用 `ConfirmDialog` 还是新建 `QuotaUpgradeDialog`（handoff 允许小型局部组件）
- 错误类型：建议 `ApiError { status: 402 }` 而非字符串匹配
- 非 402 仍走原错误路径（设计稿用「模拟 500」演示）

---

## 3. workbench-ui-review.html

### 保留点

- 三栏：左输入 / 中结果 / 右审核
- Header：真实 77 logo、标题、历史/收藏入口
- Free/Pro 额度展示语义（mock）
- 生成主 CTA 品牌色规则
- idle / loading / result / error 四态

### 修改点（提案级，未写进 client）

| 变体 | 内容 |
| --- | --- |
| A 基线紧凑 | 最接近现网密度，仅加强 loading 终端与空态文案层级 |
| B 终端更显 | loading 时中栏终端高度略增，标签色稍强 |
| C 结果优先 | loading 极简进度条 + 可折叠终端，给结果区更多预期空间 |

### 未决点 / 未实施

- 全局 Header 间距微调是否纳入切片 D
- 左栏分区标题是否统一去掉 emoji（handoff 不强制 emoji 重构）
- 右栏审核空态插图是否替换（本设计稿仅文字层级优化）
- **消费者画像去重**、**402 弹窗**逻辑不在本 HTML 内实现完整 React 状态，仅示意入口

---

## 4. homepage-v2.html（2026-07-14 定向修复）

### 保留点

- 页内锚点 `#lab` / `#flow` / `#platforms` / `#pricing` / `#faq` 仍为相对跳转
- 不伪造登录、支付成功或 Supabase 会话
- 静态预览可继续双击打开 / 任意静态端口托管

### 修改点

| 项 | 修复前风险 | 修复后 |
| --- | --- | --- |
| 真实应用 CTA | `href="/app"` 等落在静态服务器（如 5175） | `APP_ORIGIN = 'http://localhost:5173'` + `data-app-path` 绝对地址 |
| 顶栏说明 | 易被当成运行中产品 | 明确标注「静态设计稿 · 不连接登录/支付/Supabase」 |
| 端口变更 | 需改多处 href | **只改** `APP_ORIGIN` 一处 |

### 未决点 / 未实施

- 其他设计稿 HTML（工作台/额度弹窗）若有相对 `/app` 链接，可按同模式复用 `APP_ORIGIN`（本切片仅修 homepage-v2）

---

## 5. 明确未改动的运行范围

以下均**未**在本阶段修改（2026-07-14 路由结算定向修复同样遵守）：

- `server/src/**`、`supabase/**`、支付/额度服务端逻辑、`.env`、密钥
- 端口、Vite、路由架构、`npm run dev` 启动方式
- 额度预留/消费、RLS、依赖安装、部署

---

## 6. 实现前建议确认清单

请确认后我再按切片动手改运行代码：

1. [ ] 进度 + 终端视觉是否按 `generation-progress-terminal.html` 进入切片 A？
2. [ ] 预设画像去重交互：高亮已有项 / Toast「该示例已加入」二选一偏好？
3. [ ] 402 弹窗是否直接复用 `ConfirmDialog` 样式（danger=false）？
4. [ ] workbench 三个变体中，优先落地哪一个（A/B/C）作为全局微调？
5. [ ] 是否暂不改营销页 / 登录页，仅工作台相关？

---

## 6. 创建文件清单

```
前端设计稿/grok/
  README.md
  brand-spec.md
  design-review.md
  generation-progress-terminal.html
  quota-insufficient-dialog.html
  workbench-ui-review.html
  assets/77-logo.png
```
