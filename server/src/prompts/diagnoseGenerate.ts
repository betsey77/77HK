// Combined diagnosis + generation prompt.
// V2: supports inputLanguage (mandarin→translate vs cantonese→optimize),
// brandName/productName injection, creativityLevel (structure adherence),
// and temperature decoupled from creativity (tone-driven instead).

import type {
  Platform,
  BrandTone,
  InputLanguage,
  ReferenceCase,
  CalendarEvent,
  CopyType,
  ToneModifier,
  CaseLibraryContextEntry,
  ProductSellingPoint,
} from '../types/index.js';
import { buildComplianceSection } from './complianceRules.js';
import { buildW1ConstraintSections, getPrimaryToneInstructions } from './w1Constraints.js';
import { buildCaseLibraryPromptSection } from '../services/caseLibraryContext.js';
import { normalizeProductSellingPoints } from '../services/sellingPoints.js';

interface DiagnoseGenerateParams {
  source: string;
  platform: Platform;
  tone: BrandTone;
  cantoneseLevel: number;      // 0-5
  englishMixingLevel: number;  // 0-5
  brandName?: string;
  productName?: string;
  brandRedLines?: string;      // brand expression constraints
  productSellingPoints?: ProductSellingPoint[];
  structuredBriefEnabled?: boolean; // 🆕 Ph1: 结构化写作简报 toggle
  creativityLevel: number;     // 0-4, default 2
  inputLanguage: InputLanguage;
  refresh?: boolean;          // 🆕 P2.5 内容刷新 — 同参数换写法
  referenceCases?: ReferenceCase[]; // 🆕 Phase B: 用户收藏的正例案例
  calendarEvents?: CalendarEvent[]; // 🆕 话题日历：用户选择的节日/事件
  /** W1 */
  copyType?: CopyType;
  customCopyType?: string;
  lengthControlEnabled?: boolean;
  copyLengthLevel?: number;
  primaryTone?: BrandTone;
  toneModifiers?: ToneModifier[];
  /** W3: server-resolved case library only */
  caseLibraryContext?: CaseLibraryContextEntry[];
}

// ---- helpers ----

function getPlatformInstructions(platform: Platform): string {
  switch (platform) {
    case 'ig':
      return '只生成 IG 版本作為主要輸出，其他版本可以簡短但必須提供';
    case 'facebook':
      return '只生成 Facebook 版本作為主要輸出，其他版本可以簡短但必須提供';
    case 'shorts':
      return '只生成 Shorts/TK 版本作為主要輸出，同時兼顧 YouTube Shorts 與 TikTok，其他版本可以簡短但必須提供';
    case 'all':
      return '全部平台（IG + Facebook + Shorts/TK，即 YouTube Shorts / TikTok），每個版本都要完整';
  }
}

function getToneInstructions(tone: BrandTone): string {
  return getPrimaryToneInstructions(tone);
}

function getCantoneseLevelInstructions(level: number): string {
  const instructions: Record<number, string> = {
    0: '只用書面語 / 標準繁中，完全唔用粵語口語',
    1: '最多 10% 輕粵語，只用最常見嘅詞（如「嘅」「啱」）',
    2: '約 20% 輕粵語，自然融入，唔刻意',
    3: '約 40% 粵語，聽落似香港人日常傾偈',
    4: '約 60% 粵語，明顯香港地道口吻',
    5: '約 80% 粵語，地道港式口吻，但要留意品牌安全',
  };
  return instructions[level] ?? instructions[2]!;
}

function getEnglishMixingInstructions(level: number): string {
  const instructions: Record<number, string> = {
    0: '純中文，完全唔用英文',
    1: '只用最基本嘅英文 product/category 詞（如 "app", "link", "post"）',
    2: '自然品牌社媒使用（如 "check 下", "share 俾朋友"）',
    3: 'IG 生活風格（如 "daily look", "weekend vibes"）',
    4: '年輕潮流，但仍品牌安全（如 "must-have item", "game changer"）',
    5: 'creator 風格，高能量，高風險（如 "OMG this is fire"），注意品牌安全',
  };
  return instructions[level] ?? instructions[1]!;
}

