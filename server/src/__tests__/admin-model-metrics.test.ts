import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = { from: vi.fn() };

vi.mock('../services/trustedSupabase.js', () => ({
  getTrustedSupabase: () => mockDb,
}));

import {
  getAdminBadCaseModelAttempts,
  getAdminBadCases,
  getAdminModelMetrics,
} from '../services/adminMetricsService.js';

type Row = Record<string, unknown>;

function makeDatabase(tables: Record<string, Row[]>) {
  mockDb.from.mockImplementation((table: string) => {
    const filters: Array<[string, string, unknown]> = [];
    let selected = '';
    const query = {
      select(fields: string) { selected = fields; return query; },
      gte(field: string, value: unknown) { filters.push(['gte', field, value]); return query; },
      lt(field: string, value: unknown) { filters.push(['lt', field, value]); return query; },
      is(field: string, value: unknown) { filters.push(['is', field, value]); return query; },
      eq(field: string, value: unknown) { filters.push(['eq', field, value]); return query; },
      order() { return query; },
      async limit(limit: number) {
        const rows = (tables[table] ?? [])
          .filter((row) => filters.every(([operator, field, expected]) => {
            const actual = row[field];
            if (operator === 'eq') return actual === expected;
            return true;
          }))
          .slice(0, limit)
          .map((row) => Object.fromEntries(
            selected.split(',').map((field) => field.trim()).filter(Boolean).map((field) => [field, row[field]]),
          ));
        return { data: rows, error: null };
      },
      async range(start: number, end: number) {
        const rows = (tables[table] ?? [])
          .filter((row) => filters.every(([operator, field, expected]) => {
            const actual = row[field];
            if (operator === 'gte') return String(actual) >= String(expected);
            if (operator === 'lt') return String(actual) < String(expected);
            if (operator === 'is') return actual === expected;
            if (operator === 'eq') return actual === expected;
            return false;
          }))
          .slice(start, end + 1)
          .map((row) => Object.fromEntries(
            selected.split(',').map((field) => field.trim()).filter(Boolean).map((field) => [field, row[field]]),
          ));
        return { data: rows, error: null };
      },
    };
    return query;
  });
}

const RANGE = { from: '2026-07-01', to: '2026-07-19' } as const;

describe('D6b model metrics aggregation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aggregates every provider attempt, official token fields, errors and nearest-rank p95', async () => {
    makeDatabase({
      model_call_logs: [
        { created_at: '2026-07-10T00:00:00Z', provider: 'deepseek', model: 'v4', status: 'success', latency_ms: 100, prompt_tokens: 10, completion_tokens: 4, total_tokens: 14, cache_hit_tokens: null, cache_miss_tokens: 10, usage_source: 'provider' },
        { created_at: '2026-07-11T00:00:00Z', provider: 'deepseek', model: 'v4', status: 'error', latency_ms: 300, prompt_tokens: null, completion_tokens: null, total_tokens: null, cache_hit_tokens: null, cache_miss_tokens: null, usage_source: 'unavailable' },
        { created_at: '2026-07-12T00:00:00Z', provider: 'deepseek', model: 'v4', status: 'success', latency_ms: 200, prompt_tokens: 20, completion_tokens: 5, total_tokens: 25, cache_hit_tokens: 2, cache_miss_tokens: 18, usage_source: 'provider' },
        { created_at: '2026-07-13T00:00:00Z', provider: 'featherless', model: 'canto', status: 'success', latency_ms: 50, prompt_tokens: null, completion_tokens: null, total_tokens: '7', cache_hit_tokens: null, cache_miss_tokens: null, usage_source: 'provider' },
      ],
    });

    const result = await getAdminModelMetrics(RANGE);

    expect(result.rows).toEqual([
      {
        provider: 'deepseek', model: 'v4', total: 3, success: 2, error: 1,
        errorRate: 0.3333, avgLatencyMs: 200, p95LatencyMs: 300,
        promptTokens: 30, completionTokens: 9, totalTokens: 39,
        cacheHitTokens: 2, cacheMissTokens: 28, unavailableUsageCount: 1,
      },
      {
        provider: 'featherless', model: 'canto', total: 1, success: 1, error: 0,
        errorRate: 0, avgLatencyMs: 50, p95LatencyMs: 50,
        promptTokens: 0, completionTokens: 0, totalTokens: 7,
        cacheHitTokens: 0, cacheMissTokens: 0, unavailableUsageCount: 0,
      },
    ]);
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(/"prompt"|"response"|"email"|"jwt"|"api_key"|"raw_error"/);
  });

  it('returns an empty aggregate without inventing latency or token usage', async () => {
    makeDatabase({ model_call_logs: [] });
    await expect(getAdminModelMetrics(RANGE)).resolves.toEqual({ ...RANGE, rows: [] });
  });
});

