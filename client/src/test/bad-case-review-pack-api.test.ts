import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

vi.mock('../services/supabase', () => ({
  supabase: { auth: { getSession: mockGetSession } },
}));

import {
  assignBadCaseReviewPack,
  getBadCaseReviewPack,
  listBadCaseReviewPacks,
  requestBadCaseAnalysis,
  requestBadCaseFindingProposal,
  reviewBadCaseFinding,
  updateBadCaseReviewPackStatus,
} from '../services/badCaseReviewPackApi';

const PACK_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const FINDING_ID = 'f1f1f1f1-0000-4000-8000-000000000002';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('E6 bad-case review pack API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'session-jwt' } },
      error: null,
    });
  });

  it('uses authenticated GET for list and detail with encoded ids', async () => {
    const listBody = {
      items: [{
        id: PACK_ID,
        generationJobId: '7f177000-0000-4000-8000-000000000001',
        status: 'open',
        triggerKind: 'score_below_threshold',
        ownerTeam: 'content_prompt',
        assigneeId: null,
        subjectOwner: { ownerId: 'u1', displayName: '测试用户', reviewGroup: 'g1' },
        score: 42,
        severity: 'high',
        analysisStatus: 'pending',
        summary: '港味偏低',
        createdAt: '2026-07-18T03:00:00Z',
        updatedAt: '2026-07-18T03:00:00Z',
        resolvedAt: null,
      }],
      total: 1,
    };
    const detailBody = {
      ...listBody.items[0],
      sample: {
        source: '原始需求',
        variants: { ig: '文案' },
        errorMessage: null,
        errorCode: null,
      },
      trace: { status: 'unavailable', events: [] },
      criteria: [],
      artifacts: { status: 'legacy_unavailable' },
      findings: [],
      auditEvents: [],
    };

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse(listBody))
      .mockResolvedValueOnce(jsonResponse(detailBody)));

    const list = await listBadCaseReviewPacks({ status: 'open', limit: 20, offset: 0 });
    const detail = await getBadCaseReviewPack(PACK_ID);

    expect(list.total).toBe(1);
    expect(list.items[0]?.id).toBe(PACK_ID);
    expect(detail.id).toBe(PACK_ID);
    expect(detail.trace.status).toBe('unavailable');

    const calls = vi.mocked(fetch).mock.calls;
    expect(String(calls[0]?.[0])).toContain('/api/admin/bad-case-review-packs');
    expect(String(calls[0]?.[0])).toContain('status=open');
    expect(String(calls[1]?.[0])).toBe(`/api/admin/bad-case-review-packs/${PACK_ID}`);
    for (const [, init] of calls) {
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer session-jwt');
    }
  });

  it('posts assign, status, finding review, analyze and proposal to frozen paths', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true })));

    await assignBadCaseReviewPack(PACK_ID, {
      ownerTeam: 'model_provider',
      assigneeId: null,
      reason: '模型超时',
    });
    await updateBadCaseReviewPackStatus(PACK_ID, { status: 'in_progress', reason: '开始处理' });
    await reviewBadCaseFinding(FINDING_ID, {
      disposition: 'confirmed',
      reviewerComment: '确认港味问题',
    });
    await requestBadCaseAnalysis(PACK_ID);
    await requestBadCaseFindingProposal(FINDING_ID, {
      artifactType: 'rules',
      before: {
        contentHash: 'a'.repeat(64),
        snapshot: {
          artifactType: 'rules',
          manifest: {
            availability: 'captured',
            rulesetId: 'default',
            version: '1',
            ruleIds: [],
            w1ConstraintsVersion: '1',
            userRedLinesPresent: false,
          },
        },
      },
      afterPatch: { ops: [{ op: 'replace', path: '/version', value: '2.1' }] },
      rationale: '建议调整规则版本',
    });

    const urls = vi.mocked(fetch).mock.calls.map(([url, init]) => ({
      url: String(url),
      method: String(init?.method ?? 'GET').toUpperCase(),
    }));
    expect(urls).toEqual([
      { url: `/api/admin/bad-case-review-packs/${PACK_ID}/assign`, method: 'POST' },
      { url: `/api/admin/bad-case-review-packs/${PACK_ID}/status`, method: 'POST' },
      { url: `/api/admin/bad-case-findings/${FINDING_ID}/review`, method: 'POST' },
      { url: `/api/admin/bad-case-review-packs/${PACK_ID}/analyze`, method: 'POST' },
      { url: `/api/admin/bad-case-findings/${FINDING_ID}/proposal`, method: 'POST' },
    ]);
    const proposalInit = vi.mocked(fetch).mock.calls[4]?.[1];
    const proposalBody = JSON.parse(String(proposalInit?.body));
    expect(proposalBody).toEqual(expect.objectContaining({
      artifactType: 'rules',
      rationale: '建议调整规则版本',
    }));
    expect(proposalBody.afterPatch.ops).toEqual([
      { op: 'replace', path: '/version', value: '2.1' },
    ]);
    expect(proposalBody).not.toHaveProperty('note');
  });

  it('maps 403 to FORBIDDEN and never surfaces raw server bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('{"error":"internal secret stack"}', { status: 403 }),
    ));
    await expect(listBadCaseReviewPacks()).rejects.toThrow('FORBIDDEN');
    await expect(listBadCaseReviewPacks()).rejects.not.toThrow(/secret stack/);
  });

  it('rejects invalid list payloads that miss required ids', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      items: [{ status: 'open' }],
      total: 1,
    })));
    await expect(listBadCaseReviewPacks()).rejects.toThrow(/invalid/i);
  });

  it('normalizes missing trace status to unavailable instead of fake success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      id: PACK_ID,
      generationJobId: '7f177000-0000-4000-8000-000000000001',
      status: 'open',
      triggerKind: 'score_below_threshold',
      ownerTeam: 'unassigned',
      assigneeId: null,
      subjectOwner: { ownerId: 'u1', displayName: null, reviewGroup: null },
      score: null,
      severity: null,
      analysisStatus: 'pending',
      summary: null,
      createdAt: '2026-07-18T03:00:00Z',
      updatedAt: '2026-07-18T03:00:00Z',
      resolvedAt: null,
      sample: { source: 'x', variants: {} },
      // intentionally omit trace.status
      trace: { events: [] },
      criteria: [],
      artifacts: { status: 'legacy_unavailable' },
      findings: [],
      auditEvents: [],
    })));

    const detail = await getBadCaseReviewPack(PACK_ID);
    expect(detail.trace.status).toBe('unavailable');
    expect(detail.trace.events).toEqual([]);
  });
});
