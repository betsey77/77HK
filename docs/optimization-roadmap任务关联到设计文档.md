# 🧭 思念文案引擎 — 跨技能启发与优化路线图

> 分析日期：2026-06-13
> 分析来源：`/xhs-marketing-strategy`、`/marketing-skills:copywriting`、`/marketing-skills:copy-editing`、`/facebook-ads-library-search`
> 目标：将四个外部 Skill 的方法论转化为本项目可落地的优化方向，使开发有序、有条理

---

## 一、当前项目能力全景

```
[用户输入原文]
     │
     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  原文诊断     │    │  5 版生成     │    │  五维审核     │
│  · 简繁检测   │    │  · standardHK │    │  · 港味 30%   │
│  · 内地词替换 │    │  · lightCanto │    │  · 品牌安全 20%│
│  · 合规红线   │    │  · ig         │    │  · 平台适配 20%│
│  · 问题清单   │    │  · facebook   │    │  · 可读性 15%  │
│              │    │  · shorts     │    │  · 创意 15%    │
└──────────────┘    └──────────────┘    └──────────────┘
     │                                       │
     └───────────────┬───────────────────────┘
                     ▼
            ┌─────────────────┐
            │  消费者反馈模拟    │
            │  · 多 persona 评审 │
            │  · 修改建议生成    │
            │  · apply-suggestion│
            └─────────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │  重新评估 + 对比   │
            └─────────────────┘
```

**现有核心能力（10 项）：**
1. ✅ 简繁检测 + 内地腔替换
2. ✅ 5 平台变体生成（standardHK / lightCantonese / IG / Facebook / Shorts）
3. ✅ 5 维加权审核评分（港味·品牌安全·平台适配·可读性·创意）
4. ✅ 修改前后 diff 高亮（prefix-suffix 字符级算法）
5. ✅ 品牌表达红线（用户自定义 + 内置 11 类合规规则）
6. ✅ 消费者角色模拟反馈（多 persona 评审 + 修改建议）
7. ✅ 手动编辑文案（✏️ pencil → textarea）
8. ✅ 评分递增规则引擎（小幅 ±5，中等 ±10，未改动维度 ±3）
9. ✅ 保存/加载配置（localStorage + 预设管理）
10. ✅ 深色/浅色主题切换（Tailwind CSS v4 `light:` 变体）

**关键技术栈：**
- 主生成引擎：Featherless.ai `CantoneseLLMChat-v1.0-32B`
- 审核/反馈引擎：DeepSeek API `deepseek-chat`
- 备用规则引擎：本地 `fallbackService.ts`（正则替换 + 模板拼接）

---

## 二、Skill-by-Skill 启发分析

### 📱 Skill 1: `xhs-marketing-strategy`（小红书全栈营销策略）

**核心方法论：**
| 维度 | xhs-skill 提供什么 | 思念项目当前状态 |
|------|-------------------|-----------------|
| 内容模板 | 5 套经过验证的笔记模板（干货/种草/经验/清单/互动），每套含标题公式+封面文字+正文骨架+互动引导 | ❌ 无模板系统，仅按语气调参数生成 |
| 标题公式 | 6 大标题公式（数字+利益点、痛点+方案、身份+推荐、对比颠覆、场景+效果、限定+紧迫） | ❌ 无标题生成能力 |
| 平台算法 | CES 评分权重模型（收藏 1: 点赞 1: 评论 4: 转发 4: 关注 8），流量池晋升机制 | ❌ 完全不考虑平台算法 |
| 发布时间 | 7 时段流量指数表（午休 ★★★★★、晚间 ★★★★★），工作日 vs 周末内容策略 | ❌ 无发布策略 |
| 账号阶段 | 冷启动→成长→成熟的 3 阶段策略框架，每阶段有不同 KPI | ❌ 不考虑账号成熟度 |
| 合规体系 | 5 大违禁词分类（绝对化/医疗/金融/化妆品/引流）+ 审核流程 + 恢复策略 | ⚠️ 有 11 类合规规则但偏 HK 法规，缺平台层面的违禁词体系 |
| 竞品分析 | 竞品分析框架、对标账号拆解 | ❌ 无竞品分析能力 |

**🔑 关键启发：**

#### H1-1：平台内容模板系统
> 当前项目生成 5 个变体但缺少「内容结构模板」引导。可以借鉴 xhs 的 5 套模板思路，为 HK 社媒建立等效模板库：

| xhs 模板 | HK 等效场景 | 适用变体 |
|----------|-----------|---------|
| 干货教程类 | 教學/攻略帖（如「教你揀靚蛋黄月饼」） | Facebook, standardHK |
| 种草推荐类 | 好物推薦/開箱（如「呢隻月餅真心推介」） | IG, lightCantonese |
| 经验分享类 | 真實用家分享（如「買月餅中過嘅伏」） | lightCantonese, facebook |
| 清单合集类 | 合集/懶人包（如「2026中秋月餅Top 5」） | IG, shorts |
| 互动讨论类 | 投票/互動帖（如「你係流心定傳統派」） | IG, Shorts |

#### H1-2：标题公式注入 Prompt（⚠️ 需先做 HK 适配评估）
> xhs 的 6 大标题公式基于内地用户的内容消费习惯和平台算法，**不能直接照搬到香港社媒**。需要先做本地化适配评估：

**市场差异分析：**

| 维度 | 内地 xhs 用户 | 香港社媒用户 | 对标题公式的影响 |
|------|-------------|------------|----------------|
| 阅读习惯 | 信息流快速滑动，标题需强冲击力 | 相对慢速浏览，对夸张标题有免疫力 | 「緊迫感公式」效果可能打折扣 |
| 信任机制 | KOL/KOC 个人背书驱动 | 品牌信誉+朋友推荐双驱动 | 「身份+推薦」需调整为「街坊認證」风格 |
| 语言偏好 | 简体中文+网络流行语 | 粤语+繁体+中英夹杂 | 数字公式保留，但具体话术需粤语化 |
| 对营销的敏感度 | 相对容忍硬广 | 对「广告味」高度敏感 | 「限定+緊迫感」公式极可能被判定为骗子广告 |
| 平台算法 | CES 评分（收藏·点赞·评论·转发·关注） | FB 加权互动（分享优先）、IG 视觉优先 | 不同平台对标题的需求不同 |

**建议的 HK 适配评估流程：**
1. **收集样本**：搜集 50-100 条香港 IG/Facebook 高互动帖文的标题
2. **归纳模式**：从数据中归纳出 HK 本地的标题模式（而非套用 xhs 公式）
3. **A/B 验证**：选择 3-5 个候选公式，在 prompt 中注入后对比生成质量
4. **迭代收敛**：保留在 HK 市场验证通过的公式，删除不适配的

