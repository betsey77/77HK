import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../constants';
import { normalizeSettings } from '../context/AppContext';
import {
  buildWorkbenchSnapshotFromHistory,
} from '../services/workbenchSnapshot';
import {
  canGenerateWithCopyType,
  getCopyTypeLabel,
  isValidCustomCopyType,
  normalizeToneModifiers,
  normalizeW1Fields,
  W1_DEFAULTS,
} from '../utils/w1Settings';
import type { GenerationJob, SavedConfig } from '../types';

describe('W1 defaults and legacy settings fallback', () => {
  it('DEFAULT_SETTINGS uses social / length off / 3 / 稳妥 / empty modifiers', () => {
    expect(DEFAULT_SETTINGS.copyType).toBe('social');
    expect(DEFAULT_SETTINGS.customCopyType).toBe('');
    expect(DEFAULT_SETTINGS.lengthControlEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.copyLengthLevel).toBe(3);
    expect(DEFAULT_SETTINGS.primaryTone).toBe('穩妥');
    expect(DEFAULT_SETTINGS.tone).toBe('穩妥');
    expect(DEFAULT_SETTINGS.toneModifiers).toEqual([]);
  });

  it('normalizeSettings fills W1 defaults when old payload lacks fields', () => {
    const normalized = normalizeSettings({
      platform: 'ig',
      tone: '活潑',
      cantoneseLevel: 3,
      englishMixingLevel: 1,
      creativityLevel: 2,
      inputLanguage: 'mandarin',
      brandName: '甲',
      productName: '乙',
      brandRedLines: '',
      structuredBriefEnabled: false,
      consumerPersonas: [],
    });

    expect(normalized.copyType).toBe('social');
    expect(normalized.lengthControlEnabled).toBe(false);
    expect(normalized.copyLengthLevel).toBe(3);
    expect(normalized.primaryTone).toBe('活潑');
    expect(normalized.tone).toBe('活潑');
    expect(normalized.toneModifiers).toEqual([]);
  });

  it('maps legacy tone to primaryTone and clamps modifiers to 2', () => {
    const w1 = normalizeW1Fields({
      tone: '年輕',
      toneModifiers: ['簡潔', '敘事', '促銷感', '治癒'],
    });
    expect(w1.primaryTone).toBe('年輕');
    expect(w1.tone).toBe('年輕');
    expect(w1.toneModifiers).toEqual(['簡潔', '敘事']);
  });
});

describe('W1 custom copy type validation', () => {
  it('requires 2–20 chars only for custom', () => {
    expect(isValidCustomCopyType('ab')).toBe(true);
    expect(isValidCustomCopyType('a')).toBe(false);
    expect(isValidCustomCopyType('x'.repeat(21))).toBe(false);
    expect(canGenerateWithCopyType('social', '')).toBe(true);
    expect(canGenerateWithCopyType('custom', '海报')).toBe(true);
    expect(canGenerateWithCopyType('custom', '一')).toBe(false);
  });
});

describe('W1 tone modifiers', () => {
  it('drops invalid entries and enforces max two', () => {
    expect(normalizeToneModifiers(['簡潔', '无效', '敘事', '治癒'])).toEqual(['簡潔', '敘事']);
    expect(normalizeToneModifiers(null)).toEqual([]);
  });
});

