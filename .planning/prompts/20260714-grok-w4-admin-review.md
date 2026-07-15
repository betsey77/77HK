# W4 — 管理员收藏审阅与超级管理员案例正文（增量实现）

## 任务目标

在既有 `D:\work\77港话通社媒文案\77` 应用中完成 W4：让普通管理员可审阅用户收藏正文；让超级管理员可审阅个人案例库正文。两者均为最小只读能力，正文读取与复制都必须可审计、失败即拒绝。

## 强制边界

- 只能增量修改现有 Client/Server；不新建平行应用、不替换路由、不改端口、不删除现有功能。
- 不读取、打印或修改 `.env`、任何密钥、Supabase/支付宝配置。
- **禁止** Migration、RLS 变更、Supabase 远端写入、支付、部署、角色写入。
- **禁止** 实现左侧折叠页、Accordion、`details`、`CollapsibleSection` 或重排 `InputPanel`。
- 禁止管理员编辑、删除、评分、批量导出任何收藏或案例；禁止普通管理员读取个人案例库正文。
- 保留亮色橙色 / 暗色荧光绿、现有 logo、shadcn 风格、已有收藏参考/节日/案例 Prompt 注入、历史和支付行为。
- 必须使用 `--no-subagents`。先写失败测试，再实现。不要 git reset/checkout/clean/stash/rebase/commit/push/worktree。

## 已有实现，必须保留

- `GET /api/admin/favorites`：管理员列表元数据；`GET /api/admin/favorites/:id`：已经是“存在性检查 → 写 audit → 再读正文”的收藏详情接口。
- `admin_view_favorite_detail` 审计 action 已存在。保持 fail-closed：审计写入失败时绝不返回正文。
- W2 `case_library_entries` 已经有 owner-only RLS；本 W4 只能通过受信任服务端 BFF 做极窄的超级管理员只读入口，不能放宽该 RLS。
- `requireAdmin` 已把角色写入 `req.userRole`（`admin` 或 `super_admin`）。普通管理员能力不能因新接口扩大。
- W3 已完成：个人案例正文可能出现在服务端历史快照中，但本切片不得改变生成/Prompt 注入逻辑。

## W4 具体功能

### A. 管理员收藏审阅（admin + super_admin）

1. 收藏列表与详情都要补齐可得的上下文：品牌、产品、文案类型、平台、评分、用户备注、收藏原因、标签、收藏时间。
2. 这些字段从收藏的现有 `settings` 快照中安全提取；没有字段时统一显示“未填写”。不得猜测或写回数据。
3. 点击“查看”后的弹窗中，**正文上方**放置高辨识度只读“审阅摘要”卡，不能藏在参数详情折叠中；字段包括：品牌、产品、文案类型、平台、评分、用户备注、收藏原因、标签、收藏时间及当前已存在的元数据。
4. 仍保持 `存在性检查 → audit(admin_view_favorite_detail) → 正文读取`；审计失败 500，正文不返回。
5. “复制正文”可保留，但只复制文案正文，不复制用户邮箱或审阅元数据；显示本地成功状态，不作批量操作。

### B. 超级管理员案例正文（super_admin only）

1. 增加最小 API：`GET /api/admin/case-library/:id`，仅 `super_admin` 可调用；普通管理员返回 403，未登录 401。
2. 实现最窄的 `requireSuperAdmin`（可基于已设置的 `req.userRole`），只用于这个新 endpoint，不能影响现有管理员路由。
3. 严格顺序：
   - 先仅查询案例 `id` 确认存在；
   - 再写 `admin_view_case_library_detail` 审计日志，entity=`case_library_entries`；
   - 审计成功后再读取 allowlist 字段：`id, owner_id, case_type, title, body, reason, tags, created_at, updated_at, deleted_at`。
4. 找不到（含软删除）返回 404；审计失败返回 500 且不读取正文；数据库错误只返回通用错误。
5. 返回值只包含用户审阅所需字段：owner display name（不返回 email）、case type/title/body/reason/tags/created/updated。禁止密码、token、secret、用户邮箱、任何额外跨用户数据。
6. 管理后台增加一个“案例审阅”入口，仅在 `super_admin` 可见；支持按 ID 手动输入查询即可，避免新增跨用户案例列表和批量读取能力。详情中显示只读字段和单条“复制正文”；正文上方显示只读摘要，缺失 title 显示“未命名案例”。若当前 UI 无法可靠获得角色，可从现有 admin 权限响应最小扩展返回 role；不要信任客户端自报角色。

## 测试（必须）

Server：
- 收藏详情审计动作发生在正文 select 前；审计失败时正文查询函数不被调用。
- 收藏详情返回/映射品牌、产品、文案类型等 settings 快照字段；缺失统一为“未填写”由客户端展示。
- 无 token → 401；普通用户 → 403；普通管理员调用 case detail → 403；超级管理员 → 200。
- case detail 的顺序为 exists-only → audit → allowlist body read；audit fail → 500 + 不读 body；已删/不存在 → 404。
- 新 case detail 不出现 select(*)、敏感字段或任何写路由。

Client：
- 收藏详情弹窗的正文前有审阅摘要及必填显示字段。
- 无字段时显示“未填写”。
- 案例审阅入口仅 super_admin 可见；普通管理员不可见。
- 复制仅复制正文；无编辑/删除/导出按钮。

执行相关 Vitest、两端 `tsc --noEmit` 与生产构建，并更新 `spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`、`.planning/status.md` 和 `docs/evidence/2026-07-14/w4-admin-review/verification.md`（如已有文档只能增补，不删除前文）。

## 完成汇报格式

只汇报：修改文件、接口/权限矩阵、测试命令与确切结果、未做项、风险/手测步骤。不要声称执行过 Migration 或远端写入。
