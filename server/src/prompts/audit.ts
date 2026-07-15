// Audit prompt: five-dimension scoring (with forced differentiation),
// issue tags, replacement suggestions, risk notes, and consumer-feedback simulation.

import type { Variants, ConsumerPersona } from '../types/index.js';
import { buildComplianceSection, buildCompactRedLinesConstraint } from './complianceRules.js';

export function buildAuditPrompt(variants: Variants, brandRedLines?: string): string {
  const complianceBlock = buildComplianceSection(brandRedLines);

  return `## 任務：審核已生成嘅港式社媒文案

你係一個**專業嘅香港社媒文案評審**。你要誠實且有建設性地評估生成文案嘅質量——呢啲文案係經過 AI 優化嘅，理應比原文有明顯改善。好嘅地方要大膽認，但如果有改善空間都要指出。

${complianceBlock}

---

請對以下五個**生成版本**進行全面審核：

### 標準繁中版本
${variants.standardHK}

### 輕粵語版本
${variants.lightCantonese}

### IG 版本
${variants.ig}

### Facebook 版本
${variants.facebook}

### Shorts/TK 版本（YouTube Shorts / TikTok）
${variants.shorts}

---

### 審核步驟

#### 1. 八維度評分（每維 0-100 分）

t**🚨 評分規則（必須遵守）**：
	- 呢啲係經過 AI 生成同優化嘅文案，理應有相當嘅質量。大部分維度應該喺 60-90 分之間。
	- **評分必須基於文本實際質量**，用以下錨點對照。每個維度獨立評分，唔好人為拉開高低。
	- **一致性原則**：如果五個維度嘅質量接近，分數亦應該接近——唔好刻意製造差距。相近質量 → 相近分數。
	- 每個分數要俾到**具體文字證據**：邊句令你俾呢個分？點解？
	- **穩定性**：同一份文本如果評兩次，分數差距唔應該超過 ±5 分。請用錨點校準自己。

**港味純正度 (0-100)** — 權重 25%
聽落有幾似香港人寫嘅？粵語係咪自然、地道？

評分錨點（揀最接近嘅一個，唔好揀中間）：
- 15-25：災難級——全篇書面語/普通話直譯，一睇就知唔係香港人寫。例：「給大家推薦這款產品」直譯做「俾大家推薦呢款產品」（香港人會寫「同大家介紹吓呢隻product」）
- 35-50：有嘗試用粵語但好唔穩定。大部分句子仲係書面語，只有零星語氣詞（啦、嘅）點綴。讀出嚟會覺得怪。
- 55-70：基本達標。大部分句子自然，但有一兩個位用詞唔夠地道（例如用咗「質量」而唔係「質素」，「水平」而唔係「水準」）
- 75-88：自然流暢。用詞、句式、節奏都係香港社媒嘅感覺。有少量位可以更精準。
- 90-98：接近 native。用詞精準、節奏地道、語氣詞用得恰到好處。香港人睇落會以為係本地小編寫嘅。

**品牌安全度 (0-100)** — 權重 15%

評分錨點：
- 15-25：有明顯風險——粗口/性暗示/政治隱喻/誤導性宣稱。出咗街會有公關災難。
- 35-50：有一兩個位要小心。例如太粗俗嘅俚語（「好撚正」）、或者宣稱太誇張（「全港最好」）。
- 55-70：大致安全，但可以更穩妥。有少量位建議修改先出街。
- 75-88：品牌安全。用詞得體，冇踩界內容。可直接用於社媒。
- 90-98：非常穩妥。用詞審慎，可直接用於付費廣告或官方渠道。

**平台適配度 (0-100)** — 權重 15%
五個版本係咪各自符合目標平台嘅格式、語氣、長度？

評分錨點：
- 15-25：五個版本幾乎一樣，根本冇做平台適配。IG版同FB版冇分別。
- 35-50：有嘗試區分但效果差——IG版太長（超過150字）、FB版太casual唔似品牌post、Shorts/TK版冇節奏感。
- 55-70：基本適配。每個版本有啲平台特性，但可以更精準。
- 75-88：每個版本都符合平台特性。IG精簡有hashtag、FB有互動感、Shorts/TK有節奏。
- 90-98：完美適配。格式、長度、語氣、CTA都針對平台最佳化。

**可讀性 (0-100)** — 權重 15%
係咪流暢、易讀、節奏好？目標受眾會唔會睇得明？會唔會想睇落去？

評分錨點：
- 15-25：災難級。句子太長（一句超過40字）、結構混亂、睇到一半就想skip。
- 35-50：大致睇得明但有明顯改善空間——句子長短不一、段落分配差、冇節奏感。
- 55-70：流暢易讀。句子長度合理，分段清楚。
- 75-88：節奏好。長短句交替、有停頓位、容易一口氣睇晒。
- 90-98：一氣呵成。每個字都有價值，節奏控制精準，睇完想即刻做啲嘢（like/share/click）。

**創意/吸引力 (0-100)** — 權重 10%
有冇記憶點？係咪適合社媒傳播？讀者會唔會停低睇？

評分錨點：
- 15-25：平淡如水。似新聞稿或說明書，冇任何吸引人嘅元素。scroll過都唔會望。
- 35-50：有基本信息但冇創意。好平庸，市場上同類文案大把。
- 55-70：有啲創意元素。可能有一兩個有趣嘅位，但整體仲係普通。
- 75-88：有明顯hook。開頭吸引、有記憶點、有share價值。
- 90-98：爆紅潛力。創意出色、角度新鮮、令人想即時互動或分享俾朋友。

**Hook 強度 (0-100)** — 權重 10%
開頭第一句有幾搶眼？3 秒內能唔能夠抓住 scrolling 用戶嘅注意力？

評分錨點：
- 15-25：完全冇 hook——開頭似說明書標題或新聞標題，scrolling 用戶一定會 skip
- 35-50：有嘗試做 hook 但效果差——太長、太抽象、或者 clickbait 味太濃
- 55-70：基本合格。開頭有啲吸引力，但可以更搶眼
- 75-88：Hook 有力。用問句/數字/對比/懸念有效抓住注意力，會想睇落去
- 90-98：極強 hook。一句就中、即刻想知更多、會因為個 hook 而停低

**Emoji/Hashtag 策略 (0-100)** — 權重 5%
Emoji 使用係咪恰當？Hashtag 係咪相關、數量合理？

評分錨點：
- 15-25：完全冇 emoji/hashtag（對 IG/Shorts/TK 嚟講係大問題），或者 emoji 濫用到影響閱讀
- 35-50：Emoji 使用不當（例如正式版本用太多 emoji），hashtag 唔相關或太少
- 55-70：基本合理。emoji 同 hashtag 都係預期範圍內
- 75-88：Emoji 用得恰到好處、增強咗節奏；hashtag 精選且相關
- 90-98：Emoji 同文字融為一體，hashtag 策略精準（有品牌 hashtag + 熱門 hashtag + 長尾 hashtag）

**互動引導潛力 (0-100)** — 權重 5%
文案會唔會引發互動（like/comment/share/tag 朋友）？有冇引導讀者做啲嘢？

評分錨點：
- 15-25：完全冇互動引導，讀完就會 scroll 走，冇任何理由互動
- 35-50：有少少互動元素但唔夠強——可能只係結尾有個模糊嘅問句
- 55-70：有基本互動引導（例如「留言話我知」），但可以更精準
- 75-88：互動設計得好——問句自然、tag 朋友有理由、share 有誘因
- 90-98：互動引導極強——讀者會自發想留言、想 tag 朋友、想分享。CTA 自然融入內容

**總分計算公式**：
總分 = 港味純正度 × 0.25 + 品牌安全度 × 0.15 + 平台適配度 × 0.15 + 可讀性 × 0.15 + 創意/吸引力 × 0.10 + Hook強度 × 0.10 + Emoji/Hashtag策略 × 0.05 + 互動引導潛力 × 0.05
（四捨五入到整數。你自己要驗算一次，確保計啱。）

#### 1a. CTA 獨立評分（補充指標，不計入總分）

對每個版本嘅 CTA（Call-to-Action）進行獨立評估。CTA 係文案最後一步——讀者睇完之後應該做啲乜？

**評分維度**（每個版本獨立評分，0-100）：

**CTA 存在性 (0-30)**：
- 0：完全冇 CTA，讀完唔知做乜
- 15：有個模糊嘅行動暗示
- 30：有明確嘅下一步指引

**CTA 自然度 (0-30)**：
- 0：Hard sell 味濃、生硬突兀（「立即購買！」「手慢無！」）
- 15：有嘗試融入但略顯生硬
- 30：完全自然融入內容，唔似廣告

**CTA 平台匹配度 (0-40)**：
- 0：CTA 完全不適合呢個平台（例如 Shorts/TK 叫人填 form）
- 20：CTA 方向正確但執行一般
- 40：CTA 完美匹配平台特性（IG → link in bio、FB → 留言/分享、Shorts/TK → like/follow/subscribe）

每個版本 CTA 總分 = 存在性 + 自然度 + 平台匹配度

**每個版本都要評**。標準繁中同輕粵語版本都要有 CTA 評估。

#### 2. 問題標籤檢測（必須具體、多樣化）

🚨 **關鍵規則**：
- **唔可以全部問題用同一個標籤**。如果你發現自己寫咗3個「AI腔」，重新思考——每個問題應該有唔同嘅具體表現。
- 每個標籤必須配一句**具體文字證據**（引用原文邊句出事）。
- 只標真正有問題嘅位，無問題就留空。唔好為標而標。

**可用標籤分類**（揀最精準嗰個）：

語言層面：
- **書面語直譯**：普通話句式直接轉廣東話但唔自然。例：「給大家推薦」→寫咗「俾大家推薦」（應為「同大家介紹」）
- **內地網絡用語**：用咗內地social media先會用嘅詞。例：「姐妹們沖」「絕絕子」「寶子」「yyds」「種草」
- **簡繁混用**：殘留簡體中文字
- **港味不足**：廣東話用咗但唔地道。語氣詞擺錯位、用咗非香港用法（例如「啥」→香港人用「乜」）
- **粵語過火**：語氣詞堆砌（連續三四個啦喇嘅咁呀）、太粗俗、同品牌語氣唔夾

表達層面：
- **AI腔**：過度正式、空泛冇具體細節、機械式排比句、四字詞堆砌、「一站式」「全方位」「極致體驗」呢類buzzword
- **太長太嚕囌**：字數過多、句子太長（單句超過35字）、資訊密度太低
- **冇hook**：開頭唔吸引、冇記憶點、第一篇就令人想skip。冇任何令人想停低嘅元素。
- **資訊含糊**：講咗等於冇講、冇具體賣點、冇數字、冇令人記得嘅信息
- **過度推銷**：太hard sell、不停叫人買/click、冇提供價值就叫人行動

品牌層面：
- **語氣同品牌唔夾**：設定咗「高級」但文案太粗俗；設定咗「年輕」但語氣太老派
- **品牌名誤用**：品牌名或產品名寫錯、理解錯、或用得不當
- **格式問題**：emoji過多/過少、分段不當、hashtag唔合理、標點問題

#### 3. 替換建議

針對任何可以用更地道香港講法嘅位置，提供替換建議。
每個替換建議格式：{ original, suggested, reason }
至少俾 2-4 個有價值嘅替換建議。如果真係冇需要改嘅位，可以少啲。

#### 4. 風險提示

檢查有冇需要香港本地人復核嘅風險點：
- red：政治敏感、地區用語不當、法規/醫療/金融宣稱風險、價錢單位錯誤（例如港幣寫咗人民幣符號）
- amber：品牌語氣可能不當、用詞可能引起誤會、建議本地人 double check

#### 5. 街坊留言模擬

模擬 3-5 個香港受眾可能嘅留言反應，每條標明類型：
- **interest**：真心有興趣
- **question**：問價錢/邊度買/詳情
- **skepticism**：輕微懷疑（例如「真唔真呀」「會唔會又係廣告」）
- **playful**：玩味港式留言（例如用歌詞/電影對白回應）
- **followup**：實用跟進問題

留言必須（好重要！）：
- **一定要生成 4-5 條留言**，每條 2-4 句，有頭有尾
- 用返嗰個類型嘅真實語氣（懷疑嘅就真係懷疑，唔好假懷疑真讚賞）
- 有香港網絡留言嘅感覺（唔好太正式，要似真係有人喺 Facebook/IG 留嘅）
- 每條唔同風格、唔同角度、唔同長度
- 留言要有「人性」：可以反問、可以開玩笑、可以半信半疑、可以 tag 朋友
- **唔好全部得一兩句**——每條留言都要有足夠內容令用戶覺得有參考價值

---

### 輸出格式要求

請嚴格按照以下 JSON 格式輸出，唔好加任何其他文字：

\`\`\`json
{
  "thermometer": {
    "overall": 72,
    "dimensions": {
      "cantoneseFeel": 3,
      "culturalFit": 3,
      "platformFit": 4,
      "brandSafety": 4,
      "tradConsistency": 5,
      "hookStrength": 3,
      "visualStrategy": 3,
      "engagementFit": 3
    }
  },
  "scores": {
    "cantoneseNaturalness": 65,
    "brandSafety": 82,
    "platformFit": 70,
    "readability": 78,
    "creativity": 55,
    "hookStrength": 60,
    "emojiHashtagFit": 65,
    "engagementPotential": 55,
    "total": 67
  },
  "issues": [
    { "tag": "書面語直譯", "severity": "high", "description": "「俾大家推薦呢款產品」——香港人會寫「同大家介紹吓」" }
  ],
  "replacements": [
    { "original": "俾大家推薦", "suggested": "同大家介紹吓", "reason": "更地道香港講法" }
  ],
  "risks": [
    { "level": "amber", "description": "風險描述..." }
  ],
  "comments": [
    { "type": "interest", "text": "嘩呢個幾好喎！我前排先諗緊有冇呢類product，可以share俾我個group嗎？想知邊度有得買🤩" },
    { "type": "question", "text": "想問吓價錢方面係點？有冇試用裝或者sample可以試咗先？因為之前試過類似嘅唔係好啱用。" },
    { "type": "skepticism", "text": "又係廣告...老實講而家咁多brand出post，真係好嘅唔洗點sell都會有人講。有冇真實用家評價可以參考吓？" },
    { "type": "playful", "text": "😂 見到個caption笑咗，小編今次有進步喎！不過第三句嗰個位有啲hard sell，輕手啲會更自然～" },
    { "type": "followup", "text": "想知多啲詳情！你哋會唔會喺FB/IG做直播介紹？如果有片睇會更加清楚，同埋想問門市有冇現貨？" }
  ],
  "ctaScores": {
    "standardHK": { "presence": 20, "naturalness": 22, "platformFit": 30, "total": 72 },
    "lightCantonese": { "presence": 20, "naturalness": 25, "platformFit": 30, "total": 75 },
    "ig": { "presence": 25, "naturalness": 25, "platformFit": 35, "total": 85 },
    "facebook": { "presence": 20, "naturalness": 22, "platformFit": 32, "total": 74 },
    "shorts": { "presence": 18, "naturalness": 20, "platformFit": 30, "total": 68 }
  }
}
\`\`\`

🚨 最後檢查清單（輸出前自己確認）：
- [ ] 五個 scores 維度係咪基於文本實際質量獨立評分？係咪冇被人為拉開高低？
- [ ] 總分係咪跟加權公式計算？（自己驗算一次）
- [ ] issues 係咪用咗唔同嘅標籤？有冇引用具體原文？
- [ ] thermometer dimensions 係 1-5 分，overall 係 0-100
- [ ] JSON 格式合法，冇 trailing commas，所有字串用雙引號
- [ ] 冇任何 JSON 以外嘅文字`;
}

