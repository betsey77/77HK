# V2 变更摘要：新增了什么、前端会变成什么样

> 写给产品决策者看的对比文档。
> 左边 = 原 roadmap 的 18 项。右边 = V2 的 22 项 + 4 个新增。

---

## 一、一句话总结

**V2 的核心变化不是「多了 4 个功能」，而是 pm-skills 的 14 个方法论被编码进了 Prompt，让 AI 从「会写粤语」升级为「会做营销策略」。**

---

## 二、新增的 4 个优化方向（原来是 18 项，现在是 22 项）

| 编号 | 新增方向 | 它做什么 | 用户感知 |
|------|---------|---------|---------|
| **S2.1** | 6-part JTBD Value Prop | Prompt 中注入「Who/Why/WhatBefore/How/WhatAfter/Alternatives」六问结构，AI 在写文案前先回答这六个问题 | 生成的文案不再「就产品写产品」，而是清楚传达「谁需要、为什么、用完会怎样」 |
| **S2.2** | Value Prop Statement | 每个 variant 附带一句独立的价值主张（如「为唔想排队的港岛人，提供最快 30 分钟到货嘅月饼」） | ResultCard 折叠区多了一行「💡 价值主张」，帮助用户理解这个版本想达成什么 |
| **S2.3** | 审核「vs 竞品」维度 | 当用户搜了竞品后，审核报告多一个表格：我 vs 竞品在 CTA/情感/差异化上的对比 | 不只是「你的文案几分」，而是「你的文案比竞品好在哪、差在哪」 |
| **S2.4** | A/B 实验建议 | 发布策略卡片提示「你可以测试 hook 句式（问题 vs 宣言）」 | 给用户一个具体可执行的优化方向，而不是「建议多测试」这种空话 |

---

## 三、原有 18 项中被 pm-skills 增强的方向

这部分最重要——**不是新功能，而是已有功能因为吸收了 pm-skills 方法论而变得更具体**：

| 原编号 | 原描述 | V2 增强 |
|--------|--------|---------|
| **H2-1** Writing Brief | 简单的「目的·受众·产品·平台」四行 | + 融入 `value-proposition` 的 6-part JTBD 模板，Writing Brief 从 4 行变成结构化的 6 问 |
| **H1-1** 平台内容模板 | 5 套 HK 模板（干货/种草/经验/清单/互动） | + 融入 `customer-journey-map`，模板不再只是「格式」，而是按用户旅程阶段（Awareness→Consideration→Purchase→Advocacy）定制内容 |
| **H3-2** 专家小组评分 | persona × lens 评分矩阵 | + 融入 `brainstorm-ideas-existing` 的 Product Trio 模式（PM/Designer/Engineer），从「三个消费者角色」变为「三个专业角色 × 7 个评估 lens」 |
| **H4-1** 竞品检索 | 搜索竞品广告，展示文案 | + 融入 `competitor-analysis` + `positioning-ideas`，不只展示文案，还自动推断竞品的定位角度、目标受众、价值主张 |
| **H4-2** 竞品差异化 | 检测文案相似度 | + 融入 `competitive-battlecard`，不只是「相似度 60%」，而是给出「在哪里赢了、在哪里输了、怎么回应客户异议」 |
| **H1-3** 发布策略 | 最佳时间 + hashtag + 互动引导 | + 融入 `gtm-strategy` + `growth-loops`，增加「这个文案适合哪种增长循环（病毒/使用/协作/UGC/推荐）」的判断 |
| **P3.3** | 发布策略建议 | + `brainstorm-experiments-existing` 的 A/B 测试建议 |

---

## 四、MVP 前端变化（视觉对比）

### 4.1 当前界面

```
┌──────────────┬───────────────────────┬──────────────┐
│  LEFT        │       CENTER          │  RIGHT       │
│              │                       │              │
│ SourceEditor │  [Tab: IG][FB][SH]... │  AuditPanel  │
│ LanguageToggle│ ┌──────────────────┐  │  港味 30%   │
│ BrandInput   │ │  生成文案内容      │  │  品牌安全    │
│ RedLines     │ │  ...              │  │  平台适配    │
│ Creativity   │ │                   │  │  可读性     │
│ Platform     │ └──────────────────┘  │  创意       │
│ Tone         │  DiagnosisSummary     │              │
│ CantoSlider  │                       │  Consumer    │
│ EnglishSlider│                       │  Feedback    │
│ PersonaMgr   │                       │              │
│ ConfigMgr    │                       │              │
│ [🚀 生成]    │                       │              │
└──────────────┴───────────────────────┴──────────────┘
```

### 4.2 Phase 1 完成后（Prompt 增强，UI 小幅变化）

**Left Sidebar 新增一处 toggle**（创作自由度下方紧邻）：

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

**Center 的 ResultCard 根据 toggle 状态不同**：

