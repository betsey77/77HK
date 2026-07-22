import { describe, expect, it } from 'vitest';
import {
  assembleReviewPackUpsert,
  type AssembleReviewPackInput,
} from '../services/badCaseReviewPackAssembler.js';
import { createLegacyUnavailableManifest } from '../services/generationArtifactManifest.js';
import { CRITERIA_VERSION } from '../services/badCaseCriteria.js';

const JOB_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function fullVariants() {
  return {
    standardHK: '标准港式文案',
    lightCantonese: '轻粤语文案',
    ig: 'IG 文案',
    facebook: 'FB 文案',
    shorts: '短视频文案',
  };
}

function baseInput(overrides: Partial<AssembleReviewPackInput> = {}): AssembleReviewPackInput {
  return {
    job: {
      id: JOB_ID,
      ownerId: OWNER_ID,
      status: 'completed',
      deletedAt: null,
      brandRedLines: null,
      productSellingPoints: [],
      variants: fullVariants(),
      audit: { risks: [], issues: [] },
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
      errorMessage: null,
      generationEngine: 'deepseek',
    },
    artifactManifest: createLegacyUnavailableManifest('pre_e1_job'),
    modelAttempts: { status: 'available', items: [] },
    manualFlag: null,
    ...overrides,
  };
}