/**
 * Prompt for scoring the original source text on the same five dimensions.
 */
export function buildSourceScorePrompt(source: string): string {
  return `## 任務：對以下原文進行八維度評分

你要誠實評估呢篇原文嘅質量。請注意：呢篇係**用戶上傳嘅原始文案**（未經 AI 處理），所以分數反映嘅係原文本身嘅水平。

### 原文
${source}

### 評分維度（每維 0-100 分）

🚨 **評分規則**：
- 八個維度要有**高低之分**——至少一個維度 ≥ 80（原文都有優點），至少一個維度 ≤ 50（用戶就係覺得唔夠好先上傳）
- 大部分上傳嘅原文喺「港味純正度」同「創意/吸引力」呢兩個維度會偏低（30-55），因為用戶正係想改善呢兩方面
- 每個分數基於原文嘅具體表現

**港味純正度 (0-100)** — 權重 25%
原文本身有幾「港味」？有冇內地營銷詞？普通話直譯腔？粵語係咪自然？

**品牌安全度 (0-100)** — 權重 15%
原文有冇品牌風險？用詞係咪穩妥？

**平台適配度 (0-100)** — 權重 15%
原文格式/長度/語氣係咪適合社媒發布？

**可讀性 (0-100)** — 權重 15%
原文係咪流暢易讀？結構清晰？

**創意/吸引力 (0-100)** — 權重 10%
原文有冇創意？有冇令人想睇落去嘅元素？

**Hook 強度 (0-100)** — 權重 10%
原文開頭有幾吸引？

**Emoji/Hashtag 策略 (0-100)** — 權重 5%
原文 emoji/hashtag 使用係咪恰當？

**互動引導潛力 (0-100)** — 權重 5%
原文有冇引導互動？

**總分計算公式**：
總分 = 港味純正度 × 0.25 + 品牌安全度 × 0.15 + 平台適配度 × 0.15 + 可讀性 × 0.15 + 創意/吸引力 × 0.10 + Hook強度 × 0.10 + Emoji/Hashtag策略 × 0.05 + 互動引導潛力 × 0.05
（四捨五入到整數。自己驗算。）

### 輸出格式

\`\`\`json
{
  "cantoneseNaturalness": 35,
  "brandSafety": 70,
  "platformFit": 42,
  "readability": 55,
  "creativity": 30,
  "hookStrength": 25,
  "emojiHashtagFit": 40,
  "engagementPotential": 20,
  "total": 40
}
\`\`\`

只輸出 JSON，唔好加任何其他文字。`;
}

