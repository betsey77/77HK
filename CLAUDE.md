# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**本项目继承 `D:\vibecoding\claude\CLAUDE.md` 中的全部行为准则。** 遇到此处未覆盖的问题时，以上级文档为准。

## 2026-07-11 SaaS 交接入口

本仓库 `D:\work\77港话通社媒文案\77` 是唯一开发基线。不要把父目录的 `总览`、`dashboard` 或 `登录页` 另建成主产品。

开始任何新切片前依次读取：

1. `.planning/status.md`
2. `.planning/context_pack.md`
3. `spec/PRD.md`
4. `spec/SDD.md`
5. `spec/TEST_PLAN.md`
6. `D:\work\77港话通社媒文案\项目管理\03-ClaudeCode-第一阶段执行单.md`
7. `D:\work\77港话通社媒文案\开发日志\02-PRD-77港话通社媒文案器-SaaS.md`（完整 SaaS 产品需求）
8. `D:\work\77港话通社媒文案\开发日志\03-SPEC-77港话通社媒文案器-SaaS.md`（完整 SaaS 技术规格）
9. `docs/comprehensive-spec-v2.md`（文案生成工作台的领域权威规格）

交接文档和 `.planning` 文件只是执行摘要与当前状态索引，不能替代上述完整 PRD/SPEC。发生冲突时：用户最新确认 > `spec/PRD.md` > `spec/SDD.md` > 父目录完整 SaaS PRD/SPEC > `docs/comprehensive-spec-v2.md` > 旧参考方案；代码和 evidence 只用于判断“实际完成到哪里”，不能反向覆盖未实现的产品需求。

Slice A（正式路由 + 登录/注册 Mock 壳）已经完成并通过二次独立复测。当前下一切片是 Slice B：真实 Supabase Auth + `profiles/roles` + RLS + 邮箱确认流程。开始前必须获得用户对 Supabase 项目连接和数据库迁移的明确授权；未授权时只允许做方案、迁移草案和测试设计，不得连接或写入远端数据库。

高风险门禁：安装依赖、Supabase 项目连接、数据库迁移、支付宝、权限变更和部署都必须先向用户说明并获得明确同意。

---

## Commands

```bash
# 同时启动前后端（推荐开发模式）
npm run dev              # concurrently: client :5173 + server :3001

# 单独启动
npm run dev:client       # Vite dev server → localhost:5173
npm run dev:server       # tsx watch → localhost:3001 (auto-reload)

# 类型检查
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit

# 生产构建
npm run build            # client: tsc -b && vite build → dist/; server: tsc → dist/
```

---

## Architecture

```
思念 (monorepo root)
├── client/              React 19 + TypeScript 5.7 + Tailwind v4
│   └── vite.config.ts   Vite 6 — /api 代理到 localhost:3001
├── server/              Express 5 + tsx watch + OpenAI SDK
│   └── .env             所有 API Key 和配置
└── docs/                产品规格书
```

### Three-panel layout

```
┌─────────────┬──────────────────────┬──────────────┐
│ InputPanel  │ ResultsPanel         │ AuditPanel   │
│ (left 30%)  │ + InspirationPanel   │ (right 30%)  │
│             │ (center, flex)       │              │
└─────────────┴──────────────────────┴──────────────┘
```

### Client state management

Single `useReducer` via React Context (`AppContext.tsx`). All persisted to localStorage:

| localStorage key | Content |
|------------------|---------|
| `hk-cantonese-settings` | `AppSettings` |
| `hk-cantonese-configs` | `SavedConfig[]` |
| `hk-cantonese-bookmarks` | `BookmarkedCopy[]` |
| `hk-cantonese-theme` | `'dark'` / `'light'` |

**Never** introduce additional state libraries. Keep everything in the reducer.

### AI engine fallback chain (server-side)

```
POST /api/generate
  ├─ 1. CantoneseLLM (self-hosted 4B via CANTONESE_API_URL) — 15s timeout
  │     └─ fail → 2. DeepSeek (via DEEPSEEK_API_KEY) — 25s timeout
  │           └─ fail → 3. Rules engine (fallbackService.ts, pure local)
  ├─ 2. Audit      (DeepSeek, 25s timeout, parallel with step 3+4)
  ├─ 3. Source scoring (DeepSeek, 8s timeout, parallel)
  └─ 4. Consumer feedback (DeepSeek, 35s timeout, parallel)
```

