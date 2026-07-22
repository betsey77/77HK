# Loop Log

## 2026-07-22 - V2.1 final UI regressions

- Goal: close the reported workbench blank-area and regenerate-all-red release blockers.
- Result: fixed workbench shell to the viewport and reset manual diff baseline on every successful generation.
- Diagnosis: the first browser closure was a false blocker from an outdated E2E `GenerateResponse` fixture missing `thermometer.dimensions`; the fixture now satisfies the public type contract.
- Verify: focused browser 1/1; Playwright 14/14 twice; Client 487/487; Server 809/809; typecheck/build; prod/full audit 0.
- Evidence: `docs/evidence/2026-07-22/slice-v2-release-ui-regressions-release/verification.md`.
- Boundary: no commit, push, deploy, production migration, reset, clean or worktree.

## 2026-07-19 - 1.1.4.5 Slice D6b local admin metrics UI

- Goal: complete the remaining D6 super-admin model metrics, bad cases, provider balance and minimal AdminPage visualization.
- Result: added three `requireSuperAdmin` endpoints, attempt-level model aggregation, metadata-only `<50` bad cases, schema-validated 10-minute DeepSeek balance cache, authenticated client adapter and independent responsive AdminMetricsPanel.
- Grok: bounded read-only review completed in 143.7s; no Grok file edits. Existing AdminPage design system was reused; no external Stitch project was created.
- Verify: focused Server 18/18 and Client 5/5; affected Server 100/100 and Client 70/70; full Server 696/696 and Client 443/443; typecheck/build pass; both audits 0; localhost-only Playwright 12/12 with 20 screenshots; Web/API 200.
- Boundary: D1/D4 migrations unapplied; browser evidence uses localhost-only fixtures; no real provider/database call, migration, deployment, commit, push, reset, clean or worktree action.
- Next: stop before D7 and request explicit authorization for database dry-run/application.

## 2026-07-19 - 1.1.4.5 Slice D6a local overview metrics + scrollbar

- Goal: deliver one bounded D6 sub-slice and remove the visually intrusive workbench scrollbar.
- Result: added review-group/global overview aggregation with fail-closed scope and HK date windows; added workbench-only dark/light/forced-colors scrollbar styling.
- Grok: bounded read-only review completed; no Grok file edits.
- Verify: focused Server 12/12 and Client 1/1; affected Server 73/73 and Client 19/19; full Server 681/681 and Client 438/438; typecheck/build pass; localhost-only Playwright 11/11; Web/API 200.
- Boundary: D1/D4 migrations unapplied, so no live database metric visualization; no migration, deployment, commit, push, reset, clean or worktree action.
- Next: D6b super-admin model health, bad-cases, provider-balance and minimal metrics UI.

## 2026-07-19 - signup confirmation + D3 visual polish

- Phase: reproduce route unmount → red/green regression → visual polish → browser double-run
- Root cause: `PublicAuthRoute` rendered the initial Auth loader for every `isLoading`, so `AUTH_START` during signup unmounted `SignupPage`; the remounted form was blank and the old async handler could not open its dialog
- Fix: remember completion of initial Auth restoration and keep the public page mounted during later auth actions
- Visual: wider rounded surface, quieter nested sections, connected 7-day progress, stronger reward state and primary completion action; dark/light and 390px retained
- Verification: focused 24/24; full Client 46 files / 437 tests; production build; Playwright 11/11 × 2 and 18 screenshots
- Grok: two bounded visual-review attempts timed out during local legacy skill metadata scanning before model inference; no file edits; stopped without a third attempt
- Boundary: local fixture Auth/API only; no Migration, remote write, deployment, install, commit, push, reset, clean or worktree
- Evidence: `docs/evidence/2026-07-19/slice-d3-checkin-ui/verification.md`

## 2026-07-19 - 1.1.4.5 Slice D3 local check-in UI

