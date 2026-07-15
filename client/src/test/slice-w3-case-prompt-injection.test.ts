/**
 * W3 — client only sends selectedCaseLibraryIds; history restores IDs only.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildWorkbenchSnapshotFromHistory } from '../services/workbenchSnapshot';
import type { GenerationJob } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

const GOOD_ID = '11111111-1111-4111-8111-111111111111';
const BAD_ID = '22222222-2222-4222-8222-222222222222';
const SECRET_BODY = 'W3_HISTORY_BODY_MUST_NOT_BECOME_SETTINGS_XYZ';

function baseJob(overrides: Partial<GenerationJob> = {}): GenerationJob {
  const now = '2026-07-14T00:00:00.000Z';
  return {
    id: 'job-1',
    ownerId: 'u1',
    idempotencyKey: 'k1',
    status: 'completed',
    source: '测试原文',
    platform: 'all',
    tone: '穩妥',
    cantoneseLevel: 3,
    englishMixingLevel: 1,
    creativityLevel: 2,
    inputLanguage: 'mandarin',
    brandName: null,
    productName: null,
    brandRedLines: null,
    generationEngine: 'rules',
    diagnosis: { hasSimplifiedChars: false, mainlandPhrases: [], issues: [] },
    variants: {
      standardHK: 'a',
      lightCantonese: 'b',
      ig: 'c',
      facebook: 'd',
      shorts: 'e',
    },
    audit: {
      thermometer: { overall: 80, dimensions: {} as never },
      issues: [],
      replacements: [],
      risks: [],
      comments: [],
    },
    scores: null,
    consumerFeedback: null,
    variantMeta: null,
    errorMessage: null,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    deletedAt: null,
    brief: {},
    ...overrides,
  } as GenerationJob;
}

describe('W3 client generate payload — IDs only', () => {
  it('useGenerate includes selectedCaseLibraryIds and does not fetch/send case bodies', () => {
    const file = path.resolve(process.cwd(), 'src/hooks/useGenerate.ts');
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toContain('selectedCaseLibraryIds');
    expect(src).toContain('slice(0, 3)');
    expect(src).not.toMatch(/listCaseLibrary|caseLibraryApi|caseLibraryEntries/);
    // no body/reason construction for case library
    expect(src).not.toMatch(/body:\s*[^\n]*caseLibrary|reason:\s*[^\n]*caseLibrary/i);
  });

  it('GenerateRequest type documents IDs-only contract', () => {
    const file = path.resolve(process.cwd(), 'src/types/index.ts');
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toContain('selectedCaseLibraryIds?: string[]');
    expect(src).toMatch(/仅发送 ID|IDs only|不得伪造 body/i);
  });
});

describe('W3 history load — IDs only; snapshots stay in brief for interpretability', () => {
  it('restores selectedCaseLibraryIds without promoting snapshot bodies into settings', () => {
    const job = baseJob({
      brief: {
        workbenchSettings: {
          ...DEFAULT_SETTINGS,
          selectedCaseLibraryIds: [GOOD_ID, BAD_ID],
          resolvedCaseLibrarySnapshots: [
            {
              id: GOOD_ID,
              caseType: 'good',
              title: '正例',
              body: SECRET_BODY,
              reason: '好结构',
              tags: ['hook'],
            },
          ],
        },
        resolvedCaseLibrarySnapshots: [
          {
            id: GOOD_ID,
            caseType: 'good',
            title: '正例',
            body: SECRET_BODY,
            reason: '好结构',
            tags: ['hook'],
          },
        ],
      },
    });

    const restored = buildWorkbenchSnapshotFromHistory(job);
    expect(restored.snapshot?.settings.selectedCaseLibraryIds).toEqual([GOOD_ID, BAD_ID]);
    // Settings object must not embed the historical body as a live editable field
    expect(JSON.stringify(restored.snapshot?.settings)).not.toContain(SECRET_BODY);
  });

  it('deleted case still leaves historical IDs for non-blocking selection restore', () => {
    const deletedId = '55555555-5555-4555-8555-555555555555';
    const job = baseJob({
      brief: {
        workbenchSettings: {
          selectedCaseLibraryIds: [deletedId],
          resolvedCaseLibrarySnapshots: [
            {
              id: deletedId,
              caseType: 'bad',
              title: '旧反例',
              body: '当时解析到的反例正文快照',
              reason: '硬广',
              tags: [],
            },
          ],
        },
      },
    });
    const restored = buildWorkbenchSnapshotFromHistory(job);
    // IDs restored so UI can show selection; prune/notice handled by CaseLibraryPanel reconcile
    expect(restored.snapshot?.settings.selectedCaseLibraryIds).toEqual([deletedId]);
  });
});