**初步假设（待验证）——HK 社媒标题模式可能更接近：**
```
📝 **港式標題模式（待驗證）**：
- 直述價值型：「呢款月餅我食咗三年，今年終於出禮盒裝」
- 街坊共鳴型：「是但問個港島人：中秋必買嘅餅舖係？」
- 反問互動型：「你屋企仲食傳統雙黃，定係已經轉咗冰皮？」
- 資訊懶人包型：「中秋送禮懶人包｜$100-$500 預算點樣揀」
```

> ⚠️ **结论**：H1-2 的优先级从 P0 降为 **需要前置研究**——在标题公式通过 HK 适配验证之前，不应直接注入 prompt。

#### H1-3：发布策略模块（新特性）
> 在生成结果面板增加「發布建議」卡片：
> - 最佳发布时间段（含数据支撑）
> - 推荐发布平台优先级
> - 话题标签建议（Hashtag）
> - 互动引导模板（comment bait）

#### H1-4：合规体系扩展
> 当前 `complianceRules.ts` 聚焦 HK 法规（商品说明条例、不良广告条例等），可补充**平台层**违禁词：
> - 绝对化用语（廣告法風格但適用於 HK 平台審核）
> - 化妆品/食品特殊违禁词
> - 限流触发行为（重复发布、诱导互动、外链引导）

---

### ✍️ Skill 2: `marketing-skills:copywriting`（转化文案写作）

**核心方法论：**
| 维度 | copywriting-skill 提供什么 | 思念项目当前状态 |
|------|--------------------------|-----------------|
| 写前调研 | 4 步上下文收集（目的·受众·产品·流量来源） | ⚠️ 有 brandName/productName/consumerPersonas 但不够结构化 |
| 写作原则 | 6 条原则（清晰>聪明、利益>功能、具体>模糊、客户语言>公司语言、一区一意、诚实>夸张） | ❌ Prompt 中未系统化注入这些原则 |
| 页面结构 | 完整的 Above the Fold → Social Proof → Problem → Solution → How It Works → Objections → CTA 框架 | ❌ 无结构框架，生成结果结构依赖模型自由发挥 |
| CTA 质量 | 强 CTA vs 弱 CTA 分类，公式「动作动词 + 得到什么 + 限定条件」 | ⚠️ CTA 未被独立评估 |
| 语音语调 | 正式度 + 品牌个性的双维度确立 | ⚠️ 5 档 Tone 偏抽象，缺少「正式度」维度 |
| 输出格式 | 正文 + 注释 + 备选标题 + SEO meta | ❌ 只输出纯文本 |

**🔑 关键启发：**

#### H2-1：写前结构化上下文（Prompt 增强）
> 在 `diagnoseGenerate.ts` 的 system prompt 最前面注入结构化写作简报：
```
**📋 寫作簡報（Writing Brief）**：
- 目的：將 [品牌] 的 [產品] 介紹給 [目標受眾]，在 [平台] 上引發 [期望行動]
- 受眾語言：香港 [年齡層] 的日常用語，佢哋通常用 [apps] 獲取資訊
- 核心賣點：產品嘅 [差異化特徵] 解決咗 [痛點]
- 期望行動：[購買/查詢/分享/留言]
```

#### H2-2：「Benefit over Feature」转化层
> 当前生成偏重「描述产品」而非「转化读者」。新增一个审核维度或 prompt 指令：
```
**💡 So What 規則（利益優先原則）**：
每個關於產品嘅描述後面，都要回答「咁又點？」：
- ❌ 唔好：「我哋嘅月餅用湖南湘潭蓮子」
- ✅ 要：「我哋用湖南湘潭蓮子——煮出嚟嘅蓮蓉特別香滑，咬落唔會起沙」
```

#### H2-3：CTA 独立评分维度
> 在当前五维评分体系中增加 CTA 子评估：
```
**CTA 評分錨點**：
- 0-20：冇 CTA 或者只係「了解更多」
- 30-50：有 CTA 但模糊，如「快啲嚟買」
- 60-75：清晰講到做咩 + 得到咩，如「即刻去官網落單，首 100 名免運費」
- 80-95：有緊迫感 / 社交證明加持，如「上星期已經賣出 300 盒，呢批得返 50 盒咋」
```

#### H2-4：备选标题生成
> 每个变体额外生成 2-3 个备选标题/首句：
```ts
// 扩展 Variants 类型
interface VariantMeta {
  headline: string;          // 主标题
  altHeadlines: string[];    // 备选标题
  ctaLine: string;           // 行动召唤句
}
```

---

### 🔍 Skill 3: `marketing-skills:copy-editing`（文案编辑与润色）

**核心方法论：**
| 维度 | copy-editing-skill 提供什么 | 思念项目当前状态 |
|------|--------------------------|-----------------|
| 七遍编辑法 | Clarity → Voice → So What → Prove It → Specificity → Emotion → Zero Risk，每遍聚焦一维，做完循环验证 | ⚠️ 消费者建议+重新评估流程与之相似但维度不同 |
| 专家小组评分 | 3-5 个专家角色各从专业角度 1-10 分独立评分，迭代至平均 8+ | ⚠️ 有 ConsumerPersona 模拟但他们的「建议」不是评分制的 |
| 快速编辑检查 | 词语级（删除 very/actually/just）+ 句子级（每句≤25词/单意）+ 段落级（2-4句/段） | ❌ 无快速检查模式 |
| 内容刷新框架 | 何时 Refresh vs Rewrite 的决策矩阵 + 6 步刷新流程 | ❌ 无刷新模式 |
| 质检清单 | 28 项 checklist（4 项前置 + 24 项七遍检查 + 4 项终检） | ❌ 无 QA checklist |

**🔑 关键启发：**

#### H3-1：七遍编辑法 → 审核维度重构
> 当前五维评分（港味·品牌安全·平台适配·可读性·创意）可以与七遍编辑法交叉映射，形成更完整的审核体系：

| 七遍法 | 覆盖的现有维度 | 缺失的评估 |
|--------|-------------|----------|
| Clarity | 可读性（部分）| 句式复杂度、代词清晰度、信息密度 |
| Voice | 港味纯正度（部分）| ⚠️ **语气一致度**：全文正式/口语是否统一 |
| So What | — | ⚠️ **利益转化度**：每个 feature 是否连接了 benefit |
| Prove It | — | ⚠️ **证据充分度**：数据/案例/见证是否具体 |
| Specificity | 创意/吸引力（部分）| ⚠️ **具体度**：是否有数字/时间/实例 |
| Emotion | 创意/吸引力（部分）| ⚠️ **情感共鸣度**：是否让人「有感觉」 |
| Zero Risk | 品牌安全度（部分）| 消费者异议处理、信任信号 |

> **建议**：新增「語感一致度」和「利益轉化度」两个可选审核子维度（开关控制，避免 prompt 过长）

#### H3-2：专家小组评分模式
> 当前 ConsumerPersona 生成「反馈+建议」，改为或新增「专家评分」模式：
```ts
interface ExpertScore {
  personaId: string;
  personaName: string;
  lens: 'clarity' | 'voice' | 'sowhat' | 'proof' | 'specificity' | 'emotion' | 'risk';
  score: number;        // 1-10
  critique: string;     // 扣分原因
  suggestion: string;   // 改进建议
}
```
> 每个 persona 从 2-3 个 lens 独立评分，最终汇总展示「专家小组评分报告」