- Phase: contract red → API/dialog implementation → focused/affected/full/build → isolated browser double-run
- Goal: expose D2 check-in/reward state after cloud hydration without letting the browser forge dates, streaks or membership state
- Red: two new suites failed at import because the API service and dialog did not exist
- Green: focused 14/14; affected 27/27; full Client 46 files / 436 tests; production build passed
- Browser: fail-closed harness SelfTest passed; Playwright 10/10 × 2 on Node 22 and port 5184; desktop + 390px check-in screenshots inspected; no remote requests or runner leaks
- Grok: one bounded headless read-only review informed API validation, account/date dismissal, claim merge, accessibility and mock isolation
- Goal state: achieved locally; D1 live database/RPC/RLS behavior remains unproven until separately authorized D7
- Boundary: no Migration execution, staging write, deployment, install, commit, push, reset, clean or worktree
- Evidence: `docs/evidence/2026-07-19/slice-d3-checkin-ui/verification.md`

## 2026-07-19 - 1.1.4.5 Slice D1 local Migration draft

- Phase: TDD red → SQL draft → focused/impacted/full verify
- Goal: define safe Hong Kong daily check-ins and a one-time 30-day Pro reward without applying a database change
- Red: focused contract 6/6 failed because the canonical Migration did not exist
- Green: focused 6/6; all Migration contracts 56/56
- Full verification: Server 41 files / 615 tests; Server typecheck and build passed
- Security: owner SELECT only; service-role invoker RPCs; empty search_path; fixed subscription-before-grant lock order; no usage_ledger/payment/quota mutation
- Grok: design review completed; actual SQL review timed out at 120 seconds with no final answer and was not retried
- Goal state: achieved locally as a draft; database execution/RLS/concurrency remain unproven until authorized D7
- Boundary: no Migration execution/dry-run, staging write, deployment, commit, push, reset, clean or worktree
- Evidence: `docs/evidence/2026-07-19/slice-d1-checkin-rewards/verification.md`

## 2026-07-19 - 1.1.4.5 Slice D D0 specification

- Phase: inspect + read-only Grok review + specification
- Goal: turn the broad Slice D request into bounded D0-D7 implementation slices with explicit product, data, security and verification gates
- Result: detailed plan completed; current subscription/quota coupling and existing global admin stats were identified as implementation hazards
- Grok: two sequential bounded read-only reviews; no business-file edits by Grok
- Goal state: D0 achieved; D1-D3 blocked on two product decisions, D4-D5 may proceed after metrics semantics are confirmed
- Verification: PRD gate and `git diff --check` only; no executable code changed
- Boundary: no Migration, staging write, deployment, commit, push, reset, clean or worktree
- Evidence: `docs/evidence/2026-07-19/slice-d-spec-plan/verification.md`

## 2026-07-15 — Local workbench shell smoke (PASS mock only)

- Phase: isolated authenticated shell smoke (no real Supabase)
- Goal: /app shell loads under fixture auth; block remote network; desktop+mobile
- Goal state: achieved — SelfTest + 2/2 ×2 on Node v22.23.1 :5184
- Root cause fixed: Vite via Chinese-target junction blank-page → start Vite from real client/
- Evidence: docs/evidence/2026-07-15/workbench-shell-local-smoke/
- Codex: .planning/prompts/20260715-221800-codex-review.md
- NOT done: real Auth/RLS/payment, install, commit/push, production Auth code edits
- Stop: hand to Codex independent recheck

## 2026-07-15 — E2E harness hardening (PASS)

- Phase: harden Windows ASCII smoke harness only
- Goal: fail-closed junctions + repo screenshot/evidence writeback + twice E2E
- Goal state: achieved
- Tests: -SelfTest PASS; -Twice 8/8 ×2; screenshots in repo evidence; no CLI leak
- Evidence: docs/evidence/2026-07-15/e2e-harness-hardening/
- Codex: .planning/prompts/20260715-213500-codex-review.md
- NOT done: install, commit/push, Auth/RLS/payment, client/server business edits
- Stop: hand to Codex independent recheck

## 2026-07-15 — Playwright runtime repair (PASS)

- Phase: install Node 22 (authorized) + diagnose hang + fix local runner path
- Goal: two consecutive focused E2E on Node 22 with reporter, pass, clean exit
- Goal state: **achieved** (8/8 ×2 on Node v22.23.1 via C:\work\77hk-e2e)
- Root cause: non-ASCII project root path hangs Playwright test workers (list/launch OK)
- Fix: portable Node 22.23.1; scripts/e2e-public-smoke.ps1 ASCII mirror + junctions; npm test:e2e:smoke:win
- Evidence: docs/evidence/2026-07-15/playwright-runtime-repair/
- Codex review: .planning/prompts/20260715-204700-codex-review.md
- Explicitly NOT done: npm install, playwright install, commit/push, deploy, migration, real auth, full verify
- Stop: hand to Codex independent recheck

