import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertAllowedStatusTransition,
  assertUuid,
  afterGenerationPersistReviewPack,
  buildManifestForGeneration,
  createInMemoryReviewPackWritePort,
  deriveSeverity,
  hashReviewPackArtifactManifest,
  mapEngineToPromptVariant,
  parseAssignBody,
  parseFindingReviewBody,
  parseProposalBody,
  parseStatusBody,
  projectModelAttemptsToTrace,
  __resetAnalyzeRateLimitForTests,
  BadCaseReviewPackError,
} from '../services/badCaseReviewPackService.js';
import { buildBadCaseProposal } from '../services/badCaseProposalService.js';
import { createLegacyUnavailableManifest } from '../services/generationArtifactManifest.js';
import { CRITERIA_VERSION } from '../services/badCaseCriteria.js';

const JOB_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('badCaseReviewPackService pure contracts', () => {
  beforeEach(() => {
    __resetAnalyzeRateLimitForTests();
  });

  it('maps generation engines to prompt variants', () => {
    expect(mapEngineToPromptVariant('deepseek')).toBe('deepseek');
    expect(mapEngineToPromptVariant('self-hosted-cantonese')).toBe('cantonese_llm');
    expect(mapEngineToPromptVariant('rules')).toBe('rules_fallback');
    expect(mapEngineToPromptVariant(null)).toBeNull();
  });

  it('builds snapshot_missing when engine unknown', () => {
    const m = buildManifestForGeneration({ generationEngine: null, captureInput: null });
    expect(m.availability).toBe('legacy_unavailable');
    expect(JSON.stringify(m)).not.toMatch(/sk-|api_key|authorization/i);
  });

  it('enforces status transitions and UUID', () => {
    expect(() => assertAllowedStatusTransition('open', 'triaging')).not.toThrow();
    expect(() => assertAllowedStatusTransition('open', 'resolved')).toThrow(BadCaseReviewPackError);
    expect(() => assertAllowedStatusTransition('resolved', 'duplicate')).toThrow(BadCaseReviewPackError);
    expect(() => assertUuid('not-a-uuid')).toThrow(BadCaseReviewPackError);
    expect(assertUuid(JOB_ID)).toBe(JOB_ID);
  });

  it('rejects untrusted actor/owner fields and note-only proposal', () => {
    expect(() => parseAssignBody({ ownerTeam: 'content_prompt', actorId: 'x' })).toThrow(
      BadCaseReviewPackError,
    );
    expect(() => parseStatusBody({ status: 'triaging', ownerId: OWNER_ID })).toThrow(
      BadCaseReviewPackError,
    );
    expect(() => parseFindingReviewBody({ disposition: 'confirmed', role: 'admin' })).toThrow(
      BadCaseReviewPackError,
    );
    expect(() => parseProposalBody({ note: 'only note' })).toThrow(BadCaseReviewPackError);
    expect(() => parseProposalBody({})).toThrow(BadCaseReviewPackError);
  });

  it('projects trace allowlist without requestId', () => {
    const trace = projectModelAttemptsToTrace({
      status: 'available',
      items: [
        {
          createdAt: '2026-07-22T00:00:00.000Z',
          operation: 'generate',
          provider: 'deepseek',
          model: 'deepseek-chat',
          status: 'error',
          errorClass: 'timeout',
          latencyMs: 12,
          attempt: 1,
          promptTokens: 1,
          completionTokens: 2,
          totalTokens: 3,
          cacheHitTokens: null,
          cacheMissTokens: null,
          usageSource: 'provider',
        },
      ],
    });
    expect(trace.status).toBe('available');
    if (trace.status === 'available') {
      expect(trace.events[0]).not.toHaveProperty('requestId');
      expect(trace.events[0]).not.toHaveProperty('prompt');
      expect(trace.events[0]?.errorClass).toBe('timeout');
    }
    expect(projectModelAttemptsToTrace({ status: 'unavailable', items: [] }).status).toBe(
      'unavailable',
    );
  });

  it('derives pack severity from findings', () => {
    expect(deriveSeverity([{ severity: 'low' }, { severity: 'high' }])).toBe('high');
    expect(deriveSeverity([])).toBeNull();
  });

  it('uses the same manifest-body hash for detail and review-only proposal creation', () => {
    const rules = {
      availability: 'captured' as const,
      rulesetId: 'hk_social_compliance_builtin',
      version: '1.0.0',
      ruleIds: ['exaggeration'],
      w1ConstraintsVersion: '1.0.0',
      userRedLinesPresent: true,
    };
    const proposal = buildBadCaseProposal({
      findingId: JOB_ID,
      artifactType: 'rules',
      before: {
        contentHash: hashReviewPackArtifactManifest(rules),
        snapshot: { artifactType: 'rules', manifest: rules },
      },
      afterPatch: { ops: [{ op: 'replace', path: '/version', value: '1.0.1' }] },
    });

    expect(proposal.status).toBe('pending_review');
    expect(proposal.publishable).toBe(false);
  });
});

