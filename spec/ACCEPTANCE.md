# Acceptance Criteria

## 2026-07-15 — E2E harness 安全收口

| 门禁 | 状态 |
| --- | --- |
| Junction 仅在类型+目标匹配本仓库时才可移除 | ✅ fail-closed |
| 普通目录 / 目标错误 junction 拒绝且不删除 | ✅ `-SelfTest` |
| 截图写入仓库本切片 evidence（非仅镜像盘） | ✅ `E2E_SCREENSHOT_DIR` |
| 两次 focused E2E 8/8 + list reporter + 正常退出 | ✅ Node v22.23.1 |
| 无本任务 Playwright CLI 残留 | ✅ |
| 无浏览器自动安装入口 | ✅ 已移除 `-InstallBrowsers` |
| 未改 client/server 业务；未 commit/push/安装 | ✅ |

证据：`docs/evidence/2026-07-15/e2e-harness-hardening/verification.md`

## 2026-07-15 — Playwright 运行时基线返工

| 门禁 | 状态 |
| --- | --- |
| 本机 Node 与 CI 对齐（Node 22.x） | ✅ 便携 **v22.23.1**（用户授权安装）；系统默认可为 26 |
| 安装边界 | ✅ 仅 Node 22 zip；未 npm install / playwright install |
| `playwright test --list` | ✅ 10 tests |
| focused E2E 连续两次有 reporter、通过、正常退出 | ✅ **8/8 ×2** via `C:\work\77hk-e2e` + Node 22（~11s each） |
| 非 ASCII 项目根路径下直接 execute | ⚠️ 仍会挂起 — 用 `npm run test:e2e:smoke:win` |
| `git diff --check` | ✅ |
| `test-results/` gitignore + engines/nvmrc | ✅ |
| `npm run verify` | ⏸ 本切片未要求 |
| commit / push / 部署 / migration / 真实登录 | ⏸ **未做** |

证据：`docs/evidence/2026-07-15/playwright-runtime-repair/verification.md`

## 2026-07-15 — Playwright runner 稳定化 + 公开路由冒烟（上一轮，独立验收未通过）

| 门禁 | 状态 |
| --- | --- |
| `playwright test --list` 快速返回、不无输出挂起 | ⚠️ list 正常；**执行阶段** Codex 复验挂起 |
| 现有首页 smoke 可重复通过并正常退出 | ❌ 独立验收未通过 |
| 前端不可访问时硬失败（不 skip） | 代码侧仍硬失败；本切片未重验通过 |
| `/` `/pricing` `/login` 基本加载与关键元素 | 用例存在；执行基线未过 |
| 未登录 `/app` 进入登录并保留回跳意图 | 用例存在；执行基线未过 |
| 桌面 + 移动视口截图 | 上一轮产物不可当作本轮通过证据 |
| 工作台已登录壳层（完全本地 mock） | ⏸ **延期** |
| `npm run verify` | ⏸ 不因 E2E 失败而宣称整门禁通过 |
| commit / push / 部署 / migration | ⏸ **未做** |

上一轮证据（仅历史参考，**不作当前通过结论**）：`docs/evidence/2026-07-15/playwright-runner-public-smoke/verification.md`

## 2026-07-14 — R1.1 审核保存热修复与正文审阅可达性

| 门禁 | 状态 |
| --- | --- |
| 追加 Migration，不改已推送 R1 | ✅ 本地 `20260714190100` |
| 两处 `audit_log.actor_role` 显式转换为 `public.app_role` | ✅ 静态契约测试 |
| RPC 继续 `SECURITY DEFINER` + 空 `search_path` | ✅ |
| RPC 仅 `service_role` 可执行 | ✅ |
| 正文框可纵向拉伸、内部滚动且有操作提示 | ✅ |
| 主内容区可滚动；关闭与复制操作可达 | ✅ |
| 保存错误使用 `role="alert"` | ✅ |
| 客户端全量测试 | ✅ 365/365 |
| 服务端全量测试 | ✅ 551/551 |
| 双端 TypeScript、生产构建、依赖审计 | ✅ |
| 远端 Migration 推送 | ✅ `qiotocumkbwckiezuptr` 已应用 `20260714190100` |
| 远端 RPC 事务验证 | ✅ `candidate_count=1`、`rpc_ok=true`、`status_ok=true`；验证后回滚 |
| 浏览器管理员保存复验 | ⏳ 请用户刷新管理页后操作一次 |

证据：`docs/evidence/2026-07-14/r1-review-save-hotfix/verification.md`

## 2026-07-14 — R1 审核分组 + 管理员收藏批注

| 门禁 | 状态 |
| --- | --- |
| `profiles.review_group` + CHECK/索引 | ✅ 本地 + 远端 `20260714190000` |
| `favorite_admin_reviews` + RLS + service-role-only RPC | ✅ 远端元数据与权限已复核 |
| 普通 admin 同组收藏 scope（列表/count/详情/复制/审核） | ✅ 服务端显式校验 |
| 未分组 admin 空列表；super_admin 跨组 | ✅ |
| 越组 404 且不写审计、不读正文 | ✅ |
| PUT review：adopted / changes_requested / clear；校验 note | ✅ 原子 RPC |
| bootstrap 返回只读 adminReview；用户不可写 | ✅ |
| 收藏卡折叠态高亮审核；无 review 不显示空框 | ✅ |
| 管理后台列表 chip + 详情编辑区 | ✅ |
| 官网 TEL 提示 + `tel:18595680518` | ✅ |
| 操作文档 `docs/admin/review-group-management.md` | ✅ |
| 远端 migration | ✅ 已推送至 `qiotocumkbwckiezuptr` |
| Dashboard 分组/角色写入 / 部署 | ⏸ **未做** |

证据：`docs/evidence/2026-07-14/review-groups-admin-notes/verification.md`

## 2026-07-14 — R2/R2.1 句子级批注 + 收藏正文编辑（本地验收）

| 验收项 | 结果 |
|---|---|
| 用户仅能通过 owner-scoped API 编辑自己的收藏正文 | ✅ 路由/服务契约测试 |
| 保存失败不覆盖当前正文且保留编辑草稿 | ✅ FavoritesPanel 行为测试 |
| 正文改变后旧整篇审核与句子批注由数据库 trigger 清除 | ✅ Migration 契约测试 |
| 管理员列表对修改后的无审核正文显示“修改后待审核” | ✅ 类型/组件契约 + 构建 |
| 管理员可选中文字、填写建议并随审核原子保存 | ✅ AdminPage 文本选择行为测试 + RPC 契约 |
| 用户可见红色锚点高亮；失效锚点不误标其他正文 | ✅ 文本分段单元测试 |
| 普通管理员同组边界、超级管理员跨组边界保持 R1 规则 | ✅ RPC 复用 R1 scope + R1 回归测试 |
| Client 全量测试 | ✅ 30 files / 370 tests |
| Server 全量测试 | ✅ 27 files / 554 tests |
| 双端 TypeScript 与生产构建 | ✅ |
| 远端数据库 | ✅ `20260714190200` 已推送；列、trigger、RPC ACL 已复核 |
| 浏览器人工链路：用户编辑 → 管理员待审 → 句子批注 → 用户刷新高亮 | ✅ 2026-07-15 用户实操截图 |
| 人工证据 | ✅ `docs/evidence/2026-07-14/r2-inline-review-and-favorite-edit/manual-user-review-highlight-2026-07-15.png` |

## 2026-07-14 — 本地部署适配（官网滚动 + 双项目 Vercel readiness）

| 门禁 | 状态 |
| --- | --- |
| E2E smoke：公开首页 + 真实分段滚动 reveal | ✅ 见 evidence（不硬编码 29） |
| `apiUrl` / `VITE_API_BASE_URL`；默认相对 `/api` 不回归 | ✅ |
| 运行时 fetch 统一走 helper | ✅ |
| CORS `ALLOWED_ORIGINS` 严格 exact；无 Origin 允许；拒未授权 | ✅ |
| 支付 return/notify 分域 + 兼容 + sandbox fail closed | ✅ 同步回跳仍不授 Pro |
| `client/vercel.json` + `server/vercel.json`（hnd1 / 300s）合法 JSON | ✅ 未部署 |
| 托管决策与 Dashboard 空变量清单文档 | ✅ |
| `.env.example` 空值契约更新 | ✅ |
| `npm run verify` + secret pattern 扫描 | ✅ 见 evidence |
| 真实 Vercel/Netlify/Render 部署 | ⏸ **未做** |
| 真实支付宝 sandbox E2E / migration / git push | ⏸ **未做** |

证据：`docs/evidence/2026-07-14/local-vercel-readiness/verification.md`
决策：`docs/release/2026-07-14-hosting-platform-decision.md`

## 2026-07-14 — Phase 0 生产发布基线

| 门禁 | 状态 |
| --- | --- |
| Client 353+/353、Server 509+/509 | ✅ 353/353、509/509 |
| 双端 typecheck + production build | ✅ `npm run typecheck` / `npm run build` |
| `build` 内不执行 `npm ci` | ✅ 安装与构建分离 |
| production audit 无未处置 high/critical | ✅ 0 vulnerabilities（form-data 4.0.6） |
| 完整 audit 无未处置 high/critical | ✅ 0 vulnerabilities（concurrently/shell-quote 已修） |
| dirty worktree 可提交分组与回滚点 | ✅ 方案文档；**未 commit/push** |
| migration 漂移一一映射与修复步骤 | ✅ 映射文档；本地文件名已对齐远端 version |
| 本地 migration 文件名对齐 | ✅ `20260714052140` / `20260714052414`（仅 rename） |
| 远端 history repair / db push | ⏸ **未做**；需用户授权 |
| `.env.example` 变量名契约且空值 | ✅ 未读写真实密钥 |
| Playwright 依赖 + 最小 smoke harness | ✅ 配置与 smoke；**未扩完整业务 E2E** |
| Supabase Advisor 修复提案 | ✅ 提案 only；**未写 DB/Dashboard** |
| 真实支付宝 sandbox E2E / 生产支付 | ❌ 仍未做（Phase 3） |
| staging / CI / Auth 邮件 / 监控回滚 | ❌ Phase 1+ |

