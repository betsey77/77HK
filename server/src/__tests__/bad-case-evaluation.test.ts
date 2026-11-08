import { describe, expect, it } from 'vitest';
import {
  assertNoOwnerBodyLeak,
  evaluatePromotion,
  type PromotionInput,
} from '../services/badCaseEvaluationService.js';

function baseInput(overrides: Partial<PromotionInput> = {}): PromotionInput {
  return {
    reviewPackId: '11111111-1111-4111-8111-111111111111',
    generationJobId: '22222222-2222-4222-8222-222222222222',
    subjectOwnerId: '33333333-3333-4333-8333-333333333333',
    actorScope: {
      actorId: '44444444-4444-4444-8444-444444444444',
      actorRole: 'super_admin',
    },
    humanApproval: {
      approved: true,
      actorId: '44444444-4444-4444-8444-444444444444',
      approvedAt: '2026-07-22T10:00:00.000Z',
    },
    redaction: {
      approved: true,
      redactionVersion: '1.0.0',
      strippedFieldCount: 3,
      remainingPiiKinds: [],
    },
    readability: {
      stillReadable: true,
      reason: 'ok',
    },
    triggerKind: 'low_score',
    categories: ['content_quality'],
    severityMax: 'high',
    criterionIdsFailed: ['cantonese_naturalness'],
    promptTemplateId: 'diagnose_generate',
    promptVersion: '1.0.0',
    modelPolicy: {
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      policyVersion: '1.0.0',
    },
    scoreTotal: 42,
    findingIds: ['55555555-5555-4555-8555-555555555555'],
    now: '2026-07-22T12:00:00.000Z',
    ...overrides,
  };
}

describe('badCaseEvaluationService (E7)', () => {
  it('rejects when only human approval is true', () => {
    const decision = evaluatePromotion(
      baseInput({
        redaction: {
          approved: false,
          redactionVersion: '1.0.0',
          strippedFieldCount: 0,
          remainingPiiKinds: [],
        },
        readability: { stillReadable: false, reason: 'body_unavailable' },
        humanApproval: {
          approved: true,
          actorId: '44444444-4444-4444-8444-444444444444',
          approvedAt: '2026-07-22T10:00:00.000Z',
        },
      }),
    );

    expect(decision.status).toBe('rejected');
    if (decision.status !== 'rejected') throw new Error('expected rejected');
    expect(decision.candidate).toBeNull();
    expect(decision.reasons).toEqual(
      expect.arrayContaining(['redaction_not_approved', 'body_unavailable']),
    );
  });

  it('rejects when redaction still has remaining PII kinds', () => {
    const decision = evaluatePromotion(
      baseInput({
        redaction: {
          approved: true,
          redactionVersion: '1.0.0',
          strippedFieldCount: 1,
          remainingPiiKinds: ['email'],
        },
      }),
    );

    expect(decision.status).toBe('rejected');
    if (decision.status !== 'rejected') throw new Error('expected rejected');
    expect(decision.reasons).toContain('redaction_pii_remaining');
    expect(decision.candidate).toBeNull();
  });

  it('rejects deleted subjects even if human and redaction approved', () => {
    const decision = evaluatePromotion(
      baseInput({
        readability: { stillReadable: false, reason: 'deleted' },
      }),
    );

    expect(decision.status).toBe('rejected');
    if (decision.status !== 'rejected') throw new Error('expected rejected');
    expect(decision.reasons).toContain('subject_deleted');
  });

  it('rejects cross-owner subjects', () => {
    const decision = evaluatePromotion(
      baseInput({
        readability: { stillReadable: false, reason: 'cross_owner' },
      }),
    );

    expect(decision.status).toBe('rejected');
    if (decision.status !== 'rejected') throw new Error('expected rejected');
    expect(decision.reasons).toContain('subject_cross_owner');
  });

  it('rejects payloads that carry owner body fields', () => {
    const decision = evaluatePromotion({
      ...baseInput(),
      inputText: '用户原文不得进入共享集',
      variants: { ig: '变体' },
    } as PromotionInput);

    expect(decision.status).toBe('rejected');
    if (decision.status !== 'rejected') throw new Error('expected rejected');
    expect(decision.reasons).toContain('forbidden_payload_fields');
  });

  it('promotes only when humanApproved && redactionApproved && subjectStillReadable', () => {
    const decision = evaluatePromotion(baseInput());

    expect(decision.status).toBe('promoted');
    if (decision.status !== 'promoted') throw new Error('expected promoted');

    const candidate = decision.candidate;
    expect(candidate.schemaVersion).toBe(1);
    expect(candidate.origin.reviewPackId).toBe(baseInput().reviewPackId);
    expect(candidate.origin.generationJobId).toBe(baseInput().generationJobId);
    expect(candidate.redaction).toEqual({ version: '1.0.0', approved: true });
    expect(candidate.tags.categories).toEqual(['content_quality']);
    expect(candidate.tags.scoreBucket).toBe('lt50');
    expect(candidate.promotedAt).toBe('2026-07-22T12:00:00.000Z');

    // Owner body must never enter the shared candidate.
    expect(candidate).not.toHaveProperty('subjectOwnerId');
    expect(JSON.stringify(candidate)).not.toContain(baseInput().subjectOwnerId);
    expect(JSON.stringify(candidate)).not.toMatch(/inputText|variants|email|jwt|apiKey/i);
    expect(() => assertNoOwnerBodyLeak(candidate)).not.toThrow();
  });

  it('assertNoOwnerBodyLeak throws when body-like keys appear', () => {
    expect(() =>
      assertNoOwnerBodyLeak({
        origin: { reviewPackId: 'x', generationJobId: 'y' },
        body: 'leak',
      }),
    ).toThrow(/owner body|forbidden|sensitive/i);
  });

  it('rejects non super_admin actors in MVP', () => {
    const decision = evaluatePromotion(
      baseInput({
        actorScope: {
          actorId: '44444444-4444-4444-8444-444444444444',
          actorRole: 'admin' as 'super_admin',
        },
      }),
    );
    // If role is not super_admin string, reject.
    const decision2 = evaluatePromotion({
      ...baseInput(),
      actorScope: {
        actorId: '44444444-4444-4444-8444-444444444444',
        actorRole: 'admin',
      } as PromotionInput['actorScope'],
    });

    expect(decision2.status).toBe('rejected');
    if (decision2.status !== 'rejected') throw new Error('expected rejected');
    expect(decision2.reasons).toContain('actor_not_super_admin');
    void decision;
  });
});
