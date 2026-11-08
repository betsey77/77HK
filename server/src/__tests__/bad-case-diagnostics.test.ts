import { describe, expect, it } from 'vitest';
import {
  aggregateTokenCost,
  computeCategoryDistribution,
  computeCriterionCoverage,
  computeFindingDispositionRates,
  computeResolutionLatency,
  computeSameCategoryRecurrence,
  estimateAttemptCostCny,
  type DiagnosticCriterionRow,
  type DiagnosticFindingRow,
  type DiagnosticPackRow,
  type PriceTable,
  type TokenUsageRow,
} from '../services/badCaseDiagnosticsService.js';

const PRICE_TABLE: PriceTable = {
  version: 'fixture-2026-07-22',
  entries: [
    {
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      priceVersion: '2026-07-22',
      currency: 'CNY',
      unit: 1_000_000,
      inputCacheHitCnyPerMTok: 0.02,
      inputCacheMissCnyPerMTok: 1,
      outputCnyPerMTok: 2,
      effectiveFrom: '2026-07-01T00:00:00.000Z',
      effectiveTo: null,
    },
  ],
};

function finding(
  partial: Partial<DiagnosticFindingRow> & Pick<DiagnosticFindingRow, 'findingId' | 'category'>,
): DiagnosticFindingRow {
  return {
    reviewPackId: 'pack-1',
    disposition: null,
    reviewedAt: null,
    createdAt: '2026-07-20T00:00:00.000Z',
    ...partial,
  };
}

