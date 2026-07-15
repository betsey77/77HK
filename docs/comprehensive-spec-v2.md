# 🧭 思念文案引擎 — 综合产品规格书 V2

> 撰写日期：2026-06-14 | 最后更新：2026-07-13
> 分析来源：
> - `pm-skills-main`（68 个 PM 技能，9 个插件，42 个链式工作流）
> - 环境已加载技能：`xhs-marketing-strategy`、`marketing-skills:copywriting`、`marketing-skills:copy-editing`、`facebook-ads-library-search`、`hk-cantonese-social-voice` 等
> - 前置文档：`optimization-roadmap任务关联到设计文档.md`、`inspiration-design功能设计策略.md`
>
> 目标：将 pm-skills 方法论 + 旧有优化发现 + 灵感面板设计 整合为一版可执行的完整产品规格
>
> **⚠️ 2026-07-13 开发状态**：Slice F1 支付宝沙箱前置架构已本地完成（Server 408/408、Client 250/250），F1 Migration `20260713000000_slice_f1_payment_sandbox.sql` 已推送并通过远端结构/RLS/权限核验。真实支付宝 sandbox E2E 尚未执行；PAYMENT_MODE 默认 `mock`。所有支付配置、真实交易与生产动作仍需单独授权。详见 `spec/ACCEPTANCE.md`、`spec/CHANGELOG.md`。

---

## 目录