判定：**Phase 0 本地工程基线通过；仍不可直接生产上线。**
证据：`docs/evidence/2026-07-14/phase0-production-baseline/`
计划：`docs/release/2026-07-14-production-launch-plan-v2.md`

## 2026-07-14 — 生产上线门禁复验

| 门禁 | 状态 |
| --- | --- |
| Client 353/353、Server 509/509、双端 production build | ✅ 通过 |
| 真实支付宝 sandbox E2E | ❌ 未完成 |
| Playwright/Cypress 浏览器 E2E | ⚠️ Phase 0 仅 smoke harness；完整 E2E 未建 |
| 本地/远端 migration history 一致 | 🟡 本地 version 已对齐；list 复核与 repair 待授权 |
| production dependency audit 无 high/critical | ✅ Phase 0 已修复 |
| 完整 dependency audit 无 high/critical | ✅ Phase 0 已修复 |
| Supabase Security Advisor 无未处置 WARN | ❌ 提案已写，未落地 Dashboard/Migration |
| staging、CI/CD、正式 Auth 邮件、监控/备份/回滚 | ❌ 未闭环 |

判定：**当前为本地可验收 MVP，不可直接生产上线。** 证据见 `docs/evidence/2026-07-14/production-readiness-audit/verification.md` 与 Phase 0 证据目录；执行计划见 `docs/release/2026-07-14-production-launch-plan-v2.md`。

## 2026-07-14 — 管理员类型彩色 chip 与登录标题渐变

| 验收项 | 结果 |
|---|---|
| 管理员「用户收藏」列表文案类型为明显非灰色彩色 chip | ✅ Badge `sky` + `admin-copy-type-chip` |
| 类型仍走 `formatAdminCopyType` 中文映射，不展示英文枚举 | ✅ spoken→口播稿 等 |
| 平台 chip 保持现有 green/emerald 语义 | ✅ `variant="green"` + `admin-platform-chip` |
| 类型与平台色系可区分（非仅靠位置） | ✅ sky vs emerald |
| AuthLayout 左栏标题「77港话通社媒文案器」官网渐变规则 | ✅ emerald→lime / light orange→amber + bg-clip-text |
| 标题文案、字号（text-2xl / md:text-3xl）不变 | ✅ |
| 不改 AuthContext / Supabase / 路由 / 支付 / 服务端 / Migration / RLS / `.env` | ✅ 未做 |
| 聚焦测试 | ✅ slice-login-admin-accordion 11/11 |
| Client tsc + production build | ✅ 通过 |
| 证据 | `docs/evidence/2026-07-14/admin-type-login-gradient/` |

## 2026-07-14 — 管理员审阅、配置保存与左侧标签 UI 修复

| 验收项 | 结果 |
|---|---|
| 收藏详情弹窗 max-height + flex 列布局；顶栏关闭固定；正文独立滚动；底栏复制固定 | ✅ favorite-review-dialog / body / footer |
| 审阅摘要在正文前，紧凑两列网格；缺失「未填写」 | ✅ favorite-review-summary |
| copyType/platform 仅展示层中文映射（spoken→口播稿，all→全部平台 等） | ✅ adminDisplayLabels + 列表/详情 |
| platform 缺失可回退映射 variantKey；不显示原始英文枚举 | ✅ formatAdminPlatform |
| ConfigManager 保存 targetDate + selectedCalendarEventIds（数组拷贝） | ✅ saveConfig |
| hasUnsavedChanges 纳入日期与日历 | ✅ ConfigManager 比较 |
| LOAD_CONFIG 恢复日期/日历；旧配置缺字段 → 当日 HK 日期 + 空日历 | ✅ AppContext LOAD_CONFIG |
| RESTORE_DEFAULT 以调用时香港自然日重置 targetDate，清空日历；保留五项默认 | ✅ getHongKongDateString |
| 左侧标签 emoji：📝 文案类型 / 📱 目标平台 / 🎭 主语气 / 🗓️ 发布日期 | ✅ 四组件 label |
| 无 Accordion/details/折叠页；无 admin 写接口；无 billing 改动 | ✅ 未做 |
| Client tests | ✅ 330/330（+5 本切片） |
| Server admin 回归 | ✅ 56/56；tsc + build 通过 |
| Client tsc + production build | ✅ 通过 |

## 2026-07-14 — W4 管理员收藏审阅与超级管理员案例正文

| 验收项 | 结果 |
|---|---|
| 收藏列表/详情补齐 settings 快照：品牌、产品、文案类型、平台 | ✅ extractFavoriteSettingsFields + list/detail select settings |
| 缺失字段客户端统一「未填写」，不猜测、不写回 | ✅ displayField |
| 详情弹窗正文上方高辨识度只读审阅摘要（评分/备注/原因/标签/时间等） | ✅ favorite-review-summary 在 body 前 |
| 收藏详情：存在性检查 → audit `admin_view_favorite_detail` → 正文；审计失败 500 不读正文 | ✅ 路由顺序 + fail-closed 测试 |
| 复制仅复制文案正文，无编辑/删除/导出 | ✅ clipboard + UI 断言 |
| `GET /api/admin/case-library/:id` 仅 super_admin；普通管理员 403；未登录 401 | ✅ w4-admin-review supertest |
| `requireSuperAdmin` 仅挂在新 endpoint，不扩大普通管理员能力 | ✅ middleware + route |
| 案例：exists → audit `admin_view_case_library_detail` → allowlist 读 body；软删/不存在 404 | ✅ 路由 + service 静态/行为测试 |
| 案例响应无 email/password/token；有 owner display name | ✅ DTO 断言 |
| 「案例审阅」入口仅 super_admin 可见（服务端 role） | ✅ stats.role + UI |
| 无跨用户案例列表/批量读/写；无 Migration/RLS/支付/部署 | ✅ 未做 |
| Server tests | ✅ 全量 501/501（含 W4 定向） |
| Client tests | ✅ 全量 325/325（含 W4 定向） |
| Client/Server tsc + production build | ✅ 通过 |

## 2026-07-14 — W3 正反例 Prompt 注入（三引擎一致）

| 验收项 | 结果 |
|---|---|
| 客户端只发送 `selectedCaseLibraryIds`（≤3 UUID），不发送 case body/reason | ✅ useGenerate + client vitest |
| 服务端用用户 JWT `createUserClient` 按 owner + 未软删除解析；不用 service role | ✅ resolveCaseLibraryContext + generate route |
| 异主/不存在/已删除 ID 静默忽略；可见提示仅「部分已选案例不可用」 | ✅ partialUnavailable + CASE_LIBRARY_PARTIAL_NOTICE |
| 仅当前请求使用解析案例；`brief.workbenchSettings.resolvedCaseLibrarySnapshots` 保留最小快照 | ✅ generate route brief  enrichment |
| 历史载入只恢复 ID；快照 body 不进入 settings | ✅ workbenchSnapshot + client vitest |
| 正例：技法抽取 + 禁止逐句复制/专有事实；反例：reason→负向约束 + 禁止复述 | ✅ buildCaseLibraryPromptSection |
| 案例库优先，总风格上下文 ≤5（库≤3 + 参考收藏） | ✅ budgetReferenceCases |
| DeepSeek / CantoneseLLM / rules fallback 同一结构化约束；未选无回归 | ✅ w3-case-prompt-injection |
| fallback 不回显案例正文 | ✅ fallback + applyCaseLibraryStyle |
| 参考收藏案例、节日注入对五平台无回归 | ✅ reference-cases + calendar section |
| W1 参数 / W2 CRUD 边界保留 | ✅ w1 + case-library + w2-no-prompt 相关通过 |
| 无 Migration / RLS / 支付 / 部署 / 折叠页 / W4 | ✅ 未做 |
| Client W3 + W2/W1/history 相关 | ✅ slice-w3 + slice-w2 + slice-w1 + history |
| Server W3 + 相关 | ✅ w3 18 + w2/w1/reference/case-library 合计 45 |
| Client/Server tsc + production build | ✅ 通过 |

## 2026-07-14 — W2 个人正反例案例库（不含 Prompt 注入与折叠页）

| 验收项 | 结果 |
|---|---|
| `case_library_entries` Migration + owner RLS + soft delete | ✅ 已推送 `20260714000000_w2_case_library.sql`；远端表、RLS、策略与权限复核通过 |
| 字段校验：title 选填≤120；body 20–5000；reason 1–500；tags≤8×(1–30) | ✅ service validate + client form |
| 未命名显示名仅客户端推导，不写回 DB | ✅ `deriveCaseDisplayName` |
| CRUD 需登录；owner 隔离；非法/异主 ID → 404；软删除 | ✅ API vitest |
| 列表支持 query / caseType，按 updated_at desc，排除软删 | ✅ listCaseLibrary |
| 左侧增量入口（ReferenceCaseSelector 与 ConfigManager 之间），无折叠页 | ✅ CaseLibraryPanel + InputPanel |
| 最多选 3 条 ID；删除用 ConfirmDialog | ✅ UI 测试 |
| `selectedCaseLibraryIds` 进 AppSettings / 配置 / 云同步 / 历史载入 | ✅ normalize + ConfigManager + cloudSync + workbenchSnapshot |
| 已删除案例载入时忽略并非阻塞提示 | ✅ reconcile + notice |
| W2 边界：客户端不伪造 body；W3 起仅服务端 JWT 解析后注入 | ✅ w2-no-prompt-injection 更新 + W3 专测 |
| W2 `search_path` 安全硬化 | ✅ 已推送 `20260714000001_harden_w2_case_library_function.sql`；远端确认 `search_path=pg_catalog` |
| W4 管理员正文 | ✅ 未做 |
| Client W2 + 相关 | ✅ 10/10 W2；W1/config/history 24 |
| Server W2 + 相关 | ✅ 22 W2；合计相关 71 |
| Client/Server tsc + production build | ✅ 通过 |