#### H3-3：快速规则检查模式（本地版 Seven Sweeps）
> 不依赖 AI 的快速文案检查器，纯正则 + 规则引擎：
> - 检测过长的句子（>30 字标记）
> - 检测被动语态（「被」「遭受」「受到」）
> - 检测模糊词（「優化」「提升」「改善」「加強」）
> - 检测弱化词（「好」「非常」「相當」「十分」）
> - 检测缺少数字的声明
> - 在 ResultsPanel 中新增「快速檢查」Tab

#### H3-4：内容刷新模式（Rewrite Mode）
> 新增操作模式：不是从零生成，而是「优化已有文案」：
> - 用户粘贴已发布的旧文案
> - 系统保留核心信息，做 6 步刷新（事实更新→准确度→语音→SEO→证据→结构）
> - 输出「优化前 vs 优化后」对比，标注改动理由
> - 前端在 InputPanel 增加模式切换：「🆕 全新生成 | 🔄 刷新舊文」

---

### 📊 Skill 4: `facebook-ads-library-search`（Meta 广告库搜索）

**核心方法论：**
| 维度 | fb-ads-skill 提供什么 | 思念项目当前状态 |
|------|---------------------|-----------------|
| 竞品广告爬取 | 按关键词/Page ID 搜索 Meta 广告库，获取广告文案、CTA、创意格式、花费估算 | ❌ 完全无竞品数据 |
| 结构化输出 | JSON 格式：body/title/cta_text/link_url/cards/images/videos + 投放平台 + 起止时间 | ❌ N/A |
| 多维度筛选 | 按国家/平台/媒体类型/广告类型/活跃状态筛选 | ❌ N/A |
| 分页批量获取 | cursor 分页 + 批量脚本 + 断点续抓 | ❌ N/A |

**🔑 关键启发：**

#### H4-1：竞品文案参考库
> 这是最具差异化的功能方向。在生成/审核时提供竞品数据作为参考：
> - **输入阶段**：用户输入竞品品牌名/Facebook Page → 爬取其活跃广告文案 → 展示为参考
> - **审核阶段**：AI 审核时对比竞品文案（如果提供），检测是否与其他品牌过于相似
> - **建议阶段**：消费者建议可以参考「同类产品在 Facebook 上的高互动广告怎么写」

#### H4-2：文案差异化分析
> 基于竞品数据做差异化检测：
```
🚨 差異化警告：你嘅 IG 文案同 [競品A] 嘅最新廣告有 60% 相似度。
建議修改以下部分以保持品牌獨特性：[...]
```

#### H4-3：行业 CTA 基准
> 聚合行业数据，为 CTA 评估提供基准：
> - 「你嘅行業（月餅/食品）喺 Facebook 上最常見嘅 CTA 係『Shop Now』（42%），其次係『Learn More』（28%）」
> - 「你目前嘅 CTA『了解更多』屬於低強度——同行頭部品牌多數用『立即訂購』」

#### H4-4：广告投放时间策略
> 结合 fb-ads 的起止时间数据 + xhs 的发布时段数据，为生成文案提供「投放时机建议」

---

## 三、信息检索能力分析：能否检索香港社媒数据？

> 核心问题：系统能否主动检索香港社媒平台上爆火的文案表达方式、竞品文案？如果能，怎么实现？

### 3.1 检索需求分层

用户真正需要检索的信息分为三个层次：

```
Layer 3: 实时趋势 —— 「而家 IG 最兴用咩写法？」
          ▲
Layer 2: 竞品情报 —— 「美心、奇华嘅广告文案係点写？」
          ▲
Layer 1: 语言语料 —— 「香港人日常点样表达『好食』？」
```

| 层次 | 需求 | 更新频率 | 数据量需求 | 当前项目 |
|------|------|---------|-----------|---------|
| L1 语言语料 | 香港社媒常用表达、语气词、句式结构 | 季度更新 | 大规模语料库 | ❌ 完全依赖 AI 模型自身知识 |
| L2 竞品情报 | 同类品牌/产品在社媒的广告文案、CTA、话题标签 | 按需/周更 | 几十到几百条 | ❌ 无竞品数据 |
| L3 实时趋势 | 当下热门话题、爆款帖文写作模式、平台算法偏好 | 日更/实时 | 持续流式数据 | ❌ 无实时数据 |

### 3.2 技术可行性评估（HK 社媒专项）

#### ✅ 可行：Meta Ad Library 竞品广告检索

**数据源**：Meta Ad Library（`facebook.com/ads/library`）
- 覆盖：Facebook + Instagram + Messenger + Audience Network 所有**正在投放的广告**
- 访问：公开、无需登录、无需 API Key
- 数据字段：广告文案（body/title）、CTA、落地页 URL、投放平台、起止日期、创意素材（图片/视频）、花费估算（仅政治类广告披露）、触达估算（仅政治类广告披露）
- 筛选能力：按关键词搜索、按 Facebook Page ID 搜索、按国家/地区筛选（HK = `HK`）

**技术实现路径**：

```
方案 A：已有轮子 — 复用 fb-ads-library-search skill
┌─────────────────────────────────────────────┐
│  Browser-act (Stealth Browser)               │
│    ↓                                         │
│  Facebook Ad Library Page                    │
│    ↓                                         │
│  search-ads.py (JS injection + DOM parsing) │
│    ↓                                         │
│  结构化 JSON (ad archive ID, body, title,   │
│    CTA, platform, dates, images...)          │
└─────────────────────────────────────────────┘

方案 B：自建 — 直接 HTTP 请求 + Graph API
┌─────────────────────────────────────────────┐
│  Meta Ad Library API (非官方, undocumented) │
│    ↓                                         │
│  GraphQL endpoint 拦截 + replay              │
│    ↓                                         │
│  需维护 doc_id (Meta 前端更新即失效)         │
└─────────────────────────────────────────────┘
```

**推荐方案 A**：已有 skill 封装了完整的搜索→解析→分页→错误处理流程，且 browser-act 的 stealth browser 降低了反爬风险。

**关键限制**：
- ⚠️ 只能检索**付费广告**，不能检索自然帖文（organic posts）
- ⚠️ 不返回互动数据（likes/comments/shares），无法直接判断「爆唔爆」
- ⚠️ 部分广告的 `spend`/`impressions`/`reach` 字段为 `null`（Meta 仅披露政治/社会议题广告的花费）
- ⚠️ 高频请求可能触发限速（建议间隔 1-2 秒，不可并行）

**可行性评分**：🟢 **高** — 技术成熟，已有封装

---

#### ✅ 可行：HK 社媒公开帖文检索（Organic Content）

