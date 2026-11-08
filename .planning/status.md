# Project Status

## 2026-07-22 update - V2.1 final UI regressions closed; Git authorization gate

- 用户统一人工验收通过；普通管理员仅同 `review_group` 审核，`super_admin` 保持全组可见。
- 工作台固定为全视口壳层，页面异常变高后不再下滑露出空白；成功再次生成会清空旧 `modifiedVariants`，新文案不再整段标红。
- 聚焦浏览器 1/1、完整 Playwright 14/14 连续两遍、Client 487/487、Server 809/809、双端 typecheck/build、两类 audit 0 vulnerabilities。
- `server/src/index.ts` 删除确认为入口拆分的一部分；Git 发布清单已写好。未 commit、push、部署或执行生产 Migration，下一步等待用户明确授权 `release/v2.1` commit/push。
- 证据：`docs/evidence/2026-07-22/slice-v2-release-ui-regressions-release/verification.md`；清单：`docs/release/2026-07-22-v2.1-git-release-manifest.md`。

## 2026-07-22 update - Slice E8 staging API/DeepSeek closure passed

- staging 真实 owner/admin/super_admin JWT、401/403、E8 表直读拒绝、super_admin 元数据列表与审计详情均通过。
- 真实生成后 hook 对低分完成/失败任务幂等建包；DeepSeek 旧记录升级、复点幂等、安全失败态、指派/状态/Finding/提案/诊断/事件闭环 7/7 通过。
- 修复详情哈希与提案哈希算法不一致造成的合法提案 400，以及 hook 成功后仍打印 timeout 的假告警；Server 809/809、类型检查/构建、相关 Client 22/22 通过。
- 临时业务数据与账号零残留；按保留策略存在的模型遥测已解除 job 关联。真实 staging 浏览器按钮截图仍待统一 UI 验收。
- 未部署、commit、push、执行生产 Migration、reset/clean 或创建 Worktree。证据：`docs/evidence/2026-07-22/slice-e8-staging-acceptance/verification.md`。

## 2026-07-22 update - V2.1 notification priority verified on staging

- 修复审核结果“立即查看”被每日签到遮罩拦截；审核结果优先，处理后签到恢复，且不会写入“今天不再提醒”。
- owner-scoped 粘性状态覆盖同时挂载与签到晚挂载；相关 17/17、Client 486/486、前端 typecheck/build 通过。
- staging 桌面/390px 管理员提醒、待审队列、审核保存、用户通过/需修改通知与收藏定位全部通过；通知可见时签到显式为 0，临时数据已清理。
- 通知 UI staging 阻塞已关闭；DeepSeek Bad Case/Slice E API/数据闭环也已完成，仍待统一浏览器/人工验收、Dirty Worktree 发布清单、CI/Preview 和生产授权。

## 2026-07-22 update - V2.1 release scope locked

- 本轮只收尾 V2.1 部署前门禁；轻量 `review_group` 协作与收藏/提交审核后的组内共享属于本版既有合同。
- RAG、自动反哺/优化、批准生效和自动发布明确延后至 V3，不作为 V2.1 上线阻塞项。
- 仍未执行 commit、push、生产 Migration、API/Web 部署或 Promote；发布前需完成最终浏览器/人工验收、Dirty Worktree 文件清单与 CI/Preview 门禁。
- staging Auth/RLS、通知 UI 与 Slice E8 API/DeepSeek 真实脚本均已通过并清理可识别临时数据。整体仍因统一浏览器/人工验收、发布清单与 CI/Preview 等门禁保持 No-Go。

## 2026-07-22 update - 2.1 Slice E7c DeepSeek review analysis complete locally