If DeepSeek generation scores Cantonese naturalness < 3/5, it auto-retries once and keeps the better result.

### API routes (all under `/api`)

| Route | File | Purpose |
|-------|------|---------|
| `POST /generate` | `routes/generate.ts` | Main generation + audit + consumer feedback |
| `POST /modify` | `routes/modify.ts` | Apply consumer suggestion to variant |
| `POST /parse-personas` | `routes/parsePersonas.ts` | AI parse free-text persona descriptions |
| `POST /quick-check` | `routes/quickCheck.ts` | Local rule engine (6 checks, no AI) |
| `GET /calendar` | `routes/calendar.ts` | HK topic calendar events |
| `POST /inspiration/language-vibe` | `routes/inspiration.ts` | YT trending + search for HK content |
| `POST /inspiration/hot-trends` | `routes/inspiration.ts` | YT trending + hot topic search |
| `POST /competitor/search` | `routes/competitor.ts` | Meta Ad Library (falls back to demo data) |
| `GET /health` | `app.ts` | Engine status, key configuration |
| `GET /connectivity` | `app.ts` | External API reachability test |

### Prompt architecture (5-layer)

```
Layer 0: System Identity (固定, ~20 lines)
Layer 1: Compliance & Safety (固定, ~80 lines)
Layer 2: Writing Framework (固定, ~60 lines) — So What + JTBD Value Prop
Layer 3: Contextual (动态, ~80 lines) — Writing Brief + Few-shot + 正例
Layer 4: Generation Params (动态, ~60 lines) — Platform + Tone + Creativity
Layer 5: Output Format (固定, ~30 lines) — JSON schema
```

All prompt building in `server/src/prompts/diagnoseGenerate.ts`.

### Client component conventions

- All UI in `client/src/components/`, grouped by domain: `input/`, `results/`, `audit/`, `inspiration/`, `favorites/`, `layout/`, `shared/`
- `shared/` contains generic primitives: `Tabs`, `Slider`, `Spinner`, `SegmentedControl`, `Badge`, `Tooltip`
- Hooks: `client/src/hooks/useGenerate.ts` (the only hook; generation logic)
- API calls: `client/src/services/api.ts` (thin fetch wrappers)
- Types shared between client and server are duplicated — client types in `client/src/types/index.ts`, server types in `server/src/types/index.ts`

---

## Key conventions

### Proxy / network (China users)

YouTube API and Facebook are blocked in mainland China. The server uses `proxyFetch()` from `server/src/services/proxyFetch.ts` which respects `HTTPS_PROXY`/`HTTP_PROXY` env vars. Set them in `.env` if behind a firewall. System-level VPN does NOT need proxy settings.

### Competitor search

Uses a layered strategy:
1. Facebook GraphQL Ad Library (needs browser context — server-side fails)
2. Meta Graph API `ads_archive` (needs `META_ACCESS_TOKEN` in `.env`)
3. Demo data fallback (8 HK brands with realistic ad templates)

All competitor logic is in `server/src/services/competitorService.ts`.

### Inspiration panel

Currently uses YouTube Data API v3 exclusively (no IG scraping — IG blocks server-side requests). `regionCode=HK`, `relevanceLanguage=zh-HK`, `chart=mostPopular`.

### TypeScript strictness

Server uses `~5.7.2`. Client uses the exact same version. Always run `npx tsc --noEmit` after type changes. Keep client and server types consistent manually.

---

## Current status (updated 2026-07-11)

### ✅ Completed
- 官网 `/` 第二版与匿名工作台 `/app` 分流；官网已按工作台设计系统重做并完成多宽度构建验收
- 收藏功能 Phase A — BookmarkButton + FavoritesPanel + localStorage 持久化 + 载入参数回 InputPanel
- 收藏评价系统（Phase B）— 星级 + 原因标签 + 自定义原因 + 正例注入 Prompt Layer 3
- Reference Case 注入 — 用户手动勾选 ≥★4 收藏，最多 3 个，评价内容（星级/标签/原因）一并注入
- 一键复制按钮 — CopyButton，5 个变体各行独立复制
- Diff 标红修复 — `SET_RE_EVALUATION` 清空 `modifiedVariants`，重新评分不再丢失标红
- UTF-8 乱码修复 — `ConsumerFeedback.tsx` 中 ~8 处乱码字符串修正