**核心认知修正**：FB 公开主页、IG 公开账号、IG Hashtag 页面都是**无需登录即可公开访问**的。搜索引擎大量索引了这些内容。不存在「完全检索不到」的问题——真正的问题是**没有统一的 API**，需要多源聚合。

**按平台逐个分析**：

##### Facebook 公开内容

| 检索路径 | 技术方式 | 数据类型 | 可行性 |
|---------|---------|---------|--------|
| 公开主页帖文 | Google/Tavily 搜索 `site:facebook.com/{pagename}` | 品牌/媒体/KOL 公开发布的帖文 | ✅ 高 |
| 公开主页帖文 | 直接访问 `facebook.com/{pagename}`，解析页面 | 同上（首次渲染的 HTML 中含帖文数据） | ✅ 中（需处理动态加载） |
| 公开群组 | Google 搜索 `site:facebook.com/groups/` | 群组公开讨论 | ✅ 中 |
| Facebook Video/Reels | Google 搜索 + Facebook 视频页面 | 视频标题、描述 | ✅ 中 |
| Graph API | `/{page-id}/posts` + `/{page-id}/feed` | 结构化帖文数据 | ⚠️ 需 App Review + Page Public Content Access |

##### Instagram 公开内容

| 检索路径 | 技术方式 | 数据类型 | 可行性 |
|---------|---------|---------|--------|
| 公开账号页面 | `instagram.com/{username}/` — 页面内嵌 `window.__INITIAL_STATE__` JSON | 最近 12 条帖文的 caption、hashtags、like/comment 数 | ✅ 高 |
| Hashtag 页面 | `instagram.com/explore/tags/{tag}/` — 同样内嵌 JSON | 该 tag 下热门帖文（Top posts）+ 最新帖文 | ✅ 高 |
| Google 搜索 | `site:instagram.com "關鍵詞"` | 搜索引擎索引的 IG 公开帖文 | ✅ 高（但索引覆盖不完整） |
| Instagram Basic Display API | OAuth，仅限**自己账号** | 自己的帖文 | 🔴 对检索他人无用 |
| Instagram Graph API | 仅限 Business/Creator 账号 + `instagram_basic` 权限 | Hashtag 搜索（受限） | 🟡 低（权限门槛高，返回量有限） |

**关键发现**：Instagram 公开页面和 Hashtag 页面的 HTML 中内嵌了一个巨大的 `window.__INITIAL_STATE__` JSON 对象，包含了帖文的结构化数据（caption、点赞数、评论数、图片 URL、hashtags、时间戳）。这意味着——
> **不需要 API、不需要登录，直接 HTTP GET + JSON 解析就能拿到结构化帖文数据。**

##### YouTube Shorts

| 检索路径 | 技术方式 | 数据类型 | 可行性 |
|---------|---------|---------|--------|
| YouTube Data API v3 | `youtube.googleapis.com/youtube/v3/search` + `video` endpoint | 视频标题、描述、tags、发布时间、view/like/comment 数 | ✅ 高（免费配额 10,000 units/天） |
| YouTube 页面 | 直接访问 + 解析 | 同上但非结构化 | 🟡 中 |

##### 香港本地论坛（语料价值高）

| 平台 | 访问方式 | 数据类型 | 可行性 | 文案参考价值 |
|------|---------|---------|--------|------------|
| LIHKG（连登）| Google 搜索 `site:lihkg.com` | 帖文标题+内容，互动数据 | ✅ 高（公开，搜索引擎友好） | 🟡 中 — 口语化粤语参考价值高，但品牌文案风格差异大 |
| Discuss.com.hk（香港讨论区）| Google 搜索 `site:discuss.com.hk` | 同上 | ✅ 高 | 🟡 中 |
| OpenRice（开饭喇）| Google 搜索 `site:openrice.com` | 食评文案，HK 地道表达 | ✅ 高 | 🟢 高 — 食品/餐饮行业可直接参考 |
| Baby Kingdom（亲子王国）| Google 搜索 `site:bab-kingdom.com` | 港妈日常文案 | ✅ 高 | 🟢 高 — 母婴/家庭产品的语料金矿 |

---

#### ⚠️ 有挑战但可行：实时/近实时趋势

| 检索目标 | 技术路径 | 可行性 | 说明 |
|---------|---------|--------|------|
| IG Hashtag 趋势 | 监控 `instagram.com/explore/tags/{tag}/?__a=1` | ✅ 中 | 可获取某 tag 下的最新 + 最热帖文，定时刷新即可发现新模式 |
| FB 高互动帖文 | Google 搜索 + 按时间排序 + WebFetch | ✅ 中 | 「过去一周 site:facebook.com 月饼」→ 按日期过滤 → 提取文案 |
| Google Trends HK | `pytrends` Python 库（非官方但稳定）| ✅ 高 | 获取 HK 地区的搜索趋势关键词，但只到「主题」层面，不到具体帖文 |
| YouTube 热门视频 | YouTube API `chart=mostPopular` + `regionCode=HK` + `videoCategoryId` | ✅ 高 | 获取 HK 地区各品类当前热门视频 |

---

#### ❌ 确实不可行：仅以下两项

| 目标 | 原因 |
|------|------|
| 跨平台统一的「热度排行榜」API | 不存在这样的产品——各平台数据隔离 |
| 自动获取帖文的**精确**触达/曝光数据 | 这是平台的商业机密数据，不对外公开 |

---

### 3.3 结论：HK 社媒文案检索完全可行，需要的是聚合层

**修正后的检索能力金字塔**：

```
┌──────────────────────────────────────────────────┐
│                检索能力金字塔（修正版）              │
│                                                   │
│            ┌────────────────────┐                 │
│            │ L3: 趋势发现         │                 │
│            │ IG Hashtag + YT热门  │ ← ✅ 可行       │
│            │ + Google Trends HK  │                 │
│            └────────────────────┘                 │
│          ┌──────────────────────┐                 │
│          │ L2: 竞品检索           │                 │
│          │ Meta Ad Library +     │ ← ✅ 可行       │
│          │ FB/IG 公开主页帖文     │                 │
│          └──────────────────────┘                 │
│        ┌────────────────────────┐                 │
│        │ L1: 语感语料             │                 │
│        │ CantoneseLLM 内建知识    │ ← ✅ 当前状态    │
│        │ + HK 论坛语料补充        │                 │
│        └────────────────────────┘                 │
└──────────────────────────────────────────────────┘
```

**核心挑战不是「能不能检索」，而是「如何高效聚合多源异构数据」**：

```
                      ┌─────────────────┐
                      │  检索聚合服务     │
                      │ (retrievalService)│
                      └────────┬────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Meta Ad Lib   │    │ IG/FB 公开页   │    │ YouTube API   │
│ (竞品广告)     │    │ (帖文+Hashtag) │    │ (热门+Shorts)  │
│ via: fb-ads   │    │ via: HTTP GET  │    │ via: YT Data   │
│ skill         │    │ + JSON 解析    │    │ API v3         │
└───────────────┘    └───────────────┘    └───────────────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               ▼
                      ┌─────────────────┐
                      │ 统一格式输出      │
                      │ HKPost[]         │
                      │ (platform, text, │
                      │  engagement,     │
                      │  hashtags, url,  │
                      │  fetchedAt)      │
                      └─────────────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │ Prompt 注入       │
                      │ (few-shot 示例)  │
                      └─────────────────┘
```

