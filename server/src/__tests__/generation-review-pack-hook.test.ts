import { describe, expect, it } from 'vitest';
import {
  afterGenerationPersistReviewPack,
  buildManifestForGeneration,
  createInMemoryReviewPackWritePort,
} from '../services/badCaseReviewPackService.js';
import { createLegacyUnavailableManifest } from '../services/generationArtifactManifest.js';

const JOB_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OWNER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('generation review pack hook isolation', () => {
  it('does not throw and leaves caller success body intact when DB fails', async () => {
    const port = createInMemoryReviewPackWritePort();
    const failingPort = {
      ...port,
      async upsertPack() {
        throw new Error('db down');
      },
      async upsertSnapshot() {
        throw new Error('db down');
      },
    };

    const successBody = {
      diagnosis: { ok: true },
      variants: { ig: '文案' },
      jobId: JOB_ID,
      generationEngine: 'deepseek' as const,
    };

    const outcome = await afterGenerationPersistReviewPack(
      {
        jobId: JOB_ID,
        ownerId: OWNER_ID,
        status: 'completed',
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
      },
      { port: failingPort, timeoutMs: 5_000 },
    );

    expect(outcome.ok).toBe(false);
    // Caller would still return the original success body unchanged.
    expect(successBody).toEqual({
      diagnosis: { ok: true },
      variants: { ig: '文案' },
      jobId: JOB_ID,
      generationEngine: 'deepseek',
    });
  });

  it('saves snapshot_missing for failed generation without engine', () => {
    const manifest = buildManifestForGeneration({
      generationEngine: null,
      captureInput: null,
    });
    expect(manifest.availability).toBe('legacy_unavailable');
    const serialized = JSON.stringify(manifest);
    expect(serialized).toContain('snapshot_missing');
    expect(serialized).not.toMatch(/sk-|Bearer |password|cookie/i);
  });

  it('creates failure pack idempotently', async () => {
    const port = createInMemoryReviewPackWritePort();
    const input = {
      jobId: JOB_ID,
      ownerId: OWNER_ID,
      status: 'failed' as const,
      errorCode: 'GENERATION_ERROR',
      generationEngine: null,
      artifactManifest: buildManifestForGeneration({
        generationEngine: null,
        captureInput: null,
      }),
    };
    const a = await afterGenerationPersistReviewPack(input, { port, timeoutMs: 5_000 });
    const b = await afterGenerationPersistReviewPack(input, { port, timeoutMs: 5_000 });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(port.repo.listPacks()).toHaveLength(1);
    expect(port.repo.listPacks()[0]?.trigger_kind).toBe('generation_failed');
    expect(port.repo.getSnapshot(JOB_ID)?.availability).toBe('legacy_unavailable');
  });
});

