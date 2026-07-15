import type {
  Audit,
  AuditIssue,
  AuditScores,
  Diagnosis,
  GenerateRequest,
  DiagnoseGenerateResult,
  Replacement,
  Variants,
} from '../types/index.js';
import {
  applyCaseLibraryStyle,
  deriveCaseLibraryStyleHints,
} from './caseLibraryContext.js';

const MAINLAND_REPLACEMENTS: Array<{ phrase: string; suggestion: string }> = [
  // === 稱呼（內地腔 → 港式） ===
  { phrase: '寶子們', suggestion: '大家' },
  { phrase: '宝子们', suggestion: '大家' },
  { phrase: '姐妹們', suggestion: '各位' },
  { phrase: '姐妹们', suggestion: '各位' },
  { phrase: '家人們', suggestion: '大家' },
  { phrase: '家人们', suggestion: '大家' },
  { phrase: '小伙伴', suggestion: '朋友' },
  { phrase: '小夥伴', suggestion: '朋友' },
  { phrase: '親愛的顧客', suggestion: '各位' },
  { phrase: '亲爱的顾客', suggestion: '各位' },
  { phrase: '尊敬的用戶', suggestion: '各位' },
  { phrase: '尊敬的用户', suggestion: '各位' },
  { phrase: '親', suggestion: '' },
  { phrase: '亲', suggestion: '' },

  // === 營銷腔（內地社交電商 → 港式自然） ===
  { phrase: '爆款來襲', suggestion: '人氣之選' },
  { phrase: '爆款来袭', suggestion: '人氣之選' },
  { phrase: '狠狠拿捏', suggestion: '啱晒日常需要' },
  { phrase: '福利', suggestion: '優惠' },
  { phrase: '閉眼入', suggestion: '值得留意' },
  { phrase: '闭眼入', suggestion: '值得留意' },
  { phrase: '種草', suggestion: '值得留意' },
  { phrase: '种草', suggestion: '值得留意' },
  { phrase: '上頭', suggestion: '著迷' },
  { phrase: '上头', suggestion: '著迷' },
  { phrase: '絕絕子', suggestion: '好正' },
  { phrase: '绝绝子', suggestion: '好正' },
  { phrase: '安利', suggestion: '推介' },
  { phrase: '親測', suggestion: '試過' },
  { phrase: '亲测', suggestion: '試過' },
  { phrase: '必入', suggestion: '值得入手' },
  { phrase: '神仙單品', suggestion: '必買之選' },
  { phrase: '神仙单品', suggestion: '必買之選' },
  { phrase: '寶藏', suggestion: '隱藏好物' },
  { phrase: '宝藏', suggestion: '隱藏好物' },
  { phrase: '沖', suggestion: '快啲去' },
  { phrase: '冲', suggestion: '快啲去' },
  { phrase: '炸裂', suggestion: '勁正' },
  { phrase: '王炸', suggestion: '超值' },
  { phrase: '天花板', suggestion: '頂級' },
  { phrase: '天花板级别', suggestion: '頂級水平' },
  { phrase: '神器', suggestion: '好幫手' },
  { phrase: '平替', suggestion: '平價代替' },
  { phrase: '性價比天花板', suggestion: '性價比最高' },
  { phrase: '性价比天花板', suggestion: '性價比最高' },
  { phrase: 'YYDS', suggestion: '無得頂' },
  { phrase: 'yyds', suggestion: '無得頂' },

  // === 書面腔（內地書面/廣告 → 港式口語） ===
  { phrase: '為您帶來', suggestion: '俾你' },
  { phrase: '为您带来', suggestion: '俾你' },
  { phrase: '為您獻上', suggestion: '為你準備' },
  { phrase: '为您献上', suggestion: '為你準備' },
  { phrase: '品質保證', suggestion: '質素有保證' },
  { phrase: '质量保证', suggestion: '質素有保證' },
  { phrase: '極致享受', suggestion: '好享受' },
  { phrase: '极致享受', suggestion: '好享受' },
  { phrase: '卓越品質', suggestion: '高質' },
  { phrase: '卓越品质', suggestion: '高質' },
  { phrase: '非凡體驗', suggestion: '好體驗' },
  { phrase: '非凡体验', suggestion: '好體驗' },
  { phrase: '優質產品', suggestion: '好產品' },
  { phrase: '优质产品', suggestion: '好產品' },
  { phrase: '攜手共創', suggestion: '一齊' },
  { phrase: '携手共创', suggestion: '一齊' },
  { phrase: '匠心打造', suggestion: '用心製作' },

  // === 網絡流行語（內地梗 → 港式表達） ===
  { phrase: '真的會謝', suggestion: '真係多謝晒' },
  { phrase: '真的会谢', suggestion: '真係多謝晒' },
  { phrase: '顯眼包', suggestion: '搶眼' },
  { phrase: '显眼包', suggestion: '搶眼' },
  { phrase: '純欲風', suggestion: '清新風格' },
  { phrase: '纯欲风', suggestion: '清新風格' },
  { phrase: '氛圍感', suggestion: '氣氛' },
  { phrase: '氛围感', suggestion: '氣氛' },
  { phrase: '拿捏住', suggestion: '掌握到' },
];

