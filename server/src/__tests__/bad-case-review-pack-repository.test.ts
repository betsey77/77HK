import { describe, expect, it } from 'vitest';
import {
  InMemoryBadCaseReviewPackRepository,
  prepareEventInsert,
  prepareFindingsInsert,
  preparePackUpsert,
  prepareSnapshotUpsert,
  rejectUntrustedActorFields,
  type PackUpsertDto,
  type SnapshotUpsertDto,
} from '../services/badCaseReviewPackRepository.js';
import { createLegacyUnavailableManifest } from '../services/generationArtifactManifest.js';

const JOB_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function packDto(overrides: Partial<PackUpsertDto> = {}): PackUpsertDto {
  return {
    generationJobId: JOB_ID,
    subjectOwnerId: OWNER_ID,
    triggerKinds: ['score_below_threshold'],
    status: 'open',
    ownerTeam: 'content_prompt',
    assigneeId: null,
    criteriaVersion: '1.0.0',
    analysisStatus: 'not_requested',
    summary: 'low score sample',
    ...overrides,
  };
}

describe('badCaseReviewPackRepository whitelist persistence boundary', () => {
  it('accepts only allowlisted pack fields and strips untrusted actor/owner forgeries', () => {
    const prepared = preparePackUpsert({
      ...packDto(),
      // untrusted extras must not survive
      actorId: 'evil-actor',
      ownerId: 'evil-owner',
      role: 'super_admin',
    } as PackUpsertDto & Record<string, unknown>);

    expect(prepared).toMatchObject({
      generation_job_id: JOB_ID,
      subject_owner_id: OWNER_ID,
      trigger_kind: 'score_below_threshold',
      status: 'open',
      owner_team: 'content_prompt',
      criteria_version: '1.0.0',
      analysis_status: 'not_requested',
    });
    expect(prepared).not.toHaveProperty('actor_id');
    expect(prepared).not.toHaveProperty('actorId');
    expect(prepared).not.toHaveProperty('role');
    expect(JSON.stringify(prepared)).not.toMatch(/evil-actor|evil-owner/);
  });

  it('rejects body actor fields as trusted sources', () => {
    expect(() =>
      rejectUntrustedActorFields({
        actorId: 'from-body',
        actorRole: 'super_admin',
        ownerId: 'from-body',
      }),
    ).toThrow(/untrusted/i);
  });

  it('prepares snapshot rows from E1 manifest without prompt bodies', () => {
    const manifest = createLegacyUnavailableManifest('snapshot_missing');
    const dto: SnapshotUpsertDto = {
      generationJobId: JOB_ID,
      ownerId: OWNER_ID,
      manifest,
    };
    const row = prepareSnapshotUpsert(dto);
    expect(row.generation_job_id).toBe(JOB_ID);
    expect(row.content_hash).toBe(manifest.contentHash);
    expect(row.schema_version).toBe(manifest.schemaVersion);
    expect(row.prompt_manifest).toEqual(manifest.prompt);
    expect(row.availability).toBe('legacy_unavailable');
    expect(JSON.stringify(row)).not.toMatch(/rawPrompt|providerPayload|chainOfThought|email|jwt/i);
  });

  it('requires findings to carry parseable evidence/criterion/artifact refs', () => {
    expect(() =>
      prepareFindingsInsert('pack-1', [
        {
          category: 'content_quality',
          severity: 'high',
          confidence: 0.9,
          stage: 'audit',
          variantKey: null,
          description: 'low score',
          evidenceRefs: [],
          criterionRefs: ['score.total_threshold@1.0.0'],
          artifactRefs: [{ type: 'manifest', contentHash: 'abc', schemaVersion: 1, availability: 'legacy_unavailable' }],
          recommendedOwnerTeam: 'content_prompt',
          suggestion: null,
        },
      ]),
    ).toThrow(/evidence/i);

    const rows = prepareFindingsInsert('pack-1', [
      {
        category: 'content_quality',
        severity: 'high',
        confidence: 0.9,
        stage: 'audit',
        variantKey: null,
        description: 'low score',
        evidenceRefs: [{ type: 'score_path', path: 'scores.generated.total', value: 40 }],
        criterionRefs: ['score.total_threshold@1.0.0'],
        artifactRefs: [
          {
            type: 'manifest',
            contentHash: 'a'.repeat(64),
            schemaVersion: 1,
            availability: 'legacy_unavailable',
          },
        ],
        recommendedOwnerTeam: 'content_prompt',
        suggestion: null,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].review_pack_id).toBe('pack-1');
    expect(rows[0].evidence_refs).toHaveLength(1);
  });

  it('prepares append-only events without update fields', () => {
    const event = prepareEventInsert({
      reviewPackId: 'pack-1',
      findingId: null,
      eventType: 'pack_created',
      actorId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      actorRole: 'system',
      fromValue: null,
      toValue: { status: 'open' },
      reason: 'auto trigger',
      requestId: null,
      payload: { triggerKinds: ['score_below_threshold'] },
    });
    expect(event).toMatchObject({
      review_pack_id: 'pack-1',
      event_type: 'pack_created',
      actor_role: 'system',
    });
    expect(event).not.toHaveProperty('updated_at');
  });

  it('upserts packs idempotently by generation_job_id in memory', async () => {
    const repo = new InMemoryBadCaseReviewPackRepository();
    const first = await repo.upsertPack(packDto());
    const second = await repo.upsertPack(
      packDto({
        triggerKinds: ['score_below_threshold', 'criteria_failed'],
        summary: 'updated summary',
      }),
    );

    expect(second.id).toBe(first.id);
    expect(repo.listPacks()).toHaveLength(1);
    expect(repo.listPacks()[0].trigger_kind).toBe('score_below_threshold');
    expect(repo.listPacks()[0].summary).toBe('updated summary');

    await repo.replaceFindings(first.id, [
      {
        category: 'content_quality',
        severity: 'high',
        confidence: 1,
        stage: 'audit',
        variantKey: null,
        description: 'score below threshold',
        evidenceRefs: [{ type: 'score_path', path: 'scores.generated.total', value: 40 }],
        criterionRefs: ['score.total_threshold@1.0.0'],
        artifactRefs: [
          {
            type: 'manifest',
            contentHash: 'b'.repeat(64),
            schemaVersion: 1,
            availability: 'captured',
          },
        ],
        recommendedOwnerTeam: 'content_prompt',
        suggestion: null,
      },
    ]);
    expect(repo.listFindings(first.id)).toHaveLength(1);

    await repo.appendEvent({
      reviewPackId: first.id,
      findingId: null,
      eventType: 'pack_created',
      actorId: null,
      actorRole: 'system',
      fromValue: null,
      toValue: { status: 'open' },
      reason: null,
      requestId: null,
      payload: {},
    });
    expect(repo.listEvents(first.id)).toHaveLength(1);
  });

  it('refuses to persist forbidden secret-like payload keys', () => {
    expect(() =>
      prepareEventInsert({
        reviewPackId: 'pack-1',
        findingId: null,
        eventType: 'note_added',
        actorId: null,
        actorRole: 'system',
        fromValue: null,
        toValue: null,
        reason: null,
        requestId: null,
        payload: { prompt: 'should not store', apiKey: 'x' },
      }),
    ).toThrow(/forbidden/i);
  });
});

