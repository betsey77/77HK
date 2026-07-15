/**
 * W1: copy type / length / rich tone constraints shared by
 * DeepSeek, CantoneseLLM and rules fallback prompt paths.
 */

import type { BrandTone, CopyType, ToneModifier } from '../types/index.js';

export const VALID_COPY_TYPES: CopyType[] = [
  'social',
  'spoken',
  'poster',
  'advertorial',
  'poetry',
  'custom',
];

export const VALID_PRIMARY_TONES: BrandTone[] = [
  '穩妥',
  '活潑',
  '高級',
  '街坊',
  '年輕',
  '專業',
  '真誠',
  '溫暖',
  '幽默',
  '克制',
  '俏皮',
  '激昂',
];

export const VALID_TONE_MODIFIERS: ToneModifier[] = [
  '簡潔',
  '敘事',
  '促銷感',
  '治癒',
  '緊迫',
  '節日感',
  '知識感',
  '對話感',
];

const COPY_TYPE_SET = new Set<string>(VALID_COPY_TYPES);
const PRIMARY_TONE_SET = new Set<string>(VALID_PRIMARY_TONES);
const MODIFIER_SET = new Set<string>(VALID_TONE_MODIFIERS);

export const COPY_TYPE_LABELS: Record<CopyType, string> = {
  social: '社媒文案',
  spoken: '口播稿',
  poster: '海报短文',
  advertorial: '软文章',
  poetry: '诗歌',
  custom: '其他',
};

export const LENGTH_LEVEL_LABELS: Record<number, string> = {
  1: '极短',
  2: '短',
  3: '标准',
  4: '长',
  5: '加长',
};

/** Soft length guidance only — never hard-truncate model output. */
const LENGTH_SOFT_TARGETS: Record<number, string> = {
  1: '極短：每版約 30–60 字，短句 punch，信息高度濃縮',
  2: '短：每版約 60–100 字，保留核心賣點同 CTA',
  3: '標準：每版約 100–160 字，完整但不冗長',
  4: '長：每版約 160–240 字，可補充場景同細節',
  5: '加長：每版約 240–350 字，允許敍事同更完整說明',
};

export interface W1Resolved {
  copyType: CopyType;
  customCopyType?: string;
  lengthControlEnabled: boolean;
  copyLengthLevel: number;
  primaryTone: BrandTone;
  toneModifiers: ToneModifier[];
  /** Compat field for engines that still key off `tone` */
  tone: BrandTone;
}

export function isValidCustomCopyType(value: string | undefined | null): boolean {
  const text = (value ?? '').trim();
  return text.length >= 2 && text.length <= 20;
}

export function normalizeToneModifiers(raw: unknown): ToneModifier[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<ToneModifier>();
  const out: ToneModifier[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !MODIFIER_SET.has(item)) continue;
    const value = item as ToneModifier;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= 2) break;
  }
  return out;
}

/**
 * Parse and validate W1 fields from a generate request body / params object.
 * Throws Error with a user-facing message on invalid custom type or levels.
 */