1. [产品定位与 North Star](#一产品定位与-north-star)
2. [pm-skills → 产品功能映射矩阵](#二pm-skills--产品功能映射矩阵)
3. [综合优化方向（18 → 22 项）](#三综合优化方向18--22-项)
4. [分批实施路线图（Phase 0-3 修订版）](#四分批实施路线图phase-0-3-修订版)
5. [灵感参考面板完整设计](#五灵感参考面板完整设计)
6. [Prompt 工程策略](#六prompt-工程策略)
7. [类型系统与 API 设计](#七类型系统与-api-设计)
8. [技术架构决策](#八技术架构决策)
9. [Pre-Mortem 风险分析](#九pre-mortem-风险分析)
10. [附录：参考语料库设计](#十附录参考语料库设计)

---

## 一、产品定位与 North Star

### 1.1 产品一句话定位

> **思念** 是面向香港市场的 AI 社媒文案引擎 —— 不只翻译，而是理解香港人的语感、合规边界和平台规则，将品牌信息转化为真正「讲人话」的粤语社媒内容。

### 1.2 业务游戏分类（North Star Framework）

按照 `north-star-metric` 技能的分类法，本产品属于 **Productivity Game**：

| 维度 | 定义 |
|------|------|
| **游戏类型** | Productivity — 帮助用户高效完成「将品牌信息转化为港式社媒文案」这个任务 |
| **核心价值** | 用户从「需要自己写/翻译/审核」到「AI 生成 + 多维度审核 + 可迭代优化」 |
| **不是** | Attention Game（不靠用户时长）、Transaction Game（不是交易平台） |

### 1.3 North Star Metric

```
NSM: 每周成功发布到社媒平台的文案数量
     (Weekly Published Posts)
```

**为什么选这个**：
- 客户-centric：衡量用户真正获得了可用的产出
- 领先指标：预示用户留存和付费意愿
- 可行动：产品、Prompt、审核、灵感每一个环节都能直接影响这个数字

### 1.4 Input Metrics（3-5 个驱动指标）

| # | Input Metric | 定义 | 当前状态 |
|---|-------------|------|---------|
| 1 | **一次生成满意率** | 生成后无需修改直接采用的文案占比 | ⚠️ 未追踪 |
| 2 | **审核后修改率** | 经过审核+反馈后实际修改的比例 | ⚠️ 未追踪 |
| 3 | **灵感参考使用率** | 用户打开灵感面板并点击「複製表達」的比例 | ❌ 功能未上线 |
| 4 | **竞品检索触发率** | 生成前搜索竞品广告的用户比例 | ❌ 功能未上线 |
| 5 | **平均生成耗时** | 从输入原文到获得满意输出的时间 | ⚠️ 未追踪 |

---

## 二、pm-skills → 产品功能映射矩阵

### 2.1 可直接嵌入产品的技能（Embedded Skills）

这些技能的方法论将被编码到 Prompt、审核逻辑或前端交互中：

| pm-skill | 插件 | 在产品中的嵌入位置 | 对应优化项 |
|----------|------|-------------------|-----------|
| `value-proposition` (6-part JTBD) | pm-product-strategy | Writing Brief 结构（P1.2）→ Who/Why/WhatBefore/How/WhatAfter/Alternatives | 🆕 **S2.1** |
| `value-prop-statements` | pm-marketing-growth | 每个 variant 生成后自动附带 segment-specific value prop | 🆕 **S2.2** |
| `marketing-ideas` | pm-marketing-growth | Creativity L4 的「创意技法」已部分覆盖，可扩展为独立的「创意角度推荐」 | H2-2 扩展 |
| `positioning-ideas` | pm-marketing-growth | 竞品差异化分析（P2.7）→ 生成文案时自动检测与竞品的定位重叠 | H4-2 增强 |
| `competitor-analysis` | pm-market-research | 竞品广告检索（P2.6）+ 结构化 competitor profile | H4-1 |
| `competitive-battlecard` | pm-go-to-market | 审核报告中的「vs 竞品」对比维度 | 🆕 **S2.3** |
| `user-personas` | pm-market-research | ConsumerPersona 系统升级（已有基础） | H3-2 增强 |
| `sentiment-analysis` | pm-market-research | 消费者反馈模拟 → 从「写建议」升级为「情感评分 + 建议」 | H3-2 增强 |
| `customer-journey-map` | pm-market-research | 平台内容模板（P1.3）→ 按用户旅程阶段（Awareness→Consideration→Purchase→Advocacy）定制内容结构 | P1.3 增强 |
| `growth-loops` (5 loop types) | pm-go-to-market | 发布策略（P3.3）→ 识别文案适合哪种增长循环（Viral/Usage/Collaboration/UGC/Referral） | P3.3 增强 |
| `gtm-strategy` | pm-go-to-market | 发布策略（P3.3）→ 渠道选择 + 发布时机 | P3.3 |
| `brainstorm-ideas-existing` | pm-product-discovery | 专家小组评分（P3.2）→ PM/Designer/Engineer 三角色从不同视角评审 | H3-2 |
| `brainstorm-experiments-existing` | pm-product-discovery | A/B 变体策略 → 提示用户「这条文案可以做 A/B 测试的 3 个变量」 | 🆕 **S2.4** |
| `north-star-metric` | pm-marketing-growth | 产品自身的指标体系定义（本文档 Section 1） | — |

### 2.2 用于产品开发流程的技能（Process Skills）

这些技能不嵌入产品，但指导本项目的开发过程：

| pm-skill | 在本项目中的用途 |
|----------|----------------|
| `pre-mortem` | 每个 Phase 启动前做风险分析（见 Section 9） |
| `prioritize-features` | 用 ICE/RICE 排序 22 个优化方向 |
| `create-prd` | 本文档本身就是 PRD |
| `outcome-roadmap` | Phase 0-3 的 outcome-focused 路线图 |
| `strategy-red-team` | 对关键架构决策做对抗性压力测试 |
| `test-scenarios` | 为每个 Phase 编写验收测试场景 |
| `shipping-artifacts` | 项目文档化（architecture, permissions, variables） |
| `intended-vs-implemented` | 审计 Prompt 注入是否真的生效 |

### 2.3 不与项目直接相关的技能

| pm-skill | 原因 |
|----------|------|
| `draft-nda` / `privacy-policy` | 法律文档，产品暂不需要 |
| `review-resume` | 完全无关 |
| `sql-queries` / `cohort-analysis` / `ab-test-analysis` | 暂无数据库/分析基础设施 |
| `ansoff-matrix` / `pestle-analysis` / `porters-five-forces` | 企业战略层，不在产品范围内（但 PESTLE 可部分用于 Phase 0 HK 市场研究） |
| `lean-canvas` / `business-model` / `startup-canvas` | 商业模式设计，当前产品已有清晰方向 |
| `monetization-strategy` / `pricing-strategy` | 定价策略，产品暂无商业化计划 |

---

## 三、综合优化方向（18 → 25 项）

> 标注说明：
> - **H** 编号 = 原有 18 项（来自 optimization-roadmap）
> - **S** 编号 = 新增 4 项（来自 pm-skills 分析）
> - 🆕 = 本次新增

### 3.1 完整方向矩阵（按影响力 × 成本排序）

| # | 优化方向 | 来源 | 影响力 | 成本 | Phase | 依赖 |
|---|---------|------|--------|------|-------|------|
| **H2-2** | Benefit-over-Feature 转化层 (So What 规则) | copywriting | ★★★★★ | 低 | P1 | 无 |
| **H2-1** | 写前结构化简报 (Writing Brief) | copywriting + value-proposition | ★★★★★ | 低 | P1 | 无 |
| **S2.1** 🆕 | 6-part JTBD Value Prop 注入 | value-proposition | ★★★★ | 低 | P1 | 无 |
| **H2-4** | 各变体加备选标题 (altHeadlines) | copywriting | ★★★ | 低 | P1 | 无 |
| **H1-1** | 平台内容结构模板 (5 套 HK 模板) | xhs-strategy + customer-journey-map | ★★★★★ | 中 | P1 | ⚠️ Phase 0 |
| **H4-1** | 竞品广告检索 (Meta Ad Library) | fb-ads-library + competitor-analysis | ★★★★★ | 中 | P2 | 无 |
| **H4-2** | 竞品文案注入 + 差异化分析 | fb-ads-library + positioning-ideas | ★★★★ | 中 | P2 | P2.6 |
| **S2.3** 🆕 | 审核报告增加「vs 竞品」对比维度 | competitive-battlecard | ★★★★ | 中 | P2 | P2.6 |
| **P2.8** | IG Hashtag 热门帖文检索 | 自研 (IG JSON) | ★★★★ | 中 | P2 | 无 |
| **P2.9** | YouTube HK 热门内容检索 | 自研 (YT API) | ★★★ | 低 | P2 | 无 |
| 🆕 **P2.10** | **文案收藏库（Bookmark/Favorites）** | 自研 (localStorage) | ★★★★ | 低 | P2 | 无 |
| 🆕 **P2.11** | **正例文案参考（Reference Exemplar）** | 自研 (Prompt Injection) | ★★★★★ | 低 | P2 | 无 |
| 🆕 **P2.12** | **反馈闭环与偏好学习（Feedback Loop）** | 自研 (localStorage + Prompt) | ★★★★ | 中 | P2-P3 | P2.10 |
| **H3-1** | 七遍编辑法审核扩展 (新增 3 维度) | copy-editing | ★★★★ | 中 | P2 | 无 |
| **H2-3** | CTA 独立评分 | copywriting | ★★★ | 中 | P2 | 无 |
| **H3-3** | 快速规则检查模式 (本地引擎) | copy-editing | ★★★ | 中 | P2 | 无 |
| **H1-4** | 平台层合规扩展 | xhs-strategy | ★★★★ | 中 | P2 | ⚠️ Phase 0 |
| **H3-4** | 内容刷新模式 (Rewrite) | copy-editing | ★★★ | 中 | P2 | 无 |
| **🆕 灵感面板 UI** | 4 Tab 可折叠面板 | inspiration-design | ★★★★ | 高 | P2 | P2.6/8/9 |
| **🆕 目标发布时间字段** | 日期选择器 → 话题日历匹配 | inspiration-design | ★★ | 低 | P2 | 无 |
| **P3.1** | 参考语料库 + RAG 检索 | 自研 + sentiment-analysis | ★★★★ | 高 | P3 | P2.6/8/9 |
| **H3-2** | 专家小组评分 (persona × lens matrix) | copy-editing + brainstorm-ideas | ★★★ | 高 | P3 | P3.1 |
| **H1-3** | 发布策略建议 | xhs-strategy + gtm-strategy + growth-loops | ★★★ | 中 | P3 | P3.1 |
| **H4-3** | 行业 CTA 基准 | fb-ads-library | ★★ | 高 | P3 | P3.1 (≥200 条数据) |
| **S2.4** 🆕 | A/B 变体实验建议 | brainstorm-experiments-existing | ★★ | 低 | P3 | 无 |

### 3.2 新增 6 项详细说明（S2.1-S2.4 + P2.10-P2.11）

#### S2.1 — 6-part JTBD Value Prop 注入

> 来源：`value-proposition` skill（pm-product-strategy）

在 Writing Brief（H2-1）中嵌入 6-part 结构：

```
**📋 價值主張簡報（Value Proposition Brief）**：
- Who：呢條文案係俾邊個睇？[目标受众]
- Why：佢哋有咩痛點/需求？[核心 JTBD]
- What Before：佢哋而家點解決？[现状 + 摩擦]
- How：你嘅產品點樣解決？[核心能力]
- What After：用咗之後有咩改善？[期望结果]
- Alternatives：佢哋有其他咩選擇？點解要揀你？[差异化]
```

**与 H2-1 的关系**：H2-1 的 Writing Brief 是框架，S2.1 是填入框架的具体内容模板。

#### S2.2 — 每变体附带 Value Prop Statement

> 来源：`value-prop-statements` skill（pm-marketing-growth）
> ⚠️ **仅当用户开启「📋 結構化寫作簡報」toggle 时生成**

在每个 variant 的 meta 中增加 `valuePropStatement` 字段：

```ts
interface VariantMeta {
  headline: string;
  altHeadlines: string[];
  ctaLine: string;
  valuePropStatement?: string;  // 🆕 一句话价值主张（仅 toggle=ON）
}
```

这个 statement 不展示在文案正文中，而是展示在 ResultCard 的折叠信息区，帮助用户理解「这个版本想传达什么」。

#### S2.3 — 审核报告「vs 竞品」对比维度

> 来源：`competitive-battlecard` skill（pm-go-to-market）

当用户提供了竞品数据（P2.6），审核报告新增一个 section：

```
### 🆚 競品對比維度

| 能力 | 我哋 | 競品 A | 贏家 |
|------|------|--------|------|
| CTA 強度 | Shop Now (強) | Learn More (弱) | 我哋 ✅ |
| 情感共鳴 | 家庭溫暖 | 專業距離感 | 我哋 ✅ |
| 差異化角度 | 「本地手工」 | 「全港第一」 | 平手 |
```

#### S2.4 — A/B 变体实验建议

> 来源：`brainstorm-experiments-existing` skill（pm-product-discovery）

在发布策略卡片中，增加 A/B 测试建议：

```
### 🧪 A/B 測試建議
你嘅 IG 文案可以測試以下 3 個變量：
1. Hook 句式：問題式 vs 宣言式
2. CTA 位置：開頭 vs 結尾
3. Emoji 密度：3 個 vs 7 個
建議每 24 小時睇一次互動數據，3 日後用表現最好嘅版本
```

---

## 四、分批实施路线图（Phase 0-3 修订版）

### 🔬 Phase 0：跨市场适配研究（前置条件，1-2 天）

> **目标**：在执行任何 xhs-strategy 启发项之前，先验证内地市场方法论在香港社媒的适用性
>
> **使用的 pm-skills**：`pestle-analysis`（宏观环境）、`market-segments`（HK 受众细分）

**P0.1 — HK 社媒标题模式研究**
- 任务：收集 50-100 条香港 IG/Facebook 高互动帖文标题
- 工具升级：可用 IG JSON 解析（P2.8 的前置验证）+ Google 搜索加速样本收集
- 输出：`docs/hk-headline-patterns.md`
- 决策点：哪些 xhs 公式经本地化后可复用？

**P0.2 — HK 平台内容模板适配评估**
- 任务：验证 xhs 5 套模板在 HK 社媒的等效形态
- 结合 `customer-journey-map`：按 Awareness→Consideration→Purchase→Advocacy 阶段定制内容结构
- 输出：5 套模板的 HK 本地化版本草稿

**P0.3 — xhs 合规体系与 HK 法规差异分析**
- 任务：对比 xhs 违禁词体系与 HK 广告法规
- 输出：合规规则映射表，标注来源（xhs / HK 法规 / 通用）

> ⚠️ **Phase 0 为 Phase 1 中所有 xhs-strategy 来源项的前置条件。**

---

### 🥇 Phase 1：Prompt 层增强（低成本高回报，1-2 天）

> **目标**：不动架构，只优化 prompt
>
> **使用的 pm-skills**：`value-proposition`、`value-prop-statements`
>
> **🔑 关键设计决策：结构化写作简报 = 可选模块，不是默认行为**
>
> 用户输入的文案类型差异巨大：
> ```
> 「中秋快樂🌕」                    ← 节日祝福，无产品信息
> 「是但問個港島人，中秋必買嘅...」   ← 互动引流，无产品信息
> 「我哋嘅月餅用湖南湘潭蓮子...」     ← 产品介绍，有结构化信息
> ```
>
> 强制注入完整的 6-part JTBD Value Prop 对前两种是**噪音**——AI 会为了填满「Who/Why/How/WhatAfter」而编造原文根本没有的信息。
>
> **解决方案**：在创作自由度滑块旁边新增一个 **📋 結構化寫作簡報** toggle：
> - **OFF（默认）**：自适应模式。系统从原文中提取已有的信息（品牌名、产品名、persona），但不主动注入 6-part JTBD 框架。So What 规则仅在原文包含产品描述时触发——「如果原文冇講產品特性，就唔使轉化」。
> - **ON**：完整注入模式。Writing Brief + 6-part JTBD Value Prop + Value Prop Statement 全部启用。适合产品营销型文案。

| 编号 | 任务 | 启用条件 | 文件 | 依赖 | 状态 |
|------|------|---------|------|------|:--:|
| **P1.0** 🆕 | 结构化写作简报 toggle（UI + 状态 + Prompt 分支） | — | `InputPanel.tsx` + `AppContext.tsx` + `diagnoseGenerate.ts` | 无 | ⬜ |
| **P1.1** | Benefit-over-Feature 转化指令 (So What) | **自适应**：原文有产品描述→触发；原文纯创意/互动→跳过 | `diagnoseGenerate.ts` | 无 | ⬜ |
| **P1.2** | 写前结构化简报 (Writing Brief) | **仅当 toggle = ON** | `diagnoseGenerate.ts` + `useGenerate.ts` | P1.0 | ⬜ |
| **P1.2a** 🆕 | 6-part JTBD Value Prop 注入 (S2.1) | **仅当 toggle = ON** | `diagnoseGenerate.ts` | P1.0 | ⬜ |
| **P1.3** | 平台内容结构模板 (H1-1) | 始终启用 | `diagnoseGenerate.ts` | ⚠️ Phase 0 | ⬜ |
| **P1.4** | 各变体加备选标题 + Value Prop Statement (H2-4 + S2.2) | 备选标题：始终；Value Prop Statement：**仅当 toggle = ON** | prompt + types + `ResultsPanel.tsx` | P1.0 | ⬜ |

#### P1.0 — 结构化写作简报 toggle（新增，Phase 1 先决条件）

**位置**：InputPanel 中，CreativitySlider 下方紧邻

```
┌─────────────────────────────────────────┐
│ 🎨 創作自由度  [======○======]  2      │
│                                         │
│ 📋 結構化寫作簡報          [🔘 OFF]     │  ← 🆕
│    啟用後 AI 會按 6-part Value Prop     │
│    結構理解品牌定位，適合有明確產品        │
│    資訊嘅文案。純創意/互動文案建議關閉。   │
└─────────────────────────────────────────┘
```

**行为逻辑**：

| Toggle 状态 | 注入内容 | 适用场景 |
|------------|---------|---------|
| **OFF**（默认）| 仅注入品牌/产品识别信息（现有 `buildBrandSection` 行为）；So What 规则自适应触发（原文有产品描述才转换） | 节日祝福、互动帖、创意段子、轻量引流、纯粤语翻译 |
| **ON** | 完整注入：Writing Brief + 6-part JTBD Value Prop + Value Prop Statement；So What 规则对每条产品描述强制执行 | 产品上市文案、促销活动、品牌介绍、着陆页、付费广告 |

**Prompt 分支逻辑**（`diagnoseGenerate.ts` 中）：

```ts
function buildWritingFramework(params: DiagnoseGenerateParams): string {
  if (!params.structuredBriefEnabled) {
    // OFF: 自适应模式 — 仅注入已有信息，不主动构建框架
    return buildBrandSection(params.brandName, params.productName);
  }

  // ON: 完整结构化注入
  return [
    buildBrandSection(params.brandName, params.productName),
    buildWritingBrief(params),        // P1.2
    buildJTBDValueProp(params),       // P1.2a
  ].filter(Boolean).join('\n');
}
```

**默认值**：OFF。用户首次使用时不注入 structured brief，保持现有行为。当用户输入包含产品描述类内容时，可在 UI 中给出轻提示（非阻塞）：「💡 呢條文案包含產品資訊，開啟『結構化寫作簡報』可能會提升生成質量」。

---

**P1.1 详细 spec**（自适应模式）：

```
## 💡 So What 規則（利益優先原則）— 自適應模式

⚠️ 本規則只在原文包含產品描述時觸發。如果原文係純互動、節日祝福、創意短句，
則跳過本規則——唔好為咗套用規則而添加原文冇嘅產品資訊。

當原文有產品描述時，每個產品描述後面都要回答「咁又點？」：

❌ 唔好：「我哋嘅月餅用湖南湘潭蓮子」
✅ 要：「我哋用湖南湘潭蓮子——煮出嚟嘅蓮蓉特別香滑，咬落唔會起沙」

轉化規則（僅在原文有相關內容時適用）：
- 原材料 → 口感/體驗
- 技術/工藝 → 品質保證
- 認證/獎項 → 信任信號

🚫 原文冇提及產品特性 → 唔好自己加 → 直接跳過 So What 規則。
```

**P1.2 详细 spec**（仅 toggle = ON 时注入）：

```
## 📋 結構化寫作簡報（Writing Brief）

以下係基於你嘅品牌/產品設定自動生成嘅寫作簡報：

- 品牌：[brandName]
- 產品/服務：[productName]
- 目標受眾：[consumerPersonas 摘要]
- 核心 JTBD：[從原文提煉]
- 期望行動：[從平台推斷]
- 品牌語氣：[tone]
- 粵語程度：[cantoneseLevel]/5，中英夾雜：[englishMixingLevel]/5

請基於以上簡報生成文案，確保每個版本都呼應目標受眾嘅需求同品牌語氣。
```

**P1.2a 详细 spec**（仅 toggle = ON 时注入）：

```
## 🎯 價值主張框架（6-Part JTBD Value Proposition）

- Who：呢條文案係俾 [targetPersona] 睇嘅
- Why：佢哋需要 [JTBD]，因為 [pain point]
- What Before：而家佢哋 [current solution]，但係 [friction]
- How：[product] 透過 [core capability] 解決呢個問題
- What After：用咗之後，佢哋可以 [desired outcome]
- Alternatives：相比 [competitor/alternative]，我哋嘅優勢係 [differentiator]

請確保文案中傳達以上價值主張，尤其係 "What After" 嘅改善結果。
```

---

### 🥈 Phase 2：审核体验 + 检索 + 灵感面板（中等成本，3-5 天）

> **目标**：审核更全面、有竞品对比依据、用户能获取外部灵感
>
> **使用的 pm-skills**：`competitor-analysis`、`competitive-battlecard`、`positioning-ideas`、`customer-journey-map`

| 编号 | 任务 | 文件 | 依赖 |
|------|------|------|------|
| **P2.1** | 审核维度扩展 (H3-1)：+语气一致度、利益转化度、情感共鸣度 | `audit.ts` + `reAudit.ts` + types | 无 |
| **P2.2** | CTA 独立评分 (H2-3) | `audit.ts` + `DiagnosisSummary.tsx` | 无 |
| **P2.3** | 快速规则检查模式 (H3-3)：本地引擎 6 项检查 | 新 `quickCheckService.ts` + `QuickCheck.tsx` | 无 |
| **P2.4** | 平台层合规扩展 (H1-4) | `complianceRules.ts` | ⚠️ Phase 0 |
| **P2.5** | 内容刷新模式 (H3-4)：🆕 全新生成 / 🔄 刷新舊文 | `diagnoseGenerate.ts` + `InputPanel.tsx` | 无 |
| **P2.6** | 竞品广告检索 (H4-1)：Meta Ad Library | 新 `competitorService.ts` + `InputPanel.tsx` 竞品搜索框 | 无 |
| **P2.7** | 竞品文案注入 Prompt + 差异化检测 (H4-2) | `diagnoseGenerate.ts` + `audit.ts` | P2.6 |
| **P2.7a** 🆕 | 审核报告「vs 竞品」对比维度 (S2.3) | `audit.ts` + `AuditPanel.tsx` | P2.6 |
| **P2.8** | IG Hashtag 热门帖文检索 | 新 `igSearchService.ts` | 无 |
| **P2.9** | YouTube HK 热门内容检索 | 新 `youtubeSearchService.ts` | 无 |
| 🆕 | **灵感面板 UI 骨架**：4 Tab 可折叠面板 | 新 `InspirationPanel.tsx` | P2.6/8/9 |
| 🆕 | **目标发布时间字段**：日期选择器 | `InputPanel.tsx` | 无 |
| 🆕 **P2.10** | **文案收藏库**：收藏 + 收藏库面板 + 微调闭环 | `BookmarkButton.tsx` + `FavoritesPanel.tsx` + 类型/Context 扩展 | 无 |
| 🆕 **P2.11** | **正例文案参考**：用户输入竞品正例 → AI 技法分析 → 风格对齐生成 | `ReferenceExemplarInput.tsx` + `diagnoseGenerate.ts` | 无 |

---

### 🥉 Phase 3：数据积累 + 专家评分 + 高级分析（1-2 周）

> **目标**：累积足够数据后，支撑更高级的分析功能
>
> **使用的 pm-skills**：`brainstorm-ideas-existing`、`growth-loops`、`gtm-strategy`、`user-personas`、`sentiment-analysis`

| 编号 | 任务 | 文件 | 依赖 |
|------|------|------|------|
| **P3.1** | 参考语料库 + 自动采集管道 | `reference-corpus.json` + 自动采集脚本 + RAG 检索服务 | P2.6/8/9 |
| **P3.2** | 专家小组评分 (H3-2)：persona × lens matrix | `audit.ts` + `ConsumerFeedback.tsx` | P3.1 |
| **P3.3** | 发布策略建议 (H1-3)：最佳时间 + hashtag + 互动引导 | 新 `publishStrategyService.ts` + `PublishCard.tsx` | P3.1 |
| **P3.4** | 行业 CTA 基准 (H4-3) | `competitorService.ts` 扩展 + 统计分析 | P3.1（≥200 条数据） |
| **S2.4** 🆕 | A/B 变体实验建议 | `publishStrategyService.ts` 扩展 | 无 |

---

## 五、灵感参考面板完整设计

> 整合自 `inspiration-design功能设计策略.md`，补充 pm-skills 方法论注入

### 5.1 布局位置

**Center Panel 下方，可折叠**

```
┌──────────────┬───────────────────────────┬──────────────┐
│  LEFT (30%)  │       CENTER (flex)       │  RIGHT (30%) │
│              │                           │              │
│ SourceEditor │  5 variant tabs           │  AuditPanel  │
│ ...          │  DiagnosisSummary          │              │
│ [🚀 生成]    │                           │              │
│              │  ┌─ 💡 靈感參考 ─────────┐ │              │
│              │  │ [當下語感][話題日曆]   │ │              │
│              │  │ [即時熱話][競品動態]   │ │              │
│              │  │  (帖文卡片列表)        │ │              │
│              │  └───────────────────────┘ │              │
└──────────────┴───────────────────────────┴──────────────┘
```

### 5.2 四个 Tab 详细设计

#### Tab 1：「當下語感」🟢

| 属性 | 说明 |
|------|------|
| **数据来源** | IG Hashtag JSON (P2.8) + YouTube API (P2.9) + 参考语料库 (P3.1) |
| **pm-skill 注入** | `hk-cantonese-social-voice`：提取句式结构、语气模式、emoji 用法 |
| **展示方式** | 卡片列表，每卡片 = 一条帖文精华 |
| **Prompt 注入策略** | **默认自动注入** 2-3 条同行业帖文作为 few-shot 风格参考 |
| **排序逻辑** | 互动率降序（engagement / follower ratio），可切换为行业相关性优先 |

**卡片设计**：
```
┌──────────────────────────────────────────┐
│ 📱 Instagram · #hkfoodie · 3 日前        │
│                                          │
│ 「是但問個港島人，中秋必買嘅餅舖係？      │
│   留言話我知👇」                          │
│                                          │
│ ❤️ 2,341  💬 186  🔖 #香港美食 #中秋     │
│                                          │
│ [📋 複製表達]  [📝 複製全文]              │
└──────────────────────────────────────────┘
```

**「複製表達」vs「複製全文」**：
- **複製表達**：复制句式骨架（去话题化），如 `「是但問個___人，___必買嘅___係？留言話我知👇」`
- **複製全文**：复制原始帖文全文

#### Tab 2：「話題日曆」🟢 ✅ 已实现

| 属性 | 说明 |
|------|------|
| **数据来源** | 预制 HK 本地话题日历（JSON 文件，`calendarData.ts`，季度更新） |
| **数据覆盖** | 2026-06 至 2027-06，~40 个节日/事件，日期已核验真实有效 ✅ |
| **pm-skill 注入** | `gtm-strategy`：按时间节点匹配营销时机 |
| **展示方式** | 时间线 + 话题卡片（按目标日期 ±14 天过滤） |
| **Prompt 注入策略** | **用户多选勾选后注入** — 勾选的事件 ID 存入 AppContext → 随生成请求发送 → 路由层按 ID 查找完整事件 → 注入 Prompt Layer 3 |

**依赖字段**：「📅 目標發布時間」日期选择器（位于 InputPanel，BrandInput 下方）

**注入效果**：选中事件出现在 prompt 中的「話題日曆借勢建議」section，包含：
- 节日的叙事角度（angles）
- Hook 灵感（narrativeHooks）
- 敏感度提醒（sensitivityNote）
- 使用指引（🆕 2026-07-11 强化为**强制指令**：每个版本至少融入 1 个角度，极端情况至少 2 个版本提及）

**卡片设计**：
```
📅 目標發布時間：2026 年 7 月 5 日

┌──────────────────────────────────────────┐
│ ☑ 7 月 1 日 · 香港回歸紀念日 🏙️              │
│ 適用行業：全行業（但避免過度政治化表達）      │
│ 角度：本地情懷、家在香港、回歸優惠           │
│ ✓ 已添加至生成 prompt — 生成時會融入此話題角度│
├──────────────────────────────────────────┤
│ ☐ 7 月 15-21 日 · 香港書展 2026 📚         │
│ 適用行業：食品、零售、餐飲                  │
│ 角度：文青打卡、書展限定、攤位優惠           │
│ ☐ 加入生成 prompt                         │
└──────────────────────────────────────────┘
```

**数据流**：
```
TargetDatePicker → AppSettings.targetDate → POST /api/inspiration/calendar
→ 返回 ±14 天事件 → TopicCalendarTab 渲染
→ 用户勾选 → dispatch SET_SELECTED_CALENDAR_EVENTS → AppSettings.selectedCalendarEventIds
→ useGenerate hook 读取 → POST /api/generate (calendarEventIds)
→ 路由层 HK_CALENDAR.filter → params.calendarEvents
→ buildCalendarEventsSection() → 注入 Prompt Layer 3
```

#### Tab 3：「即時熱話」🔴 LIVE

| 属性 | 说明 |
|------|------|
| **数据来源** | IG Hashtag trending + Google Trends HK + YouTube 热门变化 |
| **pm-skill 注入** | `sentiment-analysis`：实时情感信号（什么话题正在引发强烈情感反应） |
| **展示方式** | 带时间衰减标注的卡片，排序按「上升速度」而非「绝对互动量」 |
| **Prompt 注入策略** | **不自动注入** — 用户需手动点击「複製表達」 |

**卡片设计**：
```
🔴 即時熱話 · 更新於 2026-06-13 14:30

┌──────────────────────────────────────────┐
│ 🔥 TRENDING · 2 小時前開始上升              │
│ 📱 Instagram · #dse2026                  │
│                                          │
│ 「DSE 放榜前一晚嘅心聲...                  │
│   瞓唔著嘅舉手🙋‍♂️」                       │
│                                          │
│ ❤️ 8,200  💬 1,340  📈 過去 2 小時升 340% │
│                                          │
│ [📋 複製表達]                              │
│                                          │
│ ⚠️ 此話題預計 2-3 天內降溫                  │
└──────────────────────────────────────────┘
```

#### Tab 4：「競品動態」🔵

| 属性 | 说明 |
|------|------|
| **数据来源** | Meta Ad Library（P2.6） |
| **pm-skill 注入** | `competitor-analysis` + `competitive-battlecard` + `positioning-ideas` |
| **展示方式** | 竞品当前活跃广告列表，含 CTA/平台/投放时间 |
| **Prompt 注入策略** | 注入 audit prompt 作为差异化对比基准 |

**触发方式**：用户在 InputPanel 填写竞品名 → 点击搜索 → Tab 4 加载

**卡片设计**：
```
🔍 競品：美心月餅（Facebook Page ID: 15087023444）

┌──────────────────────────────────────────┐
│ 投放中 · Facebook + Instagram · 2026-06-01 至今 │
│                                          │
│ 標題：雙黃白蓮蓉月餅 — 傳統手工，用心製作    │
│ 內文：今年中秋，同屋企人一齊分享...         │
│ CTA：立即訂購                              │
│                                          │
│ [查看完整廣告]  [📋 複製文案]              │
└──────────────────────────────────────────┘
```

### 5.3 Prompt 注入策略总结

```
Prompt 注入策略
═══════════════════════════════════════════════════════

🟢 表达模式/语感 → 作为 few-shot examples（始终注入）
   触发：P2.8/P2.9 检索 → 语料库匹配 → prompt 注入
   「以下係近期香港 IG 上面高互動帖文嘅表達方式，請參考佢哋嘅
    語氣、句式、互動引導方法——但唔好抄內容：」

🟢 近期话题（用户在 Tab 2 勾选的话题）→ 强制融入 ✅ 已实现
   触发：用户选择目标日期 + 多选勾选话题 → selectedCalendarEventIds 存入 AppContext
   → POST /api/generate 携带 calendarEventIds → 路由层按 ID 查找 HK_CALENDAR
   → buildCalendarEventsSection() 注入 Prompt Layer 3
   「🚨 你必須將上述話題融入文案創作——呢個係用戶明確指定嘅創作方向。
    每個版本至少融入 1 個相關嘅敘事角度或 hook。」
   注入内容含：叙事角度(angles)、Hook 灵感(narrativeHooks)、敏感度提醒(sensitivityNote)、强制性使用指引
   注意：2026-07-11 已从"可选建议"强化为"强制指令"，确保模型不会忽略日历事件

🔴 即时热点 → 不自动注入 prompt
   触发：用户手动点击「複製表達」→ 句式骨架进入剪贴板
   用户可自行粘贴到原文输入框

🔵 竞品广告 → 注入 audit prompt 作为差异化基准
   触发：用户搜索竞品 → audit/re-audit 时自动对比
   「以下係競品目前投放中嘅廣告，請確保你嘅文案：
    1. 唔好同競品過於相似
    2. 找到差異化角度
    3. CTA 強度不低於行業平均」
```

### 5.4 组件树

```
InspirationPanel/
├── InspirationPanel.tsx          # 容器：可折叠 + 4 Tab 切换
├── tabs/
│   ├── VoiceTab.tsx              # Tab 1「當下語感」
│   ├── CalendarTab.tsx           # Tab 2「話題日曆」
│   ├── TrendingTab.tsx           # Tab 3「即時熱話」
│   └── CompetitorTab.tsx         # Tab 4「競品動態」
├── cards/
│   ├── PostCard.tsx              # 通用帖文卡片（Tab 1/3 复用）
│   ├── CalendarEventCard.tsx     # 话题事件卡片（Tab 2）
│   └── CompetitorAdCard.tsx      # 竞品广告卡片（Tab 4）
├── buttons/
│   ├── CopyExpressionButton.tsx  # 「複製表達」按钮
│   └── CopyFullTextButton.tsx    # 「複製全文」按钮
└── hooks/
    ├── useInspirationData.ts     # 数据获取 + 缓存
    └── useInspirationPrompt.ts    # Prompt 注入逻辑
```

---

## 六、Prompt 工程策略

### 6.1 Prompt 膨胀管理

当前 `buildDiagnoseGeneratePrompt()` 约 300 行。Phase 1 完成后预计增长到 ~400 行，Phase 2 完成后 ~500 行。

**分层 Prompt 架构**：

```
┌─────────────────────────────────────┐
│ Layer 0: System Identity (固定)      │  ~20 lines
│ 「你係一個香港粵語 native speaker」    │
├─────────────────────────────────────┤
│ Layer 1: Compliance & Safety (固定)  │  ~80 lines
│ 合规规则 + 品牌红线                    │
├─────────────────────────────────────┤
│ Layer 2: Writing Framework (固定)    │  ~60 lines
│ So What 规则 + 6-part Value Prop     │
├─────────────────────────────────────┤
│ Layer 3: Contextual (动态)           │  ~80 lines
│ Writing Brief + Few-shot 示例        │
│ (brand, product, personas,           │
│  inspiration data)                   │
├─────────────────────────────────────┤
│ Layer 4: Generation Params (动态)    │  ~60 lines
│ Platform + Tone + Cantonese +        │
│ English + Creativity                 │
├─────────────────────────────────────┤
│ Layer 5: Output Format (固定)        │  ~30 lines
│ JSON schema                          │
└─────────────────────────────────────┘
Total: ~330 lines (可控制在 ~2500 tokens)
```

### 6.2 Token 预算审计

建议 Phase 1 完成后做一次审计：

| 检查项 | 方法 |
|--------|------|
| 每个 Layer 的实际 token 消耗 | `tiktoken` 计数 |
| 哪些指令从未被模型遵循 | A/B 测试：去掉某段 → 观察生成质量变化 |
| 哪些指令产生了副作用 | 检查 compliance violations 的误报率 |
| CantoneseLLM vs DeepSeek 对 prompt 长度的敏感度差异 | 分别测试 |

### 6.3 Few-Shot 示例注入格式

从灵感到 Prompt 的注入格式（Tab 1「當下語感」自动注入 2-3 条）：

```
## 🗣️ 近期港式社媒表達參考（Few-Shot 風格指引）

以下係近期香港 IG 上高互動帖文嘅表達方式，請參考佢哋嘅：
- 語氣：點樣同讀者傾偈？
- 句式：句子長短、分段節奏
- 互動引導：點樣叫人留言/share？
- Emoji 用法：點樣用 emoji 製造節奏？

**唔好直接抄內容——參考嘅係表達方式，唔係話題。**

### 參考帖文 1（IG · #hkfoodie · ❤️ 2.3K · 💬 186）
> 「是但問個港島人，中秋必買嘅餅舖係？
>  留言話我知👇」

表達分析：反問式開頭 + 地區標籤 + 簡單互動引導，節奏輕快

### 參考帖文 2（IG · #hkfood · ❤️ 1.8K · 💬 92）
> 「今年食咗 5 間，呢間嘅奶黃流心真係世一🏆
>  唔信你試下」

表達分析：個人經驗開頭 + 數據（5間）+ 挑釁式結尾（唔信你試下），有態度
```

---

## 七、类型系统与 API 设计

### 7.1 核心类型扩展

```ts
// ==========================================
// 灵感参考数据
// ==========================================

interface HKPost {
  id: string;
  platform: 'ig' | 'facebook' | 'youtube';
  type: 'organic' | 'ad';
  industry?: string;
  postType?: string;
  headline?: string;
  body: string;
  hashtags: string[];
  engagement: {
    likes: number;
    comments: number;
    shares?: number;
    views?: number;
  };
  url: string;
  authorName?: string;
  fetchedAt: string;
  publishedAt?: string;
  language: 'cantonese' | 'mixed' | 'traditionalChinese';
  expressionFingerprint?: string; // 句式骨架（去话题化）
}

interface CompetitorAd {
  adArchiveId: string;
  pageName: string;
  pageId?: string;
  platform: ('facebook' | 'instagram' | 'messenger' | 'audience_network')[];
  body: string;
  title?: string;
  ctaText?: string;
  linkUrl?: string;
  isActive: boolean;
  startDate: number;
  endDate?: number;
  // 竞品分析扩展
  positioningAngle?: string;     // AI 推断的定位角度
  targetAudience?: string;       // AI 推断的目标受众
  valuePropStatement?: string;   // AI 提取的价值主张
}

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  titleZh: string;
  applicableIndustries: string[];
  angles: string[];
  narrativeHooks: string[];
  sensitivityNote?: string;
}

// ==========================================
// Variant 元数据扩展
// ==========================================

interface VariantMeta {
  headline: string;
  altHeadlines: string[];
  ctaLine: string;
  valuePropStatement: string;    // 🆕 S2.2
  targetPersona?: string;        // 🆕 这个版本针对哪个 persona
  creativeForm?: string;         // 🆕 文案形态（L4）：直球广告/软广告/故事/诗歌/笑话/清单/对话/测验
  strategyGoal?: string;         // 🆕 策略目的：引流/推广/增长激活/品牌塑造
}

// ==========================================
// 审核维度扩展
// ==========================================

interface AuditDimensions {
  cantoneseAuthenticity: number;   // 港味纯正度 (0-100)
  brandSafety: number;             // 品牌安全 (0-100)
  platformFit: number;             // 平台适配 (0-100)
  readability: number;             // 可读性 (0-100)
  creativity: number;              // 创意/吸引力 (0-100)
  // 🆕 Phase 2 新增
  voiceConsistency?: number;       // 语气一致度
  benefitConversion?: number;      // 利益转化度 (So What)
  emotionalResonance?: number;     // 情感共鸣度
  ctaStrength?: number;            // CTA 强度
  competitorDifferentiation?: number; // 竞品差异化
}

// ==========================================
// 专家评分
// ==========================================

interface ExpertScore {
  personaId: string;
  personaName: string;
  lens: 'clarity' | 'voice' | 'sowhat' | 'proof' | 'specificity' | 'emotion' | 'risk';
  score: number;        // 1-10
  critique: string;
  suggestion: string;
}

// ==========================================
// 发布策略
// ==========================================

interface PublishStrategy {
  bestTimes: Array<{ day: string; hour: number; score: number; rationale: string }>;
  recommendedPlatforms: Array<{ platform: string; priority: number; reason: string }>;
  hashtags: string[];
  commentBait: string;
  frequency: string;
  growthLoopType?: 'viral' | 'usage' | 'collaboration' | 'userGenerated' | 'referral'; // 🆕
  abTestSuggestions?: Array<{ variable: string; variantA: string; variantB: string; metric: string }>; // 🆕 S2.4
}
```

### 7.2 API 端点设计

```ts
// ==========================================
// 现有端点
// ==========================================
POST /api/generate              // 生成文案
POST /api/audit                 // 审核文案
POST /api/re-audit              // 修改后重新审核
POST /api/consumer-feedback     // 消费者反馈模拟
POST /api/apply-suggestion      // 应用修改建议

// ==========================================
// Phase 2 新增端点
// ==========================================

// 竞品广告检索
POST /api/competitor/search
  Body: { query: string; country?: string; platform?: string[]; limit?: number }
  Response: { ads: CompetitorAd[] }

// IG Hashtag 热门帖文检索
POST /api/inspiration/ig-hashtag
  Body: { tag: string; limit?: number }
  Response: { posts: HKPost[] }

// YouTube HK 热门内容
POST /api/inspiration/youtube-trending
  Body: { categoryId?: number; limit?: number }
  Response: { videos: HKPost[] }

// YouTube 关键词搜索
POST /api/inspiration/youtube-search
  Body: { query: string; limit?: number }
  Response: { videos: HKPost[] }

// 话题日历匹配
POST /api/inspiration/calendar
  Body: { targetDate?: string; industry?: string }
  Response: { events: CalendarEvent[] }

// 内容刷新
POST /api/refresh
  Body: { originalText: string; platform: Platform; tone: BrandTone; ... }
  Response: { refreshed: string; changes: RefreshChange[] }

// ==========================================
// Phase 3 新增端点
// ==========================================

// 参考语料库检索
POST /api/corpus/search
  Body: { industry: string; platform: string; postType: string; limit: number }
  Response: { results: HKPost[] }

// 发布策略建议
POST /api/publish-strategy
  Body: { variants: Record<VariantKey, string>; targetDate?: string; industry?: string }
  Response: { strategy: PublishStrategy }

// 行业 CTA 基准
GET /api/benchmarks/cta?industry=food
  Response: { distribution: CtaDistribution[]; averageStrength: number; recommendations: string[] }
```

---

## 八、技术架构决策

### 8.1 架构全景图（Phase 2 完成后）

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React + Tailwind)             │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌─────────┐ │
│  │InputPanel│  │ResultsPanel  │  │AuditPanel│  │Inspir.  │ │
│  │          │  │              │  │          │  │Panel    │ │
│  │·Source   │  │·5 Variants   │  │·5 Dims   │  │·4 Tabs  │ │
│  │·Brand    │  │·Meta (标题)   │  │·CTA      │  │·Cards   │ │
│  │·RedLines │  │·QuickCheck   │  │·vs 竞品   │  │·Buttons │ │
│  │·Target   │  │              │  │          │  │         │ │
│  │ Date     │  │              │  │          │  │         │ │
│  └──────────┘  └──────────────┘  └──────────┘  └─────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API
┌──────────────────────┴──────────────────────────────────────┐
│                        Server (Express)                      │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │ Routes     │  │ Prompts    │  │ Services             │  │
│  │            │  │            │  │                      │  │
│  │·generate   │  │·diagnose   │  │·deepseekService     │  │
│  │·audit      │  │  Generate  │  │·cantoneseService    │  │
│  │·re-audit   │  │·audit      │  │·fallbackService     │  │
│  │·consumer   │  │·reAudit    │  │·personaService      │  │
│  │·apply      │  │·compliance │  │·competitorService 🆕│  │
│  │·competitor │  │            │  │·igSearchService 🆕   │  │
│  │·inspiration│  │            │  │·youtubeSearchSvc 🆕 │  │
│  │·refresh 🆕 │  │            │  │·quickCheckService🆕 │  │
│  │            │  │            │  │·corpusService 🆕     │  │
│  └────────────┘  └────────────┘  └──────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │DeepSeek  │ │Cantonese │ │ External │
    │API       │ │LLM (32B) │ │ Data     │
    │(审核/反馈)│ │(生成)     │ │ Sources  │
    └──────────┘ └──────────┘ └──────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              ┌───────────┐ ┌───────────┐ ┌───────────┐
              │Meta Ad    │ │IG Public  │ │YouTube    │
              │Library    │ │Pages/JSON │ │Data API   │
              │(browser)  │ │(HTTP GET) │ │(REST)     │
              └───────────┘ └───────────┘ └───────────┘
```

### 8.2 关键决策记录

| # | 决策 | 理由 | 权衡 |
|---|------|------|------|
| **D1** | 灵感面板放在 Center 下方而非 Left Sidebar | Center 更宽、认知流更自然（看结果→找灵感→迭代） | Center 纵向空间也有限，需要折叠 |
| **D2** | 四种数据类型四种注入策略 | 不同类型时效不同、风险不同，一刀切会出问题 | 增加实现复杂度 |
| **D3** | IG 帖文用 HTTP GET + JSON 解析而非 API | 无需 API Key、无需登录、返回结构化数据 | Meta 可能改页面结构 |
| **D4** | 竞品广告用 fb-ads skill 的 browser-act 方案 | 已有成熟封装，减少重复开发 | 依赖 Python 脚本 + 浏览器环境 |
| **D5** | 参考语料库先用 JSON 文件，不用向量数据库 | <500 条数据关键词匹配足够，降低复杂度 | 数据量增长后需要迁移 |
| **D6** | 快速检查用纯本地正则引擎，不调 AI | 降低延迟、免费、确定性输出 | 检查覆盖度有限，复杂问题仍需 AI |
| **D7** | Prompt 分层（5 Layer）而非单体 | 便于管理 token 预算、A/B 测试、按需注入 | 需要在代码层面维护分层逻辑 |

### 8.3 模型职责划分

| 任务 | 模型 | 原因 |
|------|------|------|
| 文案生成 | `CantoneseLLMChat-v1.0-32B` | 粤语原生能力最强 |
| 审核评分 | DeepSeek `deepseek-chat` | 结构化输出更稳定 |
| 消费者反馈 | DeepSeek `deepseek-chat` | 需要多角色推理 |
| 竞品差异化分析 | DeepSeek `deepseek-chat` | 需要对比推理 |
| 语料库匹配 | 本地关键词 + 正则 | 无需 AI，确定性匹配 |
| 快速规则检查 | 本地正则引擎 | 零延迟，离线可用 |
| 发布策略建议 | DeepSeek `deepseek-chat` | 需要综合推理 |

---

## 九、Pre-Mortem 风险分析

> 使用方法：`pre-mortem` skill（pm-execution）
> 假设项目上线后失败 → 倒推原因 → 分类风险

### 9.1 Tigers（真实风险 — 必须解决）

| # | 风险 | 分类 | 缓解措施 | 紧急度 |
|---|------|------|---------|--------|
| T1 | **Prompt 膨胀导致生成质量下降**：注入 Writing Brief + Value Prop + Few-Shot + 合规规则后，prompt 超过模型有效上下文窗口或注意力分散 | 技术 | Phase 1 后做 token 审计；每个 Layer 做 A/B 测试验证是否真的提升了生成质量 | Launch-Blocking |
| T2 | **IG JSON 解析随时可能被 Meta 封堵**：`__INITIAL_STATE__` 是内部实现细节，Meta 无义务保持兼容 | 技术 | 增加监控（定时检测 JSON 解析成功率）；准备 fallback 方案（Google 搜索 + WebFetch） | Fast-Follow |
| T3 | **竞品广告检索触发 Meta 反爬**：高频请求可能被封 IP | 技术/合规 | 间隔 2-3 秒；使用合理 UA；明确告知用户仅供研究参考 | Launch-Blocking |
| T4 | **粤语 LLM 无法稳定输出结构化 VariantMeta**：新增 headline/altHeadlines/ctaLine/valuePropStatement 字段增加 JSON 解析失败率 | 技术 | 先用 DeepSeek 做结构化提取（从 variant 文本中提取 meta）；或新增一个独立的「标题生成」步骤 | Launch-Blocking |

### 9.2 Paper Tigers（被高估的风险）

| # | 风险 | 为什么不那么可怕 |
|---|------|----------------|
| P1 | 「灵感面板太复杂，用户不会用」 | 默认折叠；核心流程（输入→生成→审核）不需要面板也能完成；高级用户自行展开 |
| P2 | 「竞品数据太多，信息过载」 | 默认只展示 5 条；搜索触发而非自动加载；每条卡片已做信息提炼 |
| P3 | 「Prompt 分层架构过度工程」 | 实际上就是 5 个函数调用，不是真正的分层架构；如果不需要，可以内联回去 |

### 9.3 Elephants（团队可能回避讨论的问题）

| # | 问题 | 建议调查方式 |
|---|------|------------|
| E1 | **CantoneseLLM 是否是长期可靠的基础设施？** 如果 Featherless.ai 停服或模型更新后粤语能力下降怎么办？ | 调研备选模型（如本地部署的 Qwen2-Cantonese-7B）；定期评估生成质量 |
| E2 | **用户真的需要灵感参考面板吗？** 还是他们只需要更好的 prompt？ | Phase 2 先做一个最小可用版本（只有 Tab 1 + Tab 4），收集使用数据后再决定是否投资 Tab 2/3 |
| E3 | **合规风险：自动爬取 IG/FB 数据是否违反 ToS？** | 咨询法律意见；标注数据来源仅供研究参考；优先使用官方 API（YouTube） |

---

## 十、附录：参考语料库设计

### 10.1 数据结构

```ts
interface ReferencePost {
  id: string;                    // UUID
  platform: 'ig' | 'facebook' | 'shorts' | 'youtube';
  industry: string;              // '食品' | '零售' | '美容' | '科技' | ...
  postType: string;              // '產品介紹' | '優惠推廣' | '品牌故事' | '互動帖' | '教學'
  headline: string;
  body: string;
  hashtags: string[];
  engagement: {
    likes: number;
    comments: number;
    shares: number;
  };
  url: string;
  collectedAt: string;           // ISO date
  source: 'manual' | 'ig-hashtag-scrape' | 'fb-ad-lib' | 'youtube-api';
  qualityNotes?: string;         // 人工标注：「为什么这条写得好」
  expressionFingerprint?: string; // AI 提取的句式骨架
  valuePropPattern?: string;     // AI 提取的价值主张模式
  ctaPattern?: string;           // AI 提取的 CTA 模式
}
```

### 10.2 数据来源比例

| 来源 | 占比 | 获取方式 | 频率 |
|------|------|---------|------|
| IG Hashtag 热门帖文 | ~40% | 自动：IG JSON 解析 → 过滤 HK 相关 → 入库 | 周更 |
| Meta Ad Library 竞品广告 | ~30% | 自动：fb-ads skill → 结构化 → 入库 | 按需 |
| YouTube 热门/搜索 | ~20% | 自动：YT API → 提取标题+描述 → 入库 | 日更 |
| 人工精选标注 | ~10% | 手动：标注「为什么这条写得好」 | 月更 |

### 10.3 检索策略

- **<500 条**：关键词匹配（行业 + 平台 + 帖文类型），内存倒排索引
- **500+ 条**：考虑引入简单 embedding（`text-embedding-3-small`）做语义相似度检索
- **不使用向量数据库**：SQLite + 内存倒排索引即可满足当前需求

### 10.4 RAG 注入格式

```
## 📚 參考語料（近期香港社媒高互動帖文）

以下係同你行業/平台相關嘅近期高互動帖文，請參考佢哋嘅表達方式：

### 語料 1（IG · 食品 · 產品介紹 · ❤️ 2.3K）
「是但問個港島人，中秋必買嘅餅舖係？留言話我知👇」
表達模式：反問式開頭 → 地區標籤 → 簡單互動引導

### 語料 2（FB · 食品 · 品牌故事 · ❤️ 1.2K）
「三十年老字號，由阿爺嗰代開始，我哋堅持每日凌晨四點起身搓粉...」
表達模式：時間線開頭 → 工藝描述 → 情感連結

**重要：參考表達方式，唔好抄內容。**
```

---

## 附录 B：文件变更清单（Phase 1-2 汇总）

### Phase 1 文件变更

| # | 文件 | 变更类型 | 描述 |
|---|------|---------|------|
| 1 | `server/src/prompts/diagnoseGenerate.ts` | 修改 | +So What 规则 + Writing Brief + Value Prop + altHeadlines |
| 2 | `server/src/types/index.ts` | 修改 | +VariantMeta (headline, altHeadlines, ctaLine, valuePropStatement) |
| 3 | `client/src/types/index.ts` | 修改 | 同步 server 类型 |
| 4 | `client/src/components/results/ResultCard.tsx` | 修改 | 展示标题 + 备选标题 |
| 5 | `client/src/hooks/useGenerate.ts` | 修改 | 构建 Writing Brief 参数 |

#### P2.10 — 文案收藏库（Bookmark/Favorites）+ 用户偏好学习

> 功能状态：🔄 基础版已实现（2026-07-09），增强版待开发
>
> 相关文档：`docs/spec-v2.1-进度条与反馈系统.md`（反馈闭环与偏好学习）

**动机**：用户在生成满意文案后，需要保存优秀案例及当时的生成参数，便于后续复盘、微调和复用。更进一步，系统应从用户的收藏行为中学习偏好，让每次生成都更贴近用户的审美标准。

**两阶段演进**：

| 阶段 | 能力 | 状态 |
|------|------|:--:|
| **Phase A** | 基本收藏：☆收藏、查看参数、载入参数微调、备注、📋复制文案 | ✅ 已实现 |
| **Phase B** | 偏好学习：收藏评价（⭐星级 + 🏷原因标签 + ✏自定义原因）、用户偏好档案、多选收藏案例注入Prompt、个性化优化 | 🔄 评价系统已实现，偏好档案待开发 |

---

### Phase A — 基本收藏（已实现 ✅）

**核心交互**：

```
┌──────────────────────────────────────────┐
│ ResultCard 右上角                         │
│                                          │
│ [☆] [✏️] [📋]                             │  ← ☆ = 收藏按钮
│  点击 ☆ → 变为 ★（已收藏）                │
└──────────────────────────────────────────┘
```

**收藏数据结构**（`BookmarkedCopy`）：

```ts
interface BookmarkedCopy {
  id: string;                    // UUID
  savedAt: string;               // ISO 时间戳
  variantKey: VariantKey;        // 哪个版本的文案
  content: string;               // 文案正文
  source: string;                // 用户输入的原始文本
  settings: AppSettings;         // 全部生成参数快照
  variantMeta?: VariantMeta | null;  // 标题/CTA/价值主张
  scores?: GenerateResponse['scores'] | null;  // 审核评分快照
  consumerFeedback?: ConsumerFeedback[] | null;
  notes?: string;                // 用户手动添加的备注
  // ↓ Phase B 新增
  rating?: number;               // 用户评分 1-5
  favoriteReason?: string;       // 收藏原因（结构化标签）
  reasonTags?: string[];         // 原因标签，如 ['hook吸睛', '语气贴地', 'CTA有力', '句式节奏好']
  // ↓ R1 管理员审核（只读，来自 bootstrap；用户不可写）
  adminReview?: {
    status: 'adopted' | 'changes_requested';
    note: string | null;
    updatedAt: string;
  } | null;
}

// R1（2026-07-14）：收藏卡折叠态展示管理员审核高亮（已采纳正向 / 需修改警示）；
// 同步 upsert 不得发送或覆盖 adminReview。运维分组见 docs/admin/review-group-management.md。
```

**收藏库面板**（`FavoritesPanel`）：

- **入口**：Header 右侧「收藏库」按钮（带数量角标）
- **展示方式**：右侧滑出面板（`max-w-md`），按时间分组（今天/昨天/本周/更早）
- **每条收藏展示**：
  - 文案版本标签 + 收藏时间
  - 文案内容预览（折叠至 3 行）
  - **展开查看**：原始输入、生成参数网格（平台/语气/粤语程度/中英夹杂/创作自由度/品牌/产品/结构化简报/目标日期）、审核评分快照
  - **备注编辑**：点击即可添加/修改，回车保存
- **操作按钮**：
  - 📋 **复制文案** — 一键复制文案全文到剪贴板，复制后图标变 ✅ 2秒
  - 🔗 **载入参数** — 将所有生成参数恢复到 InputPanel，实现一键微调
  - 🗑 **删除收藏**

**微调工作流**：

```
收藏库 → 点击 🔗 载入参数 → 参数自动填入 InputPanel
       → 修改原文/调整 slider → 重新生成 → 再次收藏优秀结果
```

此工作流完整复现了「生成 → 收藏 → 复盘 → 微调 → 再生成」的迭代闭环。

**存储策略**：`localStorage`（key: `hk-cantonese-bookmarks`），与 SavedConfig 机制一致。无需后端。

---

### Phase B — 用户偏好学习（待开发 📋）

> 需求来源：用户反馈 (2026-07-10)
> 
> 详细设计见：`docs/spec-v2.1-进度条与反馈系统.md` § 3「用户偏好档案」

#### B.1 收藏评价系统 ✅ 已实现（2026-07-10）

> 实现方式：评价面板嵌入 `FavoritesPanel` 每条收藏卡片中，非独立弹窗。评分/标签/原因**实时保存**（每次操作直接 dispatch + persist），无需额外「储存」按钮。

收藏后展开收藏卡片的评价区域即可评分：

```
┌──────────────────────────────────────────┐
│ ⭐ 已收藏 · 2026-07-10 14:30             │
│                                          │
│ 📝 这篇文案好在哪？（可选，帮助 AI 学习）   │
│                                          │
│ 评分：☆☆☆☆☆  (1-5)                       │
│                                          │
│ 原因标签（可多选）：                       │
│ ☐ hook 吸睛    ☐ 语气贴地                 │
│ ☐ CTA 有力     ☐ 句式节奏好               │
│ ☐ emoji 自然   ☐ 品牌调性匹配             │
│ ☐ 创意突出     ☐ 适合目标受众              │
│                                          │
│ 自定义原因：[________________]            │
│                                          │
│ [储存评价]                                │
└──────────────────────────────────────────┘
```

**评价数据结构扩展**：

```ts
interface BookmarkedCopy {
  // ... Phase A fields ...
  
  /** Phase B: User rating 1-5 */
  rating?: number;
  /** Phase B: Free-text reason for favoriting */
  favoriteReason?: string;
  /** Phase B: Structured reason tags */
  reasonTags?: string[];
}
```

#### B.2 用户偏好档案（User Preference Profile）

系统从用户的收藏评价中自动聚合偏好档案：

```ts
interface UserPreferenceProfile {
  /** Last updated timestamp */
  updatedAt: string;
  /** Number of rated bookmarks used for profiling */
  sampleSize: number;
  
  /** Top 3 reason tags by frequency */
  topTags: string[];
  /** Average rating across all bookmarks */
  avgRating: number;
  
  /** Inferred preferences */
  inferred: {
    /** Preferred tone leaning */
    preferredTone?: BrandTone;
    /** Preferred cantonese level (avg of settings) */
    avgCantoneseLevel: number;
    /** Preferred creativity level */
    avgCreativityLevel: number;
    /** Most-often-used platform */
    topPlatform: Platform;
    /** Preferred hook types (from variantMeta analysis) */
    preferredHookTypes: string[];
    /** Preferred emoji density (avg from content analysis) */
    avgEmojiDensity: number;
    /** Preferred CTA styles */
    preferredCtaStyles: string[];
  };
}
```

**偏好档案的使用**：

- 在 InputPanel 显示轻量偏好摘要：「🎯 你的偏好：语气偏活泼 · 粤语 Lv.3 · 喜欢反問式hook」（非阻塞信息条）
- 作为下次生成的**软性引导**——不强制修改参数，但 Prompt 中引用偏好

#### B.3 多选收藏案例注入 Prompt ✅ 已实现（2026-07-10）

> 实现方式：`ReferenceCaseSelector` 组件始终嵌入并显示在 `InputPanel`。折叠态必须展示“可用 N 条 · 已选 N/3”，避免用户误以为功能消失；只有评分 ≥★4 的收藏进入可选列表，最多选 3 条注入。选中的案例随 generate 请求传递到服务端，在 Prompt Layer 3 注入 Few-Shot 参考段。无合格案例时保留入口并展示空状态。

> 2026-07-13 可靠性补充：已失效或低于 4 星的历史 ID 不得计入“已选”；DeepSeek 与自部署模型必须让每个平台版本实际应用至少 2 项可辨识技法，同时不得把正例主题/事实当成新文案资料；当模型不可用并降级到规则引擎时，也必须按 Hook、Emoji、CTA 等标签进行确定性风格映射，不得静默忽略参考案例。

### G1.1 管理员收藏只读访问

- `admin` 与 `super_admin` 均可进入管理后台“用户收藏”页签。
- 列表只返回用户显示名、邮箱、平台、评分、备注、收藏原因、标签和收藏时间，不返回正文。
- 正文仅通过单条详情接口读取；顺序必须为 `exists → 写 audit_log → 读取正文`，审计失败时拒绝返回正文。
- 前端允许单条复制正文；禁止编辑、删除、调整评分及批量导出。
- 服务端通过受信 `service_role` 跨用户读取；浏览器端 Supabase RLS 不作放宽。

### 配置管理中的参考案例参数

- `SavedConfig` 必须保存 `selectedReferenceCaseIds`，与语气、平台、粤语程度等参数同属一份生成配置。
- 已登录用户的配置先写入账号隔离的本地状态，再由云同步写入 Supabase `saved_configs.config` JSON；不新增数据库列。
- `configToSyncConfig` 与 `configRecordToSavedConfig` 必须双向保留该字段；旧配置缺少字段时按 `[]` 处理。
- 加载配置时恢复参考案例 ID；若对应收藏已删除或评分低于 4 星，参考案例选择器与生成请求仍按有效性规则过滤，不能注入失效案例。
- 配置管理列表的提示信息显示“参考 N”，用户可确认该配置包含多少条参考案例。

**UI 交互**：

在 InputPanel 固定增加「📌 参考收藏案例」折叠区域（入口始终显示；评分 ≥★4 的收藏才计入可用数量）：

```
┌─────────────────────────────────────────┐
│ 📌 参考收藏案例 (可选)                   │
│ 基于你之前收藏的优秀案例，AI 将对齐风格    │
│                                         │
│ ☑ 美心月餅 · IG · ★5「hook超吸睛…」     │  ← 多选 checkbox
│ ☐ 奇華 · FB · ★4「语气好贴地…」          │
│ ☑ 榮華 · IG · ★5「emoji用得好自然…」     │
│                                         │
│ 已选 2 条 · 将作为 Few-Shot 参考注入     │
└─────────────────────────────────────────┘
```

**Prompt 注入格式**（注入到 Layer 3 Contextual）：

```
## 📌 用戶收藏嘅優秀案例（Few-Shot 個人化參考）

以下係用戶過往收藏並評為高質量嘅文案，請參考佢哋嘅技法，
生成與之風格對齊——但唔好抄內容——嘅新文案：

### 參考案例 1（★5 · hook吸睛 · 語氣貼地）
> 「是但問個港島人，中秋必買嘅餅舖係？留言話我知👇」

用戶評價：hook 即刻吸引注意力，語氣似朋友傾偈好自然
技法提取：反問式hook → 地區標籤 → 簡單直接CTA → 單emoji精準引導

### 參考案例 2（★5 · emoji自然 · 創意突出）
> 「今年食咗5間，呢間嘅奶黃流心真係世一🏆 唔信你試下」

用戶評價：個人經驗開頭好有說服力，挑釁式結尾令人想試
技法提取：數據開頭(5間) → 口碑用語(世一) → 挑戰式結尾 → emoji加持

---
**參考以上案例嘅共通技法，特別係用戶偏好嘅：
- hook吸睛（反問式/個人經驗式開頭）
- 語氣貼地（口語化、唔好太正式）
- 簡潔有力嘅CTA**
```

**选择规则**：
- 默认展示最近的 5 条已评价收藏（按 rating 降序）
- 用户可多选 1-3 条注入
- 已选案例的 `favoriteReason` 和 `reasonTags` 一同注入，告诉模型「用户喜欢这个案例的什么」
- 未评价的收藏不显示在此列表中

#### B.4 个性化优化循环

完整闭环：

```
第 1 次生成 → 收藏 + 评价（★5, tags: hook吸睛, 语气贴地）
    ↓
第 2 次生成 → 勾选收藏案例注入 → 模型对齐风格 → 生成新文案
    ↓
第 2 次收藏 + 评价（★4, tags: CTA有力, 句式节奏好）
    ↓
偏好档案更新 → topTags: [hook吸睛, 语气贴地, CTA有力]
    ↓
第 3 次生成 → Prompt 自动引用偏好档案 + 多选最新收藏案例
    ↓
    ... 循环，越来越精准 ...
```

**关键技术点**：
- 偏好档案从 ≥3 条已评价收藏开始生成（样本量不足时显示「继续收藏以训练 AI 了解你的偏好」）
- 每次新评价后自动更新偏好档案（增量计算，无需重跑）
- 用户可手动重置偏好档案
- 偏好档案存储于 `localStorage`（key: `hk-cantonese-preference-profile`）

**涉及文件（Phase B 增量）**：

| 文件 | 变更 | 描述 | 状态 |
|------|------|------|:--:|
| `client/src/types/index.ts` | 修改 | +`UserPreferenceProfile`，扩展 `BookmarkedCopy`（rating, favoriteReason, reasonTags）+ `REASON_TAGS` 常量 | ✅ |
| `client/src/context/AppContext.tsx` | 修改 | +偏好档案计算 + `UPDATE_BOOKMARK_RATING` action | ✅ |
| `client/src/components/favorites/BookmarkRatingPanel.tsx` | **新建** | 收藏评价面板（星级 + 原因标签 + 自定义原因） | ❌ 内嵌于 FavoritesPanel |
| `client/src/components/favorites/FavoritesPanel.tsx` | 修改 | +评价面板嵌入 + 📋复制按钮 + 多选 checkbox | ✅ |
| `client/src/components/input/ReferenceCaseSelector.tsx` | **新建** | 📌 参考收藏案例多选组件 | ✅ |
| `client/src/components/input/InputPanel.tsx` | 修改 | 嵌入 ReferenceCaseSelector + 偏好摘要条 | ✅ |
| `client/src/components/input/PreferenceSummary.tsx` | **新建** | 🎯 用户偏好摘要条（非阻塞） | 📋 |
| `server/src/prompts/diagnoseGenerate.ts` | 修改 | +收藏案例 Few-Shot 注入 + 偏好引用 | ✅ |

---

### Phase 2 涉及文件（原 P2.10 已实现部分）

| 文件 | 变更 | 描述 |
|------|------|------|
| `client/src/types/index.ts` | 修改 | +`BookmarkedCopy` 接口，+3 个 action 类型 |
| `client/src/context/AppContext.tsx` | 修改 | +`ADD_BOOKMARK`/`REMOVE_BOOKMARK`/`UPDATE_BOOKMARK_NOTES` reducer，localStorage 持久化 |
| `client/src/components/results/BookmarkButton.tsx` | **新建** | ☆/★ 收藏按钮（Star 图标） |
| `client/src/components/results/ResultCard.tsx` | 修改 | +`variantKey` prop，嵌入 BookmarkButton |
| `client/src/components/results/ResultsPanel.tsx` | 修改 | 传递 `variantKey` 到 ResultCard |
| `client/src/components/favorites/FavoritesPanel.tsx` | **新建** | 收藏库右侧滑出面板（~200 行） |
| `client/src/components/layout/Header.tsx` | 修改 | +收藏库入口按钮（含数量角标） |
| `client/src/App.tsx` | 修改 | +FavoritesPanel 容器 + 自定义事件监听 |

#### P2.11 — 正例文案参考（Reference Exemplar Copy）

> 功能状态：📋 已纳入规格，待实现
>
> 来源：用户需求 + `marketing-skills:copywriting`（swipe file / 正例学习模式）

**动机**：竞品搜索（H4-1）帮助用户发现竞品在投广告，但用户往往已经心中有数——他们见过某些竞品或同类产品的优秀文案，想直接把这几条作为「标杆」喂给模型。这是 copywriter 日常工作中的 **swipe file**（参考文案库）模式的数字化。

**与已有功能的关系**：

| 已有功能 | 定位 | 与 P2.11 的区别 |
|---------|------|----------------|
| **H4-1 竞品广告检索** | 自动从 Meta Ad Library 拉取竞品在投广告 | 被动发现；用户不知道会搜出什么 |
| **P2.11 正例文案参考** | 用户手动输入已知的优秀竞品/同类文案 | 主动输入；用户明确知道「这就是我想要的」 |
| **当下语感 (Tab 1)** | 提取 HK 社媒热门帖文的句式骨架 | 低门槛参考；偏「语感」而非「竞品对标」 |
| **P2.11** | 用户精选 1-3 条竞品文案作为标杆 | 高精准参考；偏「竞品对齐」和「差异化超越」 |

**核心理念**：

> 用户说：「我要写一条像___那样的文案，但比它更好。」
>
> P2.11 把这个自然的创作意图数字化了。

**设计规格**：

**位置**：InputPanel 中，与竞品搜索框同区域，紧邻 `CompetitorSearchInput` 下方：

```
┌─────────────────────────────────────────┐
│ 🔍 竞品品牌搜索                [___ ]  │  ← 已有 (H4-1)
│    [美心月餅] [奇華] [榮華] [+自定义]    │
│                                         │
│ 📋 正例文案参考 (可选)            [+]   │  ← 🆕 P2.11
│ ┌─────────────────────────────────────┐ │
│ │ 贴上 1-3 条竞品或同类产品的优秀      │ │
│ │ 文案，AI 将分析其技法并融入生成...   │ │
│ │                                     │ │
│ │ 例 1: 「是但問個港島人，中秋...」   │ │
│ │ ───────────────────────────────     │ │
│ │ 例 2: （空槽位，点击 + 添加）       │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**数据结构**：

```ts
/** A single reference exemplar entered by the user */
interface ReferenceExemplar {
  id: string;              // UUID
  text: string;            // 文案全文
  source?: string;         // 来源标注（可选），如 "美心月餅 FB 廣告"
  notes?: string;          // 用户备注，如 "这句 hook 很好"
}

// 扩展 AppSettings
interface AppSettings {
  // ... existing fields ...
  /** P2.11: User-provided reference exemplars for style emulation */
  referenceExemplars?: ReferenceExemplar[];
}
```

**Prompt 注入策略**：

> **不自动注入** — 用户主动输入才注入。空的 exemplar 列表 = 不注入，保持现有行为不变。

当 `referenceExemplars` 非空时，在生成 prompt 的 **Layer 3 (Contextual)** 注入：

```
## 📋 正例文案參考（Reference Exemplars）

以下係用戶提供嘅競品/同類優秀文案，請分析佢哋嘅技法，
然後喺生成時融入以下特質——但**唔好抄內容**：

### 正例 1
> 「是但問個港島人，中秋必買嘅餅舖係？留言話我知👇」

**技法分析**：
- Hook：反問式開頭，即刻製造互動意圖
- 句式：短句 + 口語節奏，似朋友傾偈
- CTA：直接要求留言，零摩擦
- Emoji：1 個（👇），精準用於引導行動

### 正例 2
> 「食咗咁多年月餅，今年呢款真係一試難忘——唔係賣廣告，係真心推薦」

**技法分析**：
- Hook：個人經驗背書（"食咗咁多年"）
- 結構：時間線 → 體驗 → 轉折（"唔係賣廣告"）→ 推薦
- 語氣：真誠、非銷售感
- 技巧：用否定句增強可信度

### 正例 3
...

---
**生成要求**：
1. 分析以上正例嘅共通技法（Hook 類型、句式節奏、Emoji 密度、CTA 風格）
2. 將呢啲技法應用喺你嘅文案中
3. **絕對唔好直接抄正例嘅內容、句子、或結構**——學嘅係技法，唔係文本
4. 如果正例同你嘅品牌/產品唔同，只需要提取通用嘅表達技法
```

**AI 自动技法提取**（Prompt 中的 meta-instruction）：

模型被要求从每条正例中提取：
- **Hook 类型**：反問式 / 宣言式 / 故事式 / 數據式 / 挑釁式 / 共鳴式
- **句式节奏**：短句快节奏 / 长句叙事 / 混合型
- **Emoji 用法**：密度（个/100字）、位置（开头/中间/结尾）、功能（分段/情绪/CTA）
- **CTA 风格**：直接命令 / 软性引导 / 隐含 CTA / 无 CTA
- **情感基调**：搞笑 / 真誠 / 緊迫 / 溫暖 / 專業 / 反叛

**UI 交互细节**：

| 操作 | 行为 |
|------|------|
| 点击 `[+]` 按钮 | 新增一个空输入槽位（最多 3 个） |
| 粘贴文案 | 自动识别换行，每条独立存储 |
| 来源标注 | 每个槽位下方有小字输入框，可选填来源（如 "美心 FB 廣告"） |
| 删除 | 每个槽位右侧有 ✕ 按钮 |
| 清空全部 | 底部「清除全部正例」文字按钮 |
| 空状态 | 显示 placeholder 提示：「贴上 1-3 条竞品或同类产品的优秀文案...」 |

**约束**：
- 最多 3 条正例（防止 prompt 膨胀 + 防止模型过度依赖参考）
- 每条最多 500 字
- 存储：`AppSettings.referenceExemplars`，随 settings 一同持久化到 `localStorage`

**与 P2.10（收藏库）的联动**：

用户可以：
1. 在收藏库中找到之前收藏的竞品广告（来自 H4-1 搜索结果）
2. 复制其文案正文
3. 粘贴到「正例文案参考」区域
4. 作为下次生成的正例标杆

此联动实现了「竞品发现 → 收藏 → 正例学习 → 生成超越」的完整闭环。

**涉及文件**：

| 文件 | 变更 | 描述 |
|------|------|------|
| `client/src/types/index.ts` | 修改 | +`ReferenceExemplar` 接口，扩展 `AppSettings.referenceExemplars` |
| `client/src/constants/index.ts` | 修改 | `DEFAULT_SETTINGS.referenceExemplars: []` |
| `client/src/context/AppContext.tsx` | 修改 | +`SET_REFERENCE_EXEMPLARS` action，normalize + persist |
| `client/src/components/input/ReferenceExemplarInput.tsx` | **新建** | 正例输入 UI（动态槽位、来源标注、删除） |
| `client/src/components/input/InputPanel.tsx` | 修改 | 嵌入 ReferenceExemplarInput |
| `server/src/prompts/diagnoseGenerate.ts` | 修改 | +正例 Prompt 注入逻辑（技法分析 + 生成要求） |

### Phase 2 文件变更

| # | 文件 | 变更类型 | 描述 |
|---|------|---------|------|
| 6 | `server/src/services/competitorService.ts` | **新建** | Meta Ad Library 检索封装 |
| 7 | `server/src/services/igSearchService.ts` | **新建** | IG Hashtag JSON 解析 |
| 8 | `server/src/services/youtubeSearchService.ts` | **新建** | YouTube Data API 封装 |
| 9 | `server/src/services/quickCheckService.ts` | **新建** | 纯本地规则引擎 |
| 10 | `server/src/routes/generate.ts` | 修改 | +competitor +refresh 路由 |
| 11 | `server/src/prompts/audit.ts` | 修改 | +3 审核维度 + CTA 评分 + vs 竞品 |
| 12 | `client/src/components/layout/InspirationPanel.tsx` | **新建** | 灵感面板容器 |
| 13 | `client/src/components/layout/ThreePanel.tsx` | 修改 | Center 下方嵌入 InspirationPanel |
| 14 | `client/src/components/input/InputPanel.tsx` | 修改 | +竞品搜索框 + 目标发布时间 |
| 15 | `client/src/components/results/QuickCheck.tsx` | **新建** | 快速检查结果展示 |
| 16 | `client/src/components/audit/AuditPanel.tsx` | 修改 | +新维度 + CTA + vs 竞品 |

---

## 附录 C：与已有文档的关系

| 文档 | 状态 | 与本 spec 的关系 |
|------|------|----------------|
| `optimization-roadmap任务关联到设计文档.md` | **被取代** | 18 项优化方向全部纳入本 spec，扩展为 25 项 |
| `inspiration-design功能设计策略.md` | **被整合** | 4 Tab 灵感面板设计完整纳入 Section 5 |
| `comprehensive-spec-v2.md`（本文档） | **当前权威** | 整合以上两份文档 + pm-skills 方法论 |
| 🆕 `spec-v2.1-进度条与反馈系统.md` | **新增** | 进度条 + 用户偏好档案 + 正例反馈系统 |
| 🆕 `RAG优化spec.md` | **新增** | ⏸️ 延后 — RAG 检索优化（Phase 3 远期） |

---

> **下一步**：请确认优先级排序，然后可以开始执行 Phase 0 或 Phase 1 中不依赖 Phase 0 的项目（P1.1、P1.2、P1.4）。

## 运行时不变量：生成历史恢复（2026-07-13 补充）

1. 完成状态的历史记录可把原文、生成结果、诊断、审核、评分、消费者反馈及当次工作台配置载回 `/app`。
2. 新生成任务必须将完整 `AppSettings` 写入现有 `generation_jobs.brief.workbenchSettings`；该字段只用于恢复，不得改变 Prompt 或模型输入语义。
3. 旧任务继续从 `brief` 的既有字段恢复结构化写作、消费者画像、参考收藏案例和话题日历选择；历史中从未保存过的字段不可伪造。
4. 历史配置载入必须进行运行时校验并保持 owner-scoped session 隔离；不得放宽 RLS 或跨用户读取。
5. 后续切片不得删除历史列表/详情的“文字消失 → 打开对应历史 → 载入工作台”恢复路径。

## 运行时不变量：Free 收藏与生成历史容量（2026-07-13 补充）

1. Free 最多新增 10 条收藏；Pro 不受本切片收藏容量限制。达到上限后，更新和删除已有收藏仍必须可用。
2. 既有超额收藏不得删除或覆盖；Free 只访问按 `savedAt` 倒序的最新 10 条，Pro 解锁全部。
3. Free 只访问按 `createdAt` 倒序的最新 15 条生成历史；搜索只发生在这 15 条内，详情 URL 不得绕过。
4. 当前套餐不可访问的收藏不得进入参考案例列表或生成 Prompt。
5. 收藏新增、批量导入预检、历史列表和详情必须由服务端实施套餐门禁；套餐解析失败按 Free。
6. 变更本容量必须同步更新 PRD、SDD、测试、Pricing 展示和回归矩阵；不得借容量调整修改生成额度、支付验签或 RLS。
