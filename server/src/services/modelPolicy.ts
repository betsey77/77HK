export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
export const DEEPSEEK_NON_THINKING = { thinking: { type: 'disabled' as const } };

export class RealModelUnavailableError extends Error {
  readonly code = 'REAL_MODEL_UNAVAILABLE';

  constructor(message = 'The AI model is temporarily unavailable. Please try again.') {
    super(message);
    this.name = 'RealModelUnavailableError';
  }
}

type ModelEnvironment = Partial<Record<
  'REQUIRE_REAL_MODEL' | 'DEEPSEEK_API_KEY' | 'CANTONESE_API_URL',
  string | undefined
>>;

export function getModelRuntimePolicy(env: ModelEnvironment = process.env) {
  const requireRealModel = env.REQUIRE_REAL_MODEL?.trim().toLowerCase() === 'true';

  return {
    requireRealModel,
    hasConfiguredRealModel: Boolean(
      env.DEEPSEEK_API_KEY?.trim() || env.CANTONESE_API_URL?.trim(),
    ),
    generationTimeoutMs: 25_000,
    qualityScoreTimeoutMs: 8_000,
    postProcessingTimeoutMs: requireRealModel ? 18_000 : 35_000,
    allowQualityRetry: !requireRealModel,
  };
}
