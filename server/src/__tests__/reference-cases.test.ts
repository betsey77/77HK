import { describe, expect, it } from 'vitest';
import { buildCantoneseLLMPrompt, buildDiagnoseGeneratePrompt } from '../prompts/diagnoseGenerate.js';
import { fallbackGenerate } from '../services/fallbackService.js';
import type { GenerateRequest } from '../types/index.js';

const request: GenerateRequest = {
  source: '新品今日上市，欢迎了解。',
  platform: 'all',
  tone: '活潑',
  cantoneseLevel: 4,
  englishMixingLevel: 1,
  useEnhancement: false,
  creativityLevel: 2,
  inputLanguage: 'mandarin',
  referenceCases: [
    {
      id: 'favorite-1',
      content: '✨ 放工想輕鬆一下？即刻留言話我知！',
      rating: 5,
      reasonTags: ['hook', 'emoji', 'cta'],
      favoriteReason: '開場吸睛，CTA 自然',
      variantKey: 'ig',
    },
  ],
};

describe('reference case prompt injection', () => {
  it.each([
    ['DeepSeek', buildDiagnoseGeneratePrompt],
    ['CantoneseLLM', buildCantoneseLLMPrompt],
  ])('%s prompt requires each platform variant to apply identifiable reference techniques', (_name, buildPrompt) => {
    const prompt = buildPrompt(request);

    expect(prompt).toContain(request.referenceCases![0]!.content);
    expect(prompt).toContain('每個平台版本');
    expect(prompt).toContain('至少 2 項');
    expect(prompt).toContain('不可把正例嘅主題或事實當成新文案資料');
  });
});

describe('reference case rules fallback', () => {
  it('applies selected hook, emoji and CTA style instead of silently ignoring references', () => {
    const result = fallbackGenerate(request);
    const variants = Object.values(result.variants);

    expect(variants).toHaveLength(5);
    for (const variant of variants) {
      expect(variant).toContain('✨');
      expect(variant).toContain('想知多啲？留言話我知。');
    }
  });
});
