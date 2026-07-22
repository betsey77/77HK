# 2.1 Slice E7b — Bad Case 诊断提醒与折叠验证

日期：2026-07-22  
范围：仅前端诊断面板、对应单元测试与隔离浏览器 Mock；不代表真实 staging API/数据人工验收。

## 实现合同

- 仅 `super_admin` 请求和渲染诊断；ordinary admin 保持零请求、零提醒。
- 面板默认折叠，标题保留时间窗、权限标签和“`N` 类指标需关注”。
- 当前 DTO 可证明的五类信号：未审核 Finding、重复样本、已评估失败、未评估标准、无效解决时长。
- 新摘要显示 `role="alert"` 的可关闭非阻塞消息卡，可直接展开面板。
- 去重签名只含时间窗、信号键和聚合数值，保存在 `sessionStorage`；同摘要刷新不重复提示，变化后可再次提示。
- 未新增轮询、API、全局状态、依赖或正文/邮箱/Trace/JWT 等敏感字段。

## 自动化结果

- 聚焦组件测试：9/9 通过。
- Client 全量：55 files，481/481 通过。
- Client TypeScript：通过。
- Client production build：通过（1737 modules）。
- 隔离 Playwright workbench Mock：12/12 通过；23 张截图；无残留 Vite/Playwright 进程。

浏览器第一次运行的 E7b 用例已通过，但旧页脚断言仍期待 `v1.1.4.5`；将其按现有产品版本最小同步为 `v2.1` 后，第二次全套通过。

## 视觉证据

- `screenshots/admin-bad-case-diagnostics-alert-desktop-1440-local-mock.png`：默认折叠、异常徽标、右下角提醒。
- `screenshots/admin-metrics-super-desktop-1440-local-mock.png`：桌面展开后的完整指标层级。
- `screenshots/admin-metrics-super-mobile-390-local-mock.png`：390px 展开布局与无横向溢出。

## Grok Build 边界

- 两次启动在 CLI 参数解析阶段失败；第三次 leader 启动，但指定候选 worktree 未出现在 Grok 或 Git worktree 清单，无法证明隔离。
- 按三次上限立即终止该目标进程；其日志停留在读取/派发前说明，未接受任何候选代码。主工作区修改由 Codex 实施并逐项验证。

## 未执行

- 未连接 production、未部署、未 commit/push/reset/clean，未创建新的 Git worktree。
- 真实 staging Auth/RLS/API/生成 hook/审计/清理仍属于 E8 下一独立切片。
