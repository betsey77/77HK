import { describe, expect, it } from 'vitest';
import { buildDiagnoseGeneratePrompt } from '../prompts/diagnoseGenerate.js';
import { fallbackGenerate } from '../services/fallbackService.js';
import { quickCheck } from '../services/quickCheckService.js';
import type { GenerateRequest, Variants } from '../types/index.js';

const request: GenerateRequest = {
  source: '新品今日上市，欢迎了解。限时优惠，欢迎选购。',
  platform: 'all',
  tone: '穩妥',
  cantoneseLevel: 4,
  englishMixingLevel: 1,
  useEnhancement: false,
  creativityLevel: 2,
  inputLanguage: 'mandarin',
};

const variants: Variants = {
  standardHK: '全新产品今日正式推出，欢迎立即了解更多详情。',
  lightCantonese: '新产品今日正式推出，欢迎即刻了解更多详情。',
  ig: '新产品今日正式推出，欢迎即刻了解更多详情。 #新品',
  facebook: '全新产品今日正式推出，欢迎大家立即了解更多详情。',
  shorts: '三秒睇清新品重点！今日正式推出，立即了解更多详情。',
};

describe('Shorts/TK prompt and rules contract', () => {
  it('teaches the model both YouTube Shorts and TikTok while keeping the shorts JSON key', () => {
    const prompt = buildDiagnoseGeneratePrompt(request);

    expect(prompt).toContain('YouTube Shorts');
    expect(prompt).toContain('TikTok');
    expect(prompt).toContain('Shorts/TK');
    expect(prompt).toContain('"shorts"');
  });

  it('uses Shorts/TK in user-facing quick-check labels', () => {
    const result = quickCheck(variants);
    const shortsItems = result.items.filter((item) => item.variantKey === 'shorts');

    expect(shortsItems.length).toBeGreaterThan(0);
    expect(shortsItems.every((item) => item.variantLabel === 'Shorts/TK')).toBe(true);
    expect(shortsItems.some((item) => item.rule === 'Shorts/TK Hook')).toBe(true);
  });

  it('keeps the internal fallback key and describes the shared short-video format', () => {
    const result = fallbackGenerate(request);

    expect(result.variants).toHaveProperty('shorts');
    expect(result.variants.shorts).toContain('Shorts/TK');
  });
});
