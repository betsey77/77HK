# 收藏平台同步、管理员检索与支付宝跳转去等待

## 目标

在既有项目上完成以下三个已授权的小范围改动；不得重构、不得删除现有功能、不得修改支付安全边界、不得做数据库迁移或 RLS 修改。

## 必读

1. `README.md`
2. `CLAUDE.md`
3. `spec/PRD.md`、`spec/SDD.md`、`spec/TEST_PLAN.md`
4. `.planning/status.md`、`.planning/context_pack.md`
5. `docs/design-system.md`

项目根目录：`D:\work\77港话通社媒文案\77`

## 严格边界

- 不改支付订单创建、签名、notify/webhook、幂等、回跳校验、Supabase RLS、migration、环境变量、密钥或部署配置。
- 不触碰左侧工作台折叠页（该需求已延期）。
- 不删除/重置用户已有改动，也不运行 git reset/checkout/clean/stash/rebase/commit/push/worktree。
- 现有收藏正文仍只能在管理员点击详情后、审计日志写入成功后读取；管理员列表与检索不得读取或返回正文。
- 客户端收藏修改要走既有 `/api/sync/favorites` upsert 与 owner RLS，不能引入管理端写操作。

## A. 收藏库：可编辑发布平台，并同步到管理员

### 需求

1. 用户在 `FavoritesPanel` 的每一条收藏内可编辑“发布平台”。
2. 该字段是**收藏条目的快照元信息**，不能改动当前工作台全局的生成平台，也不能影响原文/评分/备注。
3. 变更后立即更新本地收藏，并通过既有 cloud sync upsert 同步到 Supabase；刷新、重新登录后仍保留。
4. 新增收藏时，默认平台应优先为该收藏变体的 `variantKey`，而不是全局 `all`；已有旧收藏如果 snapshot `platform === 'all'`，管理员和用户编辑器应以 `variantKey` 作为展示/初始回退，避免再显示“全部平台”。
5. 可以在 `settings` JSON 增加 `publishPlatform`（或语义等价的收藏专属字段）；不要覆写 `settings.platform` 的历史生成参数。所有允许的平台/变体显示沿用项目现有中文显示词：标准繁中、轻粤语、IG、Facebook、Shorts、全部平台。
6. 编辑控件遵守当前组件规范（紧凑、小尺寸、浅色橙色/深色荧光绿）。需有标签、可键盘操作、可访问文本。

### 建议涉及文件（按实际最小改动）

- `client/src/types/index.ts`
- `client/src/context/AppContext.tsx`
- `client/src/components/favorites/FavoritesPanel.tsx`
- `client/src/components/results/BookmarkButton.tsx`
- `client/src/services/cloudSync.ts`
- `server/src/services/adminService.ts`

## B. 管理员收藏页：默认实际平台、高亮和标签中文化

1. 管理员收藏列表与详情的“平台”优先显示该收藏 `publishPlatform`；旧数据则：若保存的平台不是 `all` 就显示它，否则显示 `variantKey`。不能默认显示“全部平台”。
2. 列表的“类型 / 平台”信息应清晰可见且保持已有中文格式；详情摘要的“平台”也同样显示。
3. 标签不得展示英文 key。将现有 `reasonTags`（hook/tone/cta/rhythm/emoji/brand/creative/audience）完全映射成中文：
   - hook → 开场吸睛
   - tone → 语气贴地
   - cta → 行动引导有力
   - rhythm → 句式节奏好
   - emoji → 表情自然
   - brand → 品牌调性匹配
   - creative → 创意突出
   - audience → 适合目标受众
   对未知 tag 显示“自定义标签”，不要原样显示英文 key。不要影响原始 DB 值和搜索。
4. 在管理员收藏表格中使用现有的轻量 Badge/强调色，使“平台”显眼但不要造成大面积高亮或改变视觉体系。
5. `adminDisplayLabels.ts` 仅用于 UI 显示，API/数据库枚举和值保持不变。

## C. 管理员收藏检索

1. 只在“用户收藏”标签提供一个紧凑检索框与“搜索/清除”操作。支持品牌、产品、文案类型、发布平台、收藏原因、备注和标签等元信息筛选。
2. 输入检索后重置收藏页码到第 1 页，服务端返回筛选后的总数并正确分页；清除后恢复完整列表。
3. 管理员列表检索只能筛选元数据，严禁在列表 API 查询、返回或前端缓存收藏正文；正文继续仅由已有详情接口在审计成功后读取。
4. 服务端对 `q` 做 `trim`、最大 80 字符和 PostgREST 特殊字符安全处理；不得将 `q` 拼接成不受控数据库表达式。使用显式可列出的元数据字段，不使用 `select('*')`。
5. 仍由既有 `requireAuth` + `requireAdmin` 保护；不新增管理端写接口。

### 建议涉及文件

- `server/src/routes/admin.ts`
- `server/src/services/adminService.ts`
- `client/src/services/api.ts`
- `client/src/pages/AdminPage.tsx`
- `client/src/utils/adminDisplayLabels.ts`

## D. 支付跳转去掉人为等待

1. `client/src/pages/BillingPage.tsx` 当前在服务端 checkout 成功后存在 `setTimeout(..., 1500)` 才跳转 `result.redirectUrl`。删除这个人为 1.5 秒等待，收到成功响应后立即跳转。
2. 保留“正在创建订单”状态、失败提示、按钮防重复点击及所有服务端支付/校验逻辑。
3. 不改变 endpoint 或 `redirectUrl` 的来源；订单创建完毕前绝不导航。

## 测试（先补/更新测试，后实现）

至少新增或更新覆盖：

1. 收藏平台更新不会改全局 AppSettings，且会进入 `SyncFavoriteRequest.settings.publishPlatform`。
2. 新收藏默认发布平台为变体；旧收藏的 `platform=all` 显示/管理员回退到变体。
3. 管理员列表和详情显示中文平台、中文标签，未知 tag 不泄露英文 key。
4. 管理员检索把 `q` 编码传给 `/api/admin/favorites`；搜索/清除重置分页。
5. 服务端管理员收藏检索只选元数据、规范化 q，不读取 `content`；检索分页 total 一致。
6. 支付 checkout 成功后**不再**依赖 1500ms timeout；只要 response 成功就立即使用服务器给出的 `redirectUrl`。
7. 现有管理端详情“先写审计，后读正文”测试和普通管理员权限测试仍通过。

## 交付要求

1. 写一份 `docs/evidence/2026-07-14/favorite-platform-admin-search/notes.md`，记录实际修改、测试命令、通过结果、已知限制。
2. 更新 `.planning/status.md`、`.planning/progress.md`、`.planning/task_plan.md`、`spec/CHANGELOG.md`，注明本次只完成上述范围；不要将延期的左侧折叠页标完成。
3. 运行并报告：
   - `cd client && npx tsc --noEmit && npm test -- --run`（若完整测试过慢，可先跑相关测试，之后必须说明）
   - `cd client && npm run build`
   - `cd server && npx tsc --noEmit && npm test -- --run && npm run build`
4. 最终只报告：改动文件、测试结果、未完成项；不要创建 git 提交或推送。