- 修复 Bad Case 审阅包“请求 AI 分析”点击无反馈：按钮现在显示运行中、完成、幂等复点和安全失败分类。
- 后端先重建确定性规则证据，再调用 DeepSeek；模型建议绑定已有 criterion ref，并以 review-only `suggestion` 写入 Finding，不直接改动或发布 Prompt、规则、知识或模型策略。
- 旧的 deterministic-only `completed` 记录会通过版本化 `analysis_completed` 事件升级一次；当前 DeepSeek 分析版本复点保持幂等。
- 完善 Bad Case 操作手册与 v2.1 发布准备状态；本地 Web/API 200/ok，Preview 静态配置门禁通过。
- 全量门禁通过：Client 483/483、Server 806/806、双端 typecheck/build、production/full audit 0 vulnerabilities；隔离 Playwright 12/12、24 张截图且无残留进程。
- 仍待真实 staging super_admin 的模型/DB/审计/角色闭环和最终人工验收；未部署、commit、push、生产 Migration、reset/clean 或新建 Worktree。证据：`docs/evidence/2026-07-22/slice-e7c-deepseek-analysis/verification.md`。

## 2026-07-22 update - 2.1 Slice E7b diagnostics alert/collapse complete locally

- `super_admin` 的 Bad Case 诊断面板改为默认折叠；标题保留时间窗、权限标签和确定性异常类别数。
- 未审核 Finding、重复样本、已评估失败、未评估标准或无效时长会触发可关闭提醒；同摘要会话内去重，变化后再提示；普通 admin 不取数、不显示。
- Client 481/481、前端 typecheck/build、隔离 Playwright 12/12 和桌面/390px 截图通过。
- Grok Build 三次启动均未形成可证明隔离的指定候选 worktree，按上限停止且未接受候选改动；本切片由主代理最小实现。
- 未部署、commit、push、reset/clean 或创建新的 Git worktree。证据：`docs/evidence/2026-07-22/slice-e7b-diagnostics-alert/verification.md`。

## 2026-07-22 update - 2.1 Slice E8 staging migration applied

- 经用户授权，`20260722100000_slice_e_bad_case_review_packs.sql` 已单次应用至 staging `wzpaghnxlpfjojvuxplx`，远端迁移版本/名称与仓库一致。
- 四张新表均启用 RLS；`anon/authenticated` 无 SELECT，`service_role` 仅有设计所需权限，审阅事件表保持不可 UPDATE/DELETE。
- 本机 Supabase CLI 连续三次因 DNS/连接失败后按上限停止，随后使用官方 Supabase 连接器完成同一受限操作；连接器初始自动版本已校正为仓库版本，未重复执行 schema SQL。
- E8 仍待真实 `super_admin`/普通 admin/跨 owner、生成成功/失败 hook、审计顺序、写操作、提案哈希拒绝、诊断和零残留 QA 验证；最终桌面/手机人工验收也未完成。
- 未触碰生产数据库，未部署、commit、push、reset/clean 或创建 Worktree。证据：`docs/evidence/2026-07-22/slice-e8-staging-migration/verification.md`。
- Bad Case 操作手册：`docs/admin/2026-07-22-bad-case-review-pack-guide.md`。

## 2026-07-22 update - 2.1 Slice E1-E7 local complete

- 完成 Bad Case 审阅包端到端本地实现：生成时工件快照、样本/Trace/owner/标准/findings、审计、指派/状态/人工处置、待审工件 diff 与诊断面板。
- 详情权限固定为 `super_admin` 且严格 `scope -> audit -> recheck -> body`；待审提案绑定可信数据库快照哈希与白名单 JSON Patch，不能自动发布。
- 工作台已显示 `v2.1`，更新日志入口已加入；生产 2.1 条目必须等真实部署成功后再写。
- 全量验证：Client 478/478、Server 805/805、双端 typecheck/build、diff check 与 production/full audit（0 vulnerabilities）通过。
- 本条为当时的本地完成记录；Migration 后续已按上方 E8 记录应用到 staging。仍未部署、commit、push、reset/clean。
- 证据：`docs/evidence/2026-07-22/slice-e1-e7-local/verification.md`。

## 2026-07-22 update - 1.1.4.5 Slice D7 staging acceptance