describe('afterGenerationPersistReviewPack hook', () => {
  it('cancels the timeout after a successful hook instead of emitting a false timeout', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const port = createInMemoryReviewPackWritePort();
      const outcome = await afterGenerationPersistReviewPack(
        {
          jobId: JOB_ID,
          ownerId: OWNER_ID,
          status: 'failed',
          errorCode: 'GENERATION_ERROR',
          artifactManifest: createLegacyUnavailableManifest('snapshot_missing'),
        },
        { port, timeoutMs: 100 },
      );
      expect(outcome.ok).toBe(true);
      await vi.advanceTimersByTimeAsync(101);
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('review_pack.timeout'),
      );
    } finally {
      errorSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('snapshots only for healthy high-score completions', async () => {
    const port = createInMemoryReviewPackWritePort();
    const outcome = await afterGenerationPersistReviewPack(
      {
        jobId: JOB_ID,
        ownerId: OWNER_ID,
        status: 'completed',
        scores: {
          generated: {
            total: 72,
            cantoneseNaturalness: 70,
            brandSafety: 80,
            platformFit: 70,
            readability: 70,
            creativity: 60,
            hookStrength: 60,
            emojiHashtagFit: 60,
            engagementPotential: 60,
          },
        },
        variants: {
          standardHK: 'a',
          lightCantonese: 'b',
          ig: 'c',
          facebook: 'd',
          shorts: 'e',
        },
        audit: { risks: [], issues: [] },
        generationEngine: 'deepseek',
        artifactManifest: createLegacyUnavailableManifest('pre_e1_job'),
      },
      { port, timeoutMs: 5_000 },
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.action).toBe('snapshot_only');
    expect(port.repo.listPacks()).toHaveLength(0);
    expect(port.repo.getSnapshot(JOB_ID)).toBeDefined();
  });

  it('idempotently creates pack for low score', async () => {
    const port = createInMemoryReviewPackWritePort();
    const input = {
      jobId: JOB_ID,
      ownerId: OWNER_ID,
      status: 'completed' as const,
      scores: {
        generated: {
          total: 40,
          cantoneseNaturalness: 30,
          brandSafety: 40,
          platformFit: 40,
          readability: 40,
          creativity: 30,
          hookStrength: 30,
          emojiHashtagFit: 30,
          engagementPotential: 30,
        },
      },
      variants: {
        standardHK: 'a',
        lightCantonese: 'b',
        ig: 'c',
        facebook: 'd',
        shorts: 'e',
      },
      audit: { risks: [], issues: [] },
      generationEngine: 'deepseek',
      artifactManifest: createLegacyUnavailableManifest('pre_e1_job'),
    };
    const first = await afterGenerationPersistReviewPack(input, { port, timeoutMs: 5_000 });
    const second = await afterGenerationPersistReviewPack(input, { port, timeoutMs: 5_000 });
    expect(first.ok).toBe(true);
    expect(first.action).toBe('pack_upserted');
    expect(second.ok).toBe(true);
    expect(port.repo.listPacks()).toHaveLength(1);
    expect(port.repo.listPacks()[0]?.criteria_version).toBe(CRITERIA_VERSION);
    expect(port.repo.listFindings(port.repo.listPacks()[0]!.id).length).toBeGreaterThan(0);
  });

  it('creates failure pack with snapshot_missing and never throws on port failure', async () => {
    const port = createInMemoryReviewPackWritePort();
    const boomPort = {
      ...port,
      async upsertSnapshot() {
        throw new Error('relation "generation_artifact_snapshots" does not exist');
      },
    };
    const outcome = await afterGenerationPersistReviewPack(
      {
        jobId: JOB_ID,
        ownerId: OWNER_ID,
        status: 'failed',
        errorCode: 'GENERATION_ERROR',
        generationEngine: null,
        artifactManifest: buildManifestForGeneration({
          generationEngine: null,
          captureInput: null,
        }),
      },
      { port: boomPort, timeoutMs: 5_000 },
    );
    expect(outcome.ok).toBe(false);
  });

  it('skips non-terminal status', async () => {
    const port = createInMemoryReviewPackWritePort();
    const outcome = await afterGenerationPersistReviewPack(
      {
        jobId: JOB_ID,
        ownerId: OWNER_ID,
        status: 'failed',
        deletedAt: '2026-07-22T00:00:00.000Z',
        artifactManifest: createLegacyUnavailableManifest('snapshot_missing'),
      },
      { port, timeoutMs: 5_000 },
    );
    expect(outcome.action).toBe('skipped');
  });
});
