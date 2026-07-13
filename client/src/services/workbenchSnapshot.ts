/**
 * Session-storage workbench snapshot — Slice H1-R。
 *
 * Persists the current workbench state so it survives:
 * - Navigation from /app to /app/history and back
 * - Page refresh on /app
 *
 * Design constraints:
 * - Key includes ownerId → account-isolated (User A never reads User B).
 * - Only stores workbench fields: source, settings, diagnosis, variants, audit,
 *   enhancement, generationEngine, scores, consumerFeedback, variantMeta,
 *   modifiedVariants, activeTab, uiState.
 * - Never stores tokens, email, bookmarks, savedConfigs, or secrets.
 * - Schema-validated on load; corrupt JSON → graceful fallback to null.
 * - Centralized helper — no component touches sessionStorage directly.
 */

import type { AppState, AppSettings, Diagnosis, Variants, Audit, Enhancement, GenerationEngine, ConsumerFeedback, VariantMeta, VariantKey, UIState, GenerationJob, Platform, BrandTone, InputLanguage } from '../types';
import { DEFAULT_SETTINGS, INPUT_LANGUAGES, PLATFORMS, TONES, VARIANT_TABS } from '../constants';

// ── Snapshot shape (subset of AppState) ────────────────────────

export interface WorkbenchSnapshot {
  /** Unix timestamp of last save */
  _savedAt: number;
  source: string;
  settings: AppSettings;
  diagnosis: Diagnosis | null;
  variants: Variants | null;
  audit: Audit | null;
  enhancement: Enhancement | null;
  generationEngine: GenerationEngine | null;
  scores: AppState['scores'];
  consumerFeedback: ConsumerFeedback[] | null;
  variantMeta: Record<VariantKey, VariantMeta> | null;
  modifiedVariants: Partial<Record<VariantKey, string>>;
  activeTab: VariantKey;
  uiState: UIState;
}

const STORAGE_PREFIX = 'hk-cantonese-workbench';

// ── Required fields for a valid snapshot ───────────────────────

const REQUIRED_KEYS: (keyof WorkbenchSnapshot)[] = [
  '_savedAt', 'source', 'settings', 'diagnosis', 'variants',
  'audit', 'enhancement', 'generationEngine', 'scores',
  'consumerFeedback', 'variantMeta', 'modifiedVariants',
  'activeTab', 'uiState',
];

const VALID_PLATFORMS = new Set(PLATFORMS.map(item => item.value));
const VALID_TONES = new Set(TONES.map(item => item.value));
const VALID_INPUT_LANGUAGES = new Set(INPUT_LANGUAGES.map(item => item.value));
const VALID_VARIANTS = new Set(VARIANT_TABS.map(item => item.key));
const VALID_UI_STATES = new Set<UIState>(['idle', 'loading', 'success', 'error']);
const VALID_ENGINES = new Set<GenerationEngine>([
  'self-hosted-cantonese',
  'featherless-cantonese',
  'deepseek',
  'rules',
]);

function isRecordOrNull(value: unknown): boolean {
  return value === null || (!!value && typeof value === 'object' && !Array.isArray(value));
}

function isValidSettings(value: unknown): value is AppSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const settings = value as Record<string, unknown>;
  return (
    typeof settings.platform === 'string' && VALID_PLATFORMS.has(settings.platform as Platform) &&
    typeof settings.tone === 'string' && VALID_TONES.has(settings.tone as BrandTone) &&
    typeof settings.inputLanguage === 'string' && VALID_INPUT_LANGUAGES.has(settings.inputLanguage as InputLanguage) &&
    typeof settings.cantoneseLevel === 'number' && settings.cantoneseLevel >= 0 && settings.cantoneseLevel <= 5 &&
    typeof settings.englishMixingLevel === 'number' && settings.englishMixingLevel >= 0 && settings.englishMixingLevel <= 5 &&
    typeof settings.creativityLevel === 'number' && settings.creativityLevel >= 0 && settings.creativityLevel <= 4 &&
    typeof settings.brandName === 'string' &&
    typeof settings.productName === 'string' &&
    typeof settings.brandRedLines === 'string' &&
    typeof settings.structuredBriefEnabled === 'boolean' &&
    Array.isArray(settings.consumerPersonas)
  );
}

function isValidSnapshot(obj: unknown): obj is WorkbenchSnapshot {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  if (!REQUIRED_KEYS.every((k) => k in o)) return false;
  return (
    typeof o._savedAt === 'number' && Number.isFinite(o._savedAt) &&
    typeof o.source === 'string' &&
    isValidSettings(o.settings) &&
    isRecordOrNull(o.diagnosis) &&
    isRecordOrNull(o.variants) &&
    isRecordOrNull(o.audit) &&
    isRecordOrNull(o.enhancement) &&
    (o.generationEngine === null || (typeof o.generationEngine === 'string' && VALID_ENGINES.has(o.generationEngine as GenerationEngine))) &&
    isRecordOrNull(o.scores) &&
    (o.consumerFeedback === null || Array.isArray(o.consumerFeedback)) &&
    isRecordOrNull(o.variantMeta) &&
    !!o.modifiedVariants && typeof o.modifiedVariants === 'object' && !Array.isArray(o.modifiedVariants) &&
    typeof o.activeTab === 'string' && VALID_VARIANTS.has(o.activeTab as VariantKey) &&
    typeof o.uiState === 'string' && VALID_UI_STATES.has(o.uiState as UIState)
  );
}

