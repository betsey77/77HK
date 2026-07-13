# Slice G1 最终验收修复（原地执行，禁止 worktree）

直接在 `D:\work\77港话通社媒文案\77` 当前脏工作树原地修改。禁止创建 worktree/切分支/clean/reset/checkout，禁止 migration/远程写入/角色变更/secret 访问。先读 README、CLAUDE.md 和本轮已有改动。只修以下三项，测试后停止。

## 1. 同步 Admin 客户端真实契约

后端 `adminService.ts` 已改为新类型，但 `client/src/services/api.ts` 与 `client/src/pages/AdminPage.tsx` 仍读取旧的 `email/ownerEmail/contentPreview/sourceLength/planId/actorId/resource/metadata`。

- 将客户端接口逐字段同步后端当前 JSON：用户 displayName/userIdPrefix/status/deletionRequestedAt；生成 ownerDisplayName；反馈 ownerDisplayName/notifyStatus 且绝不含正文预览；订阅 userId/userDisplayName/planName；审计 actor/actorRole/entity/entityId/reason/diff/requestId。
- AdminPage 表头与单元格同步，不再渲染邮箱、原文长度、反馈正文预览等未返回/不允许字段。
- 添加客户端契约/渲染测试，使用真实新字段 fixture，并断言页面不依赖旧字段。

## 2. 日历补丁必须先于 audit 和 consumer feedback

当前补丁在 `Promise.all(audit/consumerFeedback)` 之后，导致最终文案与审核/模拟反馈不一致。

- 把 `ensureCalendarCoverage` 移到主生成/重试/fallback 得出 `generateResult` 后、创建 `fallbackAuditResult` 和启动 audit/consumerFeedback 之前。
- 原地更新 `generateResult.variants` 的五个平台；后续 validation、audit、consumer feedback、persist、HTTP response 必须都使用同一份修正后 variants。
- 删除后面重复的补丁区块和“audit based on pre-patch”限制。
- 添加路由/静态顺序测试，能防止 ensure 再次被移动到 audit 调用之后；保留纯函数测试。

## 3. 管理员正文必须先审计再读取正文

当前 `getAdminGenerationDetail` 在 route 写 audit 前已查询完整正文，顺序错误。

- 拆成：`adminGenerationExists(jobId)` 仅查 id → route 写真实 audit（失败 500，fail closed）→ `getAdminGenerationDetail(jobId)` 才查显式 allowlist 正文。
- 或直接移除 detail endpoint（若 UI 未使用，推荐最小方案）。无论选择哪种，默认 list 保持无正文。
- 测试必须验证调用顺序 `exists -> audit -> detail`，audit 失败时 detail 查询函数不被调用；不要只做源码 contain 断言。

## 验证

依次执行 server/client 的 `tsc --noEmit`、全部测试、build。更新已有 Slice G1 证据与 CHANGELOG/ACCEPTANCE（只追加/纠正，不删旧内容）。汇报精确测试数和改动文件。不要宣称未验证的内容。