```
当 toggle = OFF（默认）：
┌─────────────────────────────────────────┐
│ 📱 IG 版本                              │
│                                         │
│ **標題**：是但問個港島人，中秋必買嘅...   │  ← 🆕 主标题（始终有）
│                                         │
│ 是但問個港島人，中秋必買嘅餅舖係？       │
│ 留言話我知👇                            │
│                                         │
│ 📋 備選標題：                           │  ← 🆕 折叠区（始终有）
│   · 港島人私心推介：呢間月餅...         │
│   · 中秋必買清單，第一間係...           │
│                                         │
│ [📋 複製] [✏️ 編輯] [🔄 刷新]          │
└─────────────────────────────────────────┘

当 toggle = ON（用户主动开启）：
┌─────────────────────────────────────────┐
│ 📱 IG 版本                              │
│                                         │
│ **標題**：是但問個港島人，中秋必買嘅...   │
│                                         │
│ 是但問個港島人，中秋必買嘅餅舖係？       │
│ 留言話我知👇                            │
│                                         │
│ 📋 備選標題：                           │
│   · 港島人私心推介：呢間月餅...         │
│   · 中秋必買清單，第一間係...           │
│                                         │
│ 💡 價值主張：為唔想排隊嘅港島人，        │  ← 🆕 仅 toggle=ON 时出现
│    提供最快 30 分鐘到货嘅月餅           │
│                                         │
│ [📋 複製] [✏️ 編輯] [🔄 刷新]          │
└─────────────────────────────────────────┘
```

**变化总结**：
- Left Sidebar：紧邻创作自由度多了一个 toggle
- ResultCard：标题 + 备选标题**始终有**；💡 价值主张仅当 toggle = ON 时出现
- 其他不变

---

### 4.3 Phase 2 完成后（灵感面板上线）

这才是前端最大的变化。下面是完整的新界面：

```
┌──────────────┬───────────────────────────┬──────────────┐
│  LEFT        │       CENTER              │  RIGHT       │
│              │                           │              │
│ SourceEditor │  [Tab: IG][FB][SH][Std][Lt]│  AuditPanel  │
│ LanguageToggle│ ┌──────────────────────┐  │              │
│ BrandInput   │ │  **標題**             │  │  港味 ██░   │
│ RedLines     │ │  文案正文...          │  │  品牌安全    │
│              │ │                       │  │  平台适配    │
│ 🆕 📅 目標   │ │  📋 備選標題         │  │  可读性     │
│    發布時間  │ │  💡 價值主張(如开启)  │  │  创意       │
│              │ └──────────────────────┘  │              │
│ 🆕 🔍 競品   │  DiagnosisSummary         │  🆕 CTA 评分  │
│    搜索     │                           │  ███░ 75     │
│              │ ┌─ 💡 靈感參考 ─────────┐ │              │
│ Creativity   │ │[當下語感][話題][熱話][競品]│  🆕 vs 競品   │
│              │ │                       │ │  ┌──────┐   │
│ 📋 結構化    │ │ 📱 #hkfoodie          │ │  │我 vs  │   │
│ 寫作簡報     │ │ 「是但問個港島人...」  │ │  │竞品A │   │
│ [🔘 ON/OFF] │ │ ❤️ 2.3K 💬 186       │ │  └──────┘   │
│              │ │          [複製表達]    │ │              │
│ Platform     │ │                       │ │  Consumer    │
│ Tone         │ │ 📱 #月餅2026          │ │  Feedback    │
│ CantoSlider  │ │ 「今年食咗5間...」     │ │              │
│ EnglishSlider│ │ ❤️ 1.8K 💬 92        │ │              │
│ PersonaMgr   │ │          [複製表達]    │ │              │
│ ConfigMgr    │ └───────────────────────┘ │              │
│ [🚀 生成]    │                           │              │
└──────────────┴───────────────────────────┴──────────────┘
```

**Left Sidebar 新增**：
- 「📅 目標發布時間」日期选择器（可选）
- 「🔍 競品搜索」输入框（可选，输入品牌名搜索 Meta Ad Library）
- 「📋 結構化寫作簡報」toggle（紧邻创作自由度下方，默认 OFF）

**Center 下方新增**：
- 「💡 靈感參考」可折叠面板，4 个 Tab

**Right Sidebar 新增**：
- 「CTA 评分」独立仪表（从五维中拆出）
- 「vs 竞品」对比表（当用户搜了竞品时出现）

---

## 五、操作模式变化

### 5.1 当前操作流程

```
用户输入原文 → 调参数 → 点生成 → 看 5 个变体 → 看诊断 → 看审核 →
→ （可选）消费者反馈 → （可选）修改 → （可选）重新审核 → 复制使用
```