- Authorized staging `wzpaghnxlpfjojvuxplx` now has matching D1/D4 migration versions and passed live concurrency, idempotency, RLS, RPC ACL, activity API and telemetry-constraint checks.
- Fixed the missing production caller for `POST /api/me/activity`: the client reports once after successful cloud bootstrap without blocking workbench readiness, and a failed report can retry later.
- Eight concurrent day-7 calls produced exactly one daily row/reward; active Pro pending/claim and cross-owner failure paths passed.
- Temporary users and all synthetic check-in/grant/activity/model rows were verified at zero after cleanup.
- Full verification passed: Client 447/447, Server 703/703, both typechecks and builds.
- No production database, deployment, commit, push, reset, clean or worktree action occurred. Final human product/visual acceptance remains separate before release.
- Evidence: `docs/evidence/2026-07-22/slice-d7-staging-acceptance/verification.md`.
- Model-observability/cost recommendations: `docs/research/2026-07-22-model-observability-and-cost.md`.

Generated: 2026-07-19
Project: D:\work\77港话通社媒文案\77

## 2026-07-19 update - 1.1.4.5 Slice D6c audited bad-case detail

- Low-score cards now open a super-admin-only audited detail dialog and expose the full copyable UUID instead of only its first eight characters.
- The route enforces full UUID input and fail-closed ordering: existence check, mandatory audit write, generation body read, then privacy-allowlisted model-attempt telemetry.
- Prompt/response/request ID/raw error/owner/email are not selected from model logs. An unapplied or unavailable D4 telemetry table degrades only the log section; the audited task body remains visible.
- Added the GitHub-to-Vercel update runbook with dirty-worktree, Migration, CI, two-project Preview/Promote and rollback gates plus a bounded Grok handoff template.
- Verification passed: Server 701/701, Client 445/445, both typechecks/builds, both audits 0, localhost-only Playwright 12/12 twice with 22 screenshots, Web/API HTTP 200.
- Two bounded Grok Build read-only reviews timed out during local skill/session bootstrap and produced no usable finding; neither modified files.
- D1/D4 migrations remain unapplied. No provider/database write, migration, deployment, commit, push, reset, clean or worktree action occurred.
- Evidence: `docs/evidence/2026-07-19/slice-d6c-bad-case-detail/verification.md`.
- Next step remains D7 and requires explicit authorization before linked dry-run or any Migration application.

## 2026-07-19 update - 1.1.4.5 Slice D6b local admin metrics UI

- Added super-admin-only model health, privacy-limited bad-case and DeepSeek official balance endpoints.
- Model metrics aggregate every provider attempt by provider/model, including success/error, average/P95 latency, official Token sums and unavailable-usage counts.
- Bad cases use `scores.generated.total < 50`, return at most 20 metadata-only rows and never return content, raw scores, owner or email.
- Valid provider balance responses are schema-validated and cached for 10 minutes; valid zero/unavailable-account responses remain distinct from transport/configuration failure, which is shown as unavailable.
- Added a separate AdminMetricsPanel: all admins see D6a operational overview; only super admins see model health, balance and bad cases. Desktop and 390px use the existing dark-emerald/light-orange design system.
- Grok Build completed a bounded read-only review and did not modify files. A separate Stitch project was intentionally skipped because the existing AdminPage design system was sufficient for this small embedded panel.
- Verification passed: Server 696/696, Client 443/443, both typechecks/builds, both audits 0, localhost-only Playwright 12/12 with 20 screenshots, Web/API HTTP 200.
- D1/D4 migrations remain unapplied. No real provider/database call, migration, deployment, commit, push, reset, clean or worktree action occurred.
- Evidence: `docs/evidence/2026-07-19/slice-d6b-admin-metrics/verification.md`.
- Next step is D7 and requires explicit authorization before any database dry-run or Migration application.

## 2026-07-19 update - 1.1.4.5 Slice D6a local overview metrics and scrollbar

