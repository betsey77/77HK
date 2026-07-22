import { describe, expect, it } from 'vitest';
import {
  BAD_CASE_SCORE_THRESHOLD,
  CRITERIA_VERSION,
  evaluateBadCaseCriteria,
  hasCriticalCriteriaFailure,
  type CriteriaJobSnapshot,
} from '../services/badCaseCriteria.js';

const VARIANT_KEYS = ['standardHK', 'lightCantonese', 'ig', 'facebook', 'shorts'] as const;

function fullVariants(overrides: Partial<Record<(typeof VARIANT_KEYS)[number], string>> = {}) {
  return {
    standardHK: '标准港式文案',
    lightCantonese: '轻粤语文案',
    ig: 'IG 文案',
    facebook: 'FB 文案',
    shorts: '短视频文案',
    ...overrides,
  };
}

function baseJob(overrides: Partial<CriteriaJobSnapshot> = {}): CriteriaJobSnapshot {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    ownerId: '22222222-2222-4222-8222-222222222222',
    status: 'completed',
    deletedAt: null,
    brandRedLines: null,
    productSellingPoints: [],
    variants: fullVariants(),
    audit: {
      risks: [],
      issues: [],
    },
    scores: {
      generated: {
        cantoneseNaturalness: 70,
        brandSafety: 80,
        platformFit: 70,
        readability: 70,
        creativity: 60,
        hookStrength: 60,
        emojiHashtagFit: 60,
        engagementPotential: 60,
        total: 72,
      },
      source: null,
    },
    errorCode: null,
    ...overrides,
  };
}

function byId(evaluations: ReturnType<typeof evaluateBadCaseCriteria>, id: string) {
  const hit = evaluations.find((e) => e.criterionId === id);
  expect(hit, `missing criterion ${id}`).toBeTruthy();
  return hit!;
}

