/**
 * Built-in compliance rules for Hong Kong social media copywriting.
 * These serve as baseline brand-safety guardrails and are merged with
 * user-provided brand red lines before injection into AI prompts.
 *
 * Categories align with:
 * - HK Trade Descriptions Ordinance (Cap. 362)
 * - HK Unsolicited Electronic Messages Ordinance (Cap. 593)
 * - Advertising industry self-regulatory guidelines
 * - Practical social-media risk patterns observed in HK market
 */

// ---- Individual rule type ----

export interface ComplianceRule {
  /** Category label shown to the model */
  category: string;
  /** Concrete rules — model reads these directly */
  rules: string[];
}

// ---- Default compliance rules ----

const BUILT_IN_RULES: ComplianceRule[] = [
  {
    category: '誇大宣傳用語',
    rules: [
      '禁止使用無法證實嘅絕對化宣稱，包括但不限於：「最強」、「第一品牌」、「獨家」、「唯一」、「100%有效」、「保證見效」、「無人能及」、「全港第一」',
      '如使用「銷量冠軍」、「人氣第一」等宣稱，必須有第三方數據支持，否則不可使用',
      '比較級宣稱（「更好」、「更優質」）必須有客觀比較基準，不能含糊其辭',
    ],
  },
  {
    category: '誤導性比較廣告',
    rules: [
      '不可未經證實地貶低競爭對手或進行不當比較',
      '不可使用「告別XX品牌」、「終於有品牌做對XX」等影射負面比較',
      '如引用競品對比，必須標明數據來源、測試條件及時間範圍',
    ],
  },
  {
    category: '虛假緊迫感',
    rules: [
      '不可使用虛假嘅限時、限量宣稱，例如虛構嘅「最後一天」、「僅剩3件」、「限時搶購」',
      '如使用真實限時優惠，必須標明確實截止日期及適用條款',
      '不可使用「即將加價」、「最後機會」等無法驗證嘅緊迫感營造手法（除非有確實日期）',
    ],
  },
  {
    category: '醫療及健康宣稱',
    rules: [
      '非醫療產品／服務（包括保健品、美容產品、食品）不可使用「治療」、「療效」、「根治」、「康復」、「治病」、「藥效」、「臨床驗證」等醫療術語',
      '不可暗示產品能診斷、預防或治療任何疾病（除非已獲 HK 衛生署註冊）',
      '美容產品不可作出「永久性效果」宣稱（如「永久脫毛」需有醫療級認證）',
      '減肥／瘦身產品不可使用「不運動也能瘦」、「躺著瘦」等誤導性宣稱',
      '營養補充品不可暗示可替代均衡飲食或正規醫療',
    ],
  },
  {
    category: '金融及投資誤導',
    rules: [
      '不可作出「穩賺」、「保證回報」、「無風險」、「包賺」等誤導性投資宣稱',
      '虛擬資產／加密貨幣相關推廣需加上「投資涉及風險，價格可升可跌」等風險披露',
      '不可使用「致富捷徑」、「被動收入（無需努力）」等誇大財富承諾',
      '貸款／信貸產品必須清楚標示實際年利率（APR）及還款條款',
    ],
  },
  {
    category: '政治敏感及社會禁忌',
    rules: [
      '避開任何對政治人物、政黨、政府機構嘅影射、諷刺或聯想',
      '不可觸及香港國安法相關敏感話題，包括但不限於分裂國家、顛覆國家政權等',
      '不可使用社會事件、示威、衝突場景作為營銷素材或背景',
      '避開涉及兩岸關係、主權歸屬等敏感表述',
      '不可使用任何可能被解讀為政治隱喻嘅符號、顏色、日期或措辭',
    ],
  },
  {
    category: '不雅用語及歧視',
    rules: [
      '不可使用粗口、性暗示、淫褻或不雅用語（包括諧音、拼音縮寫代替）',
      '不可作出任何涉及種族、性別、年齡、性取向、宗教信仰、殘疾嘅歧視性表述',
      '不可使用貶低任何群體嘅刻板印象或嘲諷（即使是「開玩笑」語氣亦不可）',
      '不可使用涉及暴力、霸凌、自殘等負面行為嘅內容或暗示',
      '親密關係／兩性話題需保持尊重，不可物化任何性別',
    ],
  },
  {
    category: '版權及商標',
    rules: [
      '不可未經授權使用第三方商標、品牌名稱、標誌或產品名稱',
      '不可直接引用他人廣告金句、slogan 作為自己文案的一部分',
      '不可使用未經授權嘅版權音樂、影片截圖、名人肖像',
      '如引用第三方內容（例如新聞報導），必須標明出處且不可超出合理引用範圍',
      '不可模仿或抄襲競爭對手嘅獨特文案風格達到可能引起混淆嘅程度',
    ],
  },
  {
    category: '價格及優惠標示',
    rules: [
      '價格標示必須清晰、完整，不可隱藏附加費用或條件',
      '「免費」宣稱必須明確說明有無任何附帶條件（如需要購買其他產品）',
      '優惠活動必須清楚標明推廣期、適用範圍、限制條款',
      '不可使用誤導性價格比較（例如虛構原價再打折，「原價」必須係真實嘅近期售價）',
      '標價貨幣必須清楚（港幣 HKD），如涉及其他貨幣必須同時標示港幣等值',
    ],
  },
  {
    category: '個人資料及私隱',
    rules: [
      '不可在文案中要求或暗示收集過度個人資料（以完成交易所需為限）',
      '如引導用戶填寫表格或註冊，必須有連結至私隱政策',
      '不可暗示會將客戶資料用於推廣目的以外嘅用途（除非已獲明確同意）',
      '不可公開展示或引用真實客戶嘅個人訊息內容（即使匿名化亦有風險）',
    ],
  },
  {
    category: '香港本地法規補充',
    rules: [
      '所有文案必須符合香港《商品說明條例》（Cap. 362），不可作出虛假商品說明',
      '菸酒廣告需遵守香港相關廣告限制（煙草產品全面禁止廣告，酒精飲料有限制）',
      '不可針對未成年人作出不當營銷（例如向18歲以下人士推廣成人產品）',
      '抽獎／遊戲／比賽推廣需遵守香港《赌博条例》相關規定',
      '不可使用「政府推薦」、「教育局認可」等未經授權嘅官方背書宣稱',
    ],
  },
];