- Added group-scoped `GET /api/admin/metrics/overview` for DAU/WAU/MAU, membership grants, consumed quota and current remaining quota.
- Ordinary admins are restricted to their current non-empty review group and fail closed before business reads; super admins receive global aggregates. Date windows use Hong Kong dates, default to 30 days and cap at 90 days.
- Replaced the workbench's bright native scrollbar with a scoped transparent track and muted rounded thumb, including light-mode and forced-colors handling.
- Grok Build completed a bounded read-only review and did not modify files.
- Verification passed: Server 681/681, Client 438/438, both typechecks/builds, localhost-only Playwright 11/11 with 18 screenshots, Web/API HTTP 200.
- D1/D4 migrations remain unapplied, so D4/D5/D6 database-backed metrics are not yet visible on localhost. No database execution, deployment, commit, push, reset, clean or worktree action occurred.
- Evidence: `docs/evidence/2026-07-19/slice-d6a-scrollbar-metrics/verification.md`.
- Next bounded slice: D6b super-admin model health/bad-cases/provider-balance API and the minimal metrics UI.

## 2026-07-19 update - 1.1.4.5 Slice D5 local model instrumentation

- Added optional request/job contexts and a shared best-effort attempt observer across every real DeepSeek and CantoneseLLM call boundary.
- Official provider usage is normalized without estimation; errors use bounded classes and never store prompts, responses or raw provider messages.
- Generation retries and fallbacks have explicit per-provider attempt numbers. Fixed the Cantonese cold-start loop so its configured two retries now make three actual calls.
- Grok Build completed a bounded read-only design review and identified the cold-start defect; it did not modify files.
- TDD passed: focused 24/24, full Server 669/669, Server typecheck/build; local Web and API health both return HTTP 200.
- D1/D4 migrations remain unapplied. No real provider call, database/staging write, deployment, commit, push, reset, clean or worktree action occurred.
- Evidence: `docs/evidence/2026-07-19/slice-d5-model-telemetry/verification.md`.
- Next bounded slice: D6 review-group metrics and super-admin model health endpoints/UI, still without database execution.

## 2026-07-19 update - 1.1.4.5 Slice D4 local telemetry contracts

- Added the local-only `20260719120000_slice_d4_activity_model_telemetry.sql` draft for private daily activity and model-attempt logs.
- Hong Kong activity dates are derived inside a service-role-only RPC; authenticated browsers receive no table or function privileges.
- Added a strict runtime telemetry allowlist and 400 ms best-effort writer. Unknown/sensitive keys fail before trusted-client access; database/timeout failures return false and do not block model work.
- Adopted the recommended P1-2 through P1-4 metrics rules. Retention is documented only; no cleanup job runs in D4.
- Grok Build authenticated successfully and completed a bounded read-only final review: no blocking defect; its DB/runtime usage-alignment suggestion was applied.
- TDD passed: focused 18/18, all Migration contracts 61/61, full Server 658/658, Server typecheck/build.
- D1 and D4 migrations remain unapplied. No staging/database write, deployment, commit, push, reset, clean or worktree action was performed.
- Evidence: `docs/evidence/2026-07-19/slice-d4-telemetry-contracts/verification.md`.
- Next bounded slice: D5 DeepSeek/CantoneseLLM attempt, latency, retry/fallback and official usage instrumentation against the D4 writer contract.

## 2026-07-19 update - 1.1.4.5 Slice D3 local check-in UI

- Added the authenticated daily check-in dialog after cloud hydration, with server-owned progress, idempotent check-in, pending reward guidance and explicit reward claiming.
- Same-account/same-Hong-Kong-day dismissal is local-only; the next Hong Kong date reopens the entry and never changes server business state.
- Grok completed the earlier bounded read-only UI/test review. Two later visual-review calls were stopped before inference because the local CLI timed out while scanning mismatched legacy skill metadata; neither changed files.
- Signup no longer unmounts its form while `signUp` is pending, so accepted registrations can display the email confirmation dialog instead of resetting to a blank form.
- TDD passed: check-in focused 14/14, combined UI focused 24/24, affected 27/27, full Client 437/437 and production build.
- Isolated localhost-only Playwright passed 11/11 twice, including signup confirmation, desktop reward earning and 390px pending reward claim; 18 screenshots, zero remote requests and no residual runner process.
- D1 Migration remains unapplied. This proves client contracts against a local API mock, not live database/RLS/RPC execution.
- Evidence: `docs/evidence/2026-07-19/slice-d3-checkin-ui/verification.md`.
- Next bounded step requires confirming P1-2 through P1-4 before D4/D5 telemetry work; D7 database execution remains separately authorized only.