function basicNormalize(source: string) {
  let text = source.trim();
  for (const item of MAINLAND_REPLACEMENTS) {
    text = text.split(item.phrase).join(item.suggestion);
  }
  return text
    .replace(/！+/g, '！')
    .replace(/全國包郵/g, '香港指定地區配送')
    .replace(/全国包邮/g, '香港指定地區配送')
    .replace(/小戶型/g, '細單位')
    .replace(/小户型/g, '細單位');
}

function diagnose(source: string): Diagnosis {
  const mainlandPhrases = MAINLAND_REPLACEMENTS
    .filter((item) => source.includes(item.phrase))
    .map(({ phrase, suggestion }) => ({ phrase, suggestion }));

  return {
    hasSimplifiedChars: /[这们来个为国户闭种]/.test(source),
    mainlandPhrases,
    issues: [
      ...(mainlandPhrases.length > 0 ? ['原文含有偏內地社交電商語氣，建議轉成香港較自然嘅優惠/生活化講法。'] : []),
      '目前使用快速規則引擎生成；如需更細緻語感，建議稍後再用 AI 引擎重試。',
    ],
    complianceViolations: [],
  };
}

/**
 * The rules fallback cannot perform semantic few-shot learning, but it must not
 * silently discard a user's selected references. Map explicit tags (and a few
 * observable style signals) to deterministic, non-copying presentation cues.
 */
function applyReferenceStyle(text: string, params: GenerateRequest): string {
  const references = params.referenceCases ?? [];
  if (references.length === 0) return text;

  const tags = new Set(references.flatMap((reference) => reference.reasonTags ?? []));
  const referenceText = references.map((reference) => reference.content).join('\n');
  const wantsHook = tags.has('hook') || /[？?]/.test(referenceText);
  const wantsEmoji = tags.has('emoji') || /\p{Extended_Pictographic}/u.test(referenceText);
  const wantsCta = tags.has('cta') || /(留言|話我知|即刻|了解更多|link)/i.test(referenceText);

  let styled = wantsHook ? `講真，${text}` : text;
  if (wantsEmoji) styled = `✨ ${styled}`;
  if (wantsCta) styled = `${styled}\n\n想知多啲？留言話我知。`;
  return styled;
}

/** W3: compose bookmark style + case-library style without copying case bodies. */
function applyAllStyleHints(text: string, params: GenerateRequest): string {
  // Case library first (user just selected), then bookmark references
  const withCases = applyCaseLibraryStyle(text, params.caseLibraryContext);
  return applyReferenceStyle(withCases, params);
}