export function resolveW1Fields(obj: Record<string, unknown>): W1Resolved {
  const copyTypeRaw = (obj.copyType as string | undefined) ?? 'social';
  if (!COPY_TYPE_SET.has(copyTypeRaw)) {
    throw new Error(`Invalid copyType: ${copyTypeRaw}. Must be one of: ${VALID_COPY_TYPES.join(', ')}`);
  }
  const copyType = copyTypeRaw as CopyType;

  let customCopyType: string | undefined;
  if (copyType === 'custom') {
    const text = typeof obj.customCopyType === 'string' ? obj.customCopyType.trim() : '';
    if (!isValidCustomCopyType(text)) {
      throw new Error('customCopyType is required for copyType=custom and must be 2–20 characters');
    }
    customCopyType = text;
  }

  const lengthControlEnabled = obj.lengthControlEnabled === true;
  let copyLengthLevel = 3;
  if (obj.copyLengthLevel !== undefined && obj.copyLengthLevel !== null && obj.copyLengthLevel !== '') {
    const n = Number(obj.copyLengthLevel);
    if (!Number.isFinite(n) || Math.round(n) < 1 || Math.round(n) > 5) {
      throw new Error('copyLengthLevel must be a number between 1 and 5');
    }
    copyLengthLevel = Math.round(n);
  }

  const rawPrimary =
    (typeof obj.primaryTone === 'string' && obj.primaryTone) ||
    (typeof obj.tone === 'string' && obj.tone) ||
    '穩妥';
  if (!PRIMARY_TONE_SET.has(rawPrimary)) {
    throw new Error(`Invalid tone/primaryTone: ${rawPrimary}. Must be one of: ${VALID_PRIMARY_TONES.join(', ')}`);
  }
  const primaryTone = rawPrimary as BrandTone;

  if (obj.toneModifiers !== undefined && !Array.isArray(obj.toneModifiers)) {
    throw new Error('toneModifiers must be an array');
  }
  const toneModifiers = normalizeToneModifiers(obj.toneModifiers);
  if (Array.isArray(obj.toneModifiers) && obj.toneModifiers.length > 2) {
    // Soft clamp already applied; still reject clearly invalid oversized intentional payloads
    // only if any remaining raw items would exceed after filter? Spec: max 2 — clamp is enough.
  }

  return {
    copyType,
    customCopyType,
    lengthControlEnabled,
    copyLengthLevel,
    primaryTone,
    toneModifiers,
    tone: primaryTone,
  };
}

export function getPrimaryToneInstructions(tone: BrandTone): string {
  switch (tone) {
    case '穩妥':
      return '穩妥、貼地、輕快、唔浮誇。用最多 10% 輕粵語，保持專業可信。適合品牌官方頻道';
    case '活潑':
      return '輕鬆有活力，可以用 20-30% 粵語口語。適合生活類品牌、日常貼文';
    case '高級':
      return '精緻優雅，粵語只用最少（5% 以下）。用詞講究，適合高端品牌、奢侈品';
    case '街坊':
      return '親切貼地，可以用 40-50% 粵語。似街坊傾偈，但保持禮貌。適合社區零售、本地服務';
    case '年輕':
      return '潮流活力，可以中英夾雜（30-40% 英文詞彙）。適合 Gen Z、時尚、美妝、科技品牌';
    case '專業':
      return '理性可信、資訊清晰，少口語噱頭。適合 B2B、金融、專業服務';
    case '真誠':
      return '坦誠有溫度，避免誇大同硬銷腔。適合口碑、故事同用戶見證';
    case '溫暖':
      return '柔和關懷、令人安心。適合家庭、健康、生活方式品牌';
    case '幽默':
      return '輕鬆好笑但品牌安全，可以用港式幽默，避免冒犯';
    case '克制':
      return '少而精、留白、不堆砌形容詞。適合高端同冷静表达';
    case '俏皮':
      return '機靈輕快，有小驚喜但唔嘈。適合年輕生活同趣味內容';
    case '激昂':
      return '情緒拉滿、節奏強，適合號召行動同活動開場，但仍要合規';
    default:
      return '穩妥、貼地、自然';
  }
}

function getModifierInstructions(modifiers: ToneModifier[]): string {
  if (modifiers.length === 0) return '';
  const map: Record<ToneModifier, string> = {
    簡潔: '用更短句、刪冗詞，信息密度高',
    敘事: '可加入輕量場景或故事線，但唔好蓋過主語氣',
    促銷感: '適度強化優惠/行動誘因同 CTA 力度',
    治癒: '節奏放慢、用詞柔和、減少硬推',
    緊迫: '加入時間/名額類緊迫感，但禁止虛假倒數或誇大稀缺',
    節日感: '融入節日氣氛同儀式感詞彙（若有日曆事件則對齊）',
    知識感: '可帶輕度科普或「點解」結構，但唔好變成說明書',
    對話感: '更似傾偈：問句、回應感、第二人稱',
  };
  return modifiers.map((m) => `- ${m}：${map[m]}`).join('\n');
}

