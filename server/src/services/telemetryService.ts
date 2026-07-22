import { getTrustedSupabase } from './trustedSupabase.js';

export const MODEL_CALL_LOG_TIMEOUT_MS = 400;

const MODEL_CALL_OPERATIONS = [
  'generate',
  'audit',
  're_audit',
  'score_source',
  'consumer_feedback',
  'parse_personas',
  'translate',
  'localize_selling_point',
  'apply_suggestion',
  'score_naturalness',
] as const;

const MODEL_CALL_PROVIDERS = [
  'deepseek',
  'cantonese_self_hosted',
  'featherless',
] as const;

const MODEL_CALL_ERROR_CLASSES = [
  'timeout',
  'rate_limited',
  'authentication',
  'unavailable',
  'network',
  'invalid_response',
  'provider_error',
  'unknown',
] as const;

const MODEL_CALL_INPUT_KEYS = new Set([
  'jobId',
  'requestId',
  'operation',
  'provider',
  'model',
  'status',
  'errorClass',
  'latencyMs',
  'attempt',
  'promptTokens',
  'completionTokens',
  'totalTokens',
  'cacheHitTokens',
  'cacheMissTokens',
  'usageSource',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,119}$/i;
const SECRET_LIKE_PATTERN = /(?:^|[^a-z0-9])(?:bearer\s+|eyJ[a-z0-9_-]{8,}\.|sk-[a-z0-9_-]{8,}|xai-[a-z0-9_-]{8,})/i;

export type ModelCallOperation = typeof MODEL_CALL_OPERATIONS[number];
export type ModelCallProvider = typeof MODEL_CALL_PROVIDERS[number];
export type ModelCallErrorClass = typeof MODEL_CALL_ERROR_CLASSES[number];

export interface ModelCallContext {
  jobId: string | null;
  requestId: string;
}

export interface ModelCallAttemptMeta {
  operation: ModelCallOperation;
  provider: ModelCallProvider;
  model: string;
  attempt: number;
}

export interface NormalizedProviderUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cacheHitTokens: number | null;
  cacheMissTokens: number | null;
  usageSource: 'provider' | 'unavailable';
}

export interface ModelCallLogInput {
  jobId: string | null;
  requestId: string;
  operation: ModelCallOperation;
  provider: ModelCallProvider;
  model: string;
  status: 'success' | 'error';
  errorClass: ModelCallErrorClass | null;
  latencyMs: number;
  attempt: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cacheHitTokens: number | null;
  cacheMissTokens: number | null;
  usageSource: 'provider' | 'unavailable';
}

