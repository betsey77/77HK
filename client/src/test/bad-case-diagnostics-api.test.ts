import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

vi.mock('../services/supabase', () => ({
  supabase: { auth: { getSession: mockGetSession } },
}));

import {
  formatDiagnosticsRate,
  formatTokenCostDisplay,
  getBadCaseDiagnostics,
  userFacingDiagnosticsError,
} from '../services/badCaseDiagnosticsApi';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validFixture(overrides: Record<string, unknown> = {}) {
  const base = {
    from: '2026-06-22',
    to: '2026-07-22',
    summary: {
      categoryDistribution: {
        total: 3,
        byCategory: {
          content_quality: { count: 2, share: 0.6667 },
          compliance: { count: 1, share: 0.3333 },
          model_transport: { count: 0, share: 0 },
        },
      },
      recurrence: {
        totalFindings: 3,
        sampleRecurrenceRate: 0.6667,
        categoryRecurrenceRate: 0.5,
        duplicateSampleCount: 1,
      },
      dispositionRates: {
        total: 3,
        reviewed: 2,
        reviewCoverage: 0.6667,
        confirmationRate: 0.5,
        falsePositiveRate: 0.5,
      },
      criterionCoverage: {
        total: 4,
        evaluated: 3,
        notEvaluated: 1,
        evaluatedRate: 0.75,
        notEvaluatedRate: 0.25,
        failRateAmongEvaluated: 0.3333,
      },
      resolutionLatency: {
        sampleSize: 2,
        p50Ms: 3_600_000,
        p95Ms: 86_400_000,
        invalidCount: 1,
      },
      tokenCost: {
        costStatus: 'partial' as const,
        sumCny: 0.12,
        okCount: 1,
        unavailableCount: 1,
        sampleSize: 2,
      },
    },
  };
  return { ...base, ...overrides, summary: { ...base.summary, ...(overrides.summary as object | undefined) } };
}