describe('D6c bad-case model attempts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only diagnosis-safe attempt metadata for the full job id', async () => {
    makeDatabase({
      model_call_logs: [{
        job_id: '7f177000-0000-4000-8000-000000000001',
        created_at: '2026-07-18T03:00:05Z', operation: 'generate', provider: 'deepseek', model: 'v4',
        status: 'error', error_class: 'timeout', latency_ms: 51000, attempt: 1,
        prompt_tokens: null, completion_tokens: null, total_tokens: null,
        cache_hit_tokens: null, cache_miss_tokens: null, usage_source: 'unavailable',
        request_id: 'must-not-leak', prompt: 'must-not-leak', raw_error: 'must-not-leak',
      }],
    });

    const result = await getAdminBadCaseModelAttempts('7f177000-0000-4000-8000-000000000001');

    expect(result).toEqual({
      status: 'available',
      items: [{
        createdAt: '2026-07-18T03:00:05Z', operation: 'generate', provider: 'deepseek', model: 'v4',
        status: 'error', errorClass: 'timeout', latencyMs: 51000, attempt: 1,
        promptTokens: null, completionTokens: null, totalTokens: null,
        cacheHitTokens: null, cacheMissTokens: null, usageSource: 'unavailable',
      }],
    });
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(/request_id|"prompt"|raw_error|must-not-leak/);
  });

  it('returns an unavailable log section when D4 telemetry is not ready', async () => {
    mockDb.from.mockImplementation(() => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: async () => ({ data: null, error: { code: 'table_missing' } }),
      };
      return query;
    });

    await expect(getAdminBadCaseModelAttempts('7f177000-0000-4000-8000-000000000001'))
      .resolves.toEqual({ status: 'unavailable', items: [] });
  });
});

describe('D6b bad-case projection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses generated.total < 50, excludes soft-deleted/missing scores and returns allowlisted metadata only', async () => {
    makeDatabase({
      generation_jobs: [
        { id: 'bad-49', scores: { generated: { total: 49 }, source: { total: 10 } }, platform: 'ig', tone: '生鬼', generation_engine: 'deepseek', created_at: '2026-07-12T00:00:00Z', completed_at: '2026-07-12T00:01:00Z', deleted_at: null },
        { id: 'edge-50', scores: { generated: { total: 50 } }, platform: 'all', tone: '穩妥', generation_engine: 'deepseek', created_at: '2026-07-12T00:00:00Z', completed_at: null, deleted_at: null },
        { id: 'missing', scores: null, platform: 'all', tone: '穩妥', generation_engine: null, created_at: '2026-07-12T00:00:00Z', completed_at: null, deleted_at: null },
        { id: 'deleted', scores: { generated: { total: 1 } }, platform: 'ig', tone: '生鬼', generation_engine: 'deepseek', created_at: '2026-07-12T00:00:00Z', completed_at: null, deleted_at: '2026-07-13T00:00:00Z' },
      ],
    });

    const result = await getAdminBadCases(RANGE);
    expect(result).toEqual({
      ...RANGE,
      threshold: 50,
      items: [{
        id: 'bad-49', score: 49, platform: 'ig', tone: '生鬼',
        generationEngine: 'deepseek', createdAt: '2026-07-12T00:00:00Z',
        completedAt: '2026-07-12T00:01:00Z',
      }],
    });
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(/scores|source|variants|owner|email|prompt/);
  });

  it('sorts by lowest score then newest timestamp and caps output at 20', async () => {
    makeDatabase({
      generation_jobs: Array.from({ length: 25 }, (_, index) => ({
        id: `job-${index}`,
        scores: { generated: { total: index % 4 } },
        platform: 'all', tone: '穩妥', generation_engine: 'deepseek',
        created_at: `2026-07-${String((index % 18) + 1).padStart(2, '0')}T00:00:00Z`,
        completed_at: null, deleted_at: null,
      })),
    });
    const result = await getAdminBadCases(RANGE);
    expect(result.items).toHaveLength(20);
    expect(result.items.map((item) => item.score)).toEqual([...result.items.map((item) => item.score)].sort((a, b) => a - b));
  });
});