## 2026-07-15 — Playwright runtime repair (earlier BLOCKED, superseded)

- Was blocked pending Node 22 install authorization; closed by PASS section above.

## 2026-07-15 — Playwright runner + public smoke (SUPERSEDED / failed independent QA)

- Phase: implement (e2e harness only; no deploy/migration/secret/commit)
- Goal: stable Playwright list/start/exit; public + unauth protection smoke baseline
- Goal state: **voided by Codex independent recheck** (execute hang)
- Root cause claim (partial): Node 26 + ESM hung on playwright.config.ts; smoke used removed data-reveal
- Fix attempted: playwright.config.mjs + webServer reuse; panel-in assertions; public/protected specs
- Tests (local claim): list OK; focused 8/8 — **not accepted after independent hang**
- Deferred: authenticated workbench mock shell
- Evidence (historical only): docs/evidence/2026-07-15/playwright-runner-public-smoke/
- Explicitly NOT done: install, deploy, migration, real auth/payment, git commit/push

## 2026-07-14 — local-vercel-readiness + homepage scroll smoke

- Phase: implement (local config/code only; no deploy/migration/secret/commit)
- Goal: e2e scroll reveal smoke; configurable API origin; CORS allowlist; split alipay return/notify URLs; dual-project Vercel json + docs
- Goal state: achieved (local)
- Exit code: 0
- Tests: E2E smoke 2/2; Client 358/358; Server 526/526; typecheck + build; audit 0 vulns; vercel.json JSON OK; secret scan clean (no real keys)
- Evidence: docs/evidence/2026-07-14/local-vercel-readiness/verification.md
- Explicitly NOT done: cloud deploy CLI, migration, real env values, alipay E2E, git commit/push
- Stop: slice complete

## 2026-07-14 — Phase 0 生产发布基线

- Phase: implement (engineering baseline only; no deploy/migration write/commit)
- Goal: Phase 0 freeze — audit fixes, verify scripts, env contract, migration/Advisor plans, playwright smoke
- Goal state: achieved (local)
- Exit code: 0
- Tests: Client 353/353; Server 509/509; typecheck + build both sides; audit prod+full 0 vulns
- Key changes: package.json scripts/overrides; .env.example; playwright harness; local W2 migration rename to 052140/052414; evidence docs
- Evidence: docs/evidence/2026-07-14/phase0-production-baseline/
- Explicitly NOT done: deploy, production alipay, migration push/repair, git commit/push, DB/Dashboard writes
- Stop: waiting Codex independent acceptance

## 2026-07-14 — 登录视觉 / 收藏布局 / 管理员备注标签 / 左侧折叠页

- Phase: implement (frontend-only; no migration/push/deploy/env)
- Goal: login visual polish; favorites header wrap; admin notes/tags chips; InputPanel 4-group accordion
- Goal state: achieved
- Exit code: 0
- Tests: Client 351/351; Server 509/509; tsc + build both sides
- Key changes: AuthLayout/LoginPage; FavoritesPanel header; AdminPage notes/chips; InputPanel accordion (mount-preserving)
- Evidence: docs/evidence/2026-07-14/login-admin-accordion/
- Explicitly NOT done: migration, RLS, payment, deploy, git commit/push

## 2026-07-14 — 管理员审阅、配置保存与左侧标签 UI 修复

- Phase: implement (frontend-only; no migration/push/deploy/env)
- Goal: admin modal close/copy always visible; Chinese labels; config date save/restore; input emoji labels
- Goal state: achieved
- Exit code: 0
- Tests: Client 330/330; Server admin 56/56; tsc + build both sides
- Key changes: AdminPage dialog layout + adminDisplayLabels; ConfigManager targetDate/calendar; RESTORE/LOAD HK date; input label emoji
- Evidence: docs/evidence/2026-07-14/admin-config-ui-fixes/
- Explicitly NOT done: migration, RLS, accordion, payment, billing routes, deploy, admin write APIs

## 2026-07-14 — W4 管理员收藏审阅与超级管理员案例正文