function softLengthLimit(text: string, enabled: boolean | undefined, level: number | undefined): string {
  if (!enabled) return text;
  const lv = Math.min(5, Math.max(1, Math.round(level ?? 3)));
  // Soft guidance only for rules engine — never mid-sentence hard cut for legal/CTA safety.
  const caps: Record<number, number> = { 1: 80, 2: 120, 3: 200, 4: 280, 5: 400 };
  const cap = caps[lv] ?? 200;
  if (text.length <= cap) return text;
  const slice = text.slice(0, cap);
  const breakAt = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('！'), slice.lastIndexOf('\n'));
  return (breakAt > 40 ? slice.slice(0, breakAt + 1) : slice).trim();
}

export function fallbackGenerate(params: GenerateRequest): DiagnoseGenerateResult {
  const base = basicNormalize(params.source);
  const concise = base.length > 140 ? `${base.slice(0, 140)}...` : base;
  const primary = params.primaryTone ?? params.tone;
  const copyType = params.copyType ?? 'social';

  const baseVariants: Variants = {
    standardHK: `各位，${concise}\n\n我們已將重點整理成更貼近香港市場嘅表達，語氣保持清晰、${primary}，適合品牌正式發布使用。`,
    lightCantonese: `講真，呢個重點幾啱香港日常場景：${concise}\n\n想了解詳情，可以睇睇內容，再揀最啱自己嘅選擇。`,
    ig: `${concise}\n\n日常用得上，語氣輕鬆啲，IG caption 可以再配合產品相或者短片畫面。`,
    facebook: `各位街坊朋友，${concise}\n\n如果想了解更多詳情，歡迎留言或 inbox 查詢。我哋會盡快回覆。`,
    shorts: `呢個位，香港人應該會有感。\n\n${concise}\n\n用短句講清楚重點，再用畫面補充細節，節奏會更啱 Shorts/TK。`,
  };

  // Spoken / poster soft shaping (still five platforms)
  if (copyType === 'spoken') {
    baseVariants.shorts = `【口播】\n${baseVariants.shorts}\n（停一停）想知多啲可以留言。`;
  } else if (copyType === 'poster') {
    baseVariants.ig = `【主標題】${concise.slice(0, 24)}\n【副標題】值得一試`;
  }

  const variants: Variants = {
    standardHK: softLengthLimit(applyAllStyleHints(baseVariants.standardHK, params), params.lengthControlEnabled, params.copyLengthLevel),
    lightCantonese: softLengthLimit(applyAllStyleHints(baseVariants.lightCantonese, params), params.lengthControlEnabled, params.copyLengthLevel),
    ig: softLengthLimit(applyAllStyleHints(baseVariants.ig, params), params.lengthControlEnabled, params.copyLengthLevel),
    facebook: softLengthLimit(applyAllStyleHints(baseVariants.facebook, params), params.lengthControlEnabled, params.copyLengthLevel),
    shorts: softLengthLimit(applyAllStyleHints(baseVariants.shorts, params), params.lengthControlEnabled, params.copyLengthLevel),
  };

  const diagnosis = diagnose(params.source);
  const w1Notes: string[] = [];
  if (copyType !== 'social') w1Notes.push(`文案類型：${copyType}${params.customCopyType ? `（${params.customCopyType}）` : ''}`);
  if (params.lengthControlEnabled) w1Notes.push(`長度軟目標已開啟：檔 ${params.copyLengthLevel ?? 3}`);
  if ((params.toneModifiers?.length ?? 0) > 0) w1Notes.push(`修飾語氣：${params.toneModifiers!.join('、')}`);
  // W3: surface bad-case avoid rules without echoing case bodies
  const caseHints = deriveCaseLibraryStyleHints(params.caseLibraryContext);
  if (caseHints.avoidNotes.length > 0) {
    w1Notes.push(...caseHints.avoidNotes);
  }
  if (w1Notes.length > 0) {
    diagnosis.issues = [...(diagnosis.issues ?? []), ...w1Notes];
  }

  return {
    diagnosis,
    variants,
  };
}