**关键实现路径**：

| 数据源 | 实现复杂度 | 稳定性 | 推荐优先级 |
|--------|----------|--------|-----------|
| Meta Ad Library（竞品广告）| 低（已有轮子）| 高 | 🟢 第一优先 |
| IG 公开页面 JSON 解析 | 低 | 中（Meta 可能改页面结构）| 🟢 第一优先 |
| YouTube Data API | 低（官方 API）| 高 | 🟢 第一优先 |
| Google 搜索 + WebFetch | 中 | 中 | 🟡 第二优先 |
| Tavily 搜索 API | 低 | 中 | 🟡 第二优先 |
| Google Trends HK | 中 | 中 | 🔴 第三优先

---

### 3.4 分层检索策略建议

按实现优先级排列的实际方案：

| 层级 | 检索内容 | 数据源 | 实现方式 | 触发时机 | Phase |
|------|---------|--------|---------|---------|-------|
| L2a | 竞品广告文案 | Meta Ad Library | browser-act → fb-ads skill | 用户输入竞品名时 | Phase 2.6 |
| L2b | IG Hashtag 热门帖文 | `instagram.com/explore/tags/{tag}/` 内嵌 JSON | HTTP GET → 解析 `window.__INITIAL_STATE__` | 用户选择行业/话题标签时 | Phase 2.8 🆕 |
| L2c | YouTube 热门/搜索 | YouTube Data API v3 | API 调用 → 标题+描述+tags | 生成 Shorts 变体时 | Phase 2.9 🆕 |
| L2d | FB 公开主页帖文 | Google/Tavily `site:facebook.com` + WebFetch | 搜索 → 提取文案片段 | 用户输入参考品牌时 | Phase 3.1 |
| L2e | FB 公开主页帖文（结构化）| `facebook.com/{pagename}` HTML 解析 | HTTP GET → 提取帖文文本+互动数 | 同上 | Phase 3.1 |
| L1 | HK 论坛语料 | Google 搜索 OpenRice/LIHKG 等 | 搜索 → WebFetch → 提取文案 | 语料库积累（离线） | Phase 3.1 |
| L3 | Google Trends HK | `pytrends` | Python 脚本 | 生成时补充热点话题 | Phase 3.3 |

### 3.5 IG 公开帖文检索：关键实现细节

这是性价比最高的检索路径之一，值得展开说明：

**数据获取原理**：
```
GET https://www.instagram.com/explore/tags/{tagname}/ 
→ HTML 中包含 <script>window.__INITIAL_STATE__ = {...}</script>
→ JSON.parse() → 得到结构化数据：
  - top_posts: [{ caption, like_count, comment_count, taken_at, owner, ... }]
  - recent_posts: [同上]
  - hashtag_info: { total_post_count, ... }
```

**同样适用于公开账号**：
```
GET https://www.instagram.com/{username}/
→ 同样内嵌 __INITIAL_STATE__
→ 包含最近 12 条帖文的完整数据
```

**需要注意**：
- ⚠️ Meta 可能在任何时候修改页面结构（`__INITIAL_STATE__` key 或内部 JSON schema）
- ⚠️ 高频访问可能触发 rate limit（建议同一 session 间隔 2-3 秒）
- ⚠️ 需要设置合理的 User-Agent header 避免被墙
- ⚠️ 只能获取 Meta 选择公开渲染在首页的数据（通常 12 条帖文 + Top 9 hashtag posts）

### 3.6 检索能力对优化方向的影响

| 优化方向 | 原优先级 | 检索依赖 | 调整后 |
|---------|---------|---------|--------|
| 竞品文案参考库 (H4-1) | 🔴 P2 | Meta Ad Library ✅ | 🟡 P1 (Phase 2.6) |
| IG Hashtag 热门帖文检索 🆕 | — | IG 公开 JSON ✅ | 🟡 P1 (Phase 2.8) |
| YouTube HK 热门内容检索 🆕 | — | YT Data API ✅ | 🟡 P1 (Phase 2.9) |
| 文案差异化分析 (H4-2) | 🔴 P2 | 依赖竞品数据 | 🟡 P1 (跟 Phase 2.6 一起) |
| HK 社媒标题模式 (P0.1) | ⚪ 研究 | 可用 IG JSON + Google 检索加速样本收集 | ⚪ 研究任务（工具升级） |
| FB 公开主页帖文 | — | Google + 页面解析 ✅ | 🔴 P2 (Phase 3.1) |
| 行业 CTA 基准 (H4-3) | 🔴 P2 | 需要足够样本量 | 🔴 P2 (Phase 3.4) |

### 3.7 竞品广告检索：完整实现流程

**Step 1：用户侧触发**
```
InputPanel 新增：
┌─────────────────────────────────────┐
│ 🔍 競品參考（可選）                    │
│ ┌─────────────────────────────────┐ │
│ │ 輸入競品 Facebook Page 名稱或 URL  │ │
│ │ 例：美心月餅、奇華餅家...           │ │
│ └─────────────────────────────────┘ │
│ [搜索競品廣告]                        │
└─────────────────────────────────────┘
```

**Step 2：后端检索服务**
```ts
// server/src/services/competitorService.ts
async function searchCompetitorAds(query: string, options?: {
  country?: string;        // default 'HK'
  platform?: string[];     // default ['facebook', 'instagram']
  activeStatus?: string;   // default 'active'
  limit?: number;          // default 10, max 50
}): Promise<CompetitorAd[]>
```

内部调用：`eval "$(python scripts/search-ads.py --query '{query}' --country HK --first {limit})"` → 解析 JSON → 返回前端

**Step 3：检索结果注入 Prompt**
```
## 競品文案參考（來自 Meta Ad Library）

以下係 [美心月餅] 目前喺 Facebook + IG 上投放中嘅廣告：
### 廣告 1 (投放中)
- 標題：雙黃白蓮蓉月餅 — 傳統手工，用心製作
- 內文：今年中秋，同屋企人一齊分享美心雙黃白蓮蓉...
- CTA：立即訂購
- 平台：Facebook, Instagram

請參考以上競品文案風格，確保你生成嘅文案：
1. 保持品牌獨特性（唔好同競品太似）
2. 搵出差異化角度
3. CTA 強度唔低於行業平均水平
```

**Step 4：差异化分析**
```ts
interface SimilarityReport {
  overallSimilarity: number;  // 0-100
  overlappingPhrases: string[];
  suggestion: string;
}
```

### 3.8 参考语料库 + RAG（辅助方案）