## 2026-07-19 update - 1.1.4.5 Slice D2 local BFF

- Added authenticated `GET/POST /api/me/check-in` and `POST /api/me/membership-grants/:id/claim` with owner-bound trusted reads/RPC calls.
- The shared camelCase status model covers Hong Kong date/streak state, reward state, claimability and subscription expiry; client-supplied user/date fields are ignored.
- Grok's implementation review found POST claimability drift and deterministic errors being mapped to 503; both were fixed with focused regression coverage.
- TDD passed: focused 25/25, affected auth/API 63/63, full Server 640/640, Server TypeScript build and diff check.
- D1 Migration remains unapplied, so no live DB/RPC, staging, deployment, commit, push, reset, clean or worktree action was performed.
- Evidence: `docs/evidence/2026-07-19/slice-d2-checkin-bff/verification.md`.
- Next bounded slice: D3 check-in entry/progress/claim UI using an isolated API mock until database execution is separately authorized.

## 2026-07-19 update - 1.1.4.5 Slice D1 local draft

- User confirmed the recommended rules: one lifetime reward per account; currently valid Pro receives a pending grant and claims it after expiry.
- Added the local-only `20260719090000_slice_d1_checkin_rewards.sql` draft with owner-read RLS, service-role-only invoker RPCs, Hong Kong dates, fixed 30-day periods and subscription-first locking.
- TDD passed: focused 6/6, all Migration contracts 56/56, full Server 615/615, Server typecheck/build.
- Grok completed the design review; its second actual-SQL review timed out without a final answer and was not retried. No unexpected worktree changes were observed.
- D1 does not prove database execution. No dry-run, Migration push, staging write, deployment, commit, push, reset, clean or worktree was performed.
- Evidence: `docs/evidence/2026-07-19/slice-d1-checkin-rewards/verification.md`.
- Next bounded slice: D2 BFF check-in/status/claim API and service tests, still without applying the Migration.

## 2026-07-19 update - 1.1.4.5 Slice D D0 specification

- Completed the detailed Slice D plan covering check-in, reward lifecycle, activity metrics, quota facts, model Token telemetry, DeepSeek balance, admin scope, privacy and D0-D7 execution gates.
- Two bounded Grok Build read-only reviews informed the design; Grok did not modify business code.
- At D0 completion these rules were awaiting confirmation; both were confirmed before D1 as recorded in the newer update above.
- No business code, Migration, staging write, deployment, commit, push, reset, clean or worktree was performed.
- Plan: `docs/plans/2026-07-19-1.1.4.5-slice-d-development-plan.md`.
- Evidence: `docs/evidence/2026-07-19/slice-d-spec-plan/verification.md`.

## Current Phase

**Vercel Hobby internal Preview is deployed; one signed-in real generation remains for manual acceptance (2026-07-16).**

- Registration verification guidance, local-session sign-out, and authenticated/cached
  inspiration routes are implemented locally and pass the full verification suite.
- Local health sees the YouTube key, and the remote Preview key plus API/Web Ready
  deployments are in place. Signed-in hot-trends acceptance remains manual.
- The `user_roles` email usability improvement is deployed as restricted live view
  `private.user_roles_with_email`, avoiding a duplicated email column.
- API/Web Preview deployments for the auth and hot-trends slice are Ready and their
  stable aliases have been reassigned. Runtime HTTP acceptance is pending because
  this workstation currently receives poisoned DNS answers for Vercel deployment hosts.
- Migration `20260716150000` is applied to staging and its post-push Local/Remote
  ledger entries match; 592/592 server tests pass.

