import type { BrandTone, CopyType, ToneModifier } from '../types';

export const COPY_TYPES: Array<{ value: CopyType; label: string; description: string }> = [
  { value: 'social', label: '社媒文案', description: '适配五个平台的社媒表达' },
  { value: 'spoken', label: '口播稿', description: '口语节奏、停顿与可朗读性' },
  { value: 'poster', label: '海报短文', description: '画面感、短句、主副标题' },
  { value: 'advertorial', label: '软文章', description: '信息结构、论点、自然转化' },
  { value: 'poetry', label: '诗歌', description: '意象、节奏与表达克制' },
  { value: 'custom', label: '其他', description: '需填写 2–20 字类型说明' },
];

export const COPY_TYPE_VALUES = new Set<CopyType>(COPY_TYPES.map((item) => item.value));

export const PRIMARY_TONES: BrandTone[] = [
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

export const TONE_MODIFIERS: Array<{ value: ToneModifier; label: string }> = [
  { value: '簡潔', label: '简洁' },
  { value: '敘事', label: '叙事' },
  { value: '促銷感', label: '促销感' },
  { value: '治癒', label: '治愈' },
  { value: '緊迫', label: '紧迫' },
  { value: '節日感', label: '节日感' },
  { value: '知識感', label: '知识感' },
  { value: '對話感', label: '对话感' },
];

export const TONE_MODIFIER_VALUES = new Set<ToneModifier>(TONE_MODIFIERS.map((item) => item.value));
export const PRIMARY_TONE_VALUES = new Set<BrandTone>(PRIMARY_TONES);

export const LENGTH_LEVEL_LABELS: Record<number, string> = {
  1: '极短',
  2: '短',
  3: '标准',
  4: '长',
  5: '加长',
};

export const W1_DEFAULTS = {
  copyType: 'social' as CopyType,
  customCopyType: '',
  lengthControlEnabled: false,
  copyLengthLevel: 3,
  primaryTone: '穩妥' as BrandTone,
  toneModifiers: [] as ToneModifier[],
};

/** custom 类型补充说明：2–20 个字（按 trim 后字符数） */
export function isValidCustomCopyType(value: string | undefined | null): boolean {
  const text = (value ?? '').trim();
  return text.length >= 2 && text.length <= 20;
}

export function getCopyTypeLabel(
  copyType: CopyType | string | undefined | null,
  options?: { legacyMissing?: boolean },
): string {
  if (!copyType) {
    return options?.legacyMissing ? '社媒文案（历史记录）' : '社媒文案';
  }
  const found = COPY_TYPES.find((item) => item.value === copyType);
  if (found) return found.label;
  return options?.legacyMissing ? '社媒文案（历史记录）' : '社媒文案';
}

export function normalizeToneModifiers(raw: unknown): ToneModifier[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<ToneModifier>();
  const result: ToneModifier[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if (!TONE_MODIFIER_VALUES.has(item as ToneModifier)) continue;
    const value = item as ToneModifier;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= 2) break;
  }
  return result;
}

export function normalizeCopyType(raw: unknown): CopyType {
  return typeof raw === 'string' && COPY_TYPE_VALUES.has(raw as CopyType)
    ? (raw as CopyType)
    : W1_DEFAULTS.copyType;
}

export function normalizePrimaryTone(rawPrimary: unknown, rawTone: unknown, fallback: BrandTone): BrandTone {
  if (typeof rawPrimary === 'string' && PRIMARY_TONE_VALUES.has(rawPrimary as BrandTone)) {
    return rawPrimary as BrandTone;
  }
  if (typeof rawTone === 'string' && PRIMARY_TONE_VALUES.has(rawTone as BrandTone)) {
    return rawTone as BrandTone;
  }
  return fallback;
}

export function normalizeCopyLengthLevel(raw: unknown, fallback = W1_DEFAULTS.copyLengthLevel): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 5) return fallback;
  return rounded;
}

export interface W1Fields {
  copyType: CopyType;
  customCopyType: string;
  lengthControlEnabled: boolean;
  copyLengthLevel: number;
  primaryTone: BrandTone;
  toneModifiers: ToneModifier[];
  /** Compat field kept in sync with primaryTone */
  tone: BrandTone;
}

/** Read W1 fields from partial/legacy settings objects without throwing. */
export function normalizeW1Fields(
  raw: Record<string, unknown> | null | undefined,
  fallbackTone: BrandTone = W1_DEFAULTS.primaryTone,
): W1Fields {
  const source = raw ?? {};
  const primaryTone = normalizePrimaryTone(source.primaryTone, source.tone, fallbackTone);
  const copyType = normalizeCopyType(source.copyType);
  const customCopyType =
    typeof source.customCopyType === 'string' ? source.customCopyType : W1_DEFAULTS.customCopyType;

  return {
    copyType,
    customCopyType: copyType === 'custom' ? customCopyType : '',
    lengthControlEnabled:
      typeof source.lengthControlEnabled === 'boolean'
        ? source.lengthControlEnabled
        : W1_DEFAULTS.lengthControlEnabled,
    copyLengthLevel: normalizeCopyLengthLevel(source.copyLengthLevel),
    primaryTone,
    toneModifiers: normalizeToneModifiers(source.toneModifiers),
    tone: primaryTone,
  };
}

export function canGenerateWithCopyType(copyType: CopyType, customCopyType: string): boolean {
  if (copyType !== 'custom') return true;
  return isValidCustomCopyType(customCopyType);
}