语料库作为检索的持久化层，**不替代实时检索，而是补充和加速**：

**语料库结构**：
```ts
interface ReferencePost {
  id: string;
  platform: 'ig' | 'facebook' | 'shorts' | 'youtube';
  industry: string;           // '食品' | '零售' | '美容' | '科技' | ...
  postType: string;           // '產品介紹' | '優惠推廣' | '品牌故事' | '互動帖' | '教學'
  headline: string;
  body: string;
  hashtags: string[];
  engagement: { likes: number; comments: number; shares: number };
  url: string;
  collectedAt: string;
  source: 'manual' | 'ig-hashtag-scrape' | 'fb-ad-lib' | 'youtube-api';
  notes: string;
}
```

**数据来源**（修正后——大部分可自动获取）：
| 来源 | 占比 | 获取方式 |
|------|------|---------|
| IG Hashtag 热门帖文 | ~40% | 自动：IG JSON 解析 → 过滤 HK 相关 → 入库 |
| Meta Ad Library 竞品广告 | ~30% | 自动：fb-ads skill → 结构化 → 入库 |
| YouTube 热门/搜索 | ~20% | 自动：YT API → 提取标题+描述 → 入库 |
| 人工精选标注 | ~10% | 手动：标注「为什么这条写得好」 |

**RAG 检索策略**：
- 200-500 条：关键词匹配（行业 + 平台 + 帖文类型）
- 500+ 条：考虑引入简单 embedding（`text-embedding-3-small`）做语义相似度检索
- 不使用向量数据库：SQLite + 内存倒排索引即可满足需求

---

## 四、综合优化方向矩阵（已更新）

以下按**影响力 × 实现成本**排列所有优化方向：

| # | 优化方向 | 来源 Skill | 影响力 | 成本 | 优先级 |
|---|---------|-----------|--------|------|--------|
| 1 | **Benefit-over-Feature 转化层** (So What 规则) | copywriting | ★★★★★ | 低 | 🟢 P0 |
| 2 | **平台内容模板系统** (5 套 HK 模板) | xhs-strategy | ★★★★★ | 中 | 🟢 P0 |
| 3 | **七遍编辑法审核扩展** (新增 3 维度) | copy-editing | ★★★★ | 中 | 🟡 P1 |
| 4 | **标题公式注入 Prompt** (6 公式) | xhs-strategy | ★★★★ | 低 | ⚪ 待研究 (⚠️ 需先做 HK 本地适配验证，不可直接照搬) |
| 5 | **合规体系平台层扩展** (违禁词+限流行为) | xhs-strategy | ★★★★ | 中 | 🟡 P1 |
| 6 | **备选标题生成** (每变体 2-3 标题) | copywriting | ★★★ | 低 | 🟡 P1 |
| 7 | **CTA 独立评分 + 基准** | copywriting + fb-ads | ★★★ | 中 | 🟡 P1 |
| 8 | **写前结构化上下文** (Writing Brief) | copywriting | ★★★ | 低 | 🟢 P0 |
| 9 | **快速规则检查模式** (本地 6 项检查) | copy-editing | ★★★ | 中 | 🟡 P1 |
| 10 | **专家小组评分模式** (persona × lens) | copy-editing | ★★★ | 高 | 🔴 P2 |
| 11 | **内容刷新模式** (Refresh 旧文) | copy-editing | ★★★ | 中 | 🟡 P1 |
| 12 | **发布策略建议** (时间+标签+频率) | xhs-strategy | ★★ | 中 | 🔴 P2 |
| 13 | **竞品文案参考库** (fb-ads 集成) | fb-ads-library | ★★★★★ | 高 | 🟡 P1 (技术可行，提前至 Phase 2.6) |
| 14 | **文案差异化分析** (竞品相似度) | fb-ads-library | ★★★ | 高 | 🟡 P1 (跟竞品参考库一起做) |
| 15 | **行业 CTA 基准** (聚合统计) | fb-ads-library | ★★ | 高 | 🔴 P2 (需累积足够竞品数据后做) |
| 16 | **IG Hashtag 热门帖文检索** 🆕 | 自研 (IG JSON) | ★★★★ | 中 | 🟡 P1 (Phase 2.8，无需 API Key) |
| 17 | **YouTube HK 热门内容检索** 🆕 | 自研 (YT API) | ★★★ | 低 | 🟡 P1 (Phase 2.9，免费配额) |
| 18 | **内容日历 + 排期建议** | xhs-strategy | ★★ | 中 | 🔴 P2 |

---

## 五、分批实施路线图

### 🔬 Phase 0：跨市场适配研究（前置条件，1-2 天）

> 目标：在执行任何 xhs-strategy 启发项之前，先验证内地市场方法论在香港社媒的适用性

**P0.1 — HK 社媒标题模式研究 (对应 H1-2)**
- 任务：收集 50-100 条香港 IG/Facebook 高互动帖文标题
- 分析：归纳 HK 本地的标题模式，与 xhs 6 公式做差异对比
- 输出：`docs/hk-headline-patterns.md` — 经数据验证的 HK 标题公式
- 决策点：哪些 xhs 公式经本地化后可复用？哪些应丢弃？

**P0.2 — HK 平台内容模板适配评估 (对应 H1-1)**
- 任务：验证 xhs 5 套模板（干货/种草/经验/清单/互动）在 HK 社媒的等效形态
- 关注点：HK IG 偏好什么内容结构？FB 帖文的互动引导方式和 xhs 有什么不同？
- 输出：5 套模板的 HK 本地化版本草稿

**P0.3 — xhs 合规体系与 HK 法规差异分析 (对应 H1-4)**
- 任务：对比 xhs 违禁词体系与 HK 广告法规，识别可复用和不可复用的部分
- 关键差异：内地《广告法》的「绝对化用语禁止」在 HK 无直接对等法规，但 HK 有《商品说明条例》《不良广告（医药）条例》等
- 输出：合规规则映射表，标注哪些来自 xhs、哪些来自 HK 法规、哪些通用

> ⚠️ **Phase 0 为 Phase 1 中所有 xhs-strategy 来源项的前置条件。Phase 0 完成前，仅 copywriting + copy-editing 来源的项可独立执行。**

---

### 🥇 Phase 1：Prompt 层增强（低成本高回报，1-2 天）

> 目标：不动架构，只优化 prompt，让生成和审核质量显著提升
> 
> **执行原则**：Phase 1 中来自 xhs-strategy 的项目（P1.3）依赖 Phase 0 的研究结论；来自 copywriting/copy-editing 的项目可立即执行。

**P1.1 — Benefit-over-Feature 转化指令 (H2-2)** ✅ 可立即执行
- 来源：copywriting skill（跨市场通用原则）
- 文件：`diagnoseGenerate.ts` system prompt
- 改动：在写作要求中添加「So What 規則」
- 验收：生成文案中产品描述后有「即係話」「等於話」等利益桥接