function inferIssueTag(text: string): AuditIssue['tag'] {
  if (/內地|爆款|福利|寶子|宝子|種草|闭眼|閉眼|狠狠/.test(text)) return '內地腔';
  if (/AI|空泛|機械|模板|過度正式|冇人味/.test(text)) return 'AI腔';
  if (/普通話|直譯|句式生硬|語序/.test(text)) return '普通話直譯';
  if (/粵語過火|語氣詞|粗俗|堆砌/.test(text)) return '粵語過火';
  if (/簡繁|簡體/.test(text)) return '簡繁混用';
  return 'AI腔';
}

function dedupeIssues(issues: AuditIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.tag}:${issue.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function fallbackAudit(
  variants: Variants,
  source = '',
  diagnosis?: Diagnosis,
): Audit {
  const joined = `${source}\n${Object.values(variants).join('\n')}`;
  const replacements: Replacement[] = MAINLAND_REPLACEMENTS
    .filter((item) => joined.includes(item.phrase))
    .map(({ phrase, suggestion }) => ({
      original: phrase,
      suggested: suggestion,
      reason: '較貼近香港社媒常用表達，減少內地社交電商口吻。',
    }));

  if (diagnosis?.mainlandPhrases?.length) {
    for (const item of diagnosis.mainlandPhrases) {
      if (!replacements.some((replacement) => replacement.original === item.phrase)) {
        replacements.push({
          original: item.phrase,
          suggested: item.suggestion,
          reason: '原文診斷已標記為不夠香港社媒自然，建議替換。',
        });
      }
    }
  }

  const diagnosisIssues: AuditIssue[] = (diagnosis?.issues ?? []).map((description) => ({
    tag: inferIssueTag(description),
    severity: /明顯|嚴重|不建議|高風險/.test(description) ? 'high' : 'medium',
    description,
  }));

  const issues: AuditIssue[] = dedupeIssues([
    ...diagnosisIssues,
    ...(replacements.length > 0
      ? [{
          tag: '內地腔' as const,
          severity: 'medium' as const,
          description: '仍有偏內地營銷詞彙，建議替換後再發布。',
        }]
      : []),
  ]);

  const overall = Math.max(62, 84 - issues.length * 5 - replacements.length * 3);

  return {
    thermometer: {
      overall,
      dimensions: {
        cantoneseFeel: issues.some((issue) => issue.tag === '普通話直譯' || issue.tag === '粵語過火') ? 3 : 4,
        culturalFit: issues.some((issue) => issue.tag === '內地腔') ? 3 : 4,
        platformFit: issues.length > 0 ? 3 : 4,
        brandSafety: 4,
        tradConsistency: diagnosis?.hasSimplifiedChars ? 3 : 4,
        hookStrength: 3,
        visualStrategy: 3,
        engagementFit: 3,
      },
    },
    issues,
    replacements,
    risks: [
      {
        level: 'amber',
        description: '審核結果由快速規則引擎生成，僅供參考；正式發布前建議再做人工語感復核。',
      },
      ...(diagnosis?.hasSimplifiedChars
        ? [{
            level: 'amber' as const,
            description: '原文可能含簡體字或非香港繁體字形，發布前建議做一次繁體/香港字形檢查。',
          }]
        : []),
    ],
    comments: [
      { type: 'interest', text: '呢個幾實用，想知詳情。' },
      { type: 'question', text: '有冇價錢或者供應日期？' },
      { type: 'followup', text: '可以喺邊度買到或者了解更多？' },
    ],
    scores: {
      cantoneseNaturalness: 65,
      brandSafety: 70,
      platformFit: 65,
      readability: 68,
      creativity: 60,
      hookStrength: 55,
      emojiHashtagFit: 60,
      engagementPotential: 50,
      total: 63,
    },
  };
}