export function buildCopyTypeSection(copyType: CopyType, customCopyType?: string): string {
  const label = COPY_TYPE_LABELS[copyType];
  const intent: Record<CopyType, string> = {
    social: '按五個社媒平台特性寫（standardHK / lightCantonese / IG / Facebook / Shorts/TK），保持平台差異。',
    spoken: '偏口播可讀：有停頓節奏、口語連貫，方便主播朗讀；仍輸出全部五個平台版本，並按平台微調。',
    poster: '偏海報短文：畫面感、短句、主標題+副標題感；五平台都要有，但語氣更精煉。',
    advertorial: '偏軟文：信息結構清晰、論點自然、轉化不生硬；五平台都要提供。',
    poetry: '偏詩歌意象同節奏，表達克制；五平台都要提供，並按平台調整可讀性。',
    custom: `用戶自訂類型補充：「${(customCopyType ?? '').trim()}」。只作風格補充，不可替代平台規範、安全合規或五平台輸出。`,
  };

  return `## 📝 文案類型約束（W1）

- 類型：${label}（${copyType}）
- 意圖：${intent[copyType]}
- 🚨 **無論類型為何，必須輸出全部五個平台版本**（standardHK、lightCantonese、ig、facebook、shorts），不可退化成單一輸出。`;
}

export function buildLengthControlSection(enabled: boolean, level: number): string {
  if (!enabled) return '';
  const lv = Math.min(5, Math.max(1, Math.round(level || 3)));
  const label = LENGTH_LEVEL_LABELS[lv] ?? '标准';
  const target = LENGTH_SOFT_TARGETS[lv] ?? LENGTH_SOFT_TARGETS[3];

  return `## 📏 長度軟目標（W1，已開啟）

- 檔位：${lv}（${label}）
- 目標：${target}
- 規則：以上係**軟目標**，按平台可微調；**禁止硬性截斷**完整句子、合規說明、品牌紅線說明或必要 CTA。
- 粵語自然度優先於剛好湊字數。`;
}

export function buildRichToneSection(primaryTone: BrandTone, modifiers: ToneModifier[]): string {
  const primary = getPrimaryToneInstructions(primaryTone);
  const modBlock = getModifierInstructions(modifiers);
  return `## 🎨 語氣約束（W1）

- 主語氣：${primaryTone} — ${primary}
${modBlock ? `- 修飾語氣（最多兩個，只調節奏/詞彙/CTA 強度，不可覆蓋主語氣、品牌紅線、粵語程度或平台規範）：\n${modBlock}` : '- 修飾語氣：無（保持單主語氣效果）'}
- 主語氣優先；修飾語氣不可推翻合規、品牌紅線或參考案例約束。`;
}

/** Marker phrases used in tests to assert length injection presence/absence */
export const LENGTH_SECTION_MARKER = '長度軟目標（W1，已開啟）';
export const COPY_TYPE_SECTION_MARKER = '文案類型約束（W1）';
export const TONE_SECTION_MARKER = '語氣約束（W1）';

export function buildW1ConstraintSections(params: {
  copyType?: CopyType;
  customCopyType?: string;
  lengthControlEnabled?: boolean;
  copyLengthLevel?: number;
  tone?: BrandTone;
  primaryTone?: BrandTone;
  toneModifiers?: ToneModifier[];
}): string {
  const resolved = resolveW1Fields({
    copyType: params.copyType,
    customCopyType: params.customCopyType,
    lengthControlEnabled: params.lengthControlEnabled,
    copyLengthLevel: params.copyLengthLevel,
    tone: params.tone,
    primaryTone: params.primaryTone,
    toneModifiers: params.toneModifiers,
  });

  return [
    buildCopyTypeSection(resolved.copyType, resolved.customCopyType),
    buildLengthControlSection(resolved.lengthControlEnabled, resolved.copyLengthLevel),
    buildRichToneSection(resolved.primaryTone, resolved.toneModifiers),
  ]
    .filter(Boolean)
    .join('\n\n');
}