**P1.2 — 写前结构化简报 (H2-1)** ✅ 可立即执行
- 来源：copywriting skill（跨市场通用原则）
- 文件：`diagnoseGenerate.ts` + client `useGenerate.ts`
- 改动：利用已有的 `brandName/productName/consumerPersonas` 构建 Writing Brief 前置段落
- 验收：不同 brand/product 设置下生成的文案有明显差异化

**P1.3 — 平台内容结构模板 (H1-1)** ⚠️ 依赖 Phase 0
- 来源：xhs-strategy（需 HK 本地化验证）
- 文件：`diagnoseGenerate.ts`
- 改动：按 platform (ig/facebook/shorts/all) 注入对应的 HK 本地化内容结构骨架
- 验收：IG 版本有 emoji 分段 + 互动引导，facebook 版本有段落标题 + 留言引导

**P1.4 — 各变体加备选标题 (H2-4)** ✅ 可立即执行
- 来源：copywriting skill（通用，但最终标题文案仍需粤语化）
- 文件：`diagnoseGenerate.ts` prompt + client/server types + `ResultsPanel.tsx`
- 改动：prompt 要求每个变体额外输出 `headline` 和 `altHeadlines: string[]`
- 验收：每个 variant 卡片顶部显示多个可选标题
- 注意：标题具体措辞应由 CantoneseLLM 自由发挥，不注入内地标题公式

### 🥈 Phase 2：审核体验增强（中等成本，3-5 天）

> 目标：审核更全面、建议更有依据、用户理解更深

**P2.1 — 审核维度扩展 (H3-1)**
- 文件：`audit.ts` prompt + `reAudit.ts` + types
- 改动：新增 3 个可选子维度（语气一致度·利益转化度·情感共鸣度），默认关闭
- 验收：开启后审核报告的 dimension 从 5 个扩展到 8 个

**P2.2 — CTA 独立评分 (H2-3)**
- 文件：`audit.ts` + `DiagnosisSummary.tsx`
- 改动：在审核 prompt 中增加 CTA 专项评估段落，前端展示 CTA 评分条
- 验收：每个变体有 CTA 评分（0-100），含扣分原因

**P2.3 — 快速规则检查模式 (H3-3)**
- 文件：新文件 `server/src/services/quickCheckService.ts` + client `QuickCheck.tsx`
- 改动：纯本地正则引擎，6 项检查：过长句/被动语态/模糊词/弱化词/缺数字/结构不完整
- 验收：点击「快速檢查」后在每个 variant 上看到 inline 标注

**P2.4 — 平台层合规扩展 (H1-4)** ⚠️ 依赖 Phase 0
- 来源：xhs-strategy（需区分「内地特有规则」vs「HK 适用规则」vs「通用规则」）
- 文件：`complianceRules.ts`
- 改动：根据 Phase 0 的合规差异分析结果，新增可适用于 HK 平台审核的违禁词分类（如绝对化用语、化妆品/食品特殊违禁词、限流行为话术）
- 验收：输入含「100%有效」「最好用」的原文时，诊断报告触发平台违禁标记
- 注意：不可直接复制 xhs 的违禁词表——内地《广告法》体系与 HK 法规体系不同，需逐项甄别

**P2.5 — 内容刷新模式 (H3-4)**
- 文件：`diagnoseGenerate.ts` 新 prompt 分支 + client `InputPanel.tsx` 模式切换
- 改动：新增 `refreshContent()` API 端点，复用现有 AI 引擎但切换 refresh prompt
- 验收：用户切换至「刷新舊文」模式，输入旧文 → 输出优化版+改动理由

**P2.6 — 竞品广告检索 (H4-1)** ⚡ 新增（从原 P3.1 提前）
- 设计指引：`docs/inspiration-design功能设计策略.md` Tab 3「競品動態」
- 为何提前：Meta Ad Library 技术成熟，应尽早验证
- 文件：新服务 `server/src/services/competitorService.ts` + client `InputPanel.tsx` 竞品输入框
- 技术方案：复用 fb-ads-library-search skill 的 `search-ads.py` 脚本，browser-act → Ad Library → 解析 JSON
- 改动：
  1. 将 `search-ads.py` 复制到 `server/scripts/` 目录
  2. 创建 `competitorService.ts` 封装调用（`Bash` 执行 Python 脚本 → 解析 stdout JSON）
  3. 新增 API 端点 `POST /api/competitor/search`（接收 query/country/limit）
  4. 前端 InputPanel 增加可选竞品搜索框（非必填，展开即用）
- 验收：输入「美心月餅」→ 返回 10 条最新活跃广告 → 展示在参考面板中

**P2.7 — 竞品文案注入 Prompt (H4-2)**
- 文件：`diagnoseGenerate.ts` + `audit.ts`
- 改动：当用户提供了竞品数据时，在 prompt 中注入竞品文案作为参考 + 差异化要求
- 验收：有竞品数据时，生成文案自动避开竞品常用话术，audit 报告显示差异化评估

**P2.8 — IG Hashtag 热门帖文检索 🆕**
- 设计指引：`docs/inspiration-design功能设计策略.md` Tab 1「當下語感」
- 为何可行：`instagram.com/explore/tags/{tag}/` 页面内嵌 `window.__INITIAL_STATE__` JSON，无需登录、无需 API Key
- 文件：新文件 `server/src/services/igSearchService.ts`
- 技术方案：
  1. HTTP GET `instagram.com/explore/tags/{tag}/`（设置合理 User-Agent）
  2. 正则提取 `<script>window.__INITIAL_STATE__ = (.*?)</script>`
  3. `JSON.parse()` → 提取 `top_posts` 和 `recent_posts` 中的 caption、like_count、comment_count、taken_at
  4. 过滤 HK 相关帖文（按语言检测：含粤语字符/繁体中文）
- 输入：话题标签（如「月餅」、「中秋」、「hkfoodie」）
- 输出：`HKPost[]` 结构化数据（platform='ig', text, engagement, hashtags, url, fetchedAt）
- 验收：输入 hashtag「月餅」→ 返回 Top 9 + Recent 多条帖文 → 展示文案+caption+互动数

**P2.9 — YouTube HK 热门内容检索 🆕**
- 为何可行：YouTube Data API v3 免费配额 10,000 units/天，支持按地区+品类筛选
- 文件：新文件 `server/src/services/youtubeSearchService.ts`
- 技术方案：
  1. `youtube.googleapis.com/youtube/v3/videos?chart=mostPopular&regionCode=HK&videoCategoryId={category}&part=snippet,statistics`
  2. `youtube.googleapis.com/youtube/v3/search?q={keyword}&regionCode=HK&type=video&part=snippet`
  3. 提取 title、description、tags、viewCount、likeCount、commentCount
- 输入：品类 ID（如 26 = Howto & Style）或关键词
- 输出：`HKPost[]` 结构化数据（platform='youtube', text=title+description, engagement, tags, url, fetchedAt）
- 验收：查询 HK 地区热门视频 → 返回标题+描述+互动数据 → 尤其对 Shorts 变体生成有直接参考价值