/**
 * Prompt for consumer persona feedback simulation.
 */
export function buildConsumerFeedbackPrompt(
  variants: Variants,
  personas: ConsumerPersona[],
  platform: string,
  source?: string,
  brandName?: string,
  productName?: string,
  brandRedLines?: string,
): string {
  const personaDescriptions = personas.map((p, i) => {
    // Auto-derive speaking style from persona demographics
    const style = derivePersonaVoice(p);
    return `${i + 1}. **${p.name}** | ${p.ageRange} | ${p.occupation}
   消費習慣：${p.habits}
   常用平台：${p.apps}
   備註：${p.notes}
   🎤 **說話風格**：${style}`;
  }).join('\n\n');

  const contextBlock = (source || brandName || productName || brandRedLines)
    ? `\n### 用戶原始需求（衡量建議相關性嘅基準）\n${source ? `原文內容：${source.slice(0, 300)}${source.length > 300 ? '...(節錄)' : ''}\n` : ''}${brandName ? `品牌：${brandName}\n` : ''}${productName ? `產品：${productName}\n` : ''}${brandRedLines ? `\n🚫 **品牌表達紅線（消費者建議都唔可以觸及）**：\n${brandRedLines}\n` : ''}\n⚠️ 所有修改建議必須同以上需求相關。如果建議同原文/品牌/產品完全無關（例如原文講護膚品但建議講飲食），相關度評 1-2 分。\n⚠️ 消費者嘅修改建議都唔可以觸及以上品牌表達紅線，如果建議觸及紅線要評低相關度分數。\n`
    : '';

  return `## 任務：模擬真實香港消費者對文案嘅反應

你要分別扮演以下 ${personas.length} 位消費者。**你唔係AI，你係佢哋本人**。你要用佢哋嘅眼睛睇呢篇文案，用佢哋把口講出真實感受。

### 🚨 關鍵規則

1. **每位消費者必須有完全唔同嘅反應風格**。如果兩個人嘅 feedback 聽落差唔多，你就失敗咗。
2. **評分必須有明顯差距**：${personas.length} 位入面，至少要有一位 ≤ 2星，至少要有一位 ≥ 4星。唔可以全部都係 3-4 星。
3. **要具體**：指出邊句好、邊句唔好、邊個字令你覺得假/真。唔好寫空泛嘅「幾好睇」「唔錯」。
4. **語氣要真實**：用返嗰個人嘅社會階層、教育程度、年齡嘅真實講嘢方式。師奶同中環白領嘅廣東話係完全唔同嘅。
5. **誠實批評**：如果覺得唔吸引，直接講。香港消費者好精明，唔會俾面——做乜要讚一份佢覺得普通嘅文案？

### 消費者畫像及說話風格

${personaDescriptions}
${contextBlock}
### 文案內容

平台：${platform}

標準繁中版本：
${variants.standardHK}

IG 版本：
${variants.ig}

Facebook 版本：
${variants.facebook}

Shorts/TK 版本（YouTube Shorts / TikTok）：
${variants.shorts}

### 寫作指引

每位消費者睇最相關嗰個平台版本（例如師奶睇 FB，後生睇 IG），然後用**第一身口吻**寫出佢嘅真實反應。

你嘅 feedback 必須圍繞**文案本身**呢三個維度：
1. **港味地道度**：呢篇文案嘅廣東話係咪自然？有冇AI腔、書面語、普通話直譯？語氣詞用得啱唔啱？
2. **社媒吸引力**：喺 social media 見到會唔會停低睇？個 hook 吸唔吸引？內容有冇令我哋想like/share/留言？
3. **產品說服力**：睇完會唔會對產品/服務有興趣？文案有冇講清楚賣點？會唔會想了解多啲或者去買？

⚠️ **注意**：你只係在評價「文案寫得好唔好」，唔係在評價「產品好唔好」。專注喺文字表達、語氣、說服力嘅評價。

語氣風格參考：
- 師奶型：直接、實際、會提及價錢、用口語廣東話（「喂」「老實講」「咁又點啫」）
- 白領型：較講究、中英夾雜自然、會留意品牌 tone、挑剔但理性（「actually」「honestly」「個tone有啲off」）
- 年輕型：輕鬆、多emoji、中英夾雜多、用潮流用語（「好癲」「笑死」「真實」）
- 專業型：理性分析、留意細節、語氣平實、重視資訊準確性

### 🔍 建議相關度評分（每條建議必須評）

對於你提出嘅每條建議，請評估佢同「用戶原始需求」嘅相關程度：
- **5 分**：精準針對原文嘅核心問題，修改後會顯著提升文案效果
- **4 分**：同原文/品牌高度相關，係有價值嘅改善方向
- **3 分**：大致相關但仍然喺範圍內，有一定參考價值
- **2 分**：有啲偏離主題，可能執著於次要細節
- **1 分**：完全跑題，同原文/品牌/產品無關，或者係消費者誤解咗產品用途
- 如果你發現自己俾出咗 ≤2 分嘅建議，喺 relevanceReason 解釋點解佢唔夠相關

### 🎯 平台識別（每條建議必須標明）

對於每條建議，請識別佢**針對邊個/邊幾個平台版本**。可用嘅 variant key：
- \`standardHK\` — 標準繁中版本
- \`lightCantonese\` — 輕粵語版本
- \`ig\` — IG 版本
- \`facebook\` — Facebook 版本
- \`shorts\` — Shorts/TK 版本（YouTube Shorts / TikTok）

規則：
- 如果你嘅建議係針對某個特定平台（例如「IG 版本太長」），targetPlatforms 就係 \`["ig"]\`
- 如果你嘅建議適用於所有平台（例如「全體港味不足」），targetPlatforms 就係 \`["standardHK","lightCantonese","ig","facebook","shorts"]\`
- 如果建議係關於書面語表達（非平台特定），targetPlatforms 可以係 \`["standardHK","lightCantonese"]\`
- 唔好留空——必須填至少一個 platform

### 輸出格式

\`\`\`json
[
  {
    "personaId": "${personas[0]?.id ?? 'p1'}",
    "personaName": "${personas[0]?.name ?? '消費者'}",
    "feedback": "用第一身廣東話寫嘅真實反應（3-5句）。要聽得出係「${personas[0]?.name ?? '呢個人'}」在講嘢，唔係AI在分析。",
    "rating": 3,
    "suggestions": [
      {
        "aspect": "港味地道度",
        "suggestion": "具體修改建議，例如將邊句改成點樣...",
        "reason": "點解咁改會好啲...",
        "relevanceScore": 4,
        "relevanceReason": "呢個建議直接回應原文嘅書面語問題，對改善港味有幫助",
        "targetPlatforms": ["standardHK", "lightCantonese"]
      }
    ]
  }
]
\`\`\`

🚨 **每位消費者必須提供 1-2 個具體修改建議**（suggestions 欄位唔可以係空 array）。
suggestions 欄位：
- **aspect**：對應三個評分維度之一（港味地道度 / 社媒吸引力 / 產品說服力）
- **suggestion**：具體、可執行嘅修改建議（唔好空泛，要指出改邊度、點樣改。例：「第三句嘅『俾大家推薦』改為『同大家介紹吓』更自然」）
- **reason**：解釋點解呢個修改會改善文案效果
- **relevanceScore**：1-5 分，呢個建議同用戶需求有幾相關（跟上面嘅評分標準）
- **relevanceReason**：點解俾呢個相關度分數（一句話解釋）
- **targetPlatforms**：呢個建議針對邊個平台版本（必須填，至少一個 variant key）

🚨 最後檢查：
- 每位消費者嘅 feedback 語氣係咪明顯唔同？
- 評分係咪有高低？（檢查有冇 ≤2 同 ≥4）
- 係咪用咗第一身口吻（「我覺得」「我會唔會」）而唔係第三者分析？
- 每位消費者係咪有 1-2 個具體、可執行嘅修改建議？（suggestions 唔可以係 []！）
- 每條建議係咪有 relevanceScore + relevanceReason + targetPlatforms？
- 相關度評分係咪誠實？如果有建議明顯離題，係咪俾咗 ≤2 分？
- targetPlatforms 係咪用咗正確嘅 variant key？（standardHK/lightCantonese/ig/facebook/shorts）
- JSON 合法，只輸出 JSON`;
}

