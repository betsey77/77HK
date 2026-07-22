# Slice E0 规格验证

日期：2026-07-22

范围：文档与后续执行编排；无业务代码、Migration、远端写入、部署、commit、push 或 worktree 创建。

## 已核对现状

- D6c bad case 列表为 metadata-only，阈值为 `scores.generated.total < 50`。
- D6c 详情为 `super_admin` only，并按 `存在/范围 -> 强制审计 -> 正文` 读取。
- 详情当前包含任务正文、variants、diagnosis、audit、scores 与脱敏模型 attempts。
- `generation_jobs.brief` 已保存生成请求快照，但当前没有可证明“生成当时版本”的 Prompt/规则/知识 manifest。
- `model_call_logs` 仅保存 allowlist 遥测；不保存 prompt、response、raw error、email、JWT 或 Key。
- 当前工作区存在大量未提交/未跟踪的既有改动；从 HEAD 新建 Grok worktree 会丢失真实基线。

## 规格结论

- 下一版命名为 `2.1 Slice E — Bad Case 诊断审阅包`。
- MVP 仍仅 `super_admin`，不扩大普通管理员访问。
- Trace 是运行轨迹，不是思维链。
- 审阅包同时记录数据 owner 和内部 case owner。
- Prompt/规则/知识必须记录实际版本快照；旧数据缺失明确显示 `legacy_unavailable`。
- 自动分析只生成带证据的 finding/提案，不能自动发布变更。
- Grok 并行仅使用 Grok CLI 自身团队；成员不可嵌套派生，权限与 leader 一致。
- 用户已授权并建立 `refs/codex/checkpoints/2026-07-22-slice-e-baseline`；后续 Grok worktree 必须从该 ref 创建。
- 工作台 `HeaderMenu` 将增加“更新日志” drawer/dialog；`2.1` 只在生产部署成功后按 deployment manifest 回填，不提前宣称上线。

## 文档检查

- `vibe_prd_gate.py D:\work\77港话通社媒文案\77`：PASS，0 blocking issues，0 warnings。
- `git diff --check`（本轮涉及的 tracked 规格/规划文件）：PASS。
- 新增三个 Markdown 文件行尾空白检查：PASS。
- 未运行应用测试或 build：本轮没有业务代码变更，E0 的验证目标是规格一致性。