describe('badCaseDiagnosticsService (E7)', () => {
  describe('category distribution', () => {
    it('returns null shares when denominator is zero', () => {
      const result = computeCategoryDistribution([]);
      expect(result.total).toBe(0);
      expect(result.byCategory.content_quality.share).toBeNull();
      expect(result.byCategory.content_quality.count).toBe(0);
    });

    it('computes shares with full category keys', () => {
      const result = computeCategoryDistribution([
        finding({ findingId: 'f1', category: 'content_quality' }),
        finding({ findingId: 'f2', category: 'content_quality' }),
        finding({ findingId: 'f3', category: 'compliance' }),
      ]);
      expect(result.total).toBe(3);
      expect(result.byCategory.content_quality.count).toBe(2);
      expect(result.byCategory.content_quality.share).toBe(0.6667);
      expect(result.byCategory.compliance.share).toBe(0.3333);
      expect(result.byCategory.model_transport.count).toBe(0);
      expect(result.byCategory.model_transport.share).toBe(0);
    });
  });

  describe('same-category recurrence', () => {
    it('reports sample and category recurrence plus duplicate sample count', () => {
      const result = computeSameCategoryRecurrence([
        finding({ findingId: 'a1', category: 'content_quality' }),
        finding({ findingId: 'a2', category: 'content_quality' }),
        finding({ findingId: 'a3', category: 'content_quality' }),
        finding({ findingId: 'b1', category: 'compliance' }),
      ]);

      expect(result.totalFindings).toBe(4);
      expect(result.sampleRecurrenceRate).toBe(0.75); // 3/4
      expect(result.categoryRecurrenceRate).toBe(0.5); // 1/2 categories recurrent
      expect(result.duplicateSampleCount).toBe(2); // max(0,3-1)+max(0,1-1)
    });

    it('returns null rates for empty findings but keeps duplicate count at 0', () => {
      const result = computeSameCategoryRecurrence([]);
      expect(result.sampleRecurrenceRate).toBeNull();
      expect(result.categoryRecurrenceRate).toBeNull();
      expect(result.duplicateSampleCount).toBe(0);
    });
  });

  describe('finding disposition rates', () => {
    it('uses reviewed set as denominator; null when no reviews', () => {
      const unreviewed = computeFindingDispositionRates([
        finding({ findingId: 'f1', category: 'content_quality' }),
        finding({ findingId: 'f2', category: 'compliance' }),
        finding({ findingId: 'f3', category: 'prompt_instruction' }),
      ]);
      expect(unreviewed.reviewCoverage).toBe(0);
      expect(unreviewed.confirmationRate).toBeNull();
      expect(unreviewed.falsePositiveRate).toBeNull();

      const mixed = computeFindingDispositionRates([
        finding({
          findingId: 'c1',
          category: 'content_quality',
          disposition: 'confirmed',
          reviewedAt: '2026-07-21T00:00:00.000Z',
        }),
        finding({
          findingId: 'c2',
          category: 'content_quality',
          disposition: 'confirmed',
          reviewedAt: '2026-07-21T00:00:00.000Z',
        }),
        finding({
          findingId: 'fp1',
          category: 'compliance',
          disposition: 'false_positive',
          reviewedAt: '2026-07-21T00:00:00.000Z',
        }),
      ]);
      expect(mixed.confirmationRate).toBe(0.6667);
      expect(mixed.falsePositiveRate).toBe(0.3333);
      expect(mixed.reviewCoverage).toBe(1);
    });

    it('returns all null rates when findings empty (not fake zeros for confirmation)', () => {
      const empty = computeFindingDispositionRates([]);
      expect(empty.reviewCoverage).toBeNull();
      expect(empty.confirmationRate).toBeNull();
      expect(empty.falsePositiveRate).toBeNull();
    });
  });

  describe('criterion coverage', () => {
    it('separates not_evaluated from evaluated and nulls empty denominator', () => {
      expect(computeCriterionCoverage([]).evaluatedRate).toBeNull();
      expect(computeCriterionCoverage([]).notEvaluatedRate).toBeNull();

      const rows: DiagnosticCriterionRow[] = [
        { reviewPackId: 'p1', criterionId: 'c1', result: 'pass' },
        { reviewPackId: 'p1', criterionId: 'c2', result: 'fail' },
        { reviewPackId: 'p1', criterionId: 'c3', result: 'not_evaluated' },
        { reviewPackId: 'p1', criterionId: 'c4', result: 'not_evaluated' },
      ];
      const cov = computeCriterionCoverage(rows);
      expect(cov.evaluatedRate).toBe(0.5);
      expect(cov.notEvaluatedRate).toBe(0.5);
      expect(cov.failRateAmongEvaluated).toBe(0.5);
    });
  });

  describe('resolution latency', () => {
    it('returns null p50/p95 when no resolved packs', () => {
      const packs: DiagnosticPackRow[] = [
        {
          reviewPackId: 'p1',
          generationJobId: 'j1',
          createdAt: '2026-07-20T00:00:00.000Z',
          firstAssignedAt: null,
          resolvedAt: null,
          status: 'open',
          categories: ['content_quality'],
        },
      ];
      const result = computeResolutionLatency(packs);
      expect(result.sampleSize).toBe(0);
      expect(result.p50Ms).toBeNull();
      expect(result.p95Ms).toBeNull();
    });

    it('computes nearest-rank p50 and p95', () => {
      const base = Date.parse('2026-07-20T00:00:00.000Z');
      const packs: DiagnosticPackRow[] = [100, 200, 300, 400, 1000].map((ms, i) => ({
        reviewPackId: `p${i}`,
        generationJobId: `j${i}`,
        createdAt: new Date(base).toISOString(),
        firstAssignedAt: null,
        resolvedAt: new Date(base + ms).toISOString(),
        status: 'resolved',
        categories: ['content_quality'],
      }));
      const result = computeResolutionLatency(packs);
      expect(result.sampleSize).toBe(5);
      // nearest-rank: idx(0.5)=ceil(2.5)-1=2 → 300; idx(0.95)=ceil(4.75)-1=4 → 1000
      expect(result.p50Ms).toBe(300);
      expect(result.p95Ms).toBe(1000);
    });
  });

  describe('CNY cost estimation', () => {
    it('returns unavailable when price entry is missing', () => {
      const row: TokenUsageRow = {
        provider: 'deepseek',
        model: 'unknown-model',
        usageSource: 'provider',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cacheHitTokens: 20,
        cacheMissTokens: 80,
        priceVersion: '2026-07-22',
      };
      const result = estimateAttemptCostCny(row, PRICE_TABLE);
      expect(result.status).toBe('unavailable');
      if (result.status !== 'unavailable') throw new Error('expected unavailable');
      expect(result.reason).toBe('price_entry_missing');
      expect(result).not.toHaveProperty('cny');
    });

    it('returns unavailable when usage is incomplete', () => {
      const row: TokenUsageRow = {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        usageSource: 'unavailable',
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        cacheHitTokens: null,
        cacheMissTokens: null,
        priceVersion: '2026-07-22',
      };
      const result = estimateAttemptCostCny(row, PRICE_TABLE);
      expect(result.status).toBe('unavailable');
      if (result.status !== 'unavailable') throw new Error('expected unavailable');
      expect(result.reason).toBe('usage_unavailable');
    });

    it('computes CNY only with exact provider+model+priceVersion match and full tokens', () => {
      const row: TokenUsageRow = {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        usageSource: 'provider',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cacheHitTokens: 20,
        cacheMissTokens: 80,
        priceVersion: '2026-07-22',
      };
      const result = estimateAttemptCostCny(row, PRICE_TABLE);
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') throw new Error('expected ok');
      // 20/1e6*0.02 + 80/1e6*1 + 50/1e6*2 = 0.0001804 → micro-yuan round → 0.00018
      expect(result.cny).toBeCloseTo(0.00018, 10);
      expect(result.priceVersion).toBe('2026-07-22');
    });

    it('forbids balance-delta based estimation', () => {
      const row = {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        usageSource: 'provider' as const,
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cacheHitTokens: 20,
        cacheMissTokens: 80,
        priceVersion: '2026-07-22',
        balanceDeltaCny: 1.23,
      };
      const result = estimateAttemptCostCny(row as TokenUsageRow, PRICE_TABLE);
      expect(result.status).toBe('unavailable');
      if (result.status !== 'unavailable') throw new Error('expected unavailable');
      expect(result.reason).toBe('balance_delta_forbidden');
    });

    it('aggregates partial costs without faking full-bill zero', () => {
      const attempts: TokenUsageRow[] = [
        {
          provider: 'deepseek',
          model: 'deepseek-v4-flash',
          usageSource: 'provider',
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          cacheHitTokens: 20,
          cacheMissTokens: 80,
          priceVersion: '2026-07-22',
        },
        {
          provider: 'deepseek',
          model: 'deepseek-v4-flash',
          usageSource: 'unavailable',
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          cacheHitTokens: null,
          cacheMissTokens: null,
          priceVersion: '2026-07-22',
        },
      ];
      const agg = aggregateTokenCost(attempts, PRICE_TABLE);
      expect(agg.costStatus).toBe('partial');
      expect(agg.okCount).toBe(1);
      expect(agg.unavailableCount).toBe(1);
      expect(agg.sumCny).toBeCloseTo(0.00018, 10);

      const empty = aggregateTokenCost([], PRICE_TABLE);
      expect(empty.costStatus).toBe('unavailable');
      expect(empty.sumCny).toBeNull();
      expect(empty.sampleSize).toBe(0);
    });
  });
});
