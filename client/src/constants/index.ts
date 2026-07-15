import type { Platform, BrandTone, VariantKey, AppSettings, InputLanguage } from '../types';
import { W1_DEFAULTS } from '../utils/w1Settings';

export const SHORTS_TK_LABEL = 'Shorts/TK';

export const PLATFORMS: Array<{ value: Platform; label: string }> = [
  { value: 'all', label: '全部平台' },
  { value: 'ig', label: 'IG' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'shorts', label: SHORTS_TK_LABEL },
];

export const TONES: Array<{ value: BrandTone; label: string; description: string }> = [
  { value: '穩妥', label: '稳妥', description: '适合官方品牌内容、新闻稿、付费广告' },
  { value: '活潑', label: '活泼', description: '轻松有活力，适合生活类品牌' },
  { value: '高級', label: '高级', description: '精致优雅，适合高端品牌' },
  { value: '街坊', label: '街坊', description: '亲切贴地，适合社区零售服务' },
  { value: '年輕', label: '年轻', description: '潮流活力，适合 Gen Z 品牌' },
  { value: '專業', label: '专业', description: '理性可信，适合 B2B 与专业服务' },
  { value: '真誠', label: '真诚', description: '坦诚有温度，适合口碑与故事' },
  { value: '溫暖', label: '温暖', description: '柔和关怀，适合家庭与生活方式' },
  { value: '幽默', label: '幽默', description: '轻松俏皮，适合趣味互动' },
  { value: '克制', label: '克制', description: '少而精，适合高端与冷静表达' },
  { value: '俏皮', label: '俏皮', description: '机灵轻快，适合年轻生活品牌' },
  { value: '激昂', label: '激昂', description: '情绪拉满，适合号召与活动' },
];

export const INPUT_LANGUAGES: Array<{ value: InputLanguage; label: string; hint: string }> = [
  { value: 'mandarin', label: '普通话/书面语', hint: '将原文转译为地道香港粤语' },
  { value: 'cantonese', label: '粤语/白话', hint: '原文已是粤语，进一步优化地道性' },
];

export const VARIANT_TABS: Array<{ key: VariantKey; label: string }> = [
  { key: 'standardHK', label: '标准繁中' },
  { key: 'lightCantonese', label: '轻粤语' },
  { key: 'ig', label: 'IG' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'shorts', label: SHORTS_TK_LABEL },
];

export const DEFAULT_SETTINGS: AppSettings = {
  platform: 'all',
  tone: W1_DEFAULTS.primaryTone,
  cantoneseLevel: 4,
  englishMixingLevel: 1,
  creativityLevel: 1,  // 0-4, default 1 (偏向保守)
  inputLanguage: 'mandarin',
  brandName: '',
  productName: '',
  brandRedLines: '',
  structuredBriefEnabled: false, // 🆕 Ph1
  consumerPersonas: [],
  targetDate: new Date().toISOString().slice(0, 10), // 默认当日
  competitorQueries: [],   // 🆕 P2 — multi-select competitor brands
  selectedReferenceCaseIds: [], // 🆕 Phase B — reference case injection
  selectedCalendarEventIds: [], // 🆕 话题日历 — selected event IDs for prompt injection
  selectedCaseLibraryIds: [], // W2 — personal case library IDs (max 3)
  // W1
  copyType: W1_DEFAULTS.copyType,
  customCopyType: W1_DEFAULTS.customCopyType,
  lengthControlEnabled: W1_DEFAULTS.lengthControlEnabled,
  copyLengthLevel: W1_DEFAULTS.copyLengthLevel,
  primaryTone: W1_DEFAULTS.primaryTone,
  toneModifiers: [...W1_DEFAULTS.toneModifiers],
};

export {
  COPY_TYPES,
  TONE_MODIFIERS,
  LENGTH_LEVEL_LABELS,
  getCopyTypeLabel,
  isValidCustomCopyType,
  canGenerateWithCopyType,
} from '../utils/w1Settings';

export const SLIDER_CONFIG = {
  cantonese: {
    min: 0,
    max: 5,
    step: 1,
    leftLabel: '0 标准繁中',
    rightLabel: '5 地道粤语',
  },
  englishMixing: {
    min: 0,
    max: 5,
    step: 1,
    leftLabel: '0 纯中文',
    rightLabel: '5 自然夹杂',
  },
  creativity: {
    min: 0,
    max: 4,
    step: 1,
    leftLabel: '紧贴原文',
    rightLabel: '自由创作',
  },
};

export const CREATIVITY_LABELS: Record<number, string> = {
  0: '紧贴原文：严格遵循原文结构、格式、对仗、字数',
  1: '偏向保守：主要保持原文格式，微调措辞',
  2: '平衡：适度调整结构同表达方式',
  3: '偏向自由：自由重组信息，可添加创意元素',
  4: '自由创作：原文只作灵感，完全自由发挥',
};

export function getCreativityLabel(level: number): string {
  return CREATIVITY_LABELS[Math.round(level)] ?? CREATIVITY_LABELS[2]!;
}

export const MAX_SOURCE_LENGTH = 4000;
export const SOURCE_WARN_LENGTH = 2000;

export const MAX_SAVED_CONFIGS = 20;