**问题**：整个过程是**线性的**。用户只能在「生成→审核→修改」这条线上操作，没有外部参考。且 AI 始终以同样的「产品营销」框架生成——无论用户输入的是段子还是产品说明书。

### 5.2 Phase 1 后操作流程

```
用户输入原文 
  → 判断：这是产品营销文案还是纯创意/互动？
     ├─ 有产品信息 → 可开启「📋 結構化寫作簡報」toggle
     └─ 纯创意/互动 → 保持 toggle OFF，AI 只做语言转换
  → 调参数 → 点生成 
  → 看 5 个变体（每个有标题+备选标题；toggle=ON 时额外有 💡 价值主张）
  → 看诊断 → 看审核 → 后续同当前
```

**变化**：用户多了一步**自觉判断**（也可以忽略，toggle 默认 OFF 保持现有行为）。AI 的行为从「一刀切」变为「根据 toggle 决定要不要做结构化营销推理」。

### 5.3 Phase 2 后操作流程（完整版）

```
┌─────────────────────────────────────────────────────┐
│                  用户操作流程（Phase 2 后）           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ① 输入原文                                          │
│       ↓                                             │
│  ② 判断文案类型：                                     │
│     ├─ 「中秋快樂🌕」纯节日祝福 → toggle 保持 OFF      │
│     ├─ 「是但問個港島人...」纯互动引流 → toggle OFF    │
│     └─ 「我哋月餅用湖南蓮子...」产品营销 → toggle ON   │
│       ↓                                             │
│  ③ （可选）设置目标发布时间 → 话题日历自动匹配        │
│       ↓                                             │
│  ④ （可选）搜索竞品 → 灵感面板 Tab 4 加载竞品广告     │
│       ↓                                             │
│  ⑤ 调参数 → 点生成                                   │
│       ↓                                             │
│  ⑥ 看结果：                                          │
│     Toggle OFF: 标题 + 备选标题 + 正文（轻量）         │
│     Toggle ON:  标题 + 备选标题 + 💡价值主张 + 正文    │
│       ↓                                             │
│  ┌─ ⑦ 展开灵感面板（可选）───────────────────────┐  │
│  │                                               │  │
│  │  Tab 1「當下語感」：看 HK 人现在怎么表达       │  │
│  │    → 点「複製表達」把句式骨架加入原文           │  │
│  │                                               │  │
│  │  Tab 2「話題日曆」：勾选想借势的话题            │  │
│  │    → 重新生成，Prompt 自动融入话题角度          │  │
│  │                                               │  │
│  │  Tab 3「即時熱話」：看此刻正在爆火的内容        │  │
│  │    → 手动参考，不自动注入                      │  │
│  │                                               │  │
│  │  Tab 4「競品動態」：看竞品正在投什么广告        │  │
│  │    → 审核时自动对比差异化                      │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│       ↓                                             │
│  ⑧ 看诊断 → 看审核（含 CTA 评分 + vs 竞品对比）      │
│       ↓                                             │
│  ⑨ （可选）消费者反馈 → 修改 → 重新审核              │
│       ↓                                             │
│  ⑩ 复制使用 / 调整 toggle 重新生成                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**关键变化**：从**线性流程**变成**环形流程**。最核心的新增操作只有一步——「② 判断文案类型，决定是否开启结构化写作简报」——但这一步让 AI 的行为从「一刀切的产品营销机器」变成「能适配轻量创意和重产品营销两种模式的引擎」。

---

## 六、Phase 2 前端组件清单（MVP 需要新建/修改的文件）

### 新建文件（9 个）

| 文件 | 作用 |
|------|------|
| `client/src/components/layout/InspirationPanel.tsx` | 灵感面板容器：可折叠 + 4 Tab 切换 |
| `client/src/components/layout/InspirationTab.tsx` | 单个 Tab 的内容区 + 加载/空/错误状态 |
| `client/src/components/cards/PostCard.tsx` | 通用帖文卡片（Tab 1/3 复用） |
| `client/src/components/cards/CalendarEventCard.tsx` | 话题事件卡片（Tab 2） |
| `client/src/components/cards/CompetitorAdCard.tsx` | 竞品广告卡片（Tab 4） |
| `client/src/components/shared/CopyExpressionButton.tsx` | 「複製表達」按钮（复制句式骨架） |
| `client/src/hooks/useInspirationData.ts` | 灵感数据获取 + 缓存逻辑 |
| `client/src/components/results/QuickCheck.tsx` | 快速检查结果 inline 标注 |
| `server/src/services/quickCheckService.ts` | 纯本地正则引擎（6 项检查） |

### 修改文件（8 个）

| 文件 | 变更 |
|------|------|
| `client/src/components/layout/ThreePanel.tsx` | Center 下方嵌入 `<InspirationPanel />` |
| `client/src/components/input/InputPanel.tsx` | + 目标发布时间 + 竞品搜索框 + **📋 结构化写作简报 toggle** |
| `client/src/components/results/ResultCard.tsx` | + 标题 + 备选标题 + 价值主张（价值主张仅 toggle=ON 时显示） |
| `client/src/components/audit/AuditPanel.tsx` | + CTA 评分条 + vs 竞品表 |
| `client/src/types/index.ts` | + VariantMeta + InspirationData + `structuredBriefEnabled` |
| `client/src/context/AppContext.tsx` | + targetDate + competitorQuery + **structuredBriefEnabled** 状态 |
| `client/src/hooks/useGenerate.ts` | 请求体 + `structuredBriefEnabled` 参数 |
| `server/src/types/index.ts` | 同步类型扩展 + `structuredBriefEnabled?: boolean` |

---

## 七、与旧 roadmap 的关键差异总结

| 维度 | 旧 roadmap | V2 spec |
|------|-----------|---------|
| **优化方向数量** | 18 项 | 22 项（+4） |
| **pm-skills 嵌入** | 仅列为「来源参考」 | 14 个技能的方法论被编码为具体 prompt/功能 |
| **🔑 Writing Brief** | 4 行简单模板，始终注入 | 6-part JTBD 结构化框架，**由 toggle 控制开关**，默认 OFF |
| **🔑 文案类型适配** | 一刀切的产品营销框架 | 自适应模式：轻量创意 vs 产品营销两套 Prompt 路径 |
| **竞品分析** | 展示广告文案 + 相似度检测 | + 定位推断 + battlecard + vs 竞品审核表 |
| **专家评分** | persona × lens 评分 | + Product Trio（PM/Designer/Engineer）角色 |
| **发布策略** | 最佳时间 + hashtag | + 增长循环类型 + A/B 实验建议 |
| **灵感面板** | 设计文档中有 | 完整纳入 spec，含组件树 + 数据流 |
| **指标** | 无 | North Star Metric + 5 Input Metrics |
| **风险分析** | 无 | Pre-Mortem（3 Tigers + 3 Paper Tigers + 3 Elephants） |
| **Prompt 架构** | 单体 prompt | 5 Layer 分层（含 token 预算管理策略）+ **toggle 分支** |
| **API 设计** | 无 | 10 个端点（含 Phase 2/3 新增的 6 个） |

---

## 八、推荐 MVP 范围

如果要快速验证价值，建议 MVP 只包含以下内容：

### MVP（4-6 天）

```
Phase 1 全部（Prompt 增强 + toggle）:
  ✅ P1.0 结构化写作简报 toggle（UI + 状态 + Prompt 分支逻辑）
  ✅ P1.1 So What 规则（自适应模式：原文有产品描述才触发）
  ✅ P1.2 Writing Brief（仅 toggle=ON 时注入）
  ✅ P1.2a 6-part Value Prop（仅 toggle=ON 时注入）
  ✅ P1.4 备选标题 + Value Prop Statement（备选标题始终有；Value Prop Statement 仅 toggle=ON）