### 🥉 Phase 3：数据积累 + 专家评分（1-2 周）

> 目标：累积足够的竞品/行业数据，支撑更高级的分析功能

**P3.1 — 参考语料库 + 灵感面板 UI (L2 检索层，半自动化)**
- 设计指引：`docs/inspiration-design功能设计策略.md`（含三个 Tab 的完整交互设计）
- 文件：新文件 `server/data/reference-corpus.json` + 语料检索服务 + 自动采集脚本 + client `InspirationPanel.tsx`
- 改动：
  1. 自动采集：复用 P2.6/P2.8/P2.9 的检索能力，定时（周更）自动爬取 IG Hashtag/FB Ad/YT 热门帖文并入库
  2. 人工标注：对自动采集的帖文做 10% 抽样人工标注（「为什么这条写得好」）
  3. 存储：JSON 文件（<500 条）或 SQLite（500+ 条）
  4. RAG：关键词匹配（行业 + 平台 + 帖文类型）→ 检索 2-3 条相似帖文 → 作为 few-shot 示例注入 prompt
- 验收：选择「食品」行业生成文案时，自动注入 2-3 条相关 HK 高互动帖文作为风格参考

**P3.2 — 专家小组评分 (H3-2)**
- 文件：`audit.ts` + `ConsumerFeedback.tsx`
- 改动：将 ConsumerFeedback 的「反馈文本」升级为「结构化评分」（persona × lens matrix）
- 验收：每个 persona 在 2-3 个维度上的评分以雷达图/矩阵表展示

**P3.3 — 发布策略建议 (H1-3)**
- 文件：新文件 `server/src/services/publishStrategyService.ts` + client 新卡片
- 改动：AI 生成最佳发布时间、话题标签、互动引导语
- 验收：生成结果下方出现「📅 發布建議」卡片

**P3.4 — 行业 CTA 基准 (H4-3)**
- 前置条件：需要 P2.6 竞品检索 + P3.1 语料库累积足够数据（建议 ≥200 条竞品广告）
- 文件：`competitorService.ts` 扩展 + 统计分析模块
- 改动：对累积的竞品文案做聚合统计，生成 CTA 类型分布、标题模式、话题标签使用频率等行业基准
- 验收：审核报告中出现「你嘅行業（月餅）喺 Facebook 上最常見嘅 CTA 係 Shop Now（42%）」等数据支撑的建议

---

## 六、类型系统前瞻

以下是为支撑 Phase 1-3 所有特性而需要新增/扩展的类型定义预览：

```ts
// === 新增：标题系统 ===
interface VariantMeta {
  headline: string;
  altHeadlines: string[];
  ctaLine: string;
}

// === 扩展：Variants ===
interface Variants {
  standardHK: string;
  lightCantonese: string;
  ig: string;
  facebook: string;
  shorts: string;
  // 新增
  meta?: Record<VariantKey, VariantMeta>;
}

// === 新增：专家评分 ===
interface ExpertScore {
  personaId: string;
  personaName: string;
  lens: 'clarity' | 'voice' | 'sowhat' | 'proof' | 'specificity' | 'emotion' | 'risk';
  score: number;        // 1-10
  critique: string;
  suggestion: string;
}

// === 新增：快速检查 ===
interface QuickCheckResult {
  longSentences: Array<{ text: string; wordCount: number }>;
  passiveVoice: Array<{ text: string }>;
  vagueWords: Array<{ word: string; suggestion: string }>;
  weakIntensifiers: Array<{ word: string }>;
  missingNumbers: Array<{ claim: string }>;
  structureIssues: string[];
}

// === 新增：竞品数据 ===
interface CompetitorAd {
  adArchiveId: string;
  pageName: string;
  platform: string[];
  body: string;
  title: string;
  ctaText: string;
  isActive: boolean;
  startDate: number;
}

// === 新增：发布策略 ===
interface PublishStrategy {
  bestTimes: Array<{ day: string; hour: number; score: number }>;
  hashtags: string[];
  commentBait: string;     // 互动引导
  frequency: string;        // 建议发布频率
}

// === 新增：内容刷新 ===
interface RefreshResult {
  original: string;
  refreshed: string;
  changes: Array<{
    type: 'fact' | 'tone' | 'seo' | 'proof' | 'structure';
    original: string;
    updated: string;
    reason: string;
  }>;
}

// === 扩展：GenerateRequest ===
interface GenerateRequest {
  // ... existing
  mode: 'generate' | 'refresh';  // 新增
  referenceAds?: CompetitorAd[];  // 新增
}

// === 扩展：GenerateResponse ===
interface GenerateResponse {
  // ... existing
  variantMeta?: Record<VariantKey, VariantMeta>;   // 新增
  expertScores?: ExpertScore[];                      // 新增
  quickCheck?: Record<VariantKey, QuickCheckResult>; // 新增
  publishStrategy?: PublishStrategy;                 // 新增
}
```

---

## 七、技术决策备忘

1. **Prompt 膨胀管理**：随着 template/formula/writing-brief 注入，prompt 会大幅增长。建议 Phase 1 完成后做一次 token 预算审计，评估是否需要分层 prompt（system-level vs request-level）

2. **模型能力边界**：`CantoneseLLMChat-v1.0-32B` 是否能稳定产出标题公式变体、CTA 评分等结构化内容？Phase 1 前应做小规模 A/B 测试

3. **fb-ads 集成的合规边界**：fb-ads-library-search 基于 browser-act（模拟浏览器），需确认使用条款。Meta 广告库数据仅供研究/透明度用途，不可用于自动化广告投放决策

4. **规则引擎 vs AI 引擎的职责划分**：快速规则检查(Phase 2.3)应保持纯本地无 AI，但 AI 审核(Phase 2.1-2.2)需要模型推理。两者展示时应有明确区分（⚡ 规则检测 vs 🤖 AI 评审）

5. **消费者反馈升级方向**：当前的 ConsumerPersona → suggestion 流程已经很接近 Expert Panel Scoring。Phase 3 的专家评分可视为当前功能的升级而非替代，保持兼容

6. **信息检索的四层数据 + 四 Tab 展示**：(a) Meta Ad Library → Tab「競品動態」；(b) IG 公开帖文 JSON + YouTube API → Tab「當下語感」（表达模式）+ Tab「即時熱話」（实时趋势）；(c) 预制话题日历 → Tab「話題日曆」。四种数据类型时效不同、注入策略不同、用户操作方式不同。面板放在 Center Panel 下方（非 Left Sidebar），避免拥挤。详见 `docs/inspiration-design功能设计策略.md`。

---

## 八、后续维护

- 本文档应随开发进展更新（每完成一个 Phase 在对应 checklist 打勾）
- 新增 Skill 或外部参考时，追加到对应章节
- Phase 优先级可根据用户反馈调整
- 类型定义前瞻（第五节）在实施时以实际代码为准，此处仅为方向性参考