- Phase: implement (local-only; no migration/push/deploy/env)
- Goal: admin favorite review summary + super_admin case body with fail-closed audit
- Goal state: achieved
- Exit code: 0
- Tests: Server 501/501; Client 325/325; tsc + build both sides
- Key changes: extractFavoriteSettingsFields, requireSuperAdmin, case-library detail BFF, AdminPage 审阅摘要 + 案例审阅 Tab
- Evidence: docs/evidence/2026-07-14/w4-admin-review/
- Explicitly NOT done: migration, RLS, accordion, payment E2E, deploy, case list/bulk export

## 2026-07-14 — W3 正反例 Prompt 注入（三引擎一致）

- Phase: implement (local-only; no migration/push/deploy)
- Goal: selectedCaseLibraryIds → JWT resolve → shared caseLibraryContext on DeepSeek/Cantonese/fallback
- Goal state: achieved
- Exit code: 0
- Tests: Server related 45/45; Client W3+W2+W1+history related pass; tsc + build both sides
- Key changes: caseLibraryContext.ts, generate route resolve+snapshot, diagnoseGenerate dual path, fallback style hints, useGenerate IDs only
- Evidence: docs/evidence/2026-07-14/w3-case-prompt-injection/
- Explicitly NOT done: W4 admin body, accordion/collapsible, migration, RLS change, payment, deploy

## 2026-07-14 — W2 个人正反例案例库（不含 Prompt 注入与折叠页）

- Phase: implement (local-only; Migration SQL written, not pushed)
- Goal: owner-scoped case library CRUD + select IDs in config/history; no W3 injection
- Goal state: achieved
- Exit code: 0
- Tests: Client W2 10/10 (+ related 24); Server W2 22 (+ related 71); tsc + build both sides
- Key changes: migration case_library_entries, caseLibrary BFF, CaseLibraryPanel, selectedCaseLibraryIds wiring
- Evidence: docs/evidence/2026-07-14/w2-case-library/
- Explicitly NOT done: remote migration push, W3 prompt injection, W4 admin body access, accordion

## 2026-07-14 — W1 创作参数闭环（不含折叠页）

- Phase: implement (local-only, no migration/push/deploy)
- Goal: W1 copy type / length / rich tone + config/history/bookmark consistency
- Goal state: achieved
- Exit code: 0
- Tests: Client 308/308; Server w1+reference+calendar+generations 176; tsc + build both sides
- Key changes: w1Settings/w1Constraints, InputPanel incremental controls (no accordion), prompt injection three engines, FavoritesPanel copy type label
- Evidence: docs/evidence/2026-07-14/w1-parameters/
- Explicitly NOT done: W2/W3/W4, CollapsibleSection, migration, RLS, payment, deploy

## 2026-07-12 — Slice H1-R: Feedback security fix + Session restore + History load

- Phase: implement (local-only, no push/deploy/db migration)
- Goal: Fix all issues from independent review (A1-A8, B1-B4, C1-C4) + evidence D
- Goal state: achieved
- Exit code: 0
- Tests: Server 282/282 (+29), Client 164/164 (+5), TS --noEmit clean both sides
- Key changes: SendKey parser (case-insensitive, multi-line fail-closed, quoted), trusted notify update (keep pending on error), DB rate-limit trigger (advisory lock, 20/hr), migration permission hardening, FeedbackCenter a11y (dialog/aria/focus-trap/Escape), user-friendly error messages, sessionStorage snapshot (owner-scoped), history "load to workbench"
- Evidence: docs/evidence/2026-07-12/slice-H1-R/
- Blocker: Migration NOT pushed (requires user authorization)

## 2026-07-12 — Slice C2a Final Fix (7 boundary issues resolved, Round 3)

- Phase: fix (local-only, no push/deploy/secret retrieval)
- Goal: Fix 7 boundary issues per .planning/prompts/20260711-slice-c2a-final-audit-fix.md
- Goal state: achieved — all 7 boundary issues resolved
- Exit code: 0
- Tests: 154 server + 49 client, TS + Build pass
- Key changes: post-lock idempotency re-check, terminal event_type conflict detection, period validity, uncertain 202 guard, deprecated key purge, explicit service_role grant, business defaults removed
- Evidence: docs/evidence/2026-07-11/slice-C2a-fix/

## 2026-07-11 — Slice C2a Blocking Fix (7 issues resolved)