describe('W1 saved config / history / bookmark labels', () => {
  it('getCopyTypeLabel shows legacy label when field missing', () => {
    expect(getCopyTypeLabel(undefined, { legacyMissing: true })).toBe('社媒文案（历史记录）');
    expect(getCopyTypeLabel('spoken')).toBe('口播稿');
  });

  it('saved config shape can retain W1 fields', () => {
    const config: SavedConfig = {
      id: 'cfg1',
      name: 'w1',
      brandName: '',
      productName: '',
      brandRedLines: '',
      structuredBriefEnabled: false,
      creativityLevel: 1,
      cantoneseLevel: 4,
      englishMixingLevel: 1,
      tone: '幽默',
      platform: 'all',
      inputLanguage: 'mandarin',
      consumerPersonas: [],
      copyType: 'poetry',
      customCopyType: '',
      lengthControlEnabled: true,
      copyLengthLevel: 2,
      primaryTone: '幽默',
      toneModifiers: ['簡潔', '節日感'],
      createdAt: new Date().toISOString(),
    };
    const normalized = normalizeSettings(config as unknown as Record<string, unknown>);
    expect(normalized.copyType).toBe('poetry');
    expect(normalized.lengthControlEnabled).toBe(true);
    expect(normalized.copyLengthLevel).toBe(2);
    expect(normalized.primaryTone).toBe('幽默');
    expect(normalized.toneModifiers).toEqual(['簡潔', '節日感']);
  });

  it('history load restores W1 from workbenchSettings', () => {
    const now = new Date().toISOString();
    const job: GenerationJob = {
      id: 'j1',
      ownerId: 'u1',
      idempotencyKey: 'k1',
      status: 'completed',
      source: '原文',
      platform: 'all',
      tone: '穩妥',
      cantoneseLevel: 4,
      englishMixingLevel: 1,
      creativityLevel: 1,
      inputLanguage: 'mandarin',
      brandName: null,
      productName: null,
      brandRedLines: null,
      brief: {
        workbenchSettings: {
          ...DEFAULT_SETTINGS,
          copyType: 'spoken',
          lengthControlEnabled: true,
          copyLengthLevel: 1,
          primaryTone: '俏皮',
          tone: '俏皮',
          toneModifiers: ['對話感'],
        },
      },
      diagnosis: { hasSimplifiedChars: false, mainlandPhrases: [], issues: [] },
      variants: {
        standardHK: 'a',
        lightCantonese: 'b',
        ig: 'c',
        facebook: 'd',
        shorts: 'e',
      },
      audit: {
        thermometer: { overall: 80, dimensions: {} as never },
        issues: [],
        replacements: [],
        risks: [],
        comments: [],
      },
      scores: null,
      consumerFeedback: null,
      variantMeta: null,
      generationEngine: 'deepseek',
      errorMessage: null,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
      deletedAt: null,
    };

    const { snapshot } = buildWorkbenchSnapshotFromHistory(job);
    expect(snapshot?.settings.copyType).toBe('spoken');
    expect(snapshot?.settings.lengthControlEnabled).toBe(true);
    expect(snapshot?.settings.copyLengthLevel).toBe(1);
    expect(snapshot?.settings.primaryTone).toBe('俏皮');
    expect(snapshot?.settings.toneModifiers).toEqual(['對話感']);
  });

  it('history without W1 fields falls back safely', () => {
    const now = new Date().toISOString();
    const job: GenerationJob = {
      id: 'j2',
      ownerId: 'u1',
      idempotencyKey: 'k2',
      status: 'completed',
      source: '旧历史',
      platform: 'ig',
      tone: '街坊',
      cantoneseLevel: 4,
      englishMixingLevel: 1,
      creativityLevel: 1,
      inputLanguage: 'mandarin',
      brandName: null,
      productName: null,
      brandRedLines: null,
      brief: {},
      diagnosis: { hasSimplifiedChars: false, mainlandPhrases: [], issues: [] },
      variants: {
        standardHK: 'a',
        lightCantonese: 'b',
        ig: 'c',
        facebook: 'd',
        shorts: 'e',
      },
      audit: {
        thermometer: { overall: 80, dimensions: {} as never },
        issues: [],
        replacements: [],
        risks: [],
        comments: [],
      },
      scores: null,
      consumerFeedback: null,
      variantMeta: null,
      generationEngine: 'deepseek',
      errorMessage: null,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
      deletedAt: null,
    };

    const { snapshot } = buildWorkbenchSnapshotFromHistory(job);
    expect(snapshot?.settings.copyType).toBe(W1_DEFAULTS.copyType);
    expect(snapshot?.settings.lengthControlEnabled).toBe(false);
    expect(snapshot?.settings.copyLengthLevel).toBe(3);
    expect(snapshot?.settings.primaryTone).toBe('街坊');
    expect(snapshot?.settings.toneModifiers).toEqual([]);
  });
});

describe('W1 cloud-sync-friendly payload', () => {
  beforeEach(() => {
    // pure unit — no storage
  });

  it('bookmark settings snapshot retains W1 keys for sync payload', () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      copyType: 'advertorial',
      lengthControlEnabled: true,
      copyLengthLevel: 5,
      primaryTone: '專業',
      tone: '專業',
      toneModifiers: ['知識感', '簡潔'],
    });

    const payload = {
      settings: settings as unknown as Record<string, unknown>,
    };

    expect(payload.settings.copyType).toBe('advertorial');
    expect(payload.settings.lengthControlEnabled).toBe(true);
    expect(payload.settings.copyLengthLevel).toBe(5);
    expect(payload.settings.primaryTone).toBe('專業');
    expect(payload.settings.toneModifiers).toEqual(['知識感', '簡潔']);
  });
});