/**
 * Auto-derive a persona's speaking voice from their demographics.
 * This guides the LLM to use the right Cantonese register for each persona.
 */
function derivePersonaVoice(p: ConsumerPersona): string {
  const age = p.ageRange ? parseInt(p.ageRange.split('-')[0], 10) || 30 : 30;
  const occ = p.occupation.toLowerCase();
  const habits = p.habits.toLowerCase();
  const apps = p.apps.toLowerCase();

  const isYoung = age < 28;
  const isMiddleAged = age >= 35 && age < 55;
  const isOlder = age >= 55;
  const isProfessional = occ.includes('manager') || occ.includes('專業') || occ.includes('白領') || occ.includes('marketing') || occ.includes('銀行');
  const isHomemaker = occ.includes('主婦') || occ.includes('媽媽') || occ.includes('家庭');
  const isStudent = occ.includes('學生') || occ.includes('freelance') || occ.includes('大學');
  const isPriceSensitive = habits.includes('價錢') || habits.includes('精打細算') || habits.includes('敏感');
  const isHeavyIG = apps.includes('ig') || apps.includes('threads');
  const isHeavyFB = apps.includes('facebook') || apps.includes('whatsapp');

  const parts: string[] = [];

  // Cantonese register
  if (isYoung) {
    parts.push('粵語口語為主，較多中英夾雜（例如 "actually" " vibe" "fyi"），語氣輕鬆隨意');
  } else if (isMiddleAged) {
    if (isProfessional) {
      parts.push('粵語為主、適量中英夾雜（限於常見商業用語），語氣較講究但唔會太 formal');
    } else if (isHomemaker) {
      parts.push('純口語廣東話、貼地、直接，唔會中英夾雜。用詞生活化，可能出現街市/屋邨式講法');
    } else {
      parts.push('日常粵語口語、適量英文單字，語氣自然唔做作');
    }
  } else if (isOlder) {
    parts.push('地道廣東話、較少英文、語氣穩重務實，有時會用傳統粵語俗語');
  } else {
    parts.push('日常粵語口語，語氣自然');
  }

  // Attitude / focus
  if (isPriceSensitive) {
    parts.push('對價錢敏感，會留意優惠資訊。如果文案冇講價錢或優惠，會有微言');
  }
  if (isProfessional) {
    parts.push('對文案質素要求高、留意品牌tone of voice。太hard sell或太粗俗會反感。會用「個branding」「個positioning」呢類詞');
  }
  if (isHomemaker) {
    parts.push('重視實用性同口碑。會問「係咪真係有用」「邊度有得買」。對誇張廣告有免疫力');
  }
  if (isStudent) {
    parts.push('追求新鮮感、重視美感。caption太長會skip。會留意brand嘅aesthetic同vibe');
  }
  if (isHeavyIG) {
    parts.push('習慣IG式快速瀏覽，對視覺同排版敏感。hashtag用法會留意');
  }
  if (isHeavyFB) {
    parts.push('習慣FB式較長內容，會睇詳情同留言。重視社群互動感');
  }

  return parts.join('。');
}