function getCreativityInstructions(level: number): string {
  // 5 discrete levels: 0-4
  const lv = Math.round(level);
  switch (lv) {
    case 0:
      return `【緊貼原文 — 語言轉換模式】
你嘅唯一任務係將原文從普通話轉換成香港粵語/繁體中文表達。你係一個翻譯+本地化工具，唔係一個廣告文案寫手。

🚫 **內容邊界（違反即係失敗）**：
- 絕對不要添加原文或「產品賣點」區塊冇明確提供嘅信息：品牌名、產品名、成分、功效、營養數據、免責聲明、hashtag、emoji、公司背景
- 原文有幾多句，輸出就應該有幾多句。原文有幾多信息量，輸出就應該有同等信息量
- 你只能改「點樣表達」，不能改「表達咗咩」

📏 **結構約束**：
- 嚴格遵循原文嘅結構、分段、對仗格式、標點節奏
- 原文係短句就輸出短句，原文係兩句就輸出兩句
- 字數浮動唔超過 ±15%
- 保留原文嘅創意方向同表達邏輯

🔄 **你可以做嘅**：
- 將普通話詞彙轉換為粵語/港式表達（例如「上頭」→「上癮」/「著迷」）
- 將內地語氣轉換為香港語氣
- 調整語序令佢更符合粵語習慣`;
    case 1:
      return `【偏向保守 — 輕度潤色】
主要保持原文結構同格式，可微調措辭令佢更自然。
如果原文有對仗/排比/押韻，保留該格式。
字數浮動唔超過 ±25%。可以適量調整句子長短，但整體結構唔變。
你可以做：換更地道嘅詞、微調語序、一兩處語氣詞點綴。
你唔應該做：添加新句子、改寫結構、加入原文冇嘅信息。`;
    case 3:
      return `【偏向自由 — 放膽創作】
以原文為靈感起點，大膽重組、擴展、甚至局部轉換表達形態。

你可以積極做以下事情：
- 🎨 **重構結構**：原文係一段你就拆成多段；原文係直述你可以改用問句開頭；原文係第三人稱你可以改第一人稱
- 🔥 **加 hook**：每個版本開頭加一句搶眼嘅廣東話 hook（尤其是 Shorts/TK 同 IG 版本）
- 😋 **加感性描寫**：用具體嘅感官語言（口感、氣味、場景、心情）豐富表達
- 📝 **加互動引導**：結尾加互動問句（「你哋覺得點？留言話我知」「有冇其他推介？」）
- 💬 **加 emoji**：適當用 emoji 增加節奏同視覺吸引力
- #️⃣ **加 hashtag**：每個版本加 2-4 個相關 hashtag
- 📖 **加場景/故事**：可以添加一句生活場景描寫（例如「放工返到屋企，攰到唔想煮飯...」）
- 🗣️ **轉換人稱/視角**：可以轉為第一人稱用家口吻、朋友推薦語氣、或者品牌小編嘅個人化表達
- 📏 字數：可以係原文嘅 1.5-3 倍長度，視乎平台需要

你應該保留：原文嘅核心主題同品牌調性。其他嘢都可以自由發揮。
你唔應該：做完全唔相關嘅內容轉型（例如將食品文案寫成愛情詩）——呢個留俾 L4。`;
    case 4:
      return `【自由創作 — 你係頂級營銷策略師 ＋ 文案創作人 🔥】

你唔係一個翻譯工具，甚至唔係一個普通文案寫手。
你係一個**營銷策略師 ＋ 創意總監**。
原文只係一個 brief——一個產品/主題信號。你要基於呢個信號，為五個平台各自創作**策略目的最有效**嘅文案。

## 你可以徹底改變文案形態

以下係你可以自由運用嘅**文案形態**（可以混搭、可以創新）：

### 📣 表達形態（揀最適合平台同目的嘅）
- **直球廣告**：直接、有說服力、CTA 清晰。「限時優惠」、「即日落單免運費」
- **軟廣告 / 用家分享**：偽裝成真實用家嘅推薦。「話說上星期行超市，見到呢隻新出嘅...一試就返唔到轉頭」
- **故事型**：從一個生活場景或人物出發，產品作為故事一部分自然出現。「凌晨三點，仲喺公司 OT。打開個 IG，見到呢個...」
- **詩歌 / 打油詩**：用押韻、節奏、排比寫文案。「唔使最貴，唔使最紅／最緊要係，啱你個胃同個籠」
- **幽默 / 笑話**：用搞笑手法吸引注意力，尤其適合年輕品牌。「減肥？聽日先啦。今日呢塊豬肉係上天嘅旨意」
- **清單 / 懶人包**：結構化資訊，適合 FB 教育型內容。「買豬肉前要知嘅 3 件事：1️⃣ ... 2️⃣ ...」
- **對話 / 小劇場**：用對話形式寫文案。「👩：『今晚煮咩？』👨：『你唔使煩，我已經買咗 XX 豬肉返嚟』」
- **測驗 / 投票型**：互動優先，引導留言。「你係邊種月餅派？A. 傳統雙黃 B. 冰皮新派 C. 我兩樣都要 👇」

### 🎯 策略目的（每個版本要明確達成一個目的）
- **引流**：令讀者想 click / 想留言 / 想分享 → 用好奇心、爭議、投票、tag 朋友
- **推廣**：令讀者想買 → 用限時優惠、產品亮點、用家實證、對比優勢
- **增長激活**：令讀者成為追蹤者 → 用價值提供、系列預告、社群感
- **品牌塑造**：令讀者記住品牌個性 → 用故事、態度、價值觀表達

### 🎭 人稱 / 視角（自由切換）
- 品牌官方口吻（「我哋嚴選每一塊豬肉...」）
- 用家第一人稱（「我本身唔信，但試完真係服咗...」）
- KOL/朋友推薦（「是但問個識食嘅朋友，佢實話你知呢間最掂」）
- 旁觀者敘事（「香港人揀豬肉，來來去去得幾個標準...」）

### 🎨 創意技法（大膽使用）
比喻、對比、誇張、反問、排比、押韻、雙關、港式幽默、自嘲——任何你覺得有效嘅技法。

### 📏 字數
冇限制。可以係 20 字 punch line，亦可以係 300 字故事型長文。每個平台揀最適合嘅長度。

## 🚨 核心約束（必須遵守）
- 品牌語氣同核心主題係你嘅北極星
- 合規紅線係賽道邊界——唔可以衝出去，但邊界之內任你飛
- **五個版本必須有明顯差異**——如果五個版本似同一個人寫嘅，就係失敗
- **每個版本揀一個策略目的**，唔好貪心一個版本做晒所有嘢`;
    case 2:
    default:
      return `【平衡 — 本地化改寫】
保留原文核心信息同創意方向，但表達方式可以全面本地化。
你可以：
- 調整句子結構令佢更符合粵語節奏（合併或拆分句子都得）
- 加入適當嘅粵語語氣詞同港式表達
- 根據平台需要調整內容深淺（IG 輕巧啲、FB 多啲背景、Shorts/TK 有節奏感）
- 字數浮動唔超過 ±50%
你唔應該：添加原文或「產品賣點」區塊完全冇提及嘅產品資訊或品牌背景。`;
  }
}

function buildBrandSection(brandName?: string, productName?: string): string {
  if (!brandName && !productName) return '';
  const parts: string[] = [];
  if (brandName) parts.push(`品牌：${brandName}`);
  if (productName) parts.push(`產品：${productName}`);
  const combined = parts.join(' | ');
  return `**品牌/產品識別（僅供上下文理解，唔係必須輸出嘅內容）**：${combined}

⚠️ 極度重要嘅規則：
- 品牌名同產品名只係俾你理解文案嘅行業同產品背景
- **如果原文冇提及品牌名/產品名，你生成嘅文案都唔應該主動加入**
- 如果原文提及咗品牌名/產品名，你必須保持原樣，不可翻譯、改寫或替換
- 如果品牌名包含英文，保留英文（如「K11 MUSEA」不用改成中文）
- 🚫 **絕對唔好因為見到品牌/產品資訊，就自動添加產品描述、成分、功效、營養數據、公司背景、免責聲明等原文完全冇提及嘅內容**
- 🚫 你嘅任務係語言轉換同表達優化，唔係幫品牌寫完整廣告文案——除非原文本身就係完整廣告文案`;
}

function buildRedLinesSection(brandRedLines?: string): string {
  return buildComplianceSection(brandRedLines);
}

export const PRODUCT_SELLING_POINTS_SECTION_MARKER = '產品賣點（港話優先）';