- User adopted/changes-requested dialog, dedupe, new-review notification, and immediate favorite focus are covered.
- Admin pending reminder, later/immediate actions, pending filter, and highlighted row are covered.
- Node 22 Playwright harness passed 6/6 twice with 11 desktop/mobile screenshots and localhost-only network enforcement.
- All 19 migrations are applied on isolated staging `wzpaghnxlpfjojvuxplx`.
- Real mailbox confirmation, initial login, password reset, old-password rejection,
  and new-password login passed.
- Owner and review-group RLS, admin authorization, fail-closed API behavior, and
  cleanup passed with temporary staging users and data.
- Real staging browser sessions passed admin pending reminders, admin review save,
  user adopted/changes-requested reminders, and desktop/mobile immediate favorite
  focus.
- The first Preview contract is two Vercel projects using staging Supabase,
  DeepSeek V4 Flash strict mode, and mock payment.
- The API configuration uses official Express zero-config detection in `hnd1`.
  Hobby Fluid Compute currently defaults to and caps at 300 seconds; the app-level
  strict model budget remains 51 seconds.
- Preview environment-variable names, origin/redirect wiring order, stop conditions,
  and a local fail-closed readiness checker are documented.
- Real-model output is mandatory: `REQUIRE_REAL_MODEL=true` rejects model failure
  instead of silently returning rules copy. Self-hosted Cantonese is excluded.
- A minimal DeepSeek V4 Flash non-thinking request returned final content in 556 ms.
- The Web and API Preview deployments are Ready. Vercel Authentication is disabled
  for the Web so internal users can reach Supabase sign-in without a Vercel account.
- All model-backed API routes now require a Supabase bearer JWT. Anonymous model
  requests return 401, while unknown browser origins return 403.
- Online desktop/mobile rendering, login controls, protected-route redirect,
  pricing copy, health, and browser-to-API connectivity passed.
- YouTube Preview invalid-key failures now return structured errors instead of
  misleading empty success responses. The Sensitive Preview key was replaced and
  an authenticated stable API request returned 12 posts with source available.

## Latest slice

- Auth and hot-trends hardening evidence: `docs/evidence/2026-07-16/auth-hot-trends-hardening/`
- Preview deployment evidence: `docs/evidence/2026-07-16/auth-hot-trends-preview-deployment/`
- Private role-email view evidence: `docs/evidence/2026-07-16/private-role-email-view/`
- Manual internal Pro and role lookup: `docs/admin/2026-07-16-manual-pro-and-role-lookup.md`
- Review notification evidence: `docs/evidence/2026-07-16/review-notifications-local-e2e/`
- Staging Auth/RLS and notification evidence: `docs/evidence/2026-07-16/staging-auth-rls/`
- Vercel Preview readiness evidence: `docs/evidence/2026-07-16/vercel-preview-readiness/`
- Real-model Preview gate: `docs/evidence/2026-07-16/vercel-preview-real-model/`
- Deployed Vercel Preview evidence: `docs/evidence/2026-07-16/vercel-preview-deployment/`
- Internal Preview billing and ServerChan evidence: `docs/evidence/2026-07-16/internal-preview-billing/`
- YouTube Preview repair evidence: `docs/evidence/2026-07-16/youtube-preview-repair/`
- Hardened soft-delete Migration `20260716024428` is applied and read-only verified remotely.
- Prior shell mock evidence remains at `docs/evidence/2026-07-15/workbench-shell-local-smoke/`.

## Git baseline

Pushed to `origin/master` through `a86a40f`:

- `38ff83b` `fix(server): prefer service-local environment config`
- `a339bbc` `security(database): restrict platform RLS helper execution`
- `8336121` `test(staging): verify Auth RLS and review notifications`
- `a86a40f` `docs: record staging acceptance baseline`

The Vercel Preview readiness, deployment, and auxiliary-route auth changes remain
local and uncommitted.

## Commands

