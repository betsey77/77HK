import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerateRequest } from '../types/index.js';

const mocks = vi.hoisted(() => ({
  createCompletion: vi.fn(),
  getTrustedSupabase: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class OpenAIMock {
    chat = { completions: { create: mocks.createCompletion } };
  },
}));

vi.mock('../services/trustedSupabase.js', () => ({
  getTrustedSupabase: mocks.getTrustedSupabase,
}));

import {
  analyzeBadCaseWithDeepSeek,
  diagnoseAndGenerate,
  scoreSource,
} from '../services/deepseekService.js';
import { generateWithCantoneseLLM } from '../services/cantoneseService.js';

const context = {
  jobId: '00000000-0000-4000-a000-000000000001',
  requestId: '55555555-5555-4555-8555-555555555555',
};

const request: GenerateRequest = {
  source: '測試文案',
  platform: 'all',
  tone: '穩妥',
  cantoneseLevel: 3,
  englishMixingLevel: 1,
  useEnhancement: false,
  creativityLevel: 2,
  inputLanguage: 'mandarin',
};

function validCompletion(usage?: Record<string, number>) {
  return {
    choices: [{
      message: {
        content: JSON.stringify({
          diagnosis: { summary: 'ok' },
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
    ...(usage ? { usage } : {}),
  };
}

describe('D5 model service telemetry', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    process.env.DEEPSEEK_API_KEY = 'test-key';
    delete process.env.CANTONESE_API_URL;
    mocks.getTrustedSupabase.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.createCompletion.mockResolvedValue(validCompletion());
  });

  it('records official DeepSeek token and cache usage for a successful attempt', async () => {
    mocks.createCompletion.mockResolvedValue(validCompletion({
      prompt_tokens: 120,
      completion_tokens: 30,
      total_tokens: 150,
      prompt_cache_hit_tokens: 80,
      prompt_cache_miss_tokens: 40,
    }));

    await expect(diagnoseAndGenerate(request, context, 1)).resolves.toMatchObject({
      variants: { standardHK: '標準' },
    });

    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      job_id: context.jobId,
      request_id: context.requestId,
      operation: 'generate',
      provider: 'deepseek',
      status: 'success',
      attempt: 1,
      prompt_tokens: 120,
      completion_tokens: 30,
      total_tokens: 150,
      cache_hit_tokens: 80,
      cache_miss_tokens: 40,
      usage_source: 'provider',
    }));
  });

  it('returns only review suggestions bound to known deterministic criteria', async () => {
    mocks.createCompletion.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: '港味评分偏低，需检查提示词示例。',
            suggestions: [
              {
                criterionRef: 'score.total_threshold@2.1',
                diagnosis: '输出较书面，香港口语特征不足。',
                remediation: '审阅港式口语 few-shot，并用同一样本回归评分。',
                ownerTeam: 'content_prompt',
                confidence: 0.86,
              },
              {
                criterionRef: 'invented.criterion@1',
                diagnosis: '无对应证据',
                remediation: '不应保留',
                ownerTeam: 'content_prompt',
                confidence: 1,
              },
            ],
          }),
        },
      }],
      usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 },
    });

    const result = await analyzeBadCaseWithDeepSeek({
      source: '测试原文',
      variants: { ig: '测试变体' },
      criteria: [{
        criterionRef: 'score.total_threshold@2.1',
        result: 'fail',
        actual: 28,
        expected: 60,
      }],
      findings: [{
        criterionRef: 'score.total_threshold@2.1',
        description: '港味总分 28 低于阈值 60',
        category: 'content_quality',
        severity: 'high',
        stage: 'audit',
      }],
      modelAttempts: [],
    }, context);

    expect(result).toMatchObject({
      provider: 'deepseek',
      analysisVersion: 'deepseek-1.0.0',
      suggestions: [{ criterionRef: 'score.total_threshold@2.1' }],
    });
    expect(result.suggestions).toHaveLength(1);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'audit',
      provider: 'deepseek',
      status: 'success',
      total_tokens: 140,
    }));
  });

  it('does not open telemetry when the optional context is absent', async () => {
    await expect(diagnoseAndGenerate(request)).resolves.toBeDefined();
    expect(mocks.getTrustedSupabase).not.toHaveBeenCalled();
  });

  it('keeps a successful model result when telemetry persistence fails', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'database detail' } });

    await expect(diagnoseAndGenerate(request, context, 1)).resolves.toBeDefined();
  });

  it('records swallowed DeepSeek provider failures without raw error text', async () => {
    const providerError = Object.assign(new Error('private upstream response'), { status: 429 });
    mocks.createCompletion.mockRejectedValue(providerError);

    await expect(scoreSource('原文', context)).resolves.toBeNull();
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'score_source',
      status: 'error',
      error_class: 'rate_limited',
      usage_source: 'unavailable',
    }));
    expect(JSON.stringify(mocks.insert.mock.calls[0]?.[0])).not.toContain('private upstream response');
  });

  it('performs and records two real Cantonese cold-start retries', async () => {
    vi.useFakeTimers();
    process.env.CANTONESE_API_URL = 'http://localhost:9999/v1';
    const coldStart = () => Object.assign(new Error('not ready for inference'), {
      code: 'model_pending_deploy',
    });
    mocks.createCompletion
      .mockRejectedValueOnce(coldStart())
      .mockRejectedValueOnce(coldStart())
      .mockResolvedValueOnce(validCompletion());

    const result = generateWithCantoneseLLM(request, context);
    await vi.advanceTimersByTimeAsync(45_000);

    await expect(result).resolves.toBeDefined();
    expect(mocks.createCompletion).toHaveBeenCalledTimes(3);
    expect(mocks.insert.mock.calls.map(([row]) => ({
      attempt: row.attempt,
      status: row.status,
      errorClass: row.error_class,
      provider: row.provider,
    }))).toEqual([
      { attempt: 1, status: 'error', errorClass: 'unavailable', provider: 'cantonese_self_hosted' },
      { attempt: 2, status: 'error', errorClass: 'unavailable', provider: 'cantonese_self_hosted' },
      { attempt: 3, status: 'success', errorClass: null, provider: 'cantonese_self_hosted' },
    ]);
  });
});

describe('D5 route context contract', () => {
  const routesDir = path.resolve(__dirname, '../routes');

  it('passes one explicit request context and separate quality-attempt numbers', () => {
    const generate = fs.readFileSync(path.join(routesDir, 'generate.ts'), 'utf8');

    expect(generate).toContain('const modelCallContext: ModelCallContext');
    expect(generate).toContain('generateWithCantoneseLLM(params, modelCallContext)');
    expect(generate).toContain('diagnoseAndGenerate(params, modelCallContext, 1)');
    expect(generate).toContain('diagnoseAndGenerate(params, modelCallContext, 2)');
    expect(generate).toContain('scoreCantoneseNaturalness(deepseekResult.variants, modelCallContext, 1)');
    expect(generate).toContain('scoreCantoneseNaturalness(retryResult.variants, modelCallContext, 2)');
  });

  it('creates request-only contexts for modify and persona routes', () => {
    for (const route of ['modify.ts', 'parsePersonas.ts']) {
      const source = fs.readFileSync(path.join(routesDir, route), 'utf8');
      expect(source).toContain('createModelCallContext()');
      expect(source).toContain('jobId: null');
    }
  });
});