function buildProductSellingPointsSection(productSellingPoints?: ProductSellingPoint[]): string {
  const points = normalizeProductSellingPoints(productSellingPoints);
  if (points.length === 0) return '';

  const lines = points.map((point, index) => (
    `${index + 1}. ${point.cantoneseText || point.sourceText}`
  ));

  return `## ✨ ${PRODUCT_SELLING_POINTS_SECTION_MARKER}

以下係用戶明確提供嘅產品賣點。優先使用已港化表達，並忠實保留原本事實：

${lines.join('\n')}

**優先級與使用規則**：
- 已提供嘅事實、合規規則同品牌紅線永遠高於產品賣點；如有衝突，放棄衝突賣點
- 產品賣點高於次要語氣、修飾、創作形式同平台花巧
- 五個平台版本都要自然融入相關賣點，唔好機械式逐條羅列
- 不可把賣點延伸成用戶未提供嘅功效、成分、數據或保證`;
}

// ============================================================
// 🆕 §16.2-②: Self-Critique (港話自檢)
// ============================================================

function buildSelfCritiqueSection(): string {
  return `---

### 🔍 港話自檢（Self-Critique）

生成完五個版本之後，請你自己做一次「港話自檢」，每個版本都要過以下 checklist：

1. **語感檢查**：有冇邊度讀起身唔似香港人講嘅？如果有，改返自然啲
2. **內地腔檢查**：有冇普通話直譯嘅句式？（例如「幫到你」→ 通常係「啱你」/「幫到手」；「為你帶來」→ 直接講好處）
3. **語氣詞檢查**：語氣詞係咪自然？（㗎、啫、嘛、囉、喎、啩 用啱位未？）有冇連續堆砌 ≥3 個語氣詞？
4. **地雷詞檢查**：有冇踩到港話地雷詞庫入面嘅禁用表達？
5. **品牌紅線檢查**：有冇違反品牌表達紅線？

**如果自檢發現問題，直接修正後再輸出 JSON。唔好輸出有問題嘅版本然後備註——要輸出修正後嘅最終版本。**

呢個自檢步驟係你生成流程嘅必要部分，唔可以跳過。`;
}

// ============================================================
// 🆕 P2.5: Content Refresh — diversity injection
// ============================================================

function buildRefreshSection(): string {
  return `🔄 **內容刷新模式（Refresh）**：

用戶對上一次嘅生成結果唔滿意，希望用相同參數重新生成，但必須產出**完全唔同**嘅文案。

🚨 **關鍵指令**：
- 五個版本必須同上一次**有明顯差異**——唔同嘅開頭方式、唔同嘅句式結構、唔同嘅角度
- 上次用咗問句開頭 → 今次改用數據/場景/故事
- 上次用咗品牌官方口吻 → 今次改用用家分享/朋友推薦
- 上次 IG 版用咗直接廣告 → 今次改用軟廣告/用家視角
- 大膽轉換表達形態同創意方向——確保用戶睇到嘅係**全新嘅版本**
- 所有其他參數（語氣、粵語程度、平台）保持不變，只係表達方式同創意方向要徹底不同`;
}

// ============================================================
// 🆕 Phase B: Reference Cases from bookmarked copies
// ============================================================

const TAG_LABELS: Record<string, string> = {
  hook: 'hook 吸睛', tone: '语气贴地', cta: 'CTA 有力',
  rhythm: '句式节奏好', emoji: 'emoji 自然', brand: '品牌调性匹配',
  creative: '创意突出', audience: '适合目标受众',
};

function buildReferenceCasesSection(referenceCases?: ReferenceCase[]): string {
  if (!referenceCases || referenceCases.length === 0) return '';

  const cases = referenceCases
    .map((rc, i) => {
      const tags = (rc.reasonTags ?? [])
        .map((t) => TAG_LABELS[t] ?? t)
        .filter(Boolean)
        .join('、');
      const ratingStars = rc.rating ? '★'.repeat(rc.rating) + '☆'.repeat(5 - rc.rating) : '';
      const userFeedback = [ratingStars, tags, rc.favoriteReason].filter(Boolean).join(' · ');

      return `### 正例 ${i + 1}${ratingStars ? ` (${ratingStars})` : ''}
> ${rc.content}

${userFeedback ? `用戶評價：${userFeedback}` : ''}

**技法提取指引**：請分析以上正例嘅：
- Hook 類型（反問式/宣言式/故事式/數據式/挑釁式/共鳴式）
- 句式節奏（短句快節奏/長句敍事/混合型）
- Emoji 用法（密度、位置、功能）
- CTA 風格（直接命令/軟性引導/隱含 CTA/無 CTA）
- 情感基調（搞笑/真誠/溫暖/專業/反叛）`;
    })
    .join('\n\n');

  return `## 📌 用戶收藏嘅正例案例（Few-Shot 個人化參考）

以下係用戶過往收藏並評為高質量嘅文案，請參考佢哋嘅技法，
並將相同水準嘅表達融入新文案——**學技法，唔好抄內容**：

${cases}

---
**生成時請優先對齊以上正例嘅技法質素，特別係用戶重視嘅標籤。**
- 每個平台版本都要實際落地至少 2 項可辨識技法（Hook、句式節奏、Emoji、CTA 或情感基調），唔可以只分析但唔應用
- 五個版本可以按平台調整落地方式，但全部都要受正例風格影響
- 正例只係表達技法參考；不可把正例嘅主題或事實當成新文案資料
- 記住：學嘅係技法同風格，唔係直接複製內容或句式。`;
}

// ============================================================
// 🆕 话题日历注入：用户选择的节日/事件 → 叙事角度 + 借势建议
// ============================================================

export function buildCalendarEventsSection(calendarEvents?: CalendarEvent[]): string {
  if (!calendarEvents || calendarEvents.length === 0) return '';

  const events = calendarEvents
    .map((ev) => {
      const dateLabel = ev.date.includes('..')
        ? `${ev.date.split('..')[0]} 至 ${ev.date.split('..')[1]}`
        : ev.date;
      const hooks = ev.narrativeHooks.slice(0, 3).map((h) => `  - ${h}`).join('\n');
      const angles = ev.angles.map((a) => `「${a}」`).join('、');
      const sensitivity = ev.sensitivityNote
        ? `\n⚠️ 敏感度提醒：${ev.sensitivityNote}`
        : '';

      return `### ${ev.titleZh}（${dateLabel}）
適用行業：${ev.applicableIndustries.join('、')}
可選敘事角度：${angles}
Hook 靈感：
${hooks}${sensitivity}`;
    })
    .join('\n\n');

  return `## 🗓️ 話題日曆借勢建議

以下係用戶選擇嘅近期節日/事件，請根據適用性融入文案創作：

${events}

---
**使用指引**：
- 🚨 **你必須將上述話題融入文案創作**——呢個係用戶明確指定嘅創作方向，唔係可選項
- 每個版本至少融入 1 個相關嘅敘事角度或 hook，確保讀者能感受到節日/事件氛圍
- 可以考慮將話題角度同平台特性結合：IG 用打卡/視覺角度、Facebook 用長文討論角度、Shorts/TK 用快節奏 hook（兼顧 YouTube Shorts 與 TikTok）
- 只有喺極端情況（例如產品係殯儀服務而節日係情人節）先可以適度淡化，但仍需在至少 2 個版本中提及
- 注意敏感度提醒（如有），以恰當角度切入，避免踩中文化禁忌`;
}