// ---- Helpers ----

/**
 * Format built-in compliance rules into a prompt section.
 * Merges with optional user-provided brand red lines.
 */
export function buildComplianceSection(userRedLines?: string): string {
  const sections: string[] = [];

  // Built-in compliance rules (always injected)
  sections.push('## 🛡️ 常規合規檢測規則（社媒文案必須遵守）');
  sections.push('');
  sections.push('以下係香港社媒廣告文案嘅基本合規要求。生成、審核、修改文案時必須嚴格遵守：');
  sections.push('');

  for (const rule of BUILT_IN_RULES) {
    sections.push(`### ${rule.category}`);
    for (const r of rule.rules) {
      sections.push(`- ${r}`);
    }
    sections.push('');
  }

  sections.push('**合規優先級**：以上規則優先於任何語氣、風格或創意考量。如果某個創意方向觸及以上任何規則，必須放棄該方向。');
  sections.push('**審核要求**：審核時如發現文案觸及以上任何一條規則，必須標為 high severity 問題。');

  // User-provided brand red lines (appended after built-in rules)
  if (userRedLines && userRedLines.trim()) {
    sections.push('');
    sections.push('---');
    sections.push('');
    sections.push('## 🚫 品牌自訂表達紅線（表達約束，唔係內容清單）');
    sections.push('');
    sections.push('⚠️ **極度重要：紅線嘅正確理解**：');
    sections.push('- 品牌紅線係**約束條件**，唔係**待辦事項清單**。你唔需要逐條「完成」紅線入面嘅每一項');
    sections.push('- 以下紅線定義咗品牌允許同唔允許嘅表達方式。你只需要喺文案**自然涉及到相關內容時**跟從這些指引');
    sections.push('- 如果品牌紅線寫咗「DO」/「應該」/「要」/「必須提及」等：');
    sections.push('  * 呢啲係表示「如果文案涉及呢個話題，應該點樣表達」');
    sections.push('  * **除非明確寫明「所有文案必須包含XXX」，否則只係條件性指引，唔係強制內容要求**');
    sections.push('  * 舉例：「DO：使用品牌全名」→ 意思係「如果你要提品牌名，用全名」，而唔係「每句文案都要有品牌全名」');
    sections.push('- 如果品牌紅線寫咗「DON\'T」/「禁止」/「不可」/「避免」等：');
    sections.push('  * 呢啲係**絕對禁止**嘅紅線，無論任何情況都唔可以觸及');
    sections.push('- 🚫 **最常見嘅錯誤**：將品牌紅線當作「必須輸出嘅內容清單」，然後喺生成文案時主動添加產品描述、品牌介紹、成分說明等原文根本冇提及嘅內容。**呢個係嚴重錯誤。**');
    sections.push('');
    sections.push('---');
    sections.push('');
    sections.push('以下係品牌方提供嘅表達紅線：');
    sections.push('');
    sections.push(userRedLines.trim());
    sections.push('');
    sections.push('**紅線優先級**：以上品牌紅線係品牌表達嘅絕對約束。如果紅線同其他參數（語氣、粵語程度、平台適配）有衝突，以紅線為準。');
    sections.push('**審核要求**：文案審核時如果發現觸及紅線，要標為 high severity 問題。');
  }

  return sections.join('\n');
}

/**
 * Build a compact red-lines constraint for context blocks (consumer feedback, apply suggestion, etc.).
 * Injects both built-in compliance rules AND user red lines.
 */
export function buildCompactRedLinesConstraint(userRedLines?: string): string {
  const rules: string[] = [];

  // Condensed built-in rules
  rules.push('必須遵守嘅基本合規要求：');
  rules.push('- 唔可以用誇大/絕對化宣稱（最強、第一、獨家、100%）');
  rules.push('- 唔可以用醫療術語（治療、療效、根治）除非產品有衛生署註冊');
  rules.push('- 唔可以用金融誤導宣稱（穩賺、保證回報、無風險）');
  rules.push('- 唔可以涉及政治敏感內容或隱喻');
  rules.push('- 唔可以用粗口、性暗示、歧視性表述');
  rules.push('- 唔可以做未經證實嘅比較廣告或貶低競爭對手');
  rules.push('- 唔可以用虛假限時限量宣稱');
  rules.push('- 唔可以侵犯版權或未經授權使用第三方商標');
  rules.push('- 價格必須清晰標示，唔可以隱藏收費');
  rules.push('- 唔可以索取過度個人資料');
  rules.push('- 必須符合香港《商品說明條例》要求');

  if (userRedLines && userRedLines.trim()) {
    rules.push('');
    rules.push('品牌自訂紅線（表達約束，唔係內容清單）：');
    rules.push('⚠️ 紅線係約束條件，唔係待辦事項。DO = 如果涉及相關話題時應該點表達；DON\'T = 絕對禁止。');
    rules.push('🚫 唔好因為見到紅線入面有產品相關資訊，就喺文案中主動添加原文冇嘅產品描述、成分、功效等內容。');
    rules.push(userRedLines.trim());
  }

  return rules.join('\n');
}
