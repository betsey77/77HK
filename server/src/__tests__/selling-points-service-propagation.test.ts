import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerateRequest } from '../types/index.js';

const { buildDeepSeekPrompt, buildCantonesePrompt, createCompletion } = vi.hoisted(() => ({
  buildDeepSeekPrompt: vi.fn(() => 'deepseek prompt'),
  buildCantonesePrompt: vi.fn(() => 'cantonese prompt'),
  createCompletion: vi.fn(async () => ({
    choices: [{
      message: {
        content: JSON.stringify({
          diagnosis: {},
          variants: {
            standardHK: '標準',
            lightCantonese: '輕粵語',
            ig: 'IG',
            facebook: 'Facebook',
            shorts: 'Shorts',
          },
        }),
      },
    }],
  })),
}));

vi.mock('../prompts/diagnoseGenerate.js', () => ({
  buildDiagnoseGeneratePrompt: buildDeepSeekPrompt,
  buildCantoneseLLMPrompt: buildCantonesePrompt,
}));

vi.mock('openai', () => ({
  default: class OpenAIMock {
    chat = { completions: { create: createCompletion } };
  },
}));

import { diagnoseAndGenerate } from '../services/deepseekService.js';
import { generateWithCantoneseLLM } from '../services/cantoneseService.js';

const productSellingPoints = [
  {
    id: 'p1',
    sourceText: '富含HMO，近似母乳营养',
    cantoneseText: '富含HMO，同母乳營養好接近',
    status: 'ready' as const,
  },
];

const request: GenerateRequest = {
  source: '呢款BB奶粉味道唔錯。',
  platform: 'all',
  tone: '穩妥',
  cantoneseLevel: 4,
  englishMixingLevel: 1,
  useEnhancement: false,
  creativityLevel: 2,
  inputLanguage: 'mandarin',
  productSellingPoints,
};

describe('产品卖点真实模型服务传递', () => {
  beforeEach(() => {
    buildDeepSeekPrompt.mockClear();
    buildCantonesePrompt.mockClear();
    createCompletion.mockClear();
    process.env.DEEPSEEK_API_KEY = 'test-key';
    process.env.CANTONESE_API_URL = 'http://localhost:9999/v1';
  });

  it('DeepSeek 服务把路由参数中的卖点传给 Prompt builder', async () => {
    await diagnoseAndGenerate(request);

    expect(buildDeepSeekPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ productSellingPoints }),
    );
  });

  it('CantoneseLLM 服务把路由参数中的卖点传给 Prompt builder', async () => {
    await generateWithCantoneseLLM(request);

    expect(buildCantonesePrompt).toHaveBeenCalledWith(
      expect.objectContaining({ productSellingPoints }),
    );
  });
});