// ============================================================
// 🆕 Ph1: Adaptive So What Rule (toggle=OFF, auto-detects)
// ============================================================

/**
 * Lightweight detection: does the source text contain product descriptions?
 * This only activates the So What rule — it does NOT inject full JTBD.
 */
const PRODUCT_SIGNALS = [
  '成分', '功效', '採用', '選用', '材料', '配方', '含有', '富含', '來自',
  '產地', '進口', '原料', '製作', '工藝', '品質', '營養', '含量',
  '推出', '新品', '上市', '限時', '優惠', '折扣', '促銷',
  'ingredient', 'formula', 'extract', 'premium', 'quality',
];

function hasProductDescription(source: string): boolean {
  const lower = source.toLowerCase();
  const hits = PRODUCT_SIGNALS.filter((kw) => lower.includes(kw.toLowerCase()));
  const hasSpec = /[：:][^，。,.\n]{4,}/.test(source);
  const hasPct = /\d+%/.test(source);
  return hits.length >= 2 || (hits.length >= 1 && (hasSpec || hasPct));
}

function buildAdaptiveSoWhatRule(source: string): string {
  if (!hasProductDescription(source)) return '';

  return `**📋 自適應 So What 規則**：
原文檢測到產品相關描述。生成文案時請遵循：
- 如果有產品功能/成分描述，幫佢加一句消費者利益轉化（「所以你唔使...」「即係話你可以...」）
- 唔好憑空添加品牌背景或產品資訊——只可以基於原文或「產品賣點」區塊已有嘅內容做轉化
- 呢個係輕度增強，唔係完整嘅結構化寫作框架
- 如果原文內容太少/冇產品資訊，唔好強行做 So What 轉化`;
}

// ============================================================
// 🆕 Ph1: Writing Brief (toggle=ON)
// ============================================================

function buildWritingBrief(params: DiagnoseGenerateParams): string {
  const { source, brandName, productName, tone, platform, inputLanguage } = params;

  // Extract a short excerpt of the source for the brief
  const excerpt = source.length > 200 ? source.slice(0, 200) + '...(節錄)' : source;

  return `**📋 結構化寫作簡報**：

### 原始素材
${excerpt}

### 品牌背景
${brandName ? `品牌：${brandName}` : '（未提供）'}
${productName ? `產品/服務：${productName}` : '（未提供）'}

### 創作參數
- 目標平台：${platform === 'all' ? 'IG + Facebook + Shorts/TK（YouTube Shorts / TikTok）' : platform === 'shorts' ? 'Shorts/TK（YouTube Shorts / TikTok）' : platform}
- 品牌語氣：${tone}
- 輸入語言：${inputLanguage === 'mandarin' ? '普通話/書面語（需本地化）' : '粵語（需優化）'}

### 核心任務
基於以上素材同參數，創作五個港式社媒版本。`;
}

// ============================================================
// 🆕 Ph1: 6-part JTBD Value Proposition (toggle=ON)
// ============================================================

function buildJTBDValueProp(params: DiagnoseGenerateParams): string {
  const { brandName, productName } = params;
  const product = productName || brandName || '呢個產品/服務';

  return `**💡 6-Part JTBD 價值主張框架**：

請按照以下 JTBD（Jobs-to-be-Done）框架理解品牌定位，並將價值主張融入文案：

1. **👤 目標用戶 (Who)**：邊個會用${product}？描述目標消費者嘅身份同年齡層
2. **🎯 核心需求 (Why)**：佢哋想要達成咩目標？解決咩問題？滿足咩深層需求？
3. **📌 現狀痛點 (What Before)**：未有${product}之前，佢哋而家點樣解決？有咩唔方便/唔滿意？
4. **🔧 解決方案 (How)**：${product}點樣幫佢哋？具體機制/功能係點？
5. **✨ 使用後改變 (What After)**：用咗${product}之後，佢哋嘅生活/工作有咩具體改善？感受有咩唔同？
6. **🆚 替代選擇 (Alternatives)**：點解揀${product}而唔揀其他？有咩獨特優勢？

**關鍵規則**：
- 每個 JTBD 維度只係框架指引，實際文案中**只融入最相關嘅 2-3 個維度**，唔好貪心全部塞入去
- 價值主張要**自然融入文案**，唔好變成「說明書式羅列」
- 如果某個維度對呢個產品/場景唔適用（例如純節日祝福冇 Alternatives），跳過唔好夾硬寫
- 重點係**消費者利益**，唔係產品功能——每句都要回答「所以呢？對我有咩好處？」`;
}

// ============================================================
// 🆕 Ph1: Writing Framework (toggle-branched)
// ============================================================

function buildWritingFramework(params: DiagnoseGenerateParams): string {
  const sections: string[] = [];

  if (params.structuredBriefEnabled) {
    // Toggle ON: full framework
    sections.push(buildWritingBrief(params));
    sections.push(buildJTBDValueProp(params));
  } else {
    // Toggle OFF: brand section only + adaptive So What
    sections.push(buildBrandSection(params.brandName, params.productName));
    sections.push(buildAdaptiveSoWhatRule(params.source));
  }

  return sections.filter(Boolean).join('\n');
}

// ---- main prompt builders ----

/**
 * DeepSeek full prompt — with vocabulary tables and detailed instructions.
 */