## 2026-07-14 — W1 创作参数闭环（不含折叠页）

| 验收项 | 结果 |
|---|---|
| copyType 默认 social；支持 spoken/poster/advertorial/poetry/custom | ✅ 类型 + DEFAULT_SETTINGS + normalize |
| custom 要求 2–20 字补充说明；其他类型不要求 | ✅ 客户端 canGenerate + 服务端 resolveW1Fields |
| 长度开关默认关闭；开启后注入五档软目标，不做硬截断 | ✅ Prompt 断言 + 规则引擎软限长 |
| 主语气 12 项 + 修饰语气最多 2 项；旧 tone 映射为主语气 | ✅ normalizeW1Fields / resolveW1Fields |
| 保存配置、云同步 payload、历史载入、收藏快照保留 W1 字段 | ✅ ConfigManager + history snapshot + bookmark settings |
| 收藏卡片：品牌/产品 → 文案类型 → 平台标签 | ✅ FavoritesPanel 增量展示 |
| DeepSeek / CantoneseLLM / rules fallback 共享 W1 约束 | ✅ 共享 w1Constraints + 三路径测试 |
| 参考收藏案例与节日注入无回归 | ✅ reference-cases + calendar-validation |
| 左侧折叠页 / CollapsibleSection | ✅ 未实现（InputPanel 保持非折叠） |
| W2/W3/W4 / migration / RLS / 支付 / 部署 | ✅ 未做 |
| Client tests | ✅ 308/308（含 W1 专测） |
| Server W1 + 相关 | ✅ w1/reference/calendar/generations 176 passed |
| Client/Server tsc + production build | ✅ 通过 |

## 2026-07-13 — 收藏卡片品牌与产品展示

| 验收项 | 结果 |
|---|---|
| 品牌名和产品名显示在高亮平台标签左侧 | ✅ DOM 顺序行为测试 |
| 品牌/产品文字按双主题显示为红色 | ✅ `text-red-400` / `light:text-red-600` 行为断言 |
| 单字段缺失时只显示已有字段，双字段为空时无占位 | ✅ 由可选字段组合逻辑保证 |
| 长名称不挤压平台、时间和操作按钮 | ✅ 可截断弹性区 + `shrink-0` |
| 数据库、接口、RLS 或 Migration 变化 | ✅ 无 |
| Client regression suite | ✅ 260/260 |
| Client TypeScript + production build | ✅ `npm run build` 通过 |

## 2026-07-13 — Slice F1 PKCS8 签名与失败订单收口

| 验收项 | 结果 |
|---|---|
| PKCS8 应用私钥可生成 sandbox `alipay.trade.page.pay` RSA2 URL | ✅ 实钥离线签名预检通过 |
| PKCS1 私钥仍保持 SDK 默认兼容 | ✅ PEM header 自动识别 |
| page-pay 初始化失败不残留 pending 新订单 | ✅ 条件更新为 `failed/PAYMENT_INIT_FAILED` |
| 历史失败订单收口 | ✅ 授权范围内 3/3 改为 failed，pending=0 |
| 删除订单或授予 Pro | ✅ 均未执行 |
| Server tests / tsc / build | ✅ 417/417 / 通过 / 通过 |
| 密钥进入源码、日志或仓库 | ✅ 未发生 |

## 2026-07-13 — Slice F1 公开路由修复（实时烟测阻断）

| 验收项 | 结果 |
|---|---|
| `GET /api/billing/plans` 无 token 到达 billing handler，不 401 | ✅ sandbox 真实数据库返回 200，Free/Pro 共 2 条 |
| Sandbox plans 查询与权威 Migration 字段一致 | ✅ 使用 `is_public` + `week/month`，不再查询不存在的 `is_active/day` |
| `POST /api/billing/alipay/notify` 空 form body 快速返回 200 `fail` | ✅ 无超时 |
| `POST /api/billing/alipay/checkout` 无 token 仍 401 | ✅ auth gate 不变 |
| `GET /api/sync/bootstrap` 无 token 仍 401（无回归） | ✅ |
| Body parser 在 urlencoded 已解析空 object 时不重复读流 | ✅ `req.body && typeof req.body === 'object'` |
| billingRouter 挂载在任何 `router.use(requireAuth)` 路由之前 | ✅ 在 generationsRouter/syncRouter/feedbackRouter 前 |
| 注释准确：urlencoded 挂载位置在 app.ts | ✅ billing.ts JSDoc 已修正 |
| Server tests | ✅ 415/415 |
| Server tsc --noEmit | ✅ 通过 |
| Server build | ✅ 通过 |
| Live smoke mock mode | ✅ 4/4 |
| Live smoke sandbox mode | ✅ plans 200；本地/公网 notify 200 `fail`；无 token checkout/sync 维持鉴权 |

## 2026-07-13 — Slice F1 / G1-R 最终阻断修复（权威状态）

| 验收项 | 结果 |
|---|---|
| BillingPage 根据 paymentMode 路由 checkout (mock/sandbox) | ✅ 前端路由分流 |
| Sandbox checkout 提交 idempotencyKey | ✅ crypto.randomUUID() |
| Sandbox plans 从 DB 读取（公开安全字段）+ 返回 paymentMode | ✅ DB-backed |
| Sandbox orders/entitlements 按 owner 隔离 | ✅ 可信 BFF 查询 |
| Checkout return URL 含 orderId + paymentMode (WHATWG URL) | ✅ 服务端追加参数 |
| BillingResultPage query 参数识别 sandbox | ✅ queryPaymentMode |
| Sandbox pending/error 不显示"订单创建成功" | ✅ 仅 paid 显示成功 |
| express.urlencoded 仅 app.ts 挂载 | ✅ 删除 router 重复 |
| Notify 验签前零 DB mutation | ✅ 解析→验签→验证→DB |
| Invalid signature 零 DB write | ✅ 直接返回 fail |
| tradeQuery SDK 4.14 camelCase (无 any) | ✅ adapter + 单测 |
| Reconcile 检查 rpcErr + success | ✅ 不吞错 |
| Admin Supertest 精确断言 401/403/200 | ✅ 可控 service mock |
| .env.example 合并（删除 server/.env.example） | ✅ 仅占位符 |
| 无 PEM key / secret 泄露 | ✅ secret scan 通过 |
| Server tests | ✅ 408/408 |
| Client tests | ✅ 250/250 |
| Server tsc --noEmit | ✅ 通过 |
| Client tsc --noEmit | ✅ 通过 |
| 双端 build | ✅ 通过 |

**远端状态（2026-07-13）：**
- F1 Migration `20260713000000_slice_f1_payment_sandbox.sql` 已推送至项目 `qiotocumkbwckiezuptr`，远端历史登记为 `20260713000000 slice_f1_payment_sandbox`
- 已核验两张支付表、RLS、owner SELECT policy、最小 grants、约束与 `apply_alipay_payment` 权限；该 SECURITY DEFINER RPC 仅 `service_role` 可执行

**⚠️ 重要限制：**
- 真实支付宝 sandbox E2E **未执行**（需商户主体/资质/计费决策）
- `PAYMENT_MODE` 默认 `mock`；sandbox 需配置 ALIPAY_APP_ID + 密钥
- 所有支付/生产动作仍需单独授权

## 2026-07-12 — Slice E 本地验收（权威状态）

| 验收项 | 结果 |
|---|---|
| 定价页 Free/Pro 双卡 + MOCK 标签 | ✅ 渲染测试通过 |
| 定价页价格、配额、功能列表、CTA 链接 | ✅ 全部渲染验证通过 |
| 定价页 FAQ 区 | ✅ 渲染测试通过 |
| 结算页受保护（需鉴权） | ✅ auth gate by ProtectedRoute |
| 结算页加载/空状态/错误/列表 | ✅ API client 测试覆盖 |
| POST /api/billing/checkout 校验 planId | ✅ 测试验证 |
| 原型链键不可绕过 planId allowlist | ✅ constructor / __proto__ / toString 均返回 400 |
| 前端篡改金额不改变订单金额 | ✅ 服务端仍按 Pro 定价返回 ¥19 |
| 拒绝 Free→Free + Pro→Free | ✅ 测试验证 |
| 成功创建 Mock 订单含 redirectUrl | ✅ 测试验证 |
| GET /api/billing/orders 按 userId 隔离 | ✅ User A/B 隔离测试 |
| GET /api/billing/orders/:id 拒绝非所有者 | ✅ 403 测试 |
| GET /api/billing/orders/:id 404 | ✅ 测试验证 |
| GET /api/billing/plans 公开无需鉴权 | ✅ 测试验证 |
| 支付结果页成功/取消状态 | ✅ 渲染 + 订单摘要测试 |
| 支付结果页缺少 orderId 错误态 | ✅ 错误消息测试 |
| 所有响应和页面含 isMock/[MOCK] | ✅ 类型常量 + 渲染测试 |
| 不走真实支付宝/DB Migration/远端订单 | ✅ 纯内存 Mock |
| 结算入口不挤占 Header 横排 | ✅ 收纳至 HeaderMenu |
| 新 Logo 无白边容器 | ✅ 官网、工作台、定价、结算四处共用裁切规范 |
| 现有功能无回归 | ✅ Server 306/306; Client 198/198 |
| 自动化验证 | ✅ 双端 tsc、生产 build 与运行烟测通过 |
| 证据保存 | ✅ `docs/evidence/2026-07-12/slice-E/verification.md` |