describe('E7 bad-case diagnostics API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'session-jwt' } },
      error: null,
    });
  });

  it('uses authenticated GET for diagnostics with optional from/to query', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(validFixture())));

    const result = await getBadCaseDiagnostics({ from: '2026-06-22', to: '2026-07-22' });

    expect(result.from).toBe('2026-06-22');
    expect(result.summary.recurrence.duplicateSampleCount).toBe(1);
    expect(result.summary.tokenCost?.costStatus).toBe('partial');

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain('/api/admin/bad-case-review-packs/diagnostics');
    expect(String(url)).toContain('from=2026-06-22');
    expect(String(url)).toContain('to=2026-07-22');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer session-jwt');
  });

  it('maps 403 to FORBIDDEN and never surfaces raw server bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"error":"internal secret stack"}', { status: 403 })),
    );
    await expect(getBadCaseDiagnostics()).rejects.toThrow('FORBIDDEN');
    await expect(getBadCaseDiagnostics()).rejects.not.toThrow(/secret stack/);
  });

  it('maps 401/404 to stable codes without raw body leak', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(new Response('{"error":"nope"}', { status: 401 }))
        .mockResolvedValueOnce(new Response('{"error":"missing route"}', { status: 404 })),
    );
    await expect(getBadCaseDiagnostics()).rejects.toThrow('UNAUTHORIZED');
    await expect(getBadCaseDiagnostics()).rejects.toThrow('NOT_FOUND');
  });

  it('preserves null rates and legal zero rates after parse', async () => {
    const body = validFixture({
      summary: {
        recurrence: {
          totalFindings: 0,
          sampleRecurrenceRate: null,
          categoryRecurrenceRate: null,
          duplicateSampleCount: 0,
        },
        dispositionRates: {
          total: 3,
          reviewed: 0,
          reviewCoverage: 0,
          confirmationRate: null,
          falsePositiveRate: null,
        },
        tokenCost: null,
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)));

    const result = await getBadCaseDiagnostics();
    expect(result.summary.recurrence.sampleRecurrenceRate).toBeNull();
    expect(result.summary.dispositionRates.reviewCoverage).toBe(0);
    expect(result.summary.dispositionRates.confirmationRate).toBeNull();
    expect(result.summary.tokenCost).toBeNull();
  });

  it('accepts tokenCost ok/partial/unavailable and rejects unavailable with sumCny 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(validFixture({
          summary: {
            tokenCost: {
              costStatus: 'ok',
              sumCny: 0,
              okCount: 1,
              unavailableCount: 0,
              sampleSize: 1,
            },
          },
        })))
        .mockResolvedValueOnce(jsonResponse(validFixture({
          summary: {
            tokenCost: {
              costStatus: 'unavailable',
              sumCny: null,
              okCount: 0,
              unavailableCount: 2,
              sampleSize: 2,
            },
          },
        })))
        .mockResolvedValueOnce(jsonResponse(validFixture({
          summary: {
            tokenCost: {
              costStatus: 'unavailable',
              sumCny: 0,
              okCount: 0,
              unavailableCount: 1,
              sampleSize: 1,
            },
          },
        }))),
    );

    const ok = await getBadCaseDiagnostics();
    expect(ok.summary.tokenCost?.sumCny).toBe(0);

    const unavailable = await getBadCaseDiagnostics();
    expect(unavailable.summary.tokenCost?.costStatus).toBe('unavailable');
    expect(unavailable.summary.tokenCost?.sumCny).toBeNull();

    await expect(getBadCaseDiagnostics()).rejects.toThrow(/invalid diagnostics response/i);
  });

  it('rejects invalid payloads with invalid diagnostics response prefix', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(jsonResponse({ to: '2026-07-22', summary: {} }))
        .mockResolvedValueOnce(jsonResponse(validFixture({
          summary: {
            recurrence: {
              totalFindings: 1,
              sampleRecurrenceRate: '0.5',
              categoryRecurrenceRate: null,
              duplicateSampleCount: 0,
            },
          },
        })))
        .mockResolvedValueOnce(jsonResponse(validFixture({
          summary: {
            tokenCost: {
              costStatus: 'ok',
              sumCny: null,
              okCount: 1,
              unavailableCount: 0,
              sampleSize: 1,
            },
          },
        }))),
    );

    await expect(getBadCaseDiagnostics()).rejects.toThrow(/invalid diagnostics response/i);
    await expect(getBadCaseDiagnostics()).rejects.toThrow(/invalid diagnostics response/i);
    await expect(getBadCaseDiagnostics()).rejects.toThrow(/invalid diagnostics response/i);
  });

  it('format helpers distinguish null rate, legal 0%, and cost unavailable vs money', () => {
    expect(formatDiagnosticsRate(null)).toBe('暂无样本');
    expect(formatDiagnosticsRate(0)).toBe('0%');
    expect(formatDiagnosticsRate(0.6667)).toMatch(/66\.7%/);

    expect(formatTokenCostDisplay(null).label).toBe('暂不可估算');
    expect(formatTokenCostDisplay(null).kind).toBe('unavailable');
    expect(formatTokenCostDisplay({
      costStatus: 'unavailable',
      sumCny: null,
      okCount: 0,
      unavailableCount: 1,
      sampleSize: 1,
    }).label).toBe('暂不可估算');
    expect(formatTokenCostDisplay({
      costStatus: 'unavailable',
      sumCny: null,
      okCount: 0,
      unavailableCount: 1,
      sampleSize: 1,
    }).label).not.toMatch(/¥|￥|0/);

    const money = formatTokenCostDisplay({
      costStatus: 'partial',
      sumCny: 0.12,
      okCount: 1,
      unavailableCount: 1,
      sampleSize: 2,
    });
    expect(money.kind).toBe('money');
    expect(money.label).toMatch(/0\.12/);

    const zero = formatTokenCostDisplay({
      costStatus: 'ok',
      sumCny: 0,
      okCount: 1,
      unavailableCount: 0,
      sampleSize: 1,
    });
    expect(zero.kind).toBe('money');
    expect(zero.label).toMatch(/0/);
  });

  it('userFacingDiagnosticsError never echoes raw codes as secrets and maps known codes', () => {
    expect(userFacingDiagnosticsError(new Error('FORBIDDEN'))).toBe('无超级管理员权限');
    expect(userFacingDiagnosticsError(new Error('UNAUTHORIZED'))).toBe('请先登录');
    expect(userFacingDiagnosticsError(new Error('NOT_FOUND'))).toBe('资源不存在或不可用');
    expect(userFacingDiagnosticsError(new Error('invalid diagnostics response: summary'))).toBe(
      '加载失败，请重试',
    );
    expect(userFacingDiagnosticsError(new Error('internal secret stack'))).toBe('加载失败，请重试');
    expect(userFacingDiagnosticsError(new Error('internal secret stack'))).not.toMatch(/secret/);
  });
});