- Phase: fix (local-only, no push/deploy/secret retrieval)
- Goal: Fix all 7 blocking issues from independent acceptance review
- Goal state: achieved — all 7 issues resolved, 143/143 server tests pass
- Exit code: 0
- Tests: 143 server (3 files), TS + Build pass
- RPC functions: reserve_quota, consume_quota, release_quota (atomic, append-only, no auth.uid())
- Key: SUPABASE_SECRET_KEY (modern name only; no legacy key references in source)
- Files changed: migration SQL, quotaService.ts, trustedSupabase.ts, generate.ts, .env.example, quota.test.ts, generations.test.ts, ACCEPTANCE.md, CHANGELOG.md, findings.md, status.md, progress.md, loop_log.md
- Evidence: docs/evidence/2026-07-11/slice-C2a-fix/
- Stop reason: 所有 7 项阻断修复完成；Migration 未推送，SUPABASE_SECRET_KEY 未配置，价格/额度/周期未决定

## 2026-07-11 — Slice C2a: 可信写入与额度账本本地基础 (superseded by C2a Fix above)

- Phase: implement (local-only)
- Goal: 设计并实现服务端可信写入 + 可配置额度账本的 Migration 草案、服务端接口与 TDD
- Goal state: achieved (all C2a local requirements met; later found 7 blocking issues → fixed)
- Exit code: 0
- Files changed: 8; Files created: 4
- Agent Team: 4 roles (Team Lead + Database/Security + Backend/TDD + Review)
- Tests: 127 server (6+101+26) + 49 client, all passing
- Review: 0 critical, 2 medium, 3 low, 2 info (all resolved in fix)
- Evidence: `docs/evidence/2026-07-11/slice-C2a-local/`

## 2026-07-11T19:33 - Slice B Auth Rewrite (Real Supabase Auth)

- Phase: implement
- Goal: Replace localStorage Mock auth with real Supabase Auth (publishable key, JWT, user-scoped client)
- Goal state: achieved (local automation complete; pending real email)
- Exit code: 0
- Files changed: 14
- Tests: 21/21 passed (8 Slice A + 13 Slice B)
- Evidence: `docs/evidence/2026-07-11/slice-B-auth/test-output.txt`

## 2026-07-11T15:36:00 - Slice B Phase 0 (Local Preparation)

- Phase: implement (local-only Phase 0)
- Goal: Complete all Slice B work that does not require Supabase remote connection
- Goal state: achieved (all Phase 0 items complete)
- Exit code: 0
- Stop report: .planning\loop_stop.md

## 2026-07-11T09:43:30 - 官网第二版视觉重构

- Phase: verify
- Goal: 移除装饰Logo和伪工作台预览，并以工作台规范完成精简官网
- Goal state: achieved
- Exit code: 0
- Stop report: .planning\loop_stop.md

## 2026-07-15T16:49 - Phase 0 CI 与 Migration 基线

- Phase: implement + verify
- Goal: 补齐本地 Supabase harness、只读 CI 和 Migration history 复核
- Goal state: achieved locally
- Exit code: 0
- Focused tests: 2/2
- Full verification: Client 400/400; Server 571/571; typecheck/build passed; audits 0 vulnerabilities
- Remote read-only: 15/15 Migration versions aligned
- Boundary: CI 尚未 commit/push；未 staging、db push/repair、部署或真实支付
- Evidence: `docs/evidence/2026-07-15/phase0-ci-migration-baseline/verification.md`

## 2026-07-15T17:05 - Phase 0 GitHub CI 在线复核

- Phase: verify
- Goal: 推送 Phase 0 基线并证明 GitHub Actions 全绿
- Goal state: achieved
- Initial failure: Node 20 缺少 Supabase Realtime 所需原生 WebSocket，Server 570/571
- Fix: CI Node 22；官方 checkout/setup-node 固定 SHA v5
- Final run: `29403089055` success，全部 9 个质量步骤通过
- Boundary: 未 staging、db push/repair、部署或真实支付

## 2026-07-18T22:05 - Product Selling Points Slice B