## 2026-07-12 — Slice H1 本地验收（权威状态）

| 验收项 | 结果 |
|---|---|
| 收藏删除确认对话框（Escape/焦点/aria） | ✅ 24 项行为测试通过 |
| 确认对话框危险/非危险配色 | ✅ 红色 danger vs 亮橙/emerald |
| FeedbackCenter drawer 四种反馈类型 | ✅ 渲染 + 表单校验测试通过 |
| 反馈提交 loading/success/error 状态 | ✅ 行为测试覆盖 |
| POST /api/feedback 持久化 + 通知 | ✅ 26 项 API 测试通过 |
| 通知失败仍返回 201 | ✅ 测试验证 |
| 未登录拒绝 401 | ✅ Auth gate 测试 |
| 服务端输入校验（类型/长度/meta） | ✅ 所有边界测试通过 |
| ServerChan notifier 超时/失败 | ✅ 18 项单元测试通过 |
| SendKey 不泄漏（错误脱敏） | ✅ 测试断言 |
| 自动化验证 | ✅ Server 253/253；Client 159/159；双端 TypeScript/build 通过 |
| H1 Migration | ✅ `20260712072936` 已通过认证 Supabase MCP 应用并完成结构验收 |

仍需人工完成：从已登录工作台提交一条普通反馈；真实 Server酱通知测试必须另行确认。

## 2026-07-12 — Slice H1-R 独立复验

| 验收项 | 结果 |
|---|---|
| 工作台结果在历史往返后恢复 | ✅ owner-scoped sessionStorage 行为测试通过 |
| 完整历史记录载入工作台 | ✅ 原平台、语气、语言与生成结果映射测试通过 |
| 失败/不完整历史不可载入 | ✅ 边界测试通过 |
| 坏快照与跨账号快照隔离 | ✅ 行为测试通过 |
| H1 管理员 RLS helper | ✅ 静态测试限定 `private.has_any_role` |
| 工作台与官网共用 77 Logo | ✅ 双页面渲染回归测试通过；静态资源可用 |
| 自动化验证 | ✅ Client 170/170；Server 282/282；双端 TypeScript 与 build 通过 |
| Migration 远端应用 | ✅ MCP 应用成功；表、RLS、策略、授权与触发器已读取验证 |

当前边界：用户已于 2026-07-12 完成浏览器反馈提交测试；真实 Server酱通知是否送达以用户微信端结果为准。

## 2026-07-12 — UX-F1 生成进度 + Header 菜单收纳（权威状态）

| 验收项 | 结果 |
|---|---|
| 四阶段进度条渲染 | ✅ pending/active/done/failed 四态视觉正确 |
| "预估"标注可靠 | ✅ 标注清晰显示于进度下方 |
| 进度阶段推进 | ✅ 诊断原文→生成变体→质量审核→消费者反馈 |
| 暗色 emerald / 亮色 orange | ✅ 设计系统颜色对 |
| Header 高频保留 | ✅ 历史、收藏库、引擎状态直接可见 |
| HeaderMenu 收纳 | ✅ 官网、复原配置、主题、退出在菜单中 |
| Menu 键盘/Escape/点击外部 | ✅ 全部行为测试通过 |
| Menu aria 属性 | ✅ aria-expanded/haspopup/menu/menuitem |
| ReferenceCaseSelector 始终可见 | ✅ 回归测试通过 |
| 自动化验证 | ✅ Client 135/135；双端 TypeScript/build 通过 |

## Slice B — Acceptance Criteria

## 2026-07-12 — Slice D 云同步最终验收（权威状态）

| 验收项 | 结果 |
|---|---|
| 收藏、备注、评分、删除同步 | ✅ reducer 真实行为测试通过 |
| 配置新增、修改、删除同步 | ✅ 内容快照检测，不再只比较 ID |
| 品牌新增、修改、清空同步 | ✅ null 清空可同步 |
| hydration / retry / outbox | ✅ 不自我取消；失败操作持久化并可重放 |
| 服务端 owner_id | ✅ 仅取认证用户；payload/filter 精确断言 |
| 数据库 RLS | ✅ 三表启用；双账号角色事务模拟通过 |
| 配置上限 | ✅ 数据库原子限制 20 条；第 21 条失败；已有项可更新 |
| Migration | ✅ `20260712070000_slice_d_cloud_sync` 已推送远端 |
| 自动化验证 | ✅ Server 209/209；Client 113/113；双端 TypeScript/build 通过 |

仍需人工完成：用两个真实浏览器会话操作收藏与刷新，确认最终 UI 文案和交互体验。

## Slice D — Cloud Sync (✅ PASSED — 2026-07-12, Audit Fix v2 2026-07-12)

