import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getTrustedSupabase: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../services/trustedSupabase.js', () => ({
  getTrustedSupabase: mocks.getTrustedSupabase,
}));

import {
  MODEL_CALL_LOG_TIMEOUT_MS,
  classifyModelError,
  normalizeProviderUsage,
  observeModelAttempt,
  recordAppActivity,
  recordModelCall,
  type ModelCallLogInput,
} from '../services/telemetryService.js';

const validInput: ModelCallLogInput = {
  jobId: null,
  requestId: '11111111-1111-4111-8111-111111111111',
  operation: 'generate',
  provider: 'deepseek',
  model: 'deepseek-v4-flash',
  status: 'success',
  errorClass: null,
  latencyMs: 1234,
  attempt: 1,
  promptTokens: 100,
  completionTokens: 50,
  totalTokens: 150,
  cacheHitTokens: 20,
  cacheMissTokens: 80,
  usageSource: 'provider',
};

describe('telemetryService', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.getTrustedSupabase.mockReturnValue({
      from: mocks.from,
      rpc: mocks.rpc,
    });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it('records activity through a server-only RPC without accepting a client date', async () => {
    const userId = '22222222-2222-4222-8222-222222222222';

    await expect(recordAppActivity(userId)).resolves.toBeUndefined();
    expect(mocks.rpc).toHaveBeenCalledWith('record_app_activity', { _user_id: userId });
  });

  it('maps the strict model-call contract to the exact database allowlist', async () => {
    await expect(recordModelCall(validInput)).resolves.toBe(true);

    expect(mocks.from).toHaveBeenCalledWith('model_call_logs');
    expect(mocks.insert).toHaveBeenCalledWith({
      job_id: null,
      request_id: validInput.requestId,
      operation: 'generate',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      status: 'success',
      error_class: null,
      latency_ms: 1234,
      attempt: 1,
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      cache_hit_tokens: 20,
      cache_miss_tokens: 80,
      usage_source: 'provider',
    });
  });

  it.each(['prompt', 'response', 'rawError', 'email', 'jwt', 'apiKey', 'secret'])(
    'rejects forbidden runtime key %s before opening the trusted client',
    async (key) => {
      const unsafe = { ...validInput, [key]: 'must-not-be-stored' } as ModelCallLogInput;

      await expect(recordModelCall(unsafe)).rejects.toThrow('Invalid model telemetry payload');
      expect(mocks.getTrustedSupabase).not.toHaveBeenCalled();
    },
  );

  it('requires an error class for failures and forbids one for success', async () => {
    await expect(recordModelCall({
      ...validInput,
      status: 'error',
      errorClass: null,
      usageSource: 'unavailable',
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      cacheHitTokens: null,
      cacheMissTokens: null,
    })).rejects.toThrow('Invalid model telemetry payload');

    await expect(recordModelCall({
      ...validInput,
      errorClass: 'unknown',
    })).rejects.toThrow('Invalid model telemetry payload');
  });

  it('keeps unavailable usage fields null instead of guessing token counts', async () => {
    await expect(recordModelCall({
      ...validInput,
      status: 'error',
      errorClass: 'timeout',
      usageSource: 'unavailable',
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      cacheHitTokens: null,
      cacheMissTokens: null,
    })).resolves.toBe(true);

    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      usage_source: 'unavailable',
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      cache_hit_tokens: null,
      cache_miss_tokens: null,
    }));
  });

  it('returns false on database errors so telemetry cannot fail model work', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'sensitive database detail' } });

    await expect(recordModelCall(validInput)).resolves.toBe(false);
  });

  it('times out best-effort writes without leaving a rejection handler gap', async () => {
    vi.useFakeTimers();
    mocks.insert.mockReturnValue(new Promise(() => undefined));

    const result = recordModelCall(validInput);
    await vi.advanceTimersByTimeAsync(MODEL_CALL_LOG_TIMEOUT_MS);

    await expect(result).resolves.toBe(false);
  });

  it('normalizes official DeepSeek usage without estimating missing fields', () => {
    expect(normalizeProviderUsage({
      prompt_tokens: 120,
      completion_tokens: 30,
      total_tokens: 150,
      prompt_cache_hit_tokens: 80,
    })).toEqual({
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150,
      cacheHitTokens: 80,
      cacheMissTokens: null,
      usageSource: 'provider',
    });

    expect(normalizeProviderUsage(undefined)).toEqual({
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      cacheHitTokens: null,
      cacheMissTokens: null,
      usageSource: 'unavailable',
    });
  });

  it('classifies provider failures without returning their raw message', () => {
    expect(classifyModelError({ status: 429, message: 'secret provider body' })).toBe('rate_limited');
    expect(classifyModelError({ code: 'ETIMEDOUT', message: 'socket secret' })).toBe('timeout');
    expect(classifyModelError(new SyntaxError('bad JSON containing private text'))).toBe('invalid_response');
  });

  it('observes the whole provider attempt and telemetry failure never changes success', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'telemetry unavailable' } });

    await expect(observeModelAttempt(
      {
        jobId: null,
        requestId: '33333333-3333-4333-8333-333333333333',
      },
      {
        operation: 'generate',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        attempt: 1,
      },
      async (captureUsage) => {
        captureUsage({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 });
        return 'model-result';
      },
    )).resolves.toBe('model-result');
  });

  it('observes an invalid provider response as an error and rethrows the original error', async () => {
    const original = new SyntaxError('private response body');

    await expect(observeModelAttempt(
      {
        jobId: null,
        requestId: '44444444-4444-4444-8444-444444444444',
      },
      {
        operation: 'generate',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        attempt: 1,
      },
      async (captureUsage) => {
        captureUsage({ prompt_tokens: 10, total_tokens: 10 });
        throw original;
      },
    )).rejects.toBe(original);

    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      error_class: 'invalid_response',
      prompt_tokens: 10,
      total_tokens: 10,
      usage_source: 'provider',
    }));
    expect(JSON.stringify(mocks.insert.mock.calls[0]?.[0])).not.toContain('private response body');
  });
});
