# Slice D6c 低分任务详情与部署手册验证

日期：2026-07-19  
状态：本地实现完成；D1/D4 Migration 仍未应用

## 本次范围

- 低分任务卡片改为可点击按钮，使用完整 UUID 请求详情，并在弹窗中展示/复制完整 ID。
- 新增 `GET /api/admin/metrics/bad-cases/:id`：仅 `super_admin` 可访问，要求完整 UUID。
- 读取顺序固定为：元数据存在性检查 → 审计日志成功写入 → 任务正文 → 脱敏模型尝试日志。审计失败时正文和模型日志均不读取。
- 详情展示原始需求、生成文案、诊断、审核、评分、失败信息与模型尝试。
- 模型日志只选择时间、操作、provider/model、成功/失败、错误分类、耗时、attempt 与官方 usage；不选择 prompt、response、request ID、raw error、邮箱或 secret。
- D4 遥测表缺失/不可用时，接口仍返回任务详情，只有日志区显示“暂不可用”。
- 新增 `docs/release/2026-07-19-github-vercel-update-runbook.md`，覆盖 Dirty Worktree 整理、Migration 授权、GitHub CI、两个 Vercel Preview、API/Frontend 晋升顺序、生产 smoke、回滚和 Grok Build 提示词。

## 权限与隐私验证

- 无登录返回 401；普通 admin 返回 403；短 ID `8ac6256c` 返回 400，且不会访问任务表。
- 完整任务 ID 只有在超级管理员权限通过后使用。
- 路由测试使用 invocation order 证明审计写入发生在正文读取之前，正文读取发生在模型日志读取之前。
- 审计写入失败返回 500，并验证正文/日志服务均未调用。
- 模型日志测试注入 `request_id`、`prompt`、`raw_error` 哨兵字段，响应中均不存在。

## 自动验证

| 验证项 | 结果 |
| --- | --- |
| D6c 聚焦 Server | 9/9 通过 |
| D6b/D6c 聚焦 Client | 7/7 通过 |
| Server 全量 | 701/701 通过（52 files） |
| Client 全量 | 445/445 通过（50 files） |
| TypeScript | Client / Server 均通过 |
| Production build | Client / Server 均通过 |
| 依赖审计 | production / full 均 0 vulnerabilities |
| localhost-only Playwright | 12/12 × 2 通过，22 张截图 |
| 本地服务 | Web 200；API health 200 |
| `git diff --check` | 退出码 0；仅既有 LF→CRLF 提示 |

关键截图：

- `screenshots/admin-bad-case-detail-desktop-1440-local-mock.png`
- `screenshots/admin-bad-case-detail-mobile-390-local-mock.png`

桌面弹窗完整显示正文与模型日志；390px 弹窗保持在视口内，宽日志表只在自身容器横向滚动，页面无横向溢出。

## Grok Build

按用户授权进行了两次只读、禁用子代理/网络搜索的有界复核。两次均在启动阶段扫描旧 skills 与大型会话，60 秒内未形成有效审查结论，并分别因超时/max-turns 停止；Grok 未修改文件。按停止规则不再重试，本切片以本地 TDD、全量回归、类型检查、构建与浏览器双跑收口。

## 边界与下一步

- 当前 localhost 的运营/模型指标加载失败仍属预期：D1/D4 Migration 尚未应用。D6c fixture 证明 UI/接口合同，不证明真实数据库、RLS、审计表或模型日志。
- 未执行真实 provider 请求、数据库/staging 写入、Migration、部署、环境变量修改、commit、push、reset、clean 或新 Worktree。
- D7（linked dry-run、staging Migration、真实 RLS/并发/日志/余额验收）仍是下一高风险门禁，必须获得用户单独明确授权。