| # | Criterion | Result |
|---|-----------|--------|
| D.1 | Migration `20260713000000_slice_d_cloud_sync.sql` exists | ✅ |
| D.2 | Migration `supabase db push --dry-run` shows ONLY Slice D | ✅ |
| D.3 | 3 tables created: `favorites`, `saved_configs`, `brand_profiles` | ✅ |
| D.4 | RLS enabled on all 3 tables; anon=no access; authenticated=own rows | ✅ |
| D.5 | `GET /api/sync/bootstrap` returns user's cloud data | ✅ |
| D.6 | `POST /api/sync/favorites` upsert with validation | ✅ |
| D.7 | `DELETE /api/sync/favorites/:clientId` only own; 404 for others | ✅ |
| D.8 | `POST /api/sync/configs` enforces MAX_SAVED_CONFIGS=20 | ✅ |
| D.9 | `POST /api/sync/import` idempotent (duplicate run doesn't increase count) | ✅ |
| D.10 | `PUT /api/sync/brand-profile` MVP: one per user | ✅ |
| D.11 | Body `owner_id`/`ownerId`/`id` rejected (overpost protection) | ✅ |
| D.12 | Validation: variantKey enum, rating 1-5, content/source length, JSON type | ✅ |
| D.13 | DB errors sanitized — no constraint/table names leaked | ✅ |
| D.14 | Client cloudSync service: 17 exported functions | ✅ |
| D.15 | Legacy global key detection + explicit import (never auto-import) | ✅ |
| D.16 | Hydration guard: cloud data merged, local-only auto-imported, empty state not overwritten | ✅ |
| D.17 | Non-blocking sync error: data stays local, retryable | ✅ |
| D.18 | Server tests — 37 sync tests: auth gate, CRUD, validation, import, sanitization | ✅ 193/193 |
| D.19 | Client tests — 39 slice-d tests: API, conversion, legacy keys, error handling | ✅ 92/92 |
| D.20 | User A cannot read/modify User B data (owner-scoped RLS + WHERE clauses) | ✅ |
| D.21 | No secrets, tokens, or keys in any new code | ✅ |

### Known Limitations

- Migration NOT pushed to remote (requires user authorization)
- Real two-browser RLS test requires human verification (two accounts)
- Build (`npm run build`) blocked by pre-existing EPERM on dev server lock
- Individual `tsc --noEmit` passes clean on both sides
- Cloud sync mutations are fire-and-forget; error shown as non-blocking banner

## Slice C2b — Remote quota closure (✅ PASSED — 2026-07-12)

| # | Criterion | Result |
|---|-----------|--------|
| C2b.1 | Migration `20260712000000` exists locally and remotely | ✅ |
| C2b.2 | Catalogue is `Free = 20 / rolling 7 days`, `Pro = ¥19 / calendar month / 400` | ✅ |
| C2b.3 | Every existing auth user has exactly one subscription after backfill | ✅ 2 users / 2 subscriptions |
| C2b.4 | New-user trigger provisions profile, role and Free subscription | ✅ static + remote schema verified |
| C2b.5 | Browser role cannot INSERT/UPDATE `generation_jobs` or execute quota RPCs | ✅ remote privilege + role test |
| C2b.6 | `usage_ledger` is append-only for service role (`SELECT, INSERT`; no `UPDATE`) | ✅ remote privilege test |
| C2b.7 | reserve / duplicate reserve / consume / release / transition conflicts execute successfully | ✅ remote transaction, rolled back |
| C2b.8 | Old-period release does not refund quota into a new period | ✅ remote transaction, rolled back |
| C2b.9 | RLS exposes only the signed-in user's subscription | ✅ remote role/JWT simulation |
| C2b.10 | Trusted client reads the external secret file pointer without copying the key into the repo | ✅ plan count 2; key never printed |
| C2b.11 | Server/client tests and builds pass | ✅ server 156/156; client 53/53; both builds pass |

Known non-blocking advisor warnings: the owner-checked soft-delete RPC is intentionally `SECURITY DEFINER`; Supabase leaked-password protection remains a dashboard hardening task.

## Local Automation Gate (✅ PASSED — v2 acceptance fixes applied)

| # | Criterion | Result |
|---|-----------|--------|
| B.1 | Client `npx tsc --noEmit` | ✅ 0 errors |
| B.2 | Server `npx tsc --noEmit` | ✅ 0 errors |
| B.3 | Client `npm run build` (tsc -b + vite build) | ✅ dist/ (599 KB JS, 76 KB CSS) |
| B.4 | Server `tsc` | ✅ dist/ |
| B.5 | Client Vitest: 27 tests, 0 failed | ✅ 27/27 passed (12 slice-a + 15 slice-b) |
| B.6 | Client Vitest: **zero act() warnings in stderr** | ✅ no "act(" nor "not wrapped in act" in stderr |
| B.7 | Server Vitest: 6/6 (health, /api/me 401×4, bootstrap) | ✅ 6/6 passed |
| B.8 | Server starts (`npm run dev:server`) | ✅ loads .env, port 3001 |
| B.9 | GET /api/me — no token → 401 | ✅ "Missing or invalid" |
| B.10 | GET /api/me — invalid token → 401 | ✅ "Invalid or expired" |
| B.11 | No legacy secret key names, `service_role`, `supabaseAdmin` in source | ✅ comments only |
| B.12 | No `[MOCK]` badges in auth pages | ✅ 0 matches |
| B.13 | No plaintext password storage (no `hk-cantonese-mock-auth`) | ✅ 0 matches |
| B.14 | `.env.example` has no real key values | ✅ all set to empty/placeholder |
| B.15 | `vite-env.d.ts` uses `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ |
| B.16 | `supabase-stub.d.ts` files deleted | ✅ |

## Local workbench shell smoke (2026-07-15) — infrastructure only

| # | Criterion | Result |
|---|-----------|--------|
| LWS.1 | E2E Vite only loads mock Auth/Supabase; production vite.config untouched | ✅ |
| LWS.2 | Fixture user is `e2e@example.invalid` (not real credentials) | ✅ |
| LWS.3 | Browser aborts non-localhost; blocked list empty | ✅ |
| LWS.4 | `/app` shell loads under mock (no login bounce); desktop + mobile | ✅ |
| LWS.5 | Evidence screenshots under `docs/evidence/2026-07-15/workbench-shell-local-smoke/` | ✅ |
| LWS.6 | **Does not** accept real Auth / JWT / RLS / payment | ✅ explicit non-coverage |

## New Behavior Tests (✅ PASSED — v2 acceptance fixes)

| # | Test | Result |
|---|------|--------|
| B.5a | `resetPassword` success → `isLoading=false`, "Resolved" shown | ✅ |
| B.5b | `resetPassword` failure → "重置链接已发送" NOT shown | ✅ |
| B.5c | `updatePassword` failure → "密码已重置" NOT shown | ✅ |
| B.5d | Normal `SIGNED_IN` session → "链接已过期或无效" | ✅ |
| B.5e | `PASSWORD_RECOVERY` session → reset form visible | ✅ |
| B.5f | `AuthCallback` existing confirmed session → success redirect | ✅ |

## v2 Fixes Applied (2026-07-11)

- **Act warnings eliminated**: All page-render tests now use `awaitAuthReady()` helper to wait for AuthProvider's async `getSession()` dispatch before assertions. `AuthContext` exported for direct Provider-based testing.
- **Client tsconfig**: Added `typeRoots: ["./node_modules/@types"]` — fixes workspace-hoisted `@types/superagent` resolution error in TypeScript 5.9.3.
- **Root `package.json`**: Added `vitest` devDependency — fixes hoisting issue where `@testing-library/jest-dom` (hoisted to root) could not resolve `vitest` (in client `node_modules`).

## Pending: Real Email Interaction (⏸️ BLOCKED)

Requires a human to use a real email address and inbox:

| # | Criterion | How to verify |
|---|-----------|---------------|
| B.17 | Email signup → confirmation email received | Register at /signup, check inbox |
| B.18 | Click confirmation link → redirected to /app | Click link in email |
| B.19 | Login with confirmed email → /app works | /login with confirmed credentials |
| B.20 | Forgot password → reset email received | /forgot-password, check inbox |
| B.21 | Reset password link → new password works | Click reset link, set new password, login |
| B.22 | Session persists across refresh | Refresh /app, stay logged in |
| B.23 | Logout → /app redirects to /login | Click logout, try /app |
| B.24 | User A cannot see User B data (RLS) | Two different accounts, verify isolation |

**Stop here.** Do not mark Done until B.17–B.24 are verified by a human.

---

## Slice C1 — Local Automation Gate (✅ PASSED — v3 acceptance fixes applied)

| # | Criterion | Result |
|---|-----------|--------|
| C1.1 | Server `npx tsc --noEmit` | ✅ 0 errors |
| C1.2 | Client `npx tsc --noEmit` | ✅ 0 errors |
| C1.3 | Client `npm run build` | ✅ dist/ (615 KB JS, 78 KB CSS) |
| C1.4 | Server Vitest: 45/45 (me 6 + generations 39) | ✅ PASS |
| C1.5 | Client Vitest: 38/38 (12 slice-a + 15 slice-b + 11 slice-c1) | ✅ PASS, 0 act warnings |
| C1.6 | POST /api/generate — 401 without token | ✅ requireAuth gate |
| C1.7 | POST /api/generate — requires idempotencyKey, validates format (1-128 chars, alphanumeric) | ✅ |
| C1.8 | POST /api/generate — atomic upsert via INSERT...ON CONFLICT (no check-then-insert race) | ✅ |
| C1.9 | POST /api/generate — completed duplicate returns 200 with cached result (idempotent=true) | ✅ |
| C1.10 | POST /api/generate — processing/pending duplicate returns 202 (no re-generation) | ✅ |
| C1.11 | POST /api/generate — failed duplicate returns 200 with error + retryHint (use new key) | ✅ |
| C1.12 | POST /api/generate — saves complete GenerateResponse to generation_jobs on success | ✅ |
| C1.13 | POST /api/generate — saves error to generation_jobs on failure (failJob) | ✅ |
| C1.14 | GET /api/generations — paginated list with limit/offset validation (1-100, ≥0) | ✅ |
| C1.15 | GET /api/generations/:id — detail with UUID validation, 404 for non-owner | ✅ |
| C1.16 | DELETE /api/generations/:id — soft delete (UUID validation, ownership check) | ✅ |
| C1.17 | PATCH /api/generations/:id — **REMOVED** (was arbitrary status injection vector) | ✅ 404 |
| C1.18 | Owner isolation: RLS-enforced, cross-user returns 404 indistinguishable from not-found | ✅ |
| C1.19 | Input validation: UUID format, idempotency key format/length, limit/offset bounds, source non-empty | ✅ 400 on invalid |
| C1.20 | Migration `20260711213000_slice_c1_generation_jobs.sql` (renamed after 20260711170000) | ✅ local only |
| C1.21 | RLS: owner-scoped select/insert/update, no delete policy, soft delete via deleted_at | ✅ |
| C1.22 | UNIQUE(owner_id, idempotency_key) constraint + atomic INSERT...ON CONFLICT | ✅ |
| C1.23 | Migration static safety assertions: 10 automated checks in test suite | ✅ |
| C1.24 | Frontend HistoryPage — loading/empty/error/populated/delete, linked to Header | ✅ |
| C1.25 | Frontend HistoryDetailPage — all 5 result types (variants/diagnosis/audit/scores/consumerFeedback) + error + brief | ✅ |
| C1.26 | `/app/history` and `/app/history/:id` routed with ProtectedRoute | ✅ |
| C1.27 | Client generates stable idempotencyKey per user action (gen-{ts}-{uuid}) | ✅ |
| C1.28 | No service_role / secret / admin bypass in any new code | ✅ |
| C1.29 | Service-layer tests exercise Supabase query chain (not just mock entire service) | ✅ |
| C1.30 | Database errors sanitized — no constraint names/table names leaked to client | ✅ |

### Security Risk Assessment (C1 → C2)

**Finding: `grant update` to `authenticated` allows browser-direct status tampering.**

The migration grants `select, insert, update` on `generation_jobs` to `authenticated`. Combined with the permissive UPDATE RLS policy, a browser client with a valid JWT can call the Supabase REST API directly to modify their own jobs' `status`, `variants`, `scores`, etc., bypassing the BFF entirely.

**C1 acceptable boundary:** In C1, there is no quota enforcement, billing, or admin dashboard that consumes `generation_jobs.status` as a trusted signal. The BFF's `/api/generate` endpoint is the intended write path and the only code that sets status. Browser-direct writes would only affect the user's own history view — a self-deception vector, not a cross-user security issue.

**C2 trusted-write mitigation (recommended):**
1. Revoke `update` on `generation_jobs` from `authenticated`
2. Create SECURITY DEFINER functions for status transitions (e.g., `complete_generation_job()`)
3. Grant `execute` on these functions to `service_role` only
4. Add a `service_role` Supabase client in the BFF for trusted writes
5. Drop the existing UPDATE policy since `authenticated` no longer has update grant

This ensures only the trusted BFF can finalize job status/results, which is essential when C2 introduces usage quotas and billing based on job records.

### Pending for Remote Application

- **Migration NOT pushed to Supabase.** Exact push command:
  ```bash
  cd D:\work\77港话通社媒文案\77
  npx supabase db push
  ```
  This will apply `20260711213000_slice_c1_generation_jobs.sql` (renamed from `20260711000001`) to the linked remote project.
- After push: verify with `npx supabase db lint` and Security Advisors.
- Then: real auth + real DB integration test (create via generate, list, soft-delete with two users).
- Real RLS isolation must be verified post-push (current tests mock Supabase).

### Known Limitations (C1 v3)

- **Table grant update risk** — documented above; acceptable for C1, must be addressed in C2 before quotas/payments.
- **generate flow requires functional AI engine** — tests that exercise the full POST /api/generate path may get 500 if no AI API key is configured. The idempotency and validation tests are isolated from AI calls via mock.
- **HistoryPage does not auto-refresh** — user must navigate away and back to see new entries after generation.
- **No pagination UI** — list endpoint supports limit/offset but HistoryPage currently fetches first 50 with no "load more".

---

## Slice C1 v4 — Client Response Discrimination & Polling (✅ PASSED, 2026-07-11)

| # | Criterion | Result |
|---|-----------|--------|
| C1v4.1 | Client `npx tsc --noEmit` | ✅ 0 errors |
| C1v4.2 | Server `npx tsc --noEmit` | ✅ 0 errors |
| C1v4.3 | Client build | ✅ dist/ (616 KB JS, 78 KB CSS) |
| C1v4.4 | Server build | ✅ dist/ |
| C1v4.5 | Client Vitest: 49/49 (12 A + 15 B + 11 C1 + **11 C1v4**) | ✅ PASS, 0 unhandled rejections |
| C1v4.6 | Server Vitest: 45/45 (6 me + 39 generations) | ✅ PASS |
| C1v4.7 | Discriminated response types: `GenerateSuccessBody` \| `GeneratePendingBody` \| `GenerateFailedBody` | ✅ no blind cast |
| C1v4.8 | `generateCopy` retries network errors once with **same** `idempotencyKey` | ✅ test verified |
| C1v4.9 | `generateCopy` on HTTP 202: polls `GET /api/generations/:id` with exponential backoff (1s→2s→…→16s, 120s cap) | ✅ test verified |
| C1v4.10 | Polling: completed job → mapped to full `GenerateResponse` → `SET_RESULTS` | ✅ test verified |
| C1v4.11 | Polling: failed job → throws → `SET_ERROR` (never `SET_RESULTS`) | ✅ test verified |
| C1v4.12 | Polling: timeout → throws with `jobId` in message for user recovery | ✅ test verified |
| C1v4.13 | HTTP 200 `body.status='failed'` → throws immediately → `SET_ERROR` | ✅ test verified |
| C1v4.14 | Incomplete data (202 body, 200-failed body) **never** dispatched as `SET_RESULTS` | ✅ structurally prevented by types |
| C1v4.15 | `useGenerate` generates one idempotencyKey per call; new click = new key | ✅ test verified |
| C1v4.16 | `crypto.randomUUID()` with RFC 4122 v4 fallback for environments without it | ✅ |
| C1v4.17 | Comment accurately describes behaviour: "network retries once with SAME key" | ✅ matches code |
| C1v4.18 | Polling transient network errors are swallowed, job-level failures re-thrown | ✅ |
| C1v4.19 | No `service_role` / secret / admin bypass introduced | ✅ |

### Known Limitations (C1 v4)

- **Main migration pushed** — `20260711213000_slice_c1_generation_jobs.sql` is applied to remote Supabase.
- **Table grant update risk** — carries forward from v3; C2 trusted-write plan documented.
- **No pagination UI** — carries forward from v3.
- **Fake-timer polling tests** — two tests use `promise.catch(() => {})` to suppress expected unhandled rejections during `act()` timer advancement. This is a Vitest fake-timer idiom, not a code smell.

---

## Slice C1 Patch — Soft-Delete RLS Fix (✅ PASSED dry-run, 2026-07-11)

| # | Criterion | Result |
|---|-----------|--------|
| CP.1 | Server `npx tsc --noEmit` | ✅ 0 errors |
| CP.2 | Client `npx tsc --noEmit` | ✅ 0 errors |
| CP.3 | Client build | ✅ dist/ (616 KB JS, 78 KB CSS) |
| CP.4 | Server build | ✅ dist/ |
| CP.5 | Server Vitest: 65/65 (**+20 patch tests**) | ✅ PASS |
| CP.6 | Client Vitest: 49/49 (no regression) | ✅ PASS |
| CP.7 | Patch migration `20260711223000` is later than main `20260711213000` | ✅ |
| CP.8 | RPC is SECURITY DEFINER | ✅ |
| CP.9 | RPC sets `search_path = ''` | ✅ |
| CP.10 | RPC checks `auth.uid() is not null` before UPDATE | ✅ |
| CP.11 | **Single atomic UPDATE** — no SELECT-then-UPDATE TOCTOU window | ✅ test verified |
| CP.12 | UPDATE WHERE contains all 3 conditions: `id = _job_id AND owner_id = auth.uid() AND deleted_at is null` | ✅ test verified |
| CP.13 | No `_owner_id` variable, no pre-query — TOCTOU-free | ✅ test verified |
| CP.14 | All objects fully qualified (`public.generation_jobs`) | ✅ |
| CP.15 | REVOKE from `public, anon`; GRANT EXECUTE to `authenticated, service_role` | ✅ |
| CP.16 | `softDeleteJob` calls RPC via user-scoped client, returns `Promise<boolean>` | ✅ |
| CP.17 | `false` → route returns 404 (indistinguishable cross-user) | ✅ test verified |
| CP.18 | DB errors sanitised — no constraint names / table names leaked | ✅ test verified |
| CP.19 | SELECT policy unchanged — still filters `deleted_at IS NULL` | ✅ regression test |
| CP.20 | No `grant delete to authenticated` in original migration | ✅ regression test |
| CP.21 | `supabase db push --dry-run` previews ONLY the patch migration | ✅ verified |

### Remote verification

- ✅ `20260711223000_fix_generation_soft_delete.sql` 已推送远端。
- ✅ 本人身份创建、读取与软删除成功。
- ✅ 模拟其他用户读取为 0，调用软删除 RPC 返回 false。
- ✅ 软删除后普通查询不可见。
- ✅ 验证事务整体回滚，`generation_jobs` 测试数据为 0。
- ⚠️ Security Advisor 对 authenticated 可执行 SECURITY DEFINER RPC 提示通用警告；该 RPC 仅允许 `owner_id = auth.uid()` 的原子软删除，属于当前明确接受的 C1 边界。

---

## Slice C2a — Local Automation Gate (✅ PASSED, 2026-07-11, FIXED 2026-07-11, FINAL FIX 2026-07-11)

| # | Criterion | Result |
|---|-----------|--------|
| C2a.1 | Server `npx tsc --noEmit` | ✅ 0 errors |
| C2a.2 | Client `npx tsc --noEmit` | ✅ 0 errors |
| C2a.3 | Client `npm run build` | ✅ dist/ (616 KB JS, 78 KB CSS) |
| C2a.4 | Server `tsc` build | ✅ 0 errors |
| C2a.5 | Server Vitest (src): 154/154 | ✅ PASS (6 me + ~98 generations + 30 quota + 20 migration) |
| C2a.6 | Client Vitest: 49/49 | ✅ PASS |
| C2a.7 | Migration `20260712000000_slice_c2a_trusted_write_quota.sql` | ✅ local only, NOT pushed |
| C2a.8 | `REVOKE UPDATE on generation_jobs from authenticated` | ✅ present in migration |
| C2a.9 | No dead SECURITY DEFINER job functions (auth.uid() problem) | ✅ complete/fail/mark functions deleted |
| C2a.10 | `usage_ledger` append-only — no UPDATE/DELETE grants; terminal events INSERTed | ✅ SELECT + INSERT only |
| C2a.11 | `plans`, `subscriptions`, `usage_ledger` with RLS | ✅ all 3 tables |
| C2a.12 | Trusted adapter fail-closed on missing `SUPABASE_SECRET_KEY` | ✅ test verified |
| C2a.13 | Quota reserve → model call only if quota available | ✅ 402 when exhausted; atomic via reserve_quota RPC |
| C2a.14 | Successful generation → consume quota (append-only INSERT) | ✅ via consume_quota RPC |
| C2a.15 | Known failure → release quota (append-only INSERT + atomic decrement) | ✅ via release_quota RPC |
| C2a.16 | Duplicate idempotency key → no double reserve | ✅ RPC-level idempotency + UNIQUE constraint |
| C2a.17 | Only `SUPABASE_SECRET_KEY` (no legacy key names in source/tests/docs) | ✅ test verified |
| C2a.18 | Quota service unit tests: 27/27 | ✅ trust adapter (2) + reserve (6) + consume (7) + release (7) + entitlement (5) |
| C2a.19 | Migration static assertions: ~65 C2a checks | ✅ generations.test.ts |
| C2a.20 | No hardcoded production prices/quota values in migration | ✅ no defaults; CHECK constraints only |
| C2a.21 | generate.ts quota orchestration: no quota → 402, no model call | ✅ code reviewed |
| C2a.22 | generationJobsService UPDATE ops use trusted client + owner_id WHERE | ✅ service_role bypasses RLS; WHERE enforces ownership |
| C2a.23 | Security review: 0 critical, 0 medium, 0 low findings | ✅ ALL 7+7 blocking issues resolved |
| C2a.24 | No secret key in source code or error messages | ✅ error msgs sanitised |

### 2026-07-11 Final Fix — 7 项边界修复（第三轮）

| # | Fix | Mechanism |
|---|-----|-----------|
| F1 | reserve_quota 同键并发幂等边界 | FOR UPDATE 后再次查询 idempotency，发现已有 reserve 直接返回 |
| F2 | consume/release terminal 冲突检测 | 查询 terminal event_type：同 transition→true，相反→false |
| F3 | reserve_quota 有效周期校验 | 添加 `current_period_end > now()` 条件 |
| F4 | uncertain 202 守卫 | 仅 `uncertain && jobId && reservation` 返回 202；无 reservation 走普通 error |
| F5 | 已停用 key 名清除 | 源代码/测试/spec/planning/evidence 中已停用 legacy key 全部移除 |
| F6 | 显式 service_role grant | `grant select, insert, update on generation_jobs to service_role` |
| F7 | 未确认业务默认值移除 | price_cny/quota_per_cycle/cycle_days 删 default 加 CHECK；subscriptions CHECK 约束 |

### Atomicity Invariants (C2a-FIX)

| Invariant | Mechanism | Status |
|-----------|-----------|--------|
| Atomic reserve | `reserve_quota` RPC: FOR UPDATE lock + balance check + INSERT + quota_used increment in one transaction | ✅ |
| Append-only ledger | consume/release INSERT new terminal events; original reserve row NEVER mutated | ✅ |
| Terminal uniqueness | `idx_ledger_one_terminal_per_reservation` partial unique index; `chk_terminal_has_reservation` CHECK constraint | ✅ |
| No TOCTOU fallback | release_quota RPC handles quota_used decrement atomically; TS code never SELECT-then-UPDATE | ✅ |
| Timeout resilience | Uncertain errors (timeout, ECONNRESET, AbortError) keep job + reservation alive, return 202 | ✅ |

### RPC Functions

| RPC | Signature | Locking | Purpose |
|-----|-----------|---------|---------|
| `reserve_quota` | `(_user_id uuid, _idempotency_key text) → jsonb` | FOR UPDATE on subscription | Atomic reserve |
| `consume_quota` | `(_user_id uuid, _reservation_id uuid) → boolean` | FOR UPDATE on reservation | Append-only consume |
| `release_quota` | `(_user_id uuid, _reservation_id uuid) → boolean` | FOR UPDATE on reservation | Append-only release + atomic quota_used decrement |

All: SECURITY INVOKER, `search_path = ''`, explicit `_user_id`, service_role EXECUTE only. The modern secret runs as the explicitly granted `service_role`, so owner privileges are unnecessary.

## 2026-07-12 — Workbench usability polish

| ID | Acceptance criterion | Result |
|---|---|---|
| UI.1 | Generation history always exposes a “回到工作台” link to `/app` | ✅ automated |
| UI.2 | Saved bookmark notes remain visible as a highlighted summary after parameter details collapse | ✅ automated |
| UI.3 | Reference favorite cases default to collapsed and expose user notes when expanded | ✅ automated |
| UI.4 | Successful unconfirmed signup exits the global loading state | ✅ automated |
| UI.5 | Signup confirmation explains inbox check, verification link, refresh, and login | ✅ automated |
| UI.6 | Client regression suite | ✅ 118/118 |
| UI.7 | Client TypeScript and production build | ✅ |

Manual visual confirmation remains available at `http://localhost:5175/app` while the development server is running.

### Pending for Remote Application

- **Migration NOT pushed:** `20260712000000_slice_c2a_trusted_write_quota.sql`
  ```bash
  cd D:\work\77港话通社媒文案\77
  npx supabase db push
  ```
- **`SUPABASE_SECRET_KEY` NOT configured** — must be set in `server/.env` (modern key name)
- **Price/Quota/Cycle NOT decided** — Migration contains no production values; test fixtures use non-production values
- **Push requires user authorization** per high-risk gate

### Known Limitations (C2a)

- No SSE/streaming progress for quota status — synchronous response only.
- Timeout recovery relies on client polling; no server-side reconciliation cron yet.
- Migration is a local draft; real Supabase testing requires push + secret config.

---

## 2026-07-12 — Slice G1 验收阻断修复（权威状态）

| 验收项 | 结果 |
|---|---|
| A1: `ensureCalendarCoverage` 纯函数创建 | ✅ 33 项测试通过 |
| A2: 节日话题五平台强制覆盖 | ✅ 生成路由在 persist/return 前覆盖缺失平台 |
| A3: 已有覆盖不重复；无 event 不变 | ✅ 测试验证 |
| A4: 不调用模型、不重试、不消费 quota | ✅ 确定性桥接句生成 |
| A5: 仅 shorts 命中→其余四项补齐 | ✅ 测试验证 |
| A6: 全命中不变；全 key 存在 | ✅ 测试验证 |
| A7: 生成路由使用修正后结果持久化/返回 | ✅ generate.ts 在 completeJob 前补丁 variants |
| B1: profiles 只用真实字段（无 email/last_sign_in_at/deleted_at） | ✅ schema contract + admin test 验证 |
| B2: subscriptions 用 user_id + 真实周期/配额字段 | ✅ schema contract 验证 |
| B3: generation list 只读元数据字段 | ✅ 不选 source/variants/diagnosis/audit/consumer_feedback |
| B4: feedback 默认列表禁止 content | ✅ 只选 type/title/notify_status/created_at |
| B5: audit_log 用真实列（actor/entity/diff） | ✅ schema contract 验证 |
| B6: 无 `select('*')`；无不存在 RPC | ✅ admin-schema-contract.test.ts 验证 |
| B7: generation detail endpoint fail-closed | ✅ audit 写入失败 → 500 拒绝 |
| B8: Supabase error 不静默伪装空数据 | ✅ 所有查询 error 检查抛异常 |
| B9: schema contract tests 读迁移 SQL | ✅ 10 describe blocks 解析真实 migration 文件 |
| B10: 客户端 AdminPage 与 API 类型同步 | ✅ AdminUserOverview/AdminGenerationMeta 等类型更新 |
| C1: SignupPage 调用 resolveNextPath | ✅ 外部/evil/路径穿越均被丢弃 |
| C2: MarketingPage 含 /pricing 链接 | ✅ nav + plans section 两处都有 |
| C3: PricingPage Free/Pro CTA 进真实流程 | ✅ /signup?next=%2Fapp 与 /login?next=%2Fapp%2Fbilling |
| D1: 收藏参考案例云端 HYDRATE 保留 | ✅ 现有测试全部通过 |
| D2: 折叠状态可见"可用 N 条" | ✅ ReferenceCaseSelector 始终显示计数 |
| D3: 四星筛选 + 最多 3 条 | ✅ 现有门禁不变 |
| 自动化验证 | ✅ Server 381/381; Client 243/243; 双端 TS + build 通过 |
| 无 secrets 泄露 | ✅ 全变更文件扫描通过 |

## 2026-07-12 — Slice G1 最终修复（日历顺序 + Admin 审计顺序 + 客户端类型同步）

| 验收项 | 结果 |
|---|---|
| **F1**: AdminPage 不再引用旧字段（email/ownerEmail/lastSignIn/sourceLength/contentPreview/ownerId/planId/actorId/resource/resourceId/metadata） | ✅ 源码静态断言 + 6 项 fixture 测试通过 |
| **F1**: Admin 客户端类型与后端 JSON 完全同步 | ✅ 5 个接口类型全部更新；UsersTable/GenerationsTable/FeedbackTable/SubscriptionsTable/AuditTable 表头同频 |
| **F2**: `ensureCalendarCoverage` 移至 `validateDiagnoseGenerateResult` 之后、audit/consumerFeedback 之前 | ✅ generate.ts 顺序：validate → calendar patch → audit/consumerFeedback → persist |
| **F2**: audit 与 consumerFeedback 使用补丁后 `validatedGen.variants`（非 `generateResult.variants`） | ✅ 源码静态断言 |
| **F2**: 删除旧重复日历补丁块 + "audit based on pre-patch" 限制 | ✅ 源码静态断言无旧注释 |
| **F2**: 路由/静态顺序测试防 `ensureCalendarCoverage` 再次移到 audit 之后 | ✅ 3 项顺序测试 |
| **F3**: 新增 `adminGenerationExists(jobId)`——仅查 `id` 列，不读正文 | ✅ `.select('id')`，不含 variants/source/diagnosis/audit/consumer_feedback |
| **F3**: detail 路由改为 exists → audit → detail（fail-closed） | ✅ audit 失败 500 阻断 detail 查询 |
| **F3**: 调用顺序测试 exists → audit → detail；audit 失败不调用 detail | ✅ 4 项顺序测试 |
| 自动化验证 | ✅ Server 387/387; Client 249/249; 双端 TS + build 通过 |
| 无 secrets 泄露 | ✅ 无新密钥/令牌/密钥引入 |

---

## 2026-07-13 — F1 支付确认回跳 UI

| 验收项 | 结果 |
|---|---|
| 结算页账户信息收纳至共享折叠菜单 | ✅ 自动化 |
| pending / cancel / Mock 订单不触发已支付回跳 | ✅ 自动化 |
| 非 Mock 且服务端状态为 paid 才生成成功回跳地址 | ✅ 自动化 |
| 结算页只对订单列表中匹配的 paid 订单显示成功弹窗 | ✅ 自动化 |
| 同步回跳不直接修改订阅或权益 | ✅ 代码边界保持 |
| 参考收藏案例在可滚动 Flex 左栏中不可被压缩 | ✅ `shrink-0` 回归门禁 |
| Client regression suite | ✅ 253/253 |
| Client TypeScript and production build | ✅ |

## 2026-07-13 — 收藏案例注入与管理员收藏详情

| 验收项 | 结果 |
|---|---|
| 无效/低于 4 星的收藏 ID 不计入已选案例 | ✅ 客户端行为测试 |
| 最多仅向生成请求发送 3 条有效高评分案例 | ✅ 代码门禁 + 回归测试 |
| DeepSeek / CantoneseLLM 五个平台均须应用至少 2 项参考技法 | ✅ Prompt 合约测试 |
| 规则引擎降级不再忽略 Hook / Emoji / CTA 参考信号 | ✅ fallback 行为测试 |
| 普通管理员收藏列表不包含正文 | ✅ Supertest |
| 普通管理员可查看单条正文并复制 | ✅ 客户端行为测试 |
| 收藏正文访问遵循 exists → audit → detail，审计失败 fail-closed | ✅ Supertest 调用顺序测试 |
| 无管理员编辑、删除、调分、批量导出能力 | ✅ 客户端静态/行为门禁 |
| 用户侧 favorites RLS 不放宽 | ✅ 无 Migration、只复用受信服务端 |
| 自动化验证 | ✅ Server 425/425；Client 255/255；双端 build 通过 |

## 2026-07-13 — 配置管理保存参考案例

| 验收项 | 结果 |
|---|---|
| 保存配置包含 `selectedReferenceCaseIds` | ✅ 行为测试 |
| 清空当前选择后加载配置可恢复参考案例 ID | ✅ 行为测试 |
| Supabase `saved_configs.config` 上行包含参考案例 ID | ✅ 转换测试 |
| 云端配置恢复为本地时保留参考案例 ID | ✅ 转换测试 |
| 旧配置无该字段时按空数组处理 | ✅ 向后兼容 |
| 配置提示显示“参考 N” | ✅ DOM 行为测试 |
| 数据库结构变更 | 无需 Migration |
| 自动化验证 | ✅ Client 256/256；TypeScript + production build 通过 |

## 2026-07-13 — 生成历史完整恢复左侧输入配置

| 验收项 | 结果 |
|---|---|
| 旧历史恢复结构化写作与消费者画像 | ✅ 回归测试 |
| 旧历史从 `referenceCases` / `calendarEventIds` 重建选择 | ✅ 回归测试 |
| 新生成请求保存完整 `workbenchSettings` | ✅ Hook 行为测试 |
| 新历史恢复发布日期、竞品查询、收藏与日历选择 | ✅ 回归测试 |
| 历史列表与详情页显示文字消失恢复提示 | ✅ React DOM 行为测试 |
| 非法历史配置安全回退 | ✅ 既有快照校验门禁 |
| 数据库结构变更 | 无需 Migration |
| 自动化验证 | ✅ Client 259/259；TypeScript + production build 通过 |

## 2026-07-13 — 高影响操作确认、批量删除与检索分页

| 验收项 | 结果 |
|---|---|
| 退出登录、复原创作配置取消时不执行 | ✅ HeaderMenu 行为测试 |
| 历史列表与详情确认前不调用删除接口 | ✅ React 行为测试 |
| 收藏库/历史多选、当前页全选、零选择禁用 | ✅ React 行为测试 |
| 历史批量删除部分失败保留失败项 | ✅ `Promise.allSettled` 回归测试 |
| 收藏库按品牌/产品/原文/文案检索并每页 10 条 | ✅ React 行为测试 |
| 历史按品牌/产品/原文服务端检索并每页 10 条 | ✅ Client + Supertest |
| 非法 PostgREST 搜索语法被拒绝 | ✅ Server 输入校验测试 |
| owner 过滤、RLS、软删除边界 | ✅ 保持既有链路；无 Migration |
| 自动化验证 | ✅ Client 270/270；Server 427/427；双端 TypeScript/build 通过 |

## 2026-07-13 — Free 收藏与生成历史容量权益

| 验收项 | 结果 |
|---|---|
| Free 第 11 条新收藏被客户端提示与服务端阻止 | ✅ `403 PLAN_LIMIT` |
| 更新/删除已有收藏及删除后释放容量 | ✅ 行为与 API 测试 |
| 既有超额收藏/历史只锁定、不删除 | ✅ Free 最新 10/15，Pro 全部 |
| 历史关键词搜索与详情 URL 不可绕过 | ✅ Supertest |
| 锁定收藏不进入参考案例或 Prompt | ✅ 共享可访问集合 |
| 数据库结构变更 | 无需 Migration |
| 自动化验证 | ✅ Client 276/276；Server 433/433；双端 TypeScript/build 通过 |
## 2026-07-15 — Shorts/TK 展示与双平台语义（本地验收）

| 验收项 | 结果 |
|---|---|
| 用户可见平台名统一为 `Shorts/TK` | ✅ 常量、管理员、历史、灵感与官网路径已统一 |
| 内部键继续使用 `shorts` | ✅ 契约测试通过，无 Migration |
| 生成/审核 Prompt 同时覆盖 YouTube Shorts 与 TikTok | ✅ 服务端 Prompt 契约测试通过 |
| 桌面与 390px 手机视图可点击且无横向溢出 | ✅ Playwright 截图与像素宽度检查 |
| 全量回归 | ✅ Client 372/372；Server 557/557；双端 typecheck/build；两次 audit 均 0 vulnerabilities |

证据：`docs/evidence/2026-07-15/shorts-tk-label/verification.md`
## 2026-07-15 — Pro 每自然月 250 次（远端验收）

| 验收项 | 结果 |
|---|---|
| 官网、Pricing、结算与公开套餐 API 统一显示 250 | ✅ 自动化与浏览器截图 |
| 数据库 Pro 套餐为 `250 / month / 1` | ✅ 远端 SQL 复核 |
| 存量 Pro 当前周期立即生效且不清零已用额度 | ✅ 有效 Pro 用户仍为 10/250 |
| 249/250/251 真实 `reserve_quota` 边界 | ✅ 249 可预留；250、251 拒绝 |
| 验证事务无残留 | ✅ QA ledger 0；真实用量仍为 10 |
| 全量回归 | ✅ Client 372/372；Server 560/560；双端 typecheck/build；两次 audit 均 0 vulnerabilities |

证据：`docs/evidence/2026-07-15/pro-250-quota/verification.md`

## 2026-07-15 — 团队协作版 ￥99/月联系入口（本地验收）

| 验收项 | 结果 |
|---|---|
| 官网与 Pricing 均显示团队协作版及 ￥99/月 | ✅ 桌面/390px 手机截图与行为测试 |
| 审核分组、管理员句子批注、待审核队列与提醒可见 | ✅ 两处入口共用一致功能文案 |
| CTA 不发起支付，只打开微信联系弹窗 | ✅ 按钮无链接，未调用结算 API |
| 微信号与项目二维码可用 | ✅ `18595680518`；二维码真实加载 |
| 复制成功/失败、Esc、焦点约束与恢复 | ✅ Vitest + Playwright |
| 手机弹窗与卡片无横向溢出 | ✅ 390×844 浏览器检查 |
| 数据库、权益和支付宝链路 | ✅ 无 Migration、无后端或支付改动 |
| 全量回归 | ✅ Client 378/378；Server 560/560；双端 typecheck/build；两次 audit 均 0 vulnerabilities |

证据：`docs/evidence/2026-07-15/team-plan-contact/verification.md`

## 2026-07-15：用户自写收藏与待审核队列

| 验收项 | 结果 |
|---|---|
| 用户新增自写收藏、必填字段和显式审核选择 | ✅ 行为测试通过 |
| 现有收藏发布平台/文案类型编辑 | ✅ 行为测试通过 |
| 同组待审核筛选、行高亮、角标与审核后刷新 | ✅ API/UI 测试通过 |
| 合并提醒去重，数量下降不误报 | ✅ 行为测试通过 |
| 跨组数量和正文不泄露 | ✅ 服务端 scope/响应契约及远端只读调用通过 |
| Migration 远端结构与 history | ✅ `20260715121000` 已推送并复核 |
| 全量回归和构建 | ✅ Client 383/383；Server 569/569；双端 typecheck/build；audit 0 vulnerabilities |
| Playwright 桌面/手机截图 | ✅ 2026-07-16 使用完全本地隔离 fixture 复验，两轮各 6/6；不作为真实 Auth/RLS 证据 |

判定：**数据层、应用行为及本地隔离浏览器交互完成；真实 Auth/RLS 仍需独立 staging 验收。**

证据：`docs/evidence/2026-07-15/user-authored-review-queue/verification.md`

## 2026-07-15：用户审核结果弹窗

| 验收项 | 结果 |
|---|---|
| adopted / changes_requested 显示通过或未通过文案 | ✅ 组件行为测试通过 |
| 品牌为空不显示空书名号 | ✅ 回退为“你的文案” |
| 只读取当前 owner 云同步收藏 | ✅ `CloudSyncGate` ready 后挂载，无管理员列表查询 |
| 点击前不标记、稍后/立即查看后去重 | ✅ localStorage + 会话内存降级测试通过 |
| 新 revision、审核时间或状态再次提醒 | ✅ 审核身份键回归通过 |
| 立即查看定位分页目标 | ✅ 清搜索、翻页、滚动和 3 秒高亮测试通过 |
| 页面重新聚焦刷新审核结果 | ✅ ready 状态触发 owner-scoped re-hydration |
| 全量客户端回归和构建 | ✅ Client 388/388；TypeScript + production build 通过 |
| 浏览器自动化 | ✅ 2026-07-16 本地隔离 E2E 两轮各 6/6，含桌面/390px、去重、再次提醒和立即定位；不作为真实 Auth/RLS 证据 |

判定：**本地应用行为及隔离浏览器交互完成；真实登录用户与远端审核数据仍保留人工/staging 验收。**

证据：`docs/evidence/2026-07-15/user-review-result-dialog/verification.md`

补充浏览器证据：`docs/evidence/2026-07-16/review-notifications-local-e2e/verification.md`

## 2026-07-15：管理员待审核空状态说明

| 验收项 | 结果 |
|---|---|
| “只看待审核”显示当前计数 | ✅ 显示 `只看待审核（N）` |
| 空队列不再显示模糊的“暂无用户收藏” | ✅ 明确说明当前无待审任务 |
| 已通过/需修改记录不误归入待审核 | ✅ 保持原审核状态机与 anti-join |
| 真实远端状态只读复核 | ✅ 4 条已提交记录均已有审核结果，真实待审为 0 |
| 自动化验证 | ✅ Client 389/389；Server 受影响回归 25/25；Client production build 通过 |

证据：`docs/evidence/2026-07-15/admin-pending-empty-state/verification.md`

## 2026-07-15：Phase 0 CI 与 Migration 基线

| 验收项 | 结果 |
|---|---|
| Supabase 本地 config 存在且仅含本地 project ID/回调 | ✅ |
| GitHub Actions 最小只读权限、SHA 固定、无 secrets/部署/DB 写入 | ✅ 静态门禁 |
| linked Migration local/remote history | ✅ 15/15 完全一致 |
| Client / Server 全量测试 | ✅ 400/400；571/571 |
| 双端 typecheck / production build | ✅ |
| production / full dependency audit | ✅ 0 vulnerabilities |
| GitHub Actions 线上运行 | ✅ `29403089055` 全部步骤通过 |
| staging 从零 Migration 重放 | ⚠️ staging 尚未创建，未执行 |

证据：`docs/evidence/2026-07-15/phase0-ci-migration-baseline/verification.md`