export function buildDiagnoseGeneratePrompt(params: DiagnoseGenerateParams): string {
  const { source, platform, tone, cantoneseLevel, englishMixingLevel, creativityLevel, inputLanguage, brandRedLines, refresh, referenceCases, calendarEvents } = params;
  const effectiveTone = params.primaryTone ?? tone;

  const platformInstructions = getPlatformInstructions(platform);
  const toneInstructions = getToneInstructions(effectiveTone);
  const cantoneseInstructions = getCantoneseLevelInstructions(cantoneseLevel);
  const englishMixingInstructions = getEnglishMixingInstructions(englishMixingLevel);
  const creativityInstructions = getCreativityInstructions(creativityLevel);
  const writingFramework = buildWritingFramework(params);
  const redLinesSection = buildRedLinesSection(brandRedLines);
  const productSellingPointsSection = buildProductSellingPointsSection(params.productSellingPoints);
  const selfCritiqueSection = buildSelfCritiqueSection();
  const refreshSection = refresh ? buildRefreshSection() : '';
  // W3: case library first (user just selected), then bookmark reference cases
  const caseLibrarySection = buildCaseLibraryPromptSection(params.caseLibraryContext);
  const referenceCasesSection = buildReferenceCasesSection(referenceCases);
  const calendarEventsSection = buildCalendarEventsSection(calendarEvents);
  const w1Sections = buildW1ConstraintSections({
    copyType: params.copyType,
    customCopyType: params.customCopyType,
    lengthControlEnabled: params.lengthControlEnabled,
    copyLengthLevel: params.copyLengthLevel,
    tone: effectiveTone,
    primaryTone: params.primaryTone ?? effectiveTone,
    toneModifiers: params.toneModifiers,
  });
  const isCantoneseInput = inputLanguage === 'cantonese';

  const taskBlock = isCantoneseInput
    ? `## 任務：優化以下粵語文案，令佢更地道、更自然

原文已經係粵語/白話，你嘅任務係：
- 保留原文嘅核心意思同創意方向
- 令表達更自然、更地道（唔好「扮地道」而堆砌語氣詞）
- 修正任何唔自然嘅用詞或句式
- 如果有書面語混雜，轉為自然口語
- 如果有過時/老土嘅粵語用詞，更新為而家嘅講法`
    : `## 任務：診斷原文 + 生成五個港式社媒版本`;

  const diagnosisSection = isCantoneseInput
    ? `### 第一步：診斷原文（優化模式）

檢查以下粵語原文，標出可優化之處：

${source}

診斷清單：
- 有冇唔自然嘅表達？（似書面語直譯、AI 腔）
- 有冇用詞可以更地道？
- 有冇語氣詞堆砌？（太多「啦喇嘅咁呀」反而唔自然）
- 有冇過時嘅粵語 slang？
- 有冇簡繁混用？（輸出必須全部香港繁體中文）
- 🚫 有冇觸及合規紅線？（參見上方合規規則及品牌紅線，標出具體違規文字同違反咗邊條規則）`
    : `### 第一步：診斷原文

檢查以下原文，標出所有問題：

${source}

診斷清單：
- 有冇簡繁混用？（輸出必須全部香港繁體中文）
- 有冇內地營銷詞彙？例如「寶子們」「爆款來襲」「狠狠拿捏」「種草」「閉眼入」「福利」「親」「姐妹們」「家人們」「安利」「上頭」「絕絕子」「yyds」
- 有冇普通話直譯腔？句式生硬、唔符合廣東話語序
- 有冇 AI 腔？過度正式、空泛、冇人味
- 有冇粵語過火？語氣詞堆砌、太粗俗、同品牌語氣唔夾
- 有冇香港文化風險？價錢單位、地名、消費習慣、平台規範、法規敏感話題
- 🚫 有冇觸及合規紅線？（參見上方合規規則及品牌紅線，標出具體違規文字同違反咗邊條規則）`;

  return `${taskBlock}

${writingFramework}
${redLinesSection}
${productSellingPointsSection}
${w1Sections}
${refreshSection}
${caseLibrarySection}
${referenceCasesSection}
${calendarEventsSection}
${creativityLevel >= 3 ? `
🕊️ **創作模式提醒**：以上合規規則同紅線係賽道邊界——界定咗咩唔可以做。但邊界之內，係你盡情發揮嘅空間。
請以最大嘅創意自由去創作，唔好因為有規則而變得保守。規則係底線，唔係天花板。` : ''}

${diagnosisSection}

🔄 **保留原文 Emoji（所有創作自由度通用）**：如果原文包含 emoji，所有生成版本必須保留這些 emoji——可以調整位置、可以加新 emoji，但原文已有的 emoji 一個都不能刪。此規則優先級高於各創作檔位對 emoji 的限制。

### 第二步：生成五個版本

根據以下參數生成五個版本：

**語氣設定**: ${toneInstructions}
**粵語程度**: ${cantoneseInstructions}
**中英夾雜**: ${englishMixingInstructions}
**目標平台**: ${platformInstructions}

${creativityInstructions}

#### 版本 1：港式標準繁中
- 適用於官方品牌內容、landing page、新聞稿風格社媒貼文、CRM、付費廣告
- 完整句子，用詞正式但唔生硬
- 粵語口語用最少，保持專業感

#### 版本 2：輕粵語社媒
- 適用於 IG caption、Reels 描述、生活類貼文、友好品牌內容
- 自然融入輕量粵語（如「啱用」「抵玩」「慳時間」「唔使煩」「講真」）
- 語氣溫暖、貼地，但唔會太粗俗

#### 版本 3：IG 版本
- 視覺主導、輕巧、生活感強
- 短句為主，caption-friendly
- 可以用返 IG 常見嘅港式英中夾雜（如 "daily look", "weekend plan", "must-have"）
- 加適當 emoji 增加互動感 🎋

#### 版本 4：Facebook 版本
- 實用、清晰、家庭/社區友善
- 比 IG 版本提供多少少背景資訊
- 適合較成熟嘅 Facebook 受眾
- 語氣溫暖踏實

#### 版本 5：Shorts/TK 版本（YouTube Shorts / TikTok）
- 頭三秒 hook 要搶眼（必須用廣東話口語節奏）
- 短句、有節奏感、適合讀出嚟
- 格式：第一行 = hook（最搶眼嗰句），之後 = short script（3-5 句）

${creativityLevel === 0 ? `⚠️ **創作自由度 = 0 強制覆蓋（優先級最高）**：
由於用戶將創作自由度設為 0，以上版本描述（emoji、hashtag、補充資訊等）只係一般性指引，**對你呢次生成唔適用**。
你必須以原文嘅長度同信息量為絕對基準，覆蓋所有版本描述：
- 原文係 20 字短句 → 每個版本都應該 ~17-23 字
- 原文冇 hashtag → 唔好加 hashtag（即使 IG 版本都唔加）
- 原文冇品牌名 → 唔好加品牌名（即使 standardHK 版本都唔加）
- 原文冇 emoji → 唔好加 emoji（即使 IG 版本都唔加）
- 原文同「產品賣點」區塊都冇產品描述 → 唔好加產品描述（即使 Facebook 版本都唔加）
- 你只能做語言轉換，唔能做內容擴寫或格式升級` : ''}
${creativityLevel >= 3 ? `🔥 **創作自由度 = ${creativityLevel} 創意放大（優先級最高）**：
由於用戶將創作自由度調到最高，以上版本描述只係一個起點——你應該超越佢。
具體要求：
- IG 版本：必須係一個完整嘅 IG post（emoji + hashtag + 互動引導 + 短句節奏），可以係用家分享、可以係品牌直球、可以係幽默笑話——揀最適合平台嘅形態
- Facebook 版本：必須係一個完整嘅 FB post（背景資訊 + 溫暖語氣 + 互動引導），可以係懶人包、可以係故事型長文、可以係投票互動——揀最適合引起討論嘅形態
- Shorts/TK 版本：必須有強 hook + 口語節奏 + punch line，頭 3 秒就要搶眼，並同時適合 YouTube Shorts 與 TikTok——可以係對白、可以係詩歌節奏、可以係快問快答
- standardHK/lightCantonese：都要有完整嘅品牌語氣同港式表達，但形態可以自由（可以係軟廣告故事、可以係品牌宣言、可以係懶人包）
- 🚨 五個版本必須睇落完全唔同——唔同形態、唔同人稱、唔同策略目的。全部似同一個 template 就係失敗
- 大膽轉換形態：詩歌、笑話、對話、用家見證、清單、故事——任何你覺得有效嘅形態` : ''}

---

### 詞彙替換指引

當原文出現以下內地營銷詞彙時，必須替換：

| 內地詞 | 香港替換 |
|--------|---------|
| 福利 | 優惠 / 著數 / 限時優惠（視乎語氣） |
| 爆款來襲 | 人氣之選 / 新一季熱賣款 / 最近好多客人問 |
| 寶子們 / 家人們 / 姐妹們 | 各位 / 大家（或者省略直接稱呼） |
| 狠狠拿捏 | 啱晒 / 處理得好到位 / 夠貼心 |
| 種草 | 值得留意 / 想試 / 加入 wish list |
| 閉眼入 | 可以放心試 / 值得入手 / 不妨睇睇 |
| 親 | 省略，或用「你好」 |
| 安利 | 推介 / 推薦 |
| 上頭 | 著迷 / 停唔到 / 好鍾意 |
| 絕絕子 | 超好 / 好正 / 好掂 |

### 粵語使用關鍵
- 自然輕粵語例子：啱用、抵玩、慳時間、唔使煩、睇得出、講真、日常用落
- 語氣詞（啦、喇、嘅、咁、呀）只用喺需要節奏嘅位置，唔好裝飾性堆砌
- 英文只用喺香港社媒自然會用嘅位置：daily look、quick fix、wishlist、weekend plan、limited offer、set

### 🗣️ 港式文案 Few-Shot 參考

以下係「差 vs 好」嘅對比例子，請參考呢啲 pattern 去生成文案：

**例 1 — 內地腔 vs 港式**
❌ 差：各位親愛的顧客，我們的產品質量非常優秀，歡迎選購！
✅ 好：講真，呢個真係幾好用㗎。想試嘅話 link in bio~

**例 2 — 太書面 vs 港式**
❌ 差：本產品採用優質原料精心製作而成，為您帶來極致享受
✅ 好：用料靚，手工做，唔係間間有㗎——試過就明

**例 3 — IG caption 內地腔 vs 港式**
❌ 差：這個真的太上頭了姐妹們！必須安利給你們！
✅ 好：今次呢個堅係正 💯 低調好用，忍唔住要 share 俾大家

**例 4 — 硬銷廣告 vs 港式軟廣告**
❌ 差：限時優惠，手慢無！趕快下單吧！
✅ 好：有個優惠想話你知——唔係成日有㗎，見到就唔好等 😉

**例 5 — Shorts/TK hook 普通話 vs 港式**
❌ 差：你知道嗎？這款產品可以改變你的生活！
✅ 好：等等——你知唔知呢個嘢可以慳你一半時間？

${selfCritiqueSection}

---

### 輸出格式要求

請嚴格按照以下 JSON 格式輸出，唔好加任何其他文字：

\`\`\`json
{
  "diagnosis": {
    "hasSimplifiedChars": true/false,
    "mainlandPhrases": [
      { "phrase": "原文詞彙", "suggestion": "建議替換" }
    ],
    "issues": ["問題描述1", "問題描述2"],
    "complianceViolations": [
      { "rule": "違反嘅合規規則/紅線", "match": "原文違規文字", "severity": "high" }
    ]
  },
  "variants": {
    "standardHK": "港式標準繁中版本...",
    "lightCantonese": "輕粵語社媒版本...",
    "ig": "IG 版本...",
    "facebook": "Facebook 版本...",
    "shorts": "Shorts/TK 版本（YouTube Shorts / TikTok）..."
  },
  "variantMeta": {
    "standardHK": {
      "headline": "呢個版本嘅主要標題/第一句（作為標題）",
      "altHeadlines": ["備選標題1", "備選標題2", "備選標題3"],
      "ctaLine": "CTA / 互動引導句",
      "valuePropStatement": "一句價值主張：呢個版本想傳達嘅核心賣點/消費者利益（如有）",
      "targetPersona": "呢個版本最適合邊類目標消費者",
      "creativeForm": "文案形態（如：直球廣告/軟廣告/故事/詩歌/笑話/清單/對話/測驗）",
      "strategyGoal": "策略目的（引流/推廣/增長激活/品牌塑造）"
    },
    "lightCantonese": { "headline": "...", "altHeadlines": [...], "ctaLine": "...", "..." },
    "ig": { "headline": "...", "altHeadlines": [...], "ctaLine": "...", "..." },
    "facebook": { "headline": "...", "altHeadlines": [...], "ctaLine": "...", "..." },
    "shorts": { "headline": "...", "altHeadlines": [...], "ctaLine": "...", "..." }
  }
  }
}
\`\`\`

🚨 **variantMeta 欄位要求**：
- headline：提取文案中最搶眼嗰句做標題（8-25 字），可適量加入 emoji 增加視覺吸引力 🔥
- altHeadlines：必須為每個版本提供 3 個備選標題，要求如下：
  - **字數**：6-20 字，要精簡有力
  - **多樣性**：3 個備選標題要用唔同角度（例如：一個用數字/數據吸睛、一個用問句引起好奇、一個用情感/場景代入）
  - **Emoji**：至少 1 個備選標題適當加入 emoji（唔好濫用，1-2 個就夠）
  - **港式特色**：可以融入港式口語節奏、廣東話 punch line、本地生活場景
  - **標題模式參考**：
    - 🔢 數字型：「3 個原因點解香港人開始轉用XX」
    - ❓ 問句型：「你揀XX嗰陣，有冇諗過呢樣嘢？」
    - 😱 驚奇型：「估唔到XX原來可以咁抵」
    - 💬 共鳴型：「是但問個港島人，XX邊間最掂？」
    - 🎯 直接型：「XX新登場，限量搶手貨」
    - 🏠 場景型：「放工返到屋企，最想見到嘅就係XX」
- valuePropStatement：如有明確消費者利益就填寫一句價值主張（10-30 字）
- 每個版本嘅 creativeForm 同 strategyGoal 可以唔同

重要：JSON 必須合法（valid JSON），欄位必須完整，版本文字必須係香港繁體中文。`;
}