/**
 * Prompt for parsing unstructured free-text persona descriptions into structured personas.
 */
export function buildParsePersonasPrompt(rawText: string): string {
  return `## 任務：從用戶輸入中提取消費者畫像

請分析以下用戶自由輸入嘅文字，從中提取所有提到嘅目標消費者資訊，整理成結構化嘅消費者畫像列表。

### 用戶輸入
${rawText}

### 提取規則
- 從文字中識別出每個消費者（可能係一個、多個、或一大段描述）
- 每個消費者一個獨立畫像，要有**獨特性格同視角**（唔好整幾個差唔多嘅人）
- 如果文字中冇明確提到某個欄位，根據上下文合理推斷（例如提到「師奶」就推斷年齡約35-50、睇FB）
- 如果文字信息好少（例如只得一句），根據你對香港市場嘅認識，補充合理細節令畫像完整
- 每個畫像必須有：name（創作一個地道香港名）、ageRange、occupation、habits（消費習慣）、apps（常用平台）、notes（性格特點及對文案嘅態度）
- 至少提取 2 個消費者。如果原文信息不足以提取 2 個，根據推斷補充。
- 最多 5 個消費者。

### 輸出格式

\`\`\`json
[
  {
    "id": "ai-gen-1",
    "name": "師奶阿May",
    "ageRange": "35-50",
    "occupation": "家庭主婦",
    "habits": "精打細算、睇WhatsApp group、重口碑",
    "apps": "Facebook、WhatsApp Group",
    "notes": "對價錢敏感，見到「優惠」「限時」會特別留意。最怕太複雜嘅文字。"
  },
  {
    "id": "ai-gen-2",
    "name": "中環白領Jason",
    "ageRange": "25-35",
    "occupation": "marketing manager",
    "habits": "追求效率、睇IG多過FB、會因為文案有趣而follow品牌",
    "apps": "IG、LinkedIn",
    "notes": "中英夾雜自然，對設計感同文案質素要求高。太hard sell會反感。"
  }
]
\`\`\`

只輸出 JSON，唔好加任何其他文字。`;
}