Phase 2 最小可用:
  ✅ P2.6 竞品广告检索（Meta Ad Library）
  ✅ 灵感面板 MVP 版（只做 Tab 4「競品動態」，其他 3 个 Tab 留空壳）
  ✅ 目标发布时间字段（先做 UI，话题日历数据 Phase 3 再补）
```

### MVP 前端效果

```
Left Sidebar:  📅 目标发布时间 + 🔍 竞品搜索（两个可选字段）
               📋 结构化写作简报 [🔘 OFF]（紧邻创作自由度下方）
Center 下方:   💡 靈感參考（只有 Tab 4「競品動態」有内容）
ResultCard:    标题行 + 折叠的备选标题（始终有）
               💡 价值主张（仅当 toggle=ON 时出现）
AuditPanel:    CTA 评分条（新维度开关默认关闭）
```

### Toggle 对生成行为的控制

| Toggle | 输入示例 | AI 行为 |
|--------|---------|---------|
| OFF | 「中秋快樂🌕」 | 纯语言转换，不加任何产品信息 |
| OFF | 「是但問個港島人，中秋必買嘅餅舖係？」 | 保留互动结构，粤语化表达 |
| OFF | 「我哋月餅用湖南蓮子...」 | 自适应：So What 规则触发（因为原文有产品描述），但不注入 6-part JTBD 框架 |
| ON | 「我哋月餅用湖南蓮子...」 | 完整注入 Writing Brief + 6-part JTBD + Value Prop Statement；每个变体附带结构化价值主张 |

这个 MVP 范围可以在 1 周内交付，验证两个核心假设：
1. **竞品参考**是否真的有用户价值（Tab 4 先行）
2. **结构化简报 toggle** 是否让 AI 在「轻量互动」和「产品营销」两种模式下都表现更好