// ── Key builder ────────────────────────────────────────────────

function snapshotKey(ownerId: string): string {
  return `${STORAGE_PREFIX}:${ownerId}`;
}

// ── Save ───────────────────────────────────────────────────────

function writeSnapshot(ownerId: string, snapshot: WorkbenchSnapshot): void {
  if (!ownerId || !isValidSnapshot(snapshot)) return;
  try {
    sessionStorage.setItem(snapshotKey(ownerId), JSON.stringify(snapshot));
  } catch {
    // sessionStorage may be full or unavailable — silently skip
  }
}

export function saveWorkbenchSnapshot(ownerId: string, state: AppState): void {
  const snapshot: WorkbenchSnapshot = {
    _savedAt: Date.now(),
    source: state.source,
    settings: state.settings,
    diagnosis: state.diagnosis,
    variants: state.variants,
    audit: state.audit,
    enhancement: state.enhancement,
    generationEngine: state.generationEngine,
    scores: state.scores,
    consumerFeedback: state.consumerFeedback,
    variantMeta: state.variantMeta,
    modifiedVariants: state.modifiedVariants,
    activeTab: state.activeTab,
    uiState: state.uiState,
  };
  writeSnapshot(ownerId, snapshot);
}

/** Write a pre-built WorkbenchSnapshot (used by history load) */
export { writeSnapshot as saveWorkbenchSnapshotFromHistory };

export function getHistoryJobLoadability(job: GenerationJob): { loadable: boolean; reason?: string } {
  if (job.status !== 'completed') {
    return { loadable: false, reason: '仅已完成生成的结果可以载入工作台' };
  }
  if (!job.diagnosis) return { loadable: false, reason: '缺少诊断结果，无法载入' };
  if (!job.variants) return { loadable: false, reason: '缺少生成文案，无法载入' };
  if (!job.audit) return { loadable: false, reason: '缺少审核结果，无法载入' };
  return { loadable: true };
}

function validNumber(value: number, fallback: number, max: number): number {
  return Number.isFinite(value) && value >= 0 && value <= max ? value : fallback;
}

/** Convert a complete persisted generation job into a validated workbench snapshot. */
export function buildWorkbenchSnapshotFromHistory(job: GenerationJob): { snapshot: WorkbenchSnapshot | null; reason?: string } {
  const loadability = getHistoryJobLoadability(job);
  if (!loadability.loadable || !job.diagnosis || !job.variants || !job.audit) {
    return { snapshot: null, reason: loadability.reason };
  }

  const platform = VALID_PLATFORMS.has(job.platform as Platform)
    ? job.platform as Platform
    : DEFAULT_SETTINGS.platform;
  const tone = VALID_TONES.has(job.tone as BrandTone)
    ? job.tone as BrandTone
    : DEFAULT_SETTINGS.tone;
  const inputLanguage = VALID_INPUT_LANGUAGES.has(job.inputLanguage as InputLanguage)
    ? job.inputLanguage as InputLanguage
    : DEFAULT_SETTINGS.inputLanguage;
  const engine = job.generationEngine && VALID_ENGINES.has(job.generationEngine as GenerationEngine)
    ? job.generationEngine as GenerationEngine
    : null;
  const activeTab: VariantKey = platform === 'ig' || platform === 'facebook' || platform === 'shorts'
    ? platform
    : 'lightCantonese';

  return {
    snapshot: {
      _savedAt: Date.now(),
      source: job.source,
      settings: {
        ...DEFAULT_SETTINGS,
        platform,
        tone,
        cantoneseLevel: validNumber(job.cantoneseLevel, DEFAULT_SETTINGS.cantoneseLevel, 5),
        englishMixingLevel: validNumber(job.englishMixingLevel, DEFAULT_SETTINGS.englishMixingLevel, 5),
        creativityLevel: validNumber(job.creativityLevel, DEFAULT_SETTINGS.creativityLevel, 4),
        inputLanguage,
        brandName: job.brandName ?? '',
        productName: job.productName ?? '',
        brandRedLines: job.brandRedLines ?? '',
      },
      diagnosis: job.diagnosis,
      variants: job.variants,
      audit: job.audit,
      enhancement: null,
      generationEngine: engine,
      scores: job.scores ?? null,
      consumerFeedback: job.consumerFeedback ?? null,
      variantMeta: job.variantMeta as WorkbenchSnapshot['variantMeta'] ?? null,
      modifiedVariants: {},
      activeTab,
      uiState: 'success',
    },
  };
}

// ── Load ───────────────────────────────────────────────────────

export function loadWorkbenchSnapshot(ownerId: string): WorkbenchSnapshot | null {
  try {
    const raw = sessionStorage.getItem(snapshotKey(ownerId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!isValidSnapshot(parsed)) return null;

    return parsed;
  } catch {
    // Corrupt JSON or schema mismatch → graceful fallback
    return null;
  }
}

// ── Clear ──────────────────────────────────────────────────────

export function clearWorkbenchSnapshot(ownerId: string): void {
  try {
    sessionStorage.removeItem(snapshotKey(ownerId));
  } catch {
    // Silently skip
  }
}

// ── Check existence ────────────────────────────────────────────

export function hasWorkbenchSnapshot(ownerId: string): boolean {
  return loadWorkbenchSnapshot(ownerId) !== null;
}