```powershell
powershell -File .\scripts\e2e-workbench-shell.ps1 -SelfTest
powershell -File .\scripts\e2e-workbench-shell.ps1 -Twice -EvidenceDir docs/evidence/2026-07-16/review-notifications-local-e2e
node .\scripts\verify\preview-readiness.mjs
```

## Boundaries

- Staging only; no production deployment or production data mutation.
- The real-mailbox staging account remains available; temporary administrators and
  acceptance data were removed.
- Supabase CLI link-state files under `supabase/.temp/` remain intentionally dirty
  and were excluded from all commits.
- No production promotion, payment execution, production Supabase migration, or
  production data mutation was performed.
- The API and Web are publicly reachable at the Vercel layer. Protected Web routes
  and model APIs still require a valid Supabase JWT; server CORS and database RLS remain enabled.

## Next

1. Hard-refresh local billing and confirm the intended account identity and quota.
   The QQ administrator is Pro 3/250; the separate Tezign administrator remains Free 0/20.
2. Submit one feedback item from the signed-in Web app to verify the complete
   ServerChan notification path; direct provider delivery is already confirmed.
3. After manual acceptance, audit the Dirty Worktree into functional Git commits
   and push only with explicit confirmation of the final commit set.
4. Keep Alipay sandbox E2E deferred until payment work is resumed.

## 2026-07-18 update - 1.1.4.5 Slice A

- Requirements and staged architecture for the six new requests are recorded in
  `spec/PRD.md`, `spec/SDD.md`, `spec/TEST_PLAN.md`, `spec/CHANGELOG.md`, and
  `.planning/task_plan.md`.
- Signup confirmation, workbench viewport containment, single-persona append, and
  footer `Powered by CANTONESE API` / `v1.1.4.5` are implemented locally.
- Full verification passed: Client 410/410, Server 594/594, both typechecks/builds,
  both dependency audits, and two local Playwright runs of 7/7.
- API Preview deployment `dpl_5yKcJFYvATAmxejR6X3gjMHLZ8ki` is Ready and assigned
  to the stable API alias; `/api/health` returns HTTP 200.
- Web Preview deployment is blocked after three Vercel CLI attempts ended as
  `UNKNOWN`. The stable Web alias intentionally remains on the 2026-07-16 Ready
  deployment, so the new UI is not yet live.
- Evidence: `docs/evidence/2026-07-18/workbench-slice-a-1.1.4.5/`.
- Git remains at `a86a40f` locally and on `origin/master`; 87 dirty/untracked path
  entries mean the current Preview/local state is not reproducible from GitHub.

## 2026-07-18 update - admin review-group isolation

- Local Web/API runtime is running for manual acceptance at `http://localhost:5173/app`
  and `http://localhost:3001/api/health`; PID/log paths are under `.planning/runtime/`.
- The observed QQ administrator is `super_admin`, so its cross-group visibility is
  intentional. A real ordinary-admin leak was found in generation list/detail routes,
  which used trusted reads without review-group owner filtering.
- Ordinary `admin` generation list/detail reads are now restricted to the same
  non-null `profiles.review_group`; cross-group detail returns 404 before audit/body reads.
- Admin UI now displays the current role/scope and the owner group on generation and
  favorite rows.
- Real staging read-only acceptance with `77@tezign.com` (`admin`, `group1`) returned
  only group1 rows and HTTP 404 for an existing group2 generation detail.
- Full verification passed: Client 410/410, Server 597/597, typecheck/build, and both audits.
- Evidence: `docs/evidence/2026-07-18/admin-review-group-scope/verification.md`.
- Handoff: `docs/handoff/2026-07-18-admin-review-group-scope-handoff.md`.
- No migration, deployment, commit, push, reset, clean, or new worktree.

## 2026-07-18 update - product selling points Slice B

