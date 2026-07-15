# Grok 前端设计稿（2026-07-13）

> 本目录为**可交互静态设计稿**，用于评审与确认后再增量实现到真实应用。  
> **不修改** `client/src`、`server/src`、`supabase`、`spec` 等运行代码。

## 如何本地打开

在资源管理器中双击 HTML，或用浏览器打开绝对路径：

| 文件 | 用途 |
| --- | --- |
| `generation-progress-terminal.html` | 四阶段生成进度 + Agent Terminal 科技感 |
| `quota-insufficient-dialog.html` | Free 额度不足弹窗（暂不充值 / 充值 Pro） |
| `workbench-ui-review.html` | 三栏工作台统一 UI 提案（idle / loading / result / error） |
| `homepage-v2.html` | **首页改版设计稿（Jasper 风格）** — 已部分迁入 MarketingPage |
| `homepage-v3.html` | **首页 v3** — code-field + 维港融合背景 + 翻页动效；思念案例墙；Plans 含 Team ¥99/月 |
| `homepage-v4.html` | **首页 v4（推荐评审）** — 对齐定价/导航高亮/移动菜单/联系开通弹层/错峰动效；编码底深浅呼吸；统一中文导航 |
| `login-page.html` | **登录页设计稿（仅亮版）** — 分栏登录 + soft flower 背景；白橙配色 |
| `workbench-ui-v2.html` | **工作台 UI v2** — 降密度不删组件；分组折叠 + 粘性生成栏；未写回源码 |

文档：

- `brand-spec.md` — Logo、双主题色、字体/间距规则
- `design-review.md` — 保留点 / 修改点 / 未决点
- `assets/77-logo.png` — 从 `client/public/brand/77-logo.png` 复制的品牌资产

## 设计方向（主方向）

**紧凑 · 专业 · 工具感**

- 桌面优先三栏工作台，信息密度适中
- 深色：石墨/蓝黑表面 + 荧光绿（emerald）强调
- 浅色：白/浅灰表面 + 橙色（orange）强调
- 生成进度：清晰四步 + 克制终端日志（**预估状态**，非 SSE / 非真实模型推理）
- 动效仅服务状态反馈，支持 `prefers-reduced-motion`

`workbench-ui-review.html` 内提供 3 个**受约束局部变体**（同一产品骨架，仅微调密度/终端位置/强调色强度），不是三套互不相关的产品。

## 与真实应用的边界

| 允许（设计稿） | 禁止（本阶段） |
| --- | --- |
| Mock 数据、本地 JS 状态切换 | 调用真实 API / 登录 / 支付 |
| 演示 402 弹窗按钮跳转语义 | 伪造 Pro 开通成功 |
| 展示预估阶段日志 | 伪造真实 agent 内部思考或精确耗时 |
| 相对路径引用本目录 logo | 重画 / CSS 仿制 logo |
| 真实应用 CTA 用绝对地址跳出设计稿 | 把静态预览（如 5175）误当成正式产品 |

### 真实应用入口常量（`homepage-v2.html`）

`homepage-v2.html` 内集中定义：

```js
const APP_ORIGIN = 'http://localhost:5173';
```

- **当前真实验证入口**固定默认指向 `http://localhost:5173`（`npm run dev` 的 Vite 客户端）。
- 带 `data-app-path` 的按钮（进入工作台 `/app`、充值 Pro `/app/billing`、完整定价 `/pricing`）会解析为 `APP_ORIGIN + path` 的绝对地址，**不会**落在静态预览服务器（例如 5175）。
- 页内锚点（`#lab`、`#flow`、`#platforms`、`#pricing`、`#faq`）保持相对跳转。
- **若将来端口变化，只改这一处常量**；不要散落手改多个 `href`。
- 本设计稿**不连接**登录、支付或 Supabase，也不伪造支付成功。

## 源资产路径

- 正式品牌 Logo：`client/public/brand/77-logo.png`（黑底荧光绿 77，用户已确认）
- 本目录副本：`assets/77-logo.png`（仅供离线打开设计稿）
- 设计规范：`docs/design-system.md`
- 交接约束：`docs/handoff/GROK_BUILD_FRONTEND_HANDOFF_2026-07-13.md`

## 后续实现切片（需你明确确认后再做）

按 handoff 顺序，**每次只做一个切片**：

1. **切片 A** — 升级 `GenerationProgress` + 小型终端子组件（不改 `useGenerate` 核心逻辑）
2. **切片 B** — 预设消费者画像去重（`PersonaManager`）
3. **切片 C** — HTTP 402 → 账户配额不足弹窗 → `/app/billing`
4. **切片 D** — 从本设计稿挑选少量已批准的全局 UI 微调

## 验证入口（实现阶段，本阶段不启动）

- 官网：`http://localhost:5173/`
- 工作台：`http://localhost:5173/app`
- API：`http://localhost:3001/api`
- 根目录：`npm run dev`
