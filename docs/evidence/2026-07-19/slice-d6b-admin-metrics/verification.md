# Slice D6b 管理指标与模型健康页验证

日期：2026-07-19  
状态：本地实现完成；D1/D4 Migration 仍未应用

## 本次范围

- 新增仅 `super_admin` 可访问的模型健康、低分任务和 DeepSeek 官方余额接口。
- 模型健康按 provider/model 聚合每次真实 attempt 的成功、错误、平均/P95 延迟、官方 Token 与 usage 缺失次数。
- 低分任务严格使用 `scores.generated.total < 50`，最多 20 条，只返回任务 ID、分数、平台、语气、引擎和时间，不返回正文、完整 scores、owner 或邮箱。
- DeepSeek 余额只缓存校验成功的响应 10 分钟；合法 0 余额或 `is_available=false` 保持为有效响应，缺 Key、超时、HTTP 错误或非法响应统一为“暂不可用”。
- AdminPage 新增独立 `AdminMetricsPanel`：普通管理员只看同组运营概览，超级管理员额外查看模型、Token、余额和低分任务；包含 loading、empty、partial error 与移动端横向表格滚动。

## 权限与隐私

- 三条 D6b 路由均位于 `requireAuth` + `requireAdmin` 之后，并额外挂载 `requireSuperAdmin`；普通 admin 返回 403。
- 余额响应与错误均不包含 API Key、Authorization 或 provider 原始错误。
- 未新增成本估算、价格表、全文入口、用户级模型日志或新依赖。

## 自动验证

| 验证项 | 结果 |
| --- | --- |
| D6b 聚焦 Server | 18/18 通过 |
| D6b 聚焦 Client | 5/5 通过 |
| 受影响 Server 回归 | 100/100 通过 |
| 受影响 Client 回归 | 70/70 通过 |
| Server 全量 | 696/696 通过（51 files） |
| Client 全量 | 443/443 通过（49 files） |
| TypeScript | Client / Server 均通过 |
| Production build | Client / Server 均通过 |
| 依赖审计 | production / full 均 0 vulnerabilities |
| localhost-only Playwright | 12/12 通过，20 张截图 |
| 本地服务 | Web 200；API health 200 |
| `git diff --check` | 通过 |

关键截图：

- `screenshots/admin-metrics-super-desktop-1440-local-mock.png`
- `screenshots/admin-metrics-super-mobile-390-local-mock.png`

浏览器 fixture 拦截所有非 localhost 请求；没有调用真实 DeepSeek 或数据库。桌面与 390px 均无页面级横向溢出，宽模型表只在自身容器内滚动。

## Grok Build 与设计取舍

Grok Build 以只读、禁用子代理/网络搜索的模式完成有界复核，未修改文件。采纳了 super-admin 硬门禁、bad-case 响应白名单、nearest-rank P95、余额成功/失败二分、只缓存合法响应和独立 Panel 等建议。

底层 Stitch 工具可用，但当前没有现成设计项目。由于本轮只是在既有 AdminPage 中增加一个小面板，另建外部设计项目会扩大范围，因此沿用现有 React/Tailwind/Lucide、深色 emerald / 浅色 orange、既有圆角和边框体系。

## 边界

- D1/D4 Migration 未应用，真实 localhost 登录页会显示指标加载失败或空态；本轮浏览器视觉证据来自 localhost-only fixture。
- D7 数据库 dry-run、Migration 应用、真实 RLS/并发、真实日志和真实余额验收必须由用户另行明确授权。
- 未执行真实 provider 请求、数据库写入、Migration、staging、部署、安装、commit、push、reset、clean 或新 Worktree。