- Product selling points now support itemized input, delete, authenticated Cantonese localization, failure retention, and retry; limits are 10 items and 200 source characters each.
- Both generation prompt paths prefer the localized expression and enforce facts/brand red lines above selling points, with selling points above style modifiers.
- Selling points round-trip through `AppSettings`, local saved configs, `saved_configs.config` JSONB, generation `workbenchSettings`, and history restoration; no Migration is required.
- Full verification passed: Client 417/417, Server 604/604, typecheck/build, and both audits.
- Local isolated Playwright passed 8/8 twice with desktop/mobile selling-point screenshots and localhost-only networking.
- Evidence: `docs/evidence/2026-07-18/product-selling-points/verification.md` and `docs/evidence/2026-07-18/slice-03/test-output.txt`.
- The first signed-in generation exposed a real-model service propagation bug: both model services dropped `productSellingPoints` before Prompt construction, so generated copy omitted the saved selling points.
- Both DeepSeek and CantoneseLLM forwarding paths are fixed locally. The new service-boundary regression failed twice before the fix and now passes; full verification is Client 417/417 and Server 606/606 with typecheck/build/audits passing.
- Manual reacceptance passed: the user repeated the signed-in local generation and confirmed the generated copy now reflects the supplied selling points.
- Slice C review notification polling is complete locally: visible pages refresh every 15 seconds, hidden pages pause, focus refreshes immediately, and failures back off at 15/30/60 seconds.
- Administrators reuse the pending summary. Users poll only an owner-scoped latest review timestamp and run the existing full owner bootstrap only when that version changes.
- Full verification passed: Client 422/422, Server 609/609, both typechecks/builds and audits; isolated Playwright passed 8/8 twice.
- Evidence: `docs/evidence/2026-07-18/review-notification-polling/verification.md` and `docs/evidence/2026-07-18/slice-05/test-output.txt`.
- No Migration, deployment, commit, push, reset, clean, or new worktree.

## 2026-07-19 update - Slice D7 staging migration dry-run passed

- Linked target is confirmed as staging `wzpaghnxlpfjojvuxplx`; production was not touched.
- D1/D4 focused migration contracts pass 11/11, and the helper refuses a non-staging linked ref.
- Two initial attempts failed before execution because of the proxy/DNS path. After the shared pooler resolved to public IPv4, the guarded retry passed.
- All 19 existing Local/Remote migration versions match; dry-run would push only D1 `20260719090000` and D4 `20260719120000`.
- No migration was applied and no remote database write occurred. Actual application is paused for explicit approval naming both migrations.
- Evidence: `docs/evidence/2026-07-19/slice-d7-staging-migrations/verification.md`.

## 2026-07-22 update - 2.1 Slice E0 Bad Case 诊断审阅包规格

- 用户要求下一版 bad case 自动带样本、Operational Trace、双 Owner、验收标准，以及可审阅的规则、知识和 Prompt，不再只输出问题和证据。
- 已定义带 evidence refs 的 findings、错误位置分类、人工 disposition、修复提案 diff 和评测候选闭环；自动分析不能自动发布工件修改。
- MVP 保持 `super_admin` only；详情继续要求 scope、强制审计、scope recheck 后才读正文，Trace 明确不包含思维链或原始 provider payload。
- 已拆分 E0-E9。E1 是下一推荐小切片：先做工件 manifest/version/hash 和生成时快照合同。
- 后续并行仅使用 Grok CLI 自身 Agent Teams/Autonomous Agents/worktree/background task；不使用 Codex 子代理，成员不得嵌套派生且使用与 leader 相同的 `permission-mode=auto`。
- 用户已授权并建立本地 `refs/codex/checkpoints/2026-07-22-slice-e-baseline`。它使用独立 Git index，不移动 master、不改变真实暂存区或 Dirty Worktree；后续 Grok worktree 基线阻断已解除。
- 本轮无业务代码、Migration、远端写入、部署、commit、push、reset/clean 或 worktree 创建。
- 计划：`docs/plans/2026-07-22-2.1-bad-case-review-pack-plan.md`。
- 新增发布沟通要求：工作台 `HeaderMenu` 后续增加“更新日志” drawer/dialog；`2.1` 条目只在全部验收且生产部署成功后，按最终 deployment manifest 写入本次所有实际上线内容。