### 🔧 技术债 / 已知限制
- **尚无终端运行可视化** — 当前只有 spinner "生成中，请稍候..."，无阶段进度、无 SSE、无耗时显示
- **生成过程对用户是黑箱** — 无 streaming、无 rationale、`<think>` 推理被丢弃、无法查看 raw prompt/response
- **去黑箱方案已记录** → `docs/spec-deblackbox-去黑箱参考方案.md`（5 层，共 ~8-11h，参考用，非强制开发）

### 📋 Pending
- 正式路由、公开邮箱注册/登录、Supabase Auth/RLS、历史、云收藏、额度、支付宝与管理后台
- P2.12: 反馈闭环与偏好学习
- F1-F6: 进度条（SSE）、收藏评价面板、偏好档案、偏好 Prompt 注入、正例反馈多选、偏好自动更新
- RAG 优化: ⏸️ 延后至 Phase 3
- 灵感面板 UX: 默认收起 + max-h 520→300
- 节日事件 + 预设品牌 chips + 日历默认当日

### Architecture notes
- State: single `useReducer` (AppContext.tsx), 4 localStorage keys
- Bookmarks: `hk-cantonese-bookmarks` key, `ADD_BOOKMARK`/`REMOVE_BOOKMARK`/`UPDATE_BOOKMARK_NOTES` actions
- FavoritesPanel: right slide-out overlay, `window.dispatchEvent(new CustomEvent('toggle-favorites'))` to toggle
- Diff baseline: `modifiedVariants` tracks original text per variant; cleared on re-evaluate to reset baseline
- Reference cases: manual selection (not auto), ReferenceCaseSelector shown only when ≥★4 bookmarks exist, max 3
- Prompt 注入：收藏评价内容（星级、原因标签、自定义原因）一并注入 Layer 3，含指令「學技法，唔好抄內容」

## Docs index

| Document | Purpose |
|----------|---------|
| `docs/comprehensive-spec-v2.md` | 权威规格书 — 25 项优化方向, 所有功能设计 |
| `docs/spec-v2.1-进度条与反馈系统.md` | 进度条 + 偏好档案 + 正例反馈 (待开发) |
| `docs/design-system.md` | 🎨 前端设计规范 — 色彩/字体/间距/组件/交互/约定 |
| `docs/RAG优化spec.md` | RAG 检索优化 (⏸️ 延后至 Phase 3) |
| `docs/spec-deblackbox-去黑箱参考方案.md` | 5 层去黑箱方案（参考，非强制开发）— SSE 进度 + rationale + think 回收 + Debug + 港话自然度 |
| `docs/inspiration-design功能设计策略.md` | 4-Tab 灵感面板设计 (已整合入 comprehensive) |
| `docs/optimization-roadmap任务关联到设计文档.md` | 被取代 — 18 项优化方向演进为 25 项 |
| `用户手册/README.md` | 用户操作手册 |

---

## Watch out for

- **不要删除 `.env` 中的 API Key** — 这些是用户配置的真实密钥
- **Competitor search 在无代理时返回 demo 数据** — 这是设计行为，不是 bug。`isDemo: true` 标记
- **灵感面板 default collapsed** — 当前实现会在生成后自动展开。UX 计划要求改为默认收起
- **收藏功能仍有残留的 `crypto.randomUUID()`** — TypeScript 在 DOM lib 下可用，但可能在未来 SSR 场景失败
- **client/server 类型是手动同步的** — 改一边要记得改另一边
- **server 用 Express 5** — API 与 Express 4 不完全兼容（如 `req.body` 解析需手动处理）
- **SET_RE_EVALUATION 必须清空 modifiedVariants** — 否则重新评分后 diff 基线停滞在第一轮，标红永久消失。参见 AppContext.tsx:256-266
- **FavoritesPanel 通过 CustomEvent 通信** — `window.dispatchEvent(new CustomEvent('toggle-favorites'))` 触发开关，不要在组件间直接 import