/**
 * Prompt for translating Cantonese feedback to Mandarin.
 */
export function buildTranslatePrompt(cantoneseText: string): string {
  return `## 任務：將以下粵語文字翻譯成普通話/書面語

請將以下香港粵語口語翻譯成流暢嘅普通話/書面中文。
保留原文嘅語氣、情感同節奏，只係轉換語言。

### 原文（粵語）
${cantoneseText}

### 要求
- 翻譯成自然流暢嘅普通話/書面中文
- 保留第一身口吻（如果原文係「我覺得」，翻譯都要係「我覺得」）
- 保留語氣強度（如果原文係批評，翻譯都要係批評）
- 唔好添加或刪減內容

只輸出翻譯後嘅中文文字，唔好加任何標記或說明。`;
}

/**
 * Prompt for applying a consumer's modification suggestion to a variant.
 */
export function buildApplySuggestionPrompt(
  variantText: string,
  suggestion: string,
  reason: string,
  brandRedLines?: string,
  originalText?: string,
  appliedSuggestions?: string[],
): string {
  const redLinesBlock = buildCompactRedLinesConstraint(brandRedLines);

  // Build context about previously applied modifications
  let historyBlock = '';
  if (originalText && appliedSuggestions && appliedSuggestions.length > 0) {
    historyBlock = `
### ⚠️ 修改歷史（已套用嘅建議）

以下係**原始文案**（未經任何修改嘅版本）同埋**已經套用咗嘅修改建議**。
你嘅任務係：從原始文案出發，整合所有已套用嘅建議 + 新嘅建議，產出一個**精簡不重複**嘅最終版本。

**原始文案（未修改前）**：
${originalText}

**已套用嘅修改**（總共 ${appliedSuggestions.length} 條）：
${appliedSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

🚨 **關鍵指令**：
- 以上修改已經體現喺當前文案入面。你而家要喺呢個基礎上，加入新嘅建議。
- **唔好重複已套用嘅修改**——如果新建議同已套用嘅建議相似或重疊，只需要微調，唔好再添加相同內容。
- **整合而非疊加**——將新舊建議融為一體，確保文案讀起身自然流暢，冇重複感。
- **精簡原則**——如果新舊建議有衝突（例如一個叫你加 emoji、一個叫你簡潔），以新建議為準，但要確保唔好兩個都做導致冗長。
`;
  }

  return `## 任務：根據消費者建議修改文案

你係一個香港社媒文案編輯。以下係一份已生成嘅文案版本，同埋一位目標消費者嘅修改建議。
請根據建議修改文案，令佢更符合消費者嘅期望。
${historyBlock}
### 當前文案（可能已經過修改）
${variantText}

### 🆕 新嘅消費者修改建議（今次要執行嘅）
${suggestion}

### 建議原因
${reason}

### 🛡️ 合規及紅線約束（修改時必須遵守）
${redLinesBlock}

### 修改要求
- 只修改建議提到嘅部分，其他內容保持不變
- **如果當前文案已有類似內容，整合而唔好重複添加**
- 保持原有嘅語氣風格同品牌調性
- 修改後嘅文案仍然要係地道香港粵語/繁中
- 如果建議合理，大膽改；如果建議同以上合規規則或紅線有衝突，以合規規則及紅線為準，溫和調整或拒絕該修改
- 🚫 修改後嘅文案絕不可以觸犯以上任何合規規則或紅線
- 保持原有嘅格式結構（分段、emoji、hashtag等）
- 字數浮動唔超過 ±20%
- 🎯 **最終輸出必須精簡、冇重複內容、讀起身自然**

### 輸出格式

\`\`\`json
{
  "modifiedText": "修改後嘅完整文案..."
}
\`\`\`

只輸出 JSON，唔好加任何其他文字。`;
}
