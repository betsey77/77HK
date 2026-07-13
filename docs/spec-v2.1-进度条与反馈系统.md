# 📊 进度条与反馈系统 — 产品规格书 V2.1

> 撰写日期：2026-07-10
> 关联文档：`comprehensive-spec-v2.md` § P2.10（收藏库 + 用户偏好学习）、§ P2.11（正例文案参考）
> 功能状态：📋 待开发

---

## 目录

1. [系统定位](#一系统定位)
2. [生成进度条](#二生成进度条-generation-progress-bar)
3. [用户偏好档案](#三用户偏好档案-user-preference-profile)
4. [正例反馈系统](#四正例反馈系统-positive-example-feedback)
5. [反馈闭环工作流](#五反馈闭环工作流)
6. [数据结构全览](#六数据结构全览)
7. [实施路线图](#七实施路线图)

---

## 一、系统定位

### 1.1 一句话定位

> **反馈系统**让「港话社媒文案器」从一个「一次性生成工具」升级为「随使用越来越懂你」的 AI 文案伙伴。

### 1.2 核心理念

传统 AI 文案工具：
```
输入 → 生成 → 复制/丢弃 → 再输入 → 再生成 → ...
        ↑ 每次都是全新开始，无记忆
```

V2.1 反馈系统：
```
输入 → 生成 → 收藏 + 评价 → 用户偏好档案更新
        ↓                                ↓
  下次生成前 ← 正例参考注入 ← 偏好引导 ←┘
        ↓
  越来越贴近用户的审美标准
```

### 1.3 三个子系统

| 子系统 | 负责 | 用户感知 |
|--------|------|---------|
| **生成进度条** | 展示生成过程（诊断→生成→审核→反馈），降低等待焦虑 | 「我知道 AI 做到哪了」 |
| **用户偏好档案** | 从收藏行为中学习，聚合用户的风格偏好 | 「AI 越来越懂我」 |
| **正例反馈系统** | 收藏时记录原因，下次可多选优秀案例注入 Prompt | 「我要这种感觉，但写得更好」 |

---

## 二、生成进度条（Generation Progress Bar）

### 2.1 动机

当前生成过程（`uiState === 'loading'`）只显示一个 Spinner + 「生成中，请稍候...」。整个流程大约 5-15 秒，但包含多个步骤，用户在等待中缺乏信息反馈——不知道 AI 做到哪了、是不是卡住了。

### 2.2 生成流程拆解

后端的实际执行顺序：

```
Phase 1: 诊断 (diagnosis)
  └─ 繁简体检查、内地用语检测、合规检查 → ~1-2s

Phase 2: 生成 (generation)
  └─ 调用 LLM 生成 5 个 variant → ~3-8s

Phase 3: 审核 (audit)
  └─ 温度计评分 + 问题检测 + 替换建议 + 风险标注 → ~1-3s

Phase 4: 反馈模拟 (consumer feedback)
  └─ 多 persona 模拟消费者反馈 → ~1-3s
```

### 2.3 UI 设计

**Phase-based 进度条**（代替现有 Spinner）：

```
┌──────────────────────────────────────────┐
│                                          │
│         🎋 正在生成文案...                 │
│                                          │
│  ✅ 诊断完成 ───●─── ○ 生成中 ──── ○ 审核 ──── ○ 反馈  │
│                                          │
│     当前：调用 DeepSeek 生成 5 个版本...    │
│     已耗时：4.2s                          │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │ ████████████░░░░░░░░░░░░░░░░░░░░ │ 55%│
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

**组件规格**（`GenerationProgressBar.tsx`）：

```ts
interface GenerationProgress {
  phase: 'diagnosis' | 'generation' | 'audit' | 'feedback' | 'done';
  /** 0-100 */
  percent: number;
  /** Human-readable description */
  description: string;
  /** Elapsed time in seconds */
  elapsedSeconds: number;
}
```

| Phase | 进度占比 | 默认描述 |
|-------|:-------:|------|
| `diagnosis` | 0-15% | 检查繁体一致性、内地用语... |
| `generation` | 15-70% | 生成 5 个平台变体... |
| `audit` | 70-90% | 审核评分 + 问题检测... |
| `feedback` | 90-100% | 模拟消费者反馈... |
| `done` | 100% | ✅ 生成完成 |

### 2.4 实现方案

由于当前架构是单次 API 调用（一个 `/api/generate` 返回所有结果），进度通过前端模拟实现。

**方案**：前端模拟进度

- 使用 `setTimeout` 模拟进度推进
- 基于平均耗时（诊断 1.5s → 生成 5s → 审核 2s → 反馈 1.5s）分配权重
- 在 `/api/generate` 返回后跳到 100%
- 优点：零后端改动；缺点：进度不精确

> **后续升级**：如果生成时间持续 >20s，升级为 SSE 分步方案（`POST /api/generate/start` + `GET /api/generate/:id/status`）。

### 2.5 涉及文件

| 文件 | 变更 | 描述 |
|------|------|------|
| `client/src/components/results/GenerationProgressBar.tsx` | **新建** | 阶段式进度条 UI |
| `client/src/components/results/ResultsPanel.tsx` | 修改 | 替换 Spinner 为 GenerationProgressBar |
| `client/src/hooks/useGenerationProgress.ts` | **新建** | 前端模拟进度 + 时间追踪 |

---

## 三、用户偏好档案（User Preference Profile）

> 详见 `comprehensive-spec-v2.md` § P2.10 Phase B.2

### 3.1 档案生成

偏好档案从用户的**收藏评价**中自动聚合。只有在 ≥3 条已评价收藏后才开始生成——样本量不足时显示引导提示：「继续收藏以训练 AI 了解你的偏好」。

### 3.2 档案结构

```ts
interface UserPreferenceProfile {
  updatedAt: string;
  sampleSize: number;

  // 频率分析
  topTags: string[];            // 最常见的 3 个原因标签
  tagDistribution: Record<string, number>;  // 所有标签的频率分布

  // 均值分析
  avgRating: number;
  avgCantoneseLevel: number;
  avgEnglishMixingLevel: number;
  avgCreativityLevel: number;

  // 模态分析
  preferredTone?: BrandTone;    // 最常用的品牌语气
  topPlatform: Platform;        // 最常生成的平台

  // 内容分析（从 variantMeta 和文案内容提取）
  preferredHookTypes: string[];  // 用户评分最高的 Hook 类型
  avgEmojiDensity: number;       // 高评分文案的平均 Emoji 密度
  preferredCtaStyles: string[];  // 用户评分最高的 CTA 风格

  // 正例参考
  topReferenceExemplarIds: string[]; // 被标记为「正例」最多的收藏 ID
}
```

### 3.3 偏好展示

**位置**：InputPanel 顶部或侧边，非阻塞信息条：

```
┌──────────────────────────────────────────┐
│ 🎯 AI 知道你的偏好（基于 5 条收藏）         │
│ 语气偏活泼 · 粤语 Lv.3 · 喜欢反問式hook    │
│ [查看详情]  [重置偏好]                     │
└──────────────────────────────────────────┘
```

### 3.4 Prompt 注入

当偏好档案存在时，在 Prompt Layer 3 注入：

```
## 🎯 用戶偏好參考（基於過往 {sampleSize} 條收藏分析）

用戶傾向於：
- 語氣：{preferredTone}（{usagePercent}% 的收藏使用此語氣）
- 粵語程度：平均 {avgCantoneseLevel}/5
- Hook 偏好：{topHookTypes}
- CTA 偏好：{topCtaStyles}

請在生成時優先考慮以上偏好，但唔好犧牲文案質量同品牌適配性。
如果當前設定（語氣/粵語程度等）同偏好有明顯差距，可以適度調整。
```

---

## 四、正例反馈系统（Positive Example Feedback）

### 4.1 动机

当前的「生成 → 收藏」是单向的：收藏只是一条记录，不会反过来影响后续生成。

正例反馈系统的目标是建立**双向学习闭环**：
- 用户收藏 + 评价 → 告诉系统「这条好，好在哪里」
- 下次生成 → 系统引用之前的正例作为 Few-Shot 参考
- 用户再评价 → 系统继续学习，越来越精准

### 4.2 收藏评价流程

```
用户点击 ☆ 收藏
    ↓
弹出评价面板（非阻塞，可跳过）
    ↓
┌──────────────────────────┐
│ ⭐ 评价这条文案            │
│                          │
│ 评分：☆☆☆☆☆  [选 1-5]    │
│                          │
│ 为什么好？（可多选）        │
│ ☐ hook 吸睛              │
│ ☐ 语气贴地               │
│ ☐ CTA 有力               │
│ ☐ 句式节奏好              │
│ ☐ emoji 自然             │
│ ☐ 品牌调性匹配            │
│ ☐ 创意突出               │
│ ☐ 适合目标受众            │
│                          │
│ 自定义原因：               │
│ [____________________]   │
│                          │
│ [储存]  [跳过，仅收藏]     │
└──────────────────────────┘
```

### 4.2a 收藏卡复制按钮 🆕

> 实施状态：✅ 已实现（2026-07-10）

每条收藏卡片的右上角操作区新增**复制按钮**（📋 Copy 图标），一键复制该收藏文案的完整内容到剪贴板。

**位置**：BookmarkCard 右上角操作按钮区，位于「载入参数」按钮左侧：

```
┌──────────────────────────────────────────┐
│ [IG]  7月10日 14:30      [📋][🔗][🗑]    │  ← 📋=复制, 🔗=载入参数, 🗑=删除
│                                          │
│ 「是但問個港島人，中秋必買嘅...」          │
│                                          │
│ ⭐⭐⭐⭐⭐ 5/5 · hook吸睛 · 语气贴地       │
└──────────────────────────────────────────┘
```

**交互细节**：
- 点击 📋 → 文案复制到剪贴板 → 图标切换为 ✅（绿色）2 秒 → 恢复 📋
- 失败回退：使用 `document.execCommand('copy')` 兼容旧浏览器
- Footer 提示更新为：`点击 📋 复制文案 · 点击 ⭐ 评分 · 点击 🔗 载入参数`

### 4.2b 收藏卡打分系统 🆕

> 实施状态：✅ 已实现（2026-07-10）

每条收藏卡片新增可折叠的**评价区域**，包含星级评分、原因标签、自定义原因三个组件。

**状态 A — 未评分（折叠）**：

```
⭐ 点击评分，帮助 AI 学习你的偏好    ← 可点击展开
```

**状态 B — 已评分（折叠摘要）**：

```
⭐⭐⭐⭐⭐ · hook吸睛 · 语气贴地 · CTA有力  （点击编辑评价）
```

**状态 C — 展开评价面板**：

```
┌──────────────────────────────────────────┐
│ 评分                              [收起 ▲] │
│ ☆☆☆☆☆  (1-5 可点击切换)        4/5       │
│                                          │
│ 这条文案好在哪？（可多选）                  │
│ [✓ hook吸睛] [✓ 语气贴地] [CTA有力]       │
│ [emoji自然] [品牌调性匹配] [创意突出]      │
│ [句式节奏好] [✓ 适合目标受众]              │
│                                          │
│ 自定义原因：[________________]            │
└──────────────────────────────────────────┘
```

**评分存储**：

星级、原因标签、自定义原因均**实时保存**（每次点击/输入立即 dispatch + persist 到 localStorage）。无需额外「储存」按钮。评分后可随时收起面板。

**数据结构**（`BookmarkedCopy` 扩展字段）：

```ts
interface BookmarkedCopy {
  // ... Phase A 字段 ...
  rating?: number;               // 1-5 星级
  favoriteReason?: string;       // 自定义文字原因
  reasonTags?: string[];         // 结构化标签 key，如 ['hook', 'tone', 'cta']
}
```

**预定义原因标签**（`REASON_TAGS`）：

| key | label | description |
|-----|-------|-------------|
| `hook` | hook 吸睛 | 开头能立刻吸引注意力 |
| `tone` | 语气贴地 | 语气自然，像真人聊天 |
| `cta` | CTA 有力 | 行动号召明确且有说服力 |
| `rhythm` | 句式节奏好 | 长短句搭配舒服，读起来流畅 |
| `emoji` | emoji 自然 | 表情使用恰到好处，不做作 |
| `brand` | 品牌调性匹配 | 符合品牌定位和风格 |
| `creative` | 创意突出 | 有令人印象深刻的创意点 |
| `audience` | 适合目标受众 | 目标受众会有共鸣 |

**AppContext 新增 Action**：

```ts
| { type: 'UPDATE_BOOKMARK_RATING'; payload: { id: string; rating?: number; favoriteReason?: string; reasonTags?: string[] } }
```

**涉及文件**：

| 文件 | 变更 | 描述 |
|------|------|------|
| `client/src/types/index.ts` | 修改 | +`rating`, `favoriteReason`, `reasonTags` 到 `BookmarkedCopy`；+`REASON_TAGS` 常量；+`UPDATE_BOOKMARK_RATING` action |
| `client/src/context/AppContext.tsx` | 修改 | +`UPDATE_BOOKMARK_RATING` reducer case |
| `client/src/components/favorites/FavoritesPanel.tsx` | 重写 | +复制按钮（📋）+ 星级评分 + 原因标签 chips + 自定义原因输入 |

### 4.3 正例注入 Prompt（多选机制）

在下一次生成时，用户可以在 InputPanel 的「📌 参考收藏案例」区域**多选**之前的高分收藏：

```
┌─────────────────────────────────────────┐
│ 📌 参考收藏案例 (可选)     [展开/折叠]     │
│ 基于你的收藏评价，AI 将学习你的偏好        │
│                                         │
│ 最近高分收藏：                            │
│ ☑ 美心月餅 · IG · ★5                     │
│    「hook超吸睛，開頭即刻想睇落去」         │
│ ☐ 奇華 · FB · ★4                        │
│ ☑ 榮華 · IG · ★5                        │
│                                         │
│ 已选 2 条 · 将作为正例注入 Prompt         │
└─────────────────────────────────────────┘
```

**注入规则**：

| 规则 | 说明 |
|------|------|
| 最大选择数 | 3 条（防止 Prompt 膨胀） |
| 排序 | 按 rating 降序，同 rating 按时间倒序 |
| 最低 rating | 只显示 ≥★4 的收藏（低于此的不作为正例） |
| 过滤 | 自动排除与当前 platform 不匹配的收藏（可选关闭） |
| Prompt 注入位置 | Layer 3 (Contextual)，在「正例文案参考」(P2.11) 之后 |

**Prompt 注入格式**：

```
## 📌 用戶收藏嘅正例案例（Few-Shot 個人化參考）

以下係用戶過往收藏嘅高分文案，請分析佢哋嘅技法，
並將相同水準嘅表達融入新文案——**學技法，唔好抄內容**：

### 正例 1（★5 · 2026-07-05 · IG）
> 「是但問個港島人，中秋必買嘅餅舖係？留言話我知👇」

**用戶評價**：hook 超吸睛，開頭即刻想睇落去；語氣似朋友傾偈好自然
**技法標籤**：hook吸睛、語氣貼地、互動引導
**技法提取**：
- Hook：反問式開頭 → 即刻製造好奇心
- 句式：短句 + 口語節奏
- CTA：直接要求留言，零摩擦
- Emoji：1 個（👇），精準用於引導行動

### 正例 2（★5 · 2026-07-08 · IG）
> ...

---
**生成時請優先對齊以上正例嘅技法質素，特別係用戶重視嘅：
- hook吸睛（反問式/個人經驗式開頭）
- 語氣貼地（口語化、唔好太正式）**
```

### 4.4 正例与竞品正例的区别

| 维度 | 正例反馈（P2.10 Phase B） | 竞品正例参考（P2.11） |
|------|--------------------------|----------------------|
| **来源** | 用户自己收藏的历史生成结果 | 用户手动粘贴的竞品/外部文案 |
| **目的** | 「我要像上次那样写」 | 「我要像竞品那样写，但更好」 |
| **评价** | 自带用户评分和原因标签 | 无评分（外部文案） |
| **信任度** | 高（自己选的） | 中（外部参考） |
| **注入权重** | 高（用户偏好对齐） | 中（技法参考） |

两者**互补而非替代**——正例反馈建立个人风格档案，竞品正例提供行业标杆。

---

## 五、反馈闭环工作流

### 5.1 完整闭环图

```
┌─────────────────────────────────────────────────────────┐
│                    反馈闭环全景                           │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ 1. 输入   │───▶│ 2. 生成   │───▶│ 3. 审核   │          │
│  │ 原文+参数  │    │ +进度条   │    │ 评分+问题  │          │
│  └──────────┘    └──────────┘    └──────────┘          │
│        ▲                                │               │
│        │                                ▼               │
│        │                         ┌──────────┐          │
│        │                         │ 4. 结果   │          │
│        │                         │ 5 variants│          │
│        │                         └──────────┘          │
│        │                              │                 │
│        │                    ┌─────────┴─────────┐      │
│        │                    ▼                   ▼      │
│        │             ┌──────────┐        ┌──────────┐  │
│        │             │ 5a. 收藏  │        │ 5b. 修改  │  │
│        │             │ + 评价    │        │ + 重新审核 │  │
│        │             └──────────┘        └──────────┘  │
│        │                  │                             │
│        │                  ▼                             │
│        │           ┌──────────────┐                    │
│        │           │ 6. 偏好档案   │                    │
│        │           │ 自动更新      │                    │
│        │           └──────────────┘                    │
│        │                  │                             │
│        │     ┌────────────┴────────────┐               │
│        │     ▼                         ▼               │
│        │  ┌────────────┐        ┌────────────┐        │
│        │  │ 6a. 偏好引导│        │ 6b. 正例注入│        │
│        │  │ Prompt 软性 │        │ 收藏案例    │        │
│        │  │ 风格对齐    │        │ Few-Shot    │        │
│        │  └────────────┘        └────────────┘        │
│        │     │                         │               │
│        │     └──────────┬──────────────┘               │
│        │                ▼                              │
│        └──────── 下次生成时自动注入 ────────────────────┘
│                                                         │
│  附加输入（每次可选）：                                    │
│  - P2.11 竞品正例参考（手动粘贴外部文案）                   │
│  - P2.11 正例文案作为额外技术参考                          │
└─────────────────────────────────────────────────────────┘
```

### 5.2 用户故事

**第一周**：
> 「我买了一款月饼，用『港话社媒文案器』写了第一条 IG 文案。挺不错，收藏了，打了个 ★4，选了『语气贴地』标签。」

**第二周**：
> 「又要写中秋文案了。这次我看到 InputPanel 上有个小提示：🎯 AI 知道你的偏好（基于 3 条收藏）——语气偏活泼 · 粤语 Lv.3。我勾选了上周收藏的两条文案作为参考，然后生成——出来的效果明显更接近我想要的感觉。」

**一个月后**：
> 「AI 已经很懂我的品牌风格了。我现在几乎不用调参数，直接输入原文，勾上几条收藏案例，出来的文案就很对味。偶尔改几个词就能出街。」

---

## 六、数据结构全览

### 6.1 新增/扩展类型

```ts
// ==========================================
// BookmarkedCopy 扩展（P2.10 Phase B）
// ==========================================

interface BookmarkedCopy {
  // Phase A 字段（已实现）
  id: string;
  savedAt: string;
  variantKey: VariantKey;
  content: string;
  source: string;
  settings: AppSettings;
  variantMeta?: VariantMeta | null;
  scores?: GenerateResponse['scores'] | null;
  consumerFeedback?: ConsumerFeedback[] | null;
  notes?: string;

  // Phase B 新增
  rating?: number;               // 1-5
  favoriteReason?: string;       // 自定义文字
  reasonTags?: string[];         // ['hook吸睛', '语气贴地', 'CTA有力', ...]
}

// ==========================================
// 用户偏好档案
// ==========================================

interface UserPreferenceProfile {
  updatedAt: string;
  sampleSize: number;

  topTags: string[];
  tagDistribution: Record<string, number>;

  avgRating: number;
  avgCantoneseLevel: number;
  avgEnglishMixingLevel: number;
  avgCreativityLevel: number;

  preferredTone?: BrandTone;
  topPlatform: Platform;

  preferredHookTypes: string[];
  avgEmojiDensity: number;
  preferredCtaStyles: string[];

  topReferenceExemplarIds: string[];
}

// ==========================================
// 生成进度
// ==========================================

interface GenerationProgress {
  phase: 'diagnosis' | 'generation' | 'audit' | 'feedback' | 'done';
  percent: number;
  description: string;
  elapsedSeconds: number;
}

// ==========================================
// 正例反馈标签（预定义原因标签）
// ==========================================

const REASON_TAGS = [
  { key: 'hook', label: 'hook 吸睛', description: '开头能立刻吸引注意力' },
  { key: 'tone', label: '语气贴地', description: '语气自然，像真人聊天' },
  { key: 'cta', label: 'CTA 有力', description: '行动号召明确且有说服力' },
  { key: 'rhythm', label: '句式节奏好', description: '长短句搭配舒服，读起来流畅' },
  { key: 'emoji', label: 'emoji 自然', description: '表情使用恰到好处，不做作' },
  { key: 'brand', label: '品牌调性匹配', description: '符合品牌定位和风格' },
  { key: 'creative', label: '创意突出', description: '有令人印象深刻的创意点' },
  { key: 'audience', label: '适合目标受众', description: '目标受众会有共鸣' },
] as const;

// ==========================================
// AppSettings 扩展
// ==========================================

interface AppSettings {
  // ... existing fields ...
  /** P2.10 Phase B: Selected bookmark IDs for few-shot injection */
  selectedReferenceCaseIds?: string[];
}

// ==========================================
// Actions 扩展
// ==========================================

type AppAction =
  // ... existing actions ...
  | { type: 'UPDATE_BOOKMARK_RATING'; payload: { id: string; rating: number; favoriteReason?: string; reasonTags?: string[] } }
  | { type: 'SET_SELECTED_REFERENCE_CASES'; payload: string[] }
  | { type: 'UPDATE_PREFERENCE_PROFILE'; payload: UserPreferenceProfile }
  | { type: 'RESET_PREFERENCE_PROFILE' };
```

### 6.2 localStorage Keys

| Key | 存储内容 | 引入版本 |
|-----|---------|---------|
| `hk-cantonese-bookmarks` | `BookmarkedCopy[]` | P2.10 Phase A |
| `hk-cantonese-preference-profile` | `UserPreferenceProfile` | P2.10 Phase B |
| `hk-cantonese-settings` | `{ settings: AppSettings }` | P1 |
| `hk-cantonese-configs` | `SavedConfig[]` | P1 |

---

## 七、实施路线图

### 7.1 分步实施

| 步骤 | 内容 | 优先级 | 依赖 | 预估 | 状态 |
|------|------|:------:|------|:----:|:----:|
| **F1** | 生成进度条（前端模拟） | ★★★ | 无 | 0.5 天 | 📋 |
| **F2** | 收藏评价面板（星级 + 标签）+ 复制按钮 | ★★★ | P2.10 基本收藏 | 0.5 天 | ✅ |
| **F3** | 用户偏好档案计算 + 展示 | ★★ | F2 | 0.5 天 | 📋 |
| **F4** | 偏好 Prompt 注入（软性引导） | ★★ | F3 | 0.5 天 | 📋 |
| **F5** | 正例反馈多选 + Prompt 注入 | ★★★ | F2 | 1 天 | ✅ |
| **F6** | 偏好档案自动更新 + 重置 | ★ | F3 | 0.5 天 | 📋 |

### 7.2 优先级矩阵

```
影响大
  │  F5 正例注入    F2 收藏评价
  │  F3 偏好档案
  │  F4 偏好Prompt  F1 进度条
  │                 F6 自动更新
  └──────────────────────────→ 成本
```

> **建议实施顺序**：F1 → F2 → F5（核心闭环）→ F3 → F4 → F6（锦上添花）

### 7.3 与已有功能的集成点

| 已有功能 | 集成方式 |
|---------|---------|
| **P2.10 收藏库** | 评价面板嵌入收藏库 + ResultCard |
| **P2.11 正例文案参考** | 竞品正例（外部）与 收藏正例（内部）分层注入 Prompt |
| **InputPanel** | +偏好摘要条 + 参考案例多选区 |
| **ResultsPanel** | 替换 Spinner 为 GenerationProgressBar |

---

> **下一步**：确认 F1-F6 的优先级排序，然后开始实施。