describe('badCaseCriteria versioned acceptance engine', () => {
  it('pins criteria version and score threshold constants', () => {
    expect(CRITERIA_VERSION).toBe('1.0.0');
    expect(BAD_CASE_SCORE_THRESHOLD).toBe(50);
  });

  it('fails score.total_threshold when total is below 50 with score evidence', () => {
    const evaluations = evaluateBadCaseCriteria(
      baseJob({
        scores: {
          generated: {
            cantoneseNaturalness: 40,
            brandSafety: 40,
            platformFit: 40,
            readability: 40,
            creativity: 40,
            hookStrength: 40,
            emojiHashtagFit: 40,
            engagementPotential: 40,
            total: 49,
          },
          source: null,
        },
      }),
    );
    const total = byId(evaluations, 'score.total_threshold');
    expect(total.status).toBe('fail');
    expect(total.critical).toBe(true);
    expect(total.version).toBe(CRITERIA_VERSION);
    expect(total.evidenceRefs.length).toBeGreaterThan(0);
    expect(total.evidenceRefs[0]).toMatchObject({
      type: 'score_path',
      path: 'scores.generated.total',
      value: 49,
    });
  });

  it('passes total threshold at exactly 50', () => {
    const evaluations = evaluateBadCaseCriteria(
      baseJob({
        scores: {
          generated: {
            cantoneseNaturalness: 50,
            brandSafety: 50,
            platformFit: 50,
            readability: 50,
            creativity: 50,
            hookStrength: 50,
            emojiHashtagFit: 50,
            engagementPotential: 50,
            total: 50,
          },
          source: null,
        },
      }),
    );
    expect(byId(evaluations, 'score.total_threshold').status).toBe('pass');
  });

  it('marks total threshold not_evaluated when scores are missing', () => {
    const evaluations = evaluateBadCaseCriteria(baseJob({ scores: null }));
    const total = byId(evaluations, 'score.total_threshold');
    expect(total.status).toBe('not_evaluated');
    expect(total.evidenceRefs).toEqual([]);
  });

  it('fails generation success only for failed status', () => {
    expect(byId(evaluateBadCaseCriteria(baseJob({ status: 'completed' })), 'runtime.generation_success').status).toBe(
      'pass',
    );
    const failed = byId(
      evaluateBadCaseCriteria(baseJob({ status: 'failed', variants: null, scores: null, audit: null })),
      'runtime.generation_success',
    );
    expect(failed.status).toBe('fail');
    expect(failed.critical).toBe(true);
    expect(failed.evidenceRefs.some((e) => e.type === 'job_field' && e.path === 'status')).toBe(true);

    expect(
      byId(evaluateBadCaseCriteria(baseJob({ status: 'processing' })), 'runtime.generation_success').status,
    ).toBe('not_evaluated');
  });

  it('does not invent selling-point failures without a deterministic matcher', () => {
    const withPoints = evaluateBadCaseCriteria(
      baseJob({
        productSellingPoints: [{ id: 'sp-1', sourceText: '鮮甜', cantoneseText: '鮮甜' }],
      }),
    );
    expect(byId(withPoints, 'content.selling_points_reflected').status).toBe('not_evaluated');

    const noPoints = evaluateBadCaseCriteria(baseJob({ productSellingPoints: [] }));
    expect(byId(noPoints, 'content.selling_points_reflected').status).toBe('pass');
  });

  it('fails compliance on red risks and not_evaluated when audit is absent', () => {
    const red = evaluateBadCaseCriteria(
      baseJob({
        audit: {
          risks: [{ level: 'red', description: '夸大疗效' }],
          issues: [],
        },
      }),
    );
    const compliance = byId(red, 'compliance.redlines_and_risks');
    expect(compliance.status).toBe('fail');
    expect(compliance.evidenceRefs[0]).toMatchObject({ type: 'audit_risk', index: 0, level: 'red' });

    const missing = evaluateBadCaseCriteria(baseJob({ audit: null }));
    expect(byId(missing, 'compliance.redlines_and_risks').status).toBe('not_evaluated');

    const unknownShape = evaluateBadCaseCriteria(baseJob({
      audit: {},
      scores: { generated: { total: 72 } },
    }));
    expect(byId(unknownShape, 'compliance.redlines_and_risks').status).toBe('not_evaluated');
  });

  it('checks five-platform completeness only when completed', () => {
    const incomplete = evaluateBadCaseCriteria(
      baseJob({ variants: fullVariants({ shorts: '' }) }),
    );
    const incompleteEval = byId(incomplete, 'output.variants_complete');
    expect(incompleteEval.status).toBe('fail');
    expect(incompleteEval.critical).toBe(true);
    expect(incompleteEval.evidenceRefs[0]).toMatchObject({ type: 'variant_presence' });

    const failedJob = evaluateBadCaseCriteria(
      baseJob({ status: 'failed', variants: null, scores: null, audit: null }),
    );
    expect(byId(failedJob, 'output.variants_complete').status).toBe('not_evaluated');
  });

  it('reports critical failure only for actual fail results', () => {
    const low = evaluateBadCaseCriteria(
      baseJob({
        scores: {
          generated: {
            cantoneseNaturalness: 40,
            brandSafety: 40,
            platformFit: 40,
            readability: 40,
            creativity: 40,
            hookStrength: 40,
            emojiHashtagFit: 40,
            engagementPotential: 40,
            total: 40,
          },
          source: null,
        },
      }),
    );
    expect(hasCriticalCriteriaFailure(low)).toBe(true);

    const ok = evaluateBadCaseCriteria(baseJob({ scores: null }));
    expect(hasCriticalCriteriaFailure(ok)).toBe(false);
  });

  it('covers the required minimum criterion set', () => {
    const ids = evaluateBadCaseCriteria(baseJob()).map((e) => e.criterionId);
    expect(ids).toEqual(
      expect.arrayContaining([
        'score.total_threshold',
        'runtime.generation_success',
        'content.selling_points_reflected',
        'compliance.redlines_and_risks',
        'output.variants_complete',
      ]),
    );
  });
});