- Phase: implement + verify (local-only)
- Goal: 产品卖点逐条港化并贯穿 Prompt、配置同步与历史恢复
- Goal state: achieved locally; real signed-in model call pending manual acceptance
- Focused verification: Client 75/75 impacted + 7/7 selling-point tests；Server 154/154 impacted + 7/7 selling-point tests
- Full verification: Client 417/417；Server 604/604；typecheck/build passed；audits 0 vulnerabilities
- Browser evidence: local mock Playwright 8/8 × 2，桌面/390px 手机截图，非 localhost 网络为 0
- Post-review prompt regression: 39/39 related tests + server typecheck passed
- Boundary: no Migration, deployment, commit, push, reset, clean, or worktree
- Evidence: `docs/evidence/2026-07-18/product-selling-points/`、`docs/evidence/2026-07-18/slice-03/`

## 2026-07-18T22:49 - Product Selling Points real-model propagation fix

- Phase: reproduce + fix + verify (local-only)
- Goal: ensure validated selling points reach both real-model Prompt builders
- Initial result: 2/2 new service-boundary tests failed because both services omitted `productSellingPoints`
- Minimal fix: forward `params.productSellingPoints` in DeepSeek and CantoneseLLM service calls
- Focused verification: 9/9 selling-point server tests passed
- Full verification: Client 417/417; Server 606/606; typecheck/build passed; audits 0 vulnerabilities
- Goal state: automated fix achieved; one signed-in user reacceptance remains
- Boundary: no real-model quota call, Migration, deployment, commit, push, reset, clean, or worktree
- Evidence: `docs/evidence/2026-07-18/slice-04/test-output.txt`

## 2026-07-18 - Review notification visible polling Slice C

- Phase: implement + verify (local-only)
- Goal: visible admin/user pages observe review changes within 0-15 seconds without repeatedly downloading full favorite content
- TDD start: missing polling hook, missing summary client API, later-review rescan failure, and server 404 reproduced the intended gaps
- Minimal implementation: shared visibility-aware polling hook; existing admin pending summary; owner-only latest review timestamp; full owner bootstrap only on version change
- Focused verification: Client 59/59; Server sync 58/58
- Full verification: Client 422/422; Server 609/609; typecheck/build passed; audits 0 vulnerabilities
- Browser evidence: isolated Playwright 8/8 x 2, 15 screenshots, localhost-only traffic
- Runtime: Web 200; API health 200; anonymous review-result summary 401
- Goal state: achieved locally
- Boundary: no Migration, deployment, commit, push, reset, clean, or worktree
- Evidence: `docs/evidence/2026-07-18/review-notification-polling/verification.md`, `docs/evidence/2026-07-18/slice-05/test-output.txt`

## 2026-07-19 - 1.1.4.5 Slice D4 telemetry contracts

- Phase: TDD implement + verify (local-only)
- Goal: create privacy-minimal activity/model telemetry schema and writer contracts without instrumenting providers or applying migrations
- Initial red: migration and telemetry service were absent; focused suite failed as expected
- Implementation: private daily activity/model tables, DB-derived HK day RPC, exact runtime allowlist, nullable official usage and 400ms best-effort insert
- Grok review: initial auth failure stopped; user reauthenticated; final bounded read-only review found no blocking defect and one SQL/runtime alignment improvement was applied
- Focused verification: 18/18
- Migration contracts: 61/61
- Full verification: Server 658/658; server typecheck/build passed
- Goal state: achieved locally
- Boundary: D1/D4 migrations unapplied; no staging/database write, cleanup, D5 provider instrumentation, deployment, commit, push, reset, clean or worktree
- Evidence: `docs/evidence/2026-07-19/slice-d4-telemetry-contracts/verification.md`

## 2026-07-19 - 1.1.4.5 Slice D5 model-attempt instrumentation

- Phase: Grok review + TDD implement + verify (local-only)
- Goal: instrument every real DeepSeek/CantoneseLLM attempt with official usage, latency, bounded error class and retry/fallback numbering without changing business results
- Initial red: focused suite had 9 expected failures across missing wrappers, route contexts and cold-start retry behavior
- Grok review: shared attempt observer and explicit context approved; found configured cold-start retries made only one actual call
- Implementation: optional request/job context, official usage normalization, privacy-safe error classes, best-effort writer isolation, per-provider attempts and corrected cold-start loop
- Focused verification: 24/24
- Full verification: Server 669/669; server typecheck/build passed; local Web/API HTTP 200
- Goal state: achieved locally
- Boundary: D1/D4 migrations unapplied; no real provider call, database/staging write, deployment, commit, push, reset, clean or worktree
- Evidence: `docs/evidence/2026-07-19/slice-d5-model-telemetry/verification.md`
