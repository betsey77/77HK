import { describe, expect, it } from 'vitest';
import {
  buildCantoneseLLMPrompt,
  buildDiagnoseGeneratePrompt,
} from '../prompts/diagnoseGenerate.js';
import {
  COPY_TYPE_SECTION_MARKER,
  LENGTH_SECTION_MARKER,
  TONE_SECTION_MARKER,
  isValidCustomCopyType,
  normalizeToneModifiers,
  resolveW1Fields,
  buildW1ConstraintSections,
} from '../prompts/w1Constraints.js';
import { fallbackGenerate } from '../services/fallbackService.js';
import type { GenerateRequest } from '../types/index.js';

const base: GenerateRequest = {
  source: '新品今日上市，欢迎了解。限时优惠，欢迎选购。',
  platform: 'all',
  tone: '穩妥',
  cantoneseLevel: 4,
  englishMixingLevel: 1,
  useEnhancement: false,
  creativityLevel: 2,
  inputLanguage: 'mandarin',
};

describe('W1 resolve / validation', () => {
  it('defaults missing W1 fields', () => {
    const w1 = resolveW1Fields({});
    expect(w1.copyType).toBe('social');
    expect(w1.lengthControlEnabled).toBe(false);
    expect(w1.copyLengthLevel).toBe(3);
    expect(w1.primaryTone).toBe('穩妥');
    expect(w1.toneModifiers).toEqual([]);
  });

  it('maps legacy tone to primaryTone', () => {
    const w1 = resolveW1Fields({ tone: '活潑' });
    expect(w1.primaryTone).toBe('活潑');
    expect(w1.tone).toBe('活潑');
  });

  it('requires customCopyType 2–20 for custom', () => {
    expect(isValidCustomCopyType('ab')).toBe(true);
    expect(() => resolveW1Fields({ copyType: 'custom', customCopyType: 'x' })).toThrow(/2–20/);
    expect(() => resolveW1Fields({ copyType: 'custom', customCopyType: '海报短文风格' })).not.toThrow();
  });

  it('clamps tone modifiers to max two', () => {
    expect(normalizeToneModifiers(['簡潔', '敘事', '促銷感'])).toEqual(['簡潔', '敘事']);
  });
});

describe('W1 prompt injection — length switch', () => {
  it('omits length section when lengthControlEnabled is false', () => {
    const section = buildW1ConstraintSections({
      ...base,
      lengthControlEnabled: false,
      copyLengthLevel: 5,
    });
    expect(section).not.toContain(LENGTH_SECTION_MARKER);
    expect(section).toContain(COPY_TYPE_SECTION_MARKER);
  });

  it('includes soft length targets when enabled', () => {
    const section = buildW1ConstraintSections({
      ...base,
      lengthControlEnabled: true,
      copyLengthLevel: 1,
    });
    expect(section).toContain(LENGTH_SECTION_MARKER);
    expect(section).toContain('极短');
    expect(section).toContain('軟目標');
  });
});

describe('W1 three engine paths share constraints', () => {
  const w1Params: GenerateRequest = {
    ...base,
    copyType: 'spoken',
    lengthControlEnabled: true,
    copyLengthLevel: 2,
    primaryTone: '俏皮',
    tone: '俏皮',
    toneModifiers: ['對話感', '簡潔'],
  };

  it.each([
    ['DeepSeek', buildDiagnoseGeneratePrompt],
    ['CantoneseLLM', buildCantoneseLLMPrompt],
  ])('%s prompt contains shared W1 sections', (_name, buildPrompt) => {
    const prompt = buildPrompt(w1Params);
    expect(prompt).toContain(COPY_TYPE_SECTION_MARKER);
    expect(prompt).toContain('口播稿');
    expect(prompt).toContain(LENGTH_SECTION_MARKER);
    expect(prompt).toContain(TONE_SECTION_MARKER);
    expect(prompt).toContain('俏皮');
    expect(prompt).toContain('對話感');
    // still five platform variants required
    expect(prompt).toContain('五個');
  });

  it('rules fallback still emits five platform variants under W1 params', () => {
    const result = fallbackGenerate(w1Params);
    expect(Object.keys(result.variants)).toEqual(
      expect.arrayContaining(['standardHK', 'lightCantonese', 'ig', 'facebook', 'shorts']),
    );
    expect(Object.values(result.variants)).toHaveLength(5);
    expect(result.diagnosis.issues?.some((i) => i.includes('文案類型') || i.includes('長度'))).toBe(true);
  });
});

describe('W1 does not break reference cases / calendar sections', () => {
  it('still injects reference cases when W1 fields present', () => {
    const prompt = buildDiagnoseGeneratePrompt({
      ...base,
      copyType: 'social',
      lengthControlEnabled: false,
      primaryTone: '穩妥',
      toneModifiers: [],
      referenceCases: [
        {
          id: 'f1',
          content: '✨ 放工想輕鬆一下？即刻留言話我知！',
          rating: 5,
          reasonTags: ['hook'],
          variantKey: 'ig',
        },
      ],
    });
    expect(prompt).toContain('放工想輕鬆一下');
    expect(prompt).toContain(COPY_TYPE_SECTION_MARKER);
  });
});