// ============================================================
// CantoneseLLMChat simplified prompt — the model already speaks
// native Cantonese, so we drop vocabulary tables and usage guides.
// ============================================================
export function buildCantoneseLLMPrompt(params: DiagnoseGenerateParams): string {
  const { source, platform, tone, cantoneseLevel, englishMixingLevel, creativityLevel, inputLanguage, brandRedLines, refresh, referenceCases, calendarEvents } = params;
  const effectiveTone = params.primaryTone ?? tone;

  const platformInstructions = getPlatformInstructions(platform);
  const toneInstructions = getToneInstructions(effectiveTone);
  const cantoneseInstructions = getCantoneseLevelInstructions(cantoneseLevel);
  const englishMixingInstructions = getEnglishMixingInstructions(englishMixingLevel);
  const creativityInstructions = getCreativityInstructions(creativityLevel);
  const writingFramework = buildWritingFramework(params);
  const redLinesSection = buildRedLinesSection(brandRedLines);
  const productSellingPointsSection = buildProductSellingPointsSection(params.productSellingPoints);
  const selfCritiqueSection = buildSelfCritiqueSection();
  const refreshSection = refresh ? buildRefreshSection() : '';
  const caseLibrarySection = buildCaseLibraryPromptSection(params.caseLibraryContext);
  const referenceCasesSection = buildReferenceCasesSection(referenceCases);
  const calendarEventsSection = buildCalendarEventsSection(calendarEvents);
  const w1Sections = buildW1ConstraintSections({
    copyType: params.copyType,
    customCopyType: params.customCopyType,
    lengthControlEnabled: params.lengthControlEnabled,
    copyLengthLevel: params.copyLengthLevel,
    tone: effectiveTone,
    primaryTone: params.primaryTone ?? effectiveTone,
    toneModifiers: params.toneModifiers,
  });
  const isCantoneseInput = inputLanguage === 'cantonese';

  const taskBlock = isCantoneseInput
    ? `## 任務：優化以下粵語文案，令佢更地道、更自然

你係一個香港粵語 native speaker，所有輸出應該自然而然用香港廣東話表達。

原文已經係粵語/白話，你嘅任務係：
- 保留原文嘅核心意思同創意方向
- 令表達更自然、更地道（唔好「扮地道」而堆砌語氣詞）
- 修正任何唔自然嘅用詞或句式
- 如果有過時/老土嘅粵語用詞，更新為而家嘅講法`
    : `## 任務：診斷原文 + 生成五個港式社媒版本

你係一個香港粵語 native speaker，所有輸出應該自然而然用香港廣東話表達。唔需要刻意模仿，用你最自然嘅講法。`;

  const diagnosisSection = isCantoneseInput
    ? `### 第一步：診斷原文（優化模式）

檢查以下粵語原文，標出可優化之處：

${source}

診斷清單（簡短標記即可）：
- 有冇唔自然嘅表達？
- 有冇用詞可以更地道？
- 有冇語氣詞堆砌？
- 有冇過時嘅粵語 slang？`
    : `### 第一步：診斷原文

檢查以下原文，標出所有問題：

${source}

診斷清單（簡短標記即可）：
- 有冇簡繁混用？
- 有冇內地營銷詞彙？（寶子們、爆款來襲、狠狠拿捏、種草、閉眼入、福利等）
- 有冇普通話直譯腔？
- 有冇 AI 腔？
- 有冇粵語過火？`;

  return `${taskBlock}

${writingFramework}
${redLinesSection}
${productSellingPointsSection}
${w1Sections}
${refreshSection}
${caseLibrarySection}
${referenceCasesSection}
${calendarEventsSection}
${creativityLevel >= 3 ? `
🕊️ **創作模式提醒**：以上合規規則同紅線係賽道邊界——界定咗咩唔可以做。但邊界之內，係你盡情發揮嘅空間。
請以最大嘅創意自由去創作，唔好因為有規則而變得保守。規則係底線，唔係天花板。` : ''}

${diagnosisSection}

🔄 **保留原文 Emoji（所有創作自由度通用）**：如果原文包含 emoji，所有生成版本必須保留這些 emoji——可以調整位置、可以加新 emoji，但原文已有的 emoji 一個都不能刪。此規則優先級高於各創作檔位對 emoji 的限制。

### 第二步：生成五個版本

根據以下參數生成五個版本：

**語氣設定**: ${toneInstructions}
**粵語程度**: ${cantoneseInstructions}
**中英夾雜**: ${englishMixingInstructions}
**目標平台**: ${platformInstructions}

${creativityInstructions}

#### 版本 1：港式標準繁中
- 適用於官方品牌內容、landing page、新聞稿風格社媒貼文、CRM、付費廣告
- 完整句子，用詞正式但唔生硬
- 粵語口語用最少，保持專業感

#### 版本 2：輕粵語社媒
- 適用於 IG caption、Reels 描述、生活類貼文、友好品牌內容
- 自然融入輕量粵語（如「啱用」「抵玩」「慳時間」「唔使煩」「講真」）
- 語氣溫暖、貼地，但唔會太粗俗

#### 版本 3：IG 版本
- 視覺主導、輕巧、生活感強
- 短句為主，caption-friendly
- 可以用返 IG 常見嘅港式英中夾雜（如 "daily look", "weekend plan", "must-have"）
- 加適當 emoji 增加互動感 🎋

#### 版本 4：Facebook 版本
- 實用、清晰、家庭/社區友善
- 比 IG 版本提供多少少背景資訊
- 適合較成熟嘅 Facebook 受眾
- 語氣溫暖踏實

#### 版本 5：Shorts/TK 版本（YouTube Shorts / TikTok）
- 頭三秒 hook 要搶眼（必須用廣東話口語節奏）
- 短句、有節奏感、適合讀出嚟
- 格式：第一行 = hook（最搶眼嗰句），之後 = short script（3-5 句）

${creativityLevel === 0 ? `⚠️ **創作自由度 = 0 強制覆蓋（優先級最高）**：
由於用戶將創作自由度設為 0，以上版本描述（emoji、hashtag、補充資訊等）只係一般性指引，**對你呢次生成唔適用**。
你必須以原文嘅長度同信息量為絕對基準，覆蓋所有版本描述：
- 原文係 20 字短句 → 每個版本都應該 ~17-23 字
- 原文冇 hashtag → 唔好加 hashtag（即使 IG 版本都唔加）
- 原文冇品牌名 → 唔好加品牌名（即使 standardHK 版本都唔加）
- 原文冇 emoji → 唔好加 emoji（即使 IG 版本都唔加）
- 原文同「產品賣點」區塊都冇產品描述 → 唔好加產品描述（即使 Facebook 版本都唔加）
- 你只能做語言轉換，唔能做內容擴寫或格式升級` : ''}
${creativityLevel >= 3 ? `🔥 **創作自由度 = ${creativityLevel} 創意放大（優先級最高）**：
由於用戶將創作自由度調到最高，以上版本描述只係一個起點——你應該超越佢。
具體要求：
- IG 版本：必須係一個完整嘅 IG post（emoji + hashtag + 互動引導 + 短句節奏），可以係用家分享、可以係品牌直球、可以係幽默笑話——揀最適合平台嘅形態
- Facebook 版本：必須係一個完整嘅 FB post（背景資訊 + 溫暖語氣 + 互動引導），可以係懶人包、可以係故事型長文、可以係投票互動——揀最適合引起討論嘅形態
- Shorts/TK 版本：必須有強 hook + 口語節奏 + punch line，頭 3 秒就要搶眼，並同時適合 YouTube Shorts 與 TikTok——可以係對白、可以係詩歌節奏、可以係快問快答
- standardHK/lightCantonese：都要有完整嘅品牌語氣同港式表達，但形態可以自由（可以係軟廣告故事、可以係品牌宣言、可以係懶人包）
- 🚨 五個版本必須睇落完全唔同——唔同形態、唔同人稱、唔同策略目的。全部似同一個 template 就係失敗
- 大膽轉換形態：詩歌、笑話、對話、用家見證、清單、故事——任何你覺得有效嘅形態` : ''}

${selfCritiqueSection}

---

### 輸出格式要求（極度重要）

必須嚴格輸出以下 JSON，唔好加任何說明、註解、或者 JSON 以外嘅文字。
如果輸出唔係合法 JSON，整個生成會失敗。

請務必確保所有字串都正確 escape（例如入面有雙引號就用 \\"），唔好出現 unterminated string。

\`\`\`json
{
  "diagnosis": {
    "hasSimplifiedChars": true/false,
    "mainlandPhrases": [
      { "phrase": "原文詞彙", "suggestion": "建議替換" }
    ],
    "issues": ["問題描述1", "問題描述2"],
    "complianceViolations": [
      { "rule": "違反嘅合規規則/紅線", "match": "原文違規文字", "severity": "high" }
    ]
  },
  "variants": {
    "standardHK": "港式標準繁中版本...",
    "lightCantonese": "輕粵語社媒版本...",
    "ig": "IG 版本...",
    "facebook": "Facebook 版本...",
    "shorts": "Shorts/TK 版本（YouTube Shorts / TikTok）..."
  },
  "variantMeta": {
    "standardHK": {
      "headline": "呢個版本嘅主要標題/第一句（作為標題）",
      "altHeadlines": ["備選標題1", "備選標題2", "備選標題3"],
      "ctaLine": "CTA / 互動引導句",
      "valuePropStatement": "一句價值主張：核心賣點/消費者利益",
      "targetPersona": "最適合嘅目標消費者",
      "creativeForm": "文案形態",
      "strategyGoal": "策略目的"
    },
    "lightCantonese": { "headline": "...", "altHeadlines": [...], "ctaLine": "...", "..." },
    "ig": { "headline": "...", "altHeadlines": [...], "ctaLine": "...", "..." },
    "facebook": { "headline": "...", "altHeadlines": [...], "ctaLine": "...", "..." },
    "shorts": { "headline": "...", "altHeadlines": [...], "ctaLine": "...", "..." }
  }
}
\`\`\`

🚨 **variantMeta 欄位要求**：
- headline：提取文案中最搶眼嗰句做標題（8-25 字），可適量加入 emoji 增加視覺吸引力 🔥
- altHeadlines：必須為每個版本提供 3 個備選標題，要求如下：
  - **字數**：6-20 字，要精簡有力
  - **多樣性**：3 個備選標題要用唔同角度（例如：一個用數字/數據吸睛、一個用問句引起好奇、一個用情感/場景代入）
  - **Emoji**：至少 1 個備選標題適當加入 emoji（唔好濫用，1-2 個就夠）
  - **港式特色**：可以融入港式口語節奏、廣東話 punch line、本地生活場景
  - **標題模式參考**：
    - 🔢 數字型：「3 個原因點解香港人開始轉用XX」
    - ❓ 問句型：「你揀XX嗰陣，有冇諗過呢樣嘢？」
    - 😱 驚奇型：「估唔到XX原來可以咁抵」
    - 💬 共鳴型：「是但問個港島人，XX邊間最掂？」
    - 🎯 直接型：「XX新登場，限量搶手貨」
    - 🏠 場景型：「放工返到屋企，最想見到嘅就係XX」
- valuePropStatement：如有明確消費者利益就填寫一句價值主張（10-30 字）
- 每個版本嘅 creativeForm 同 strategyGoal 可以唔同

重要：JSON 必須合法（valid JSON），欄位必須完整，版本文字必須係香港繁體中文。`;
}
