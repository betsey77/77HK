import { describe, expect, it } from 'vitest';
import { buildCantoneseLLMPrompt, buildDiagnoseGeneratePrompt, PRODUCT_SELLING_POINTS_SECTION_MARKER } from '../prompts/diagnoseGenerate.js';
import { TONE_SECTION_MARKER } from '../prompts/w1Constraints.js';
import type { GenerateRequest } from '../types/index.js';

const base: GenerateRequest = {
  source: '新品今日上市。', platform: 'all', tone: '穩妥', cantoneseLevel: 4,
  englishMixingLevel: 1, useEnhancement: false, creativityLevel: 2,
  inputLanguage: 'mandarin', brandRedLines: '禁止使用「全港第一」',
};

describe('产品卖点 Prompt 契约', () => {
  it.each([
    ['DeepSeek', buildDiagnoseGeneratePrompt],
    ['CantoneseLLM', buildCantoneseLLMPrompt],
  ])('%s 优先注入港话表达，且顺序为红线 > 卖点 > 风格', (_name, buildPrompt) => {
    const prompt = buildPrompt({
      ...base,
      productSellingPoints: [
        { id: 'p1', sourceText: '轻便易携带', cantoneseText: '夠輕身，拎出街都方便', status: 'ready' },
      ],
    });

    expect(prompt).toContain(PRODUCT_SELLING_POINTS_SECTION_MARKER);
    expect(prompt).toContain('夠輕身，拎出街都方便');
    expect(prompt).toContain('原文或「產品賣點」區塊');
    expect(prompt).not.toContain('原文冇產品描述 → 唔好加產品描述');
    expect(prompt.indexOf('品牌自訂表達紅線')).toBeLessThan(prompt.indexOf(PRODUCT_SELLING_POINTS_SECTION_MARKER));
    expect(prompt.indexOf(PRODUCT_SELLING_POINTS_SECTION_MARKER)).toBeLessThan(prompt.indexOf(TONE_SECTION_MARKER));
  });

  it('服务端最多注入 10 条，并在没有港话表达时保留原始卖点', () => {
    const productSellingPoints = Array.from({ length: 12 }, (_, index) => ({
      id: `p${index + 1}`,
      sourceText: `原始卖点 ${index + 1}`,
      cantoneseText: index === 0 ? '' : `港話賣點 ${index + 1}`,
      status: index === 0 ? 'error' as const : 'ready' as const,
    }));
    const prompt = buildDiagnoseGeneratePrompt({ ...base, productSellingPoints });

    expect(prompt).toContain('原始卖点 1');
    expect(prompt).toContain('港話賣點 10');
    expect(prompt).not.toContain('港話賣點 11');
  });
});