interface ModelCallLogRow {
  job_id: string | null;
  request_id: string;
  operation: ModelCallOperation;
  provider: ModelCallProvider;
  model: string;
  status: 'success' | 'error';
  error_class: ModelCallErrorClass | null;
  latency_ms: number;
  attempt: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cache_hit_tokens: number | null;
  cache_miss_tokens: number | null;
  usage_source: 'provider' | 'unavailable';
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function isNullableNonNegativeInteger(value: unknown): value is number | null {
  return value === null
    || (Number.isSafeInteger(value) && (value as number) >= 0);
}

function invalidPayload(): never {
  throw new Error('Invalid model telemetry payload');
}

function toUsageToken(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? value as number
    : null;
}

export function normalizeProviderUsage(usage: unknown): NormalizedProviderUsage {
  const source = usage && typeof usage === 'object'
    ? usage as Record<string, unknown>
    : {};
  const normalized = {
    promptTokens: toUsageToken(source.prompt_tokens),
    completionTokens: toUsageToken(source.completion_tokens),
    totalTokens: toUsageToken(source.total_tokens),
    cacheHitTokens: toUsageToken(source.prompt_cache_hit_tokens),
    cacheMissTokens: toUsageToken(source.prompt_cache_miss_tokens),
  };

  return {
    ...normalized,
    usageSource: Object.values(normalized).every((value) => value === null)
      ? 'unavailable'
      : 'provider',
  };
}

export function classifyModelError(error: unknown): ModelCallErrorClass {
  if (error instanceof SyntaxError) return 'invalid_response';

  const details = error && typeof error === 'object'
    ? error as Record<string, unknown>
    : {};
  const status = typeof details.status === 'number' ? details.status : null;
  const code = typeof details.code === 'string' ? details.code.toLowerCase() : '';
  const message = typeof details.message === 'string' ? details.message.toLowerCase() : '';

  if (
    code === 'etimedout'
    || code === 'abort_err'
    || message.includes('timeout')
    || message.includes('timed out')
    || message.includes('aborted')
  ) return 'timeout';
  if (status === 429 || code.includes('rate_limit')) return 'rate_limited';
  if (status === 401 || status === 403 || code.includes('auth')) return 'authentication';
  if (
    status === 503
    || code === 'model_pending_deploy'
    || code === 'model_not_deployed'
    || message.includes('not ready for inference')
    || message.includes('not available for inference')
    || message.includes('unavailable')
  ) return 'unavailable';
  if (
    code.startsWith('econn')
    || code === 'enotfound'
    || code === 'ehostunreach'
    || message.includes('network')
  ) return 'network';
  if (
    message.includes('json')
    || message.includes('incomplete')
    || message.includes('invalid response')
    || message.includes('empty content')
  ) return 'invalid_response';
  if (status !== null && status >= 400 && status <= 599) return 'provider_error';
  return 'unknown';
}

function toModelCallRow(input: ModelCallLogInput): ModelCallLogRow {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalidPayload();

  const unknownKeys = Object.keys(input).filter((key) => !MODEL_CALL_INPUT_KEYS.has(key));
  if (unknownKeys.length > 0) invalidPayload();

  if (input.jobId !== null && !UUID_PATTERN.test(input.jobId)) invalidPayload();
  if (!UUID_PATTERN.test(input.requestId)) invalidPayload();
  if (!isOneOf(input.operation, MODEL_CALL_OPERATIONS)) invalidPayload();
  if (!isOneOf(input.provider, MODEL_CALL_PROVIDERS)) invalidPayload();
  if (!MODEL_PATTERN.test(input.model) || SECRET_LIKE_PATTERN.test(input.model)) invalidPayload();
  if (input.status !== 'success' && input.status !== 'error') invalidPayload();
  if (input.status === 'success' && input.errorClass !== null) invalidPayload();
  if (
    input.status === 'error'
    && !isOneOf(input.errorClass, MODEL_CALL_ERROR_CLASSES)
  ) invalidPayload();
  if (!Number.isSafeInteger(input.latencyMs) || input.latencyMs < 0 || input.latencyMs > 2_147_483_647) invalidPayload();
  if (!Number.isSafeInteger(input.attempt) || input.attempt < 1 || input.attempt > 32_767) invalidPayload();

  const usageValues = [
    input.promptTokens,
    input.completionTokens,
    input.totalTokens,
    input.cacheHitTokens,
    input.cacheMissTokens,
  ];
  if (!usageValues.every(isNullableNonNegativeInteger)) invalidPayload();
  if (input.usageSource !== 'provider' && input.usageSource !== 'unavailable') invalidPayload();
  if (input.usageSource === 'unavailable' && usageValues.some((value) => value !== null)) invalidPayload();
  if (input.usageSource === 'provider' && usageValues.every((value) => value === null)) invalidPayload();

  return {
    job_id: input.jobId,
    request_id: input.requestId,
    operation: input.operation,
    provider: input.provider,
    model: input.model,
    status: input.status,
    error_class: input.errorClass,
    latency_ms: input.latencyMs,
    attempt: input.attempt,
    prompt_tokens: input.promptTokens,
    completion_tokens: input.completionTokens,
    total_tokens: input.totalTokens,
    cache_hit_tokens: input.cacheHitTokens,
    cache_miss_tokens: input.cacheMissTokens,
    usage_source: input.usageSource,
  };
}

/** Record a server-owned daily activity event. The database derives the HK date. */
export async function recordAppActivity(userId: string): Promise<void> {
  if (!UUID_PATTERN.test(userId)) throw new Error('Invalid activity user');

  const { error } = await getTrustedSupabase().rpc('record_app_activity', {
    _user_id: userId,
  });

  if (error) throw new Error('Failed to record app activity');
}

/**
 * Best-effort model-attempt telemetry for D5 callers.
 * Invalid programmer input fails loudly; database/timeout failures return false.
 */
export async function recordModelCall(input: ModelCallLogInput): Promise<boolean> {
  const row = toModelCallRow(input);

  let write: Promise<boolean>;
  try {
    const db = getTrustedSupabase();
    write = Promise.resolve(db.from('model_call_logs').insert(row)).then(
      ({ error }) => error === null,
      () => false,
    );
  } catch {
    return false;
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<boolean>((resolve) => {
    timeout = setTimeout(() => resolve(false), MODEL_CALL_LOG_TIMEOUT_MS);
  });

  try {
    return await Promise.race([write, timedOut]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** Observe one provider attempt without ever changing its business result. */
export async function observeModelAttempt<T>(
  context: ModelCallContext | undefined,
  meta: ModelCallAttemptMeta,
  run: (captureUsage: (usage: unknown) => void) => Promise<T>,
): Promise<T> {
  if (!context) return run(() => undefined);

  const startedAt = Date.now();
  let providerUsage: unknown;
  const captureUsage = (usage: unknown): void => {
    providerUsage = usage;
  };

  try {
    const value = await run(captureUsage);
    try {
      await recordModelCall({
        ...context,
        ...meta,
        status: 'success',
        errorClass: null,
        latencyMs: Math.max(0, Date.now() - startedAt),
        ...normalizeProviderUsage(providerUsage),
      });
    } catch {
      // Telemetry is best-effort and must never alter the provider result.
    }
    return value;
  } catch (error) {
    try {
      await recordModelCall({
        ...context,
        ...meta,
        status: 'error',
        errorClass: classifyModelError(error),
        latencyMs: Math.max(0, Date.now() - startedAt),
        ...normalizeProviderUsage(providerUsage),
      });
    } catch {
      // Preserve the original provider error even if telemetry validation fails.
    }
    throw error;
  }
}
