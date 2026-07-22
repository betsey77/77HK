import { describe, expect, it } from 'vitest';
import {
  DEEPSEEK_NON_THINKING,
  DEFAULT_DEEPSEEK_MODEL,
  getModelRuntimePolicy,
  RealModelUnavailableError,
} from '../services/modelPolicy.js';

describe('real-model deployment policy', () => {
  it('defaults DeepSeek to the supported V4 Flash model', () => {
    expect(DEFAULT_DEEPSEEK_MODEL).toBe('deepseek-v4-flash');
    expect(DEEPSEEK_NON_THINKING).toEqual({ thinking: { type: 'disabled' } });
  });

  it('requires a configured provider when strict mode is enabled', () => {
    const policy = getModelRuntimePolicy({
      REQUIRE_REAL_MODEL: 'true',
      DEEPSEEK_API_KEY: '',
      CANTONESE_API_URL: '',
    });

    expect(policy.requireRealModel).toBe(true);
    expect(policy.hasConfiguredRealModel).toBe(false);
    expect(policy.allowQualityRetry).toBe(false);
    expect(
      policy.generationTimeoutMs
        + policy.qualityScoreTimeoutMs
        + policy.postProcessingTimeoutMs,
    ).toBeLessThan(60_000);
  });

  it('recognizes DeepSeek without requiring the self-hosted Cantonese model', () => {
    const policy = getModelRuntimePolicy({
      REQUIRE_REAL_MODEL: 'TRUE',
      DEEPSEEK_API_KEY: 'configured',
      CANTONESE_API_URL: '',
    });

    expect(policy.requireRealModel).toBe(true);
    expect(policy.hasConfiguredRealModel).toBe(true);
  });

  it('uses an explicit machine-readable error for model failure', () => {
    const error = new RealModelUnavailableError();
    expect(error.code).toBe('REAL_MODEL_UNAVAILABLE');
    expect(error.message).toMatch(/AI model/i);
  });
});