describe('badCaseReviewPackAssembler deterministic triggers', () => {
  it('does not create a pack for a healthy completed job', () => {
    expect(assembleReviewPackUpsert(baseInput())).toBeNull();
  });

  it('creates a pack for total < 50 with low-score finding and artifact refs', () => {
    const result = assembleReviewPackUpsert(
      baseInput({
        job: {
          ...baseInput().job,
          scores: {
            generated: {
              cantoneseNaturalness: 30,
              brandSafety: 40,
              platformFit: 40,
              readability: 40,
              creativity: 30,
              hookStrength: 30,
              emojiHashtagFit: 30,
              engagementPotential: 30,
              total: 49,
            },
            source: null,
          },
        },
      }),
    );

    expect(result).not.toBeNull();
    expect(result!.pack.generationJobId).toBe(JOB_ID);
    expect(result!.pack.subjectOwnerId).toBe(OWNER_ID);
    expect(result!.pack.triggerKinds).toContain('score_below_threshold');
    expect(result!.pack.criteriaVersion).toBe(CRITERIA_VERSION);
    expect(result!.findings.length).toBeGreaterThan(0);
    for (const finding of result!.findings) {
      expect(finding.evidenceRefs.length).toBeGreaterThan(0);
      expect(finding.criterionRefs.length).toBeGreaterThan(0);
      expect(finding.artifactRefs.length).toBeGreaterThan(0);
      expect(finding.recommendedOwnerTeam).toBeTruthy();
    }
    expect(result!.event.eventType).toBe('pack_created');
  });

  it('creates a pack for failed generation without inventing score findings', () => {
    const result = assembleReviewPackUpsert(
      baseInput({
        job: {
          ...baseInput().job,
          status: 'failed',
          scores: null,
          variants: null,
          audit: null,
          errorCode: 'GENERATION_ERROR',
          errorMessage: 'provider boom sk-secret-key',
        },
        modelAttempts: {
          status: 'available',
          items: [
            {
              createdAt: '2026-07-22T01:00:00.000Z',
              operation: 'generate',
              provider: 'deepseek',
              model: 'deepseek-chat',
              status: 'error',
              errorClass: 'provider_error',
              latencyMs: 1200,
              attempt: 1,
              promptTokens: null,
              completionTokens: null,
              totalTokens: null,
              cacheHitTokens: null,
              cacheMissTokens: null,
              usageSource: 'unavailable',
            },
          ],
        },
      }),
    );

    expect(result).not.toBeNull();
    expect(result!.pack.triggerKinds).toContain('generation_failed');
    expect(result!.pack.triggerKinds).not.toContain('score_below_threshold');
    expect(result!.findings.every((f) => f.evidenceRefs.length > 0)).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/sk-secret-key/);
    expect(serialized).not.toMatch(/raw_error|jwt|cookie|apiKey|api_key/i);
    expect(serialized).not.toContain('provider boom sk-secret-key');
  });

  it('creates a pack for critical criteria failure even when score is 50+', () => {
    const result = assembleReviewPackUpsert(
      baseInput({
        job: {
          ...baseInput().job,
          scores: {
            generated: {
              cantoneseNaturalness: 70,
              brandSafety: 40,
              platformFit: 70,
              readability: 70,
              creativity: 60,
              hookStrength: 60,
              emojiHashtagFit: 60,
              engagementPotential: 60,
              total: 60,
            },
            source: null,
          },
          audit: {
            risks: [{ level: 'red', description: '医疗承诺' }],
            issues: [],
          },
        },
      }),
    );

    expect(result).not.toBeNull();
    expect(result!.pack.triggerKinds).toContain('criteria_failed');
    expect(result!.findings.some((f) => f.category === 'compliance')).toBe(true);
  });

  it('creates a pack for authenticated manual flag only', () => {
    const result = assembleReviewPackUpsert(
      baseInput({
        manualFlag: {
          actorId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          actorRole: 'super_admin',
          reason: 'spot check',
        },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.pack.triggerKinds).toEqual(['manual']);
    expect(result!.event.actorId).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  });

  it('ignores soft-deleted and non-terminal jobs', () => {
    expect(
      assembleReviewPackUpsert(
        baseInput({
          job: {
            ...baseInput().job,
            deletedAt: '2026-07-22T00:00:00.000Z',
            scores: {
              generated: {
                cantoneseNaturalness: 10,
                brandSafety: 10,
                platformFit: 10,
                readability: 10,
                creativity: 10,
                hookStrength: 10,
                emojiHashtagFit: 10,
                engagementPotential: 10,
                total: 10,
              },
              source: null,
            },
          },
        }),
      ),
    ).toBeNull();

    expect(
      assembleReviewPackUpsert(
        baseInput({
          job: { ...baseInput().job, status: 'pending' },
          manualFlag: {
            actorId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            actorRole: 'super_admin',
            reason: 'too early',
          },
        }),
      ),
    ).toBeNull();
  });

  it('does not emit findings for not_evaluated criteria', () => {
    const result = assembleReviewPackUpsert(
      baseInput({
        job: {
          ...baseInput().job,
          status: 'failed',
          scores: null,
          variants: null,
          audit: null,
          errorCode: 'GENERATION_ERROR',
          productSellingPoints: [{ id: 'sp-1', sourceText: '鮮甜', cantoneseText: '鮮甜' }],
        },
      }),
    );
    expect(result).not.toBeNull();
    const criterionIds = result!.criteria.map((c) => c.criterionId);
    expect(criterionIds).toContain('content.selling_points_reflected');
    expect(result!.criteria.find((c) => c.criterionId === 'content.selling_points_reflected')?.status).toBe(
      'not_evaluated',
    );
    expect(
      result!.findings.some((f) => f.criterionRefs.some((ref) => ref.startsWith('content.selling_points_reflected'))),
    ).toBe(false);
  });

  it('never trusts request-body actor/owner fields on the job snapshot', () => {
    const result = assembleReviewPackUpsert(
      baseInput({
        job: {
          ...baseInput().job,
          // @ts-expect-error intentional untrusted extra
          forgedActorId: 'forged-actor',
          scores: {
            generated: {
              cantoneseNaturalness: 20,
              brandSafety: 20,
              platformFit: 20,
              readability: 20,
              creativity: 20,
              hookStrength: 20,
              emojiHashtagFit: 20,
              engagementPotential: 20,
              total: 20,
            },
            source: null,
          },
        },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.pack.subjectOwnerId).toBe(OWNER_ID);
    expect(JSON.stringify(result)).not.toMatch(/forged-actor/);
  });
});

