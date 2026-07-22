import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  createUserClient: vi.fn(),
  scope: vi.fn(),
  visible: vi.fn(),
  audit: vi.fn(),
  list: vi.fn(),
  diagnostics: vi.fn(),
  detail: vi.fn(),
  assign: vi.fn(),
  status: vi.fn(),
  review: vi.fn(),
  analyze: vi.fn(),
  proposal: vi.fn(),
}));

vi.mock('../services/supabase.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/supabase.js')>()),
  verifyToken: mocks.verifyToken,
  createUserClient: mocks.createUserClient,
}));

vi.mock('../services/adminService.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/adminService.js')>()),
  writeAdminAuditLog: mocks.audit,
}));

vi.mock('../services/badCaseReviewPackService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/badCaseReviewPackService.js')>();
  return {
    ...actual,
    getReviewPackScope: mocks.scope,
    isReviewPackVisible: mocks.visible,
    listReviewPacksMeta: mocks.list,
    getReviewPackDiagnostics: mocks.diagnostics,
    loadReviewPackDetailBody: mocks.detail,
    assignReviewPack: mocks.assign,
    transitionReviewPackStatus: mocks.status,
    reviewFinding: mocks.review,
    requestPackAnalysis: mocks.analyze,
    createFindingProposal: mocks.proposal,
  };
});

const PACK_ID = '7f177000-0000-4000-8000-000000000001';
const JOB_ID = '7f177000-0000-4000-8000-000000000002';
const OWNER_ID = '7f177000-0000-4000-8000-000000000003';

const LIST_ITEM = {
  id: PACK_ID,
  generationJobId: JOB_ID,
  status: 'open',
  triggerKind: 'score_below_threshold',
  ownerTeam: 'content_prompt',
  assigneeId: null,
  subjectOwner: { ownerId: OWNER_ID, displayName: 'Tester', reviewGroup: 'g1' },
  score: 42,
  severity: 'high',
  analysisStatus: 'not_requested',
  summary: 'triggers=score_below_threshold',
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
  resolvedAt: null,
  findingCount: 1,
  criticalFailCount: 1,
};

const DETAIL = {
  ...LIST_ITEM,
  sample: {
    source: '原始需求',
    variants: { ig: '低分文案' },
  },
  trace: { status: 'unavailable', events: [] },
  criteria: [],
  artifacts: { status: 'legacy_unavailable' },
  findings: [],
  auditEvents: [],
};

describe('E3 bad-case review pack routes', () => {
  let app: Awaited<typeof import('../app.js')>['default'];

  beforeAll(async () => {
    app = (await import('../app.js')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockRejectedValue(new Error('No token'));
    mocks.scope.mockResolvedValue({
      id: PACK_ID,
      generationJobId: JOB_ID,
      subjectOwnerId: OWNER_ID,
    });
    mocks.visible.mockResolvedValue(true);
    mocks.audit.mockResolvedValue(undefined);
    mocks.list.mockResolvedValue({ items: [LIST_ITEM], total: 1 });
    mocks.diagnostics.mockResolvedValue({
      from: '2026-06-23',
      to: '2026-07-22',
      summary: {
        categoryDistribution: { total: 0, byCategory: {} },
        recurrence: {
          totalFindings: 0,
          sampleRecurrenceRate: null,
          categoryRecurrenceRate: null,
          duplicateSampleCount: 0,
        },
        dispositionRates: {
          total: 0,
          reviewed: 0,
          reviewCoverage: null,
          confirmationRate: null,
          falsePositiveRate: null,
        },
        criterionCoverage: {
          total: 0,
          evaluated: 0,
          notEvaluated: 0,
          evaluatedRate: null,
          notEvaluatedRate: null,
          failRateAmongEvaluated: null,
        },
        resolutionLatency: { sampleSize: 0, p50Ms: null, p95Ms: null, invalidCount: 0 },
        tokenCost: null,
      },
    });
    mocks.detail.mockResolvedValue(DETAIL);
    mocks.assign.mockResolvedValue({ id: PACK_ID, ownerTeam: 'content_prompt', assigneeId: null });
    mocks.status.mockResolvedValue({ id: PACK_ID, status: 'triaging', resolvedAt: null });
    mocks.review.mockResolvedValue({
      id: PACK_ID,
      disposition: 'confirmed',
      reviewedBy: 'actor-1',
      reviewedAt: '2026-07-22T00:00:00.000Z',
    });
    mocks.analyze.mockResolvedValue({ id: PACK_ID, analysisStatus: 'completed' });
    mocks.proposal.mockResolvedValue({
      status: 'pending_review',
      publishable: false,
      autoPublish: false,
      proposalHash: 'abc',
    });
  });

  function authorization(role: 'admin' | 'super_admin') {
    mocks.verifyToken.mockResolvedValue({ sub: 'actor-1', email: 'actor@example.com' });
    mocks.createUserClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => Promise.resolve({ data: [{ role }], error: null }),
          }),
        }),
      }),
    });
    return 'Bearer valid-token';
  }

  it('returns 401 for anonymous list/detail', async () => {
    expect((await request(app).get('/api/admin/bad-case-review-packs')).status).toBe(401);
    expect((await request(app).get(`/api/admin/bad-case-review-packs/${PACK_ID}`)).status).toBe(401);
  });

  it('returns 403 for ordinary admin on all review-pack routes', async () => {
    const auth = authorization('admin');
    const paths = [
      ['get', '/api/admin/bad-case-review-packs'],
      ['get', '/api/admin/bad-case-review-packs/diagnostics'],
      ['get', `/api/admin/bad-case-review-packs/${PACK_ID}`],
      ['post', `/api/admin/bad-case-review-packs/${PACK_ID}/assign`],
      ['post', `/api/admin/bad-case-review-packs/${PACK_ID}/status`],
      ['post', `/api/admin/bad-case-review-packs/${PACK_ID}/analyze`],
      ['post', `/api/admin/bad-case-findings/${PACK_ID}/review`],
      ['post', `/api/admin/bad-case-findings/${PACK_ID}/proposal`],
    ] as const;

    for (const [method, path] of paths) {
      const res =
        method === 'get'
          ? await request(app).get(path).set('Authorization', auth)
          : await request(app).post(path).set('Authorization', auth).send({});
      expect(res.status).toBe(403);
    }
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.scope).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('lists metadata only for super_admin without body fields', async () => {
    const res = await request(app)
      .get('/api/admin/bad-case-review-packs')
      .set('Authorization', authorization('super_admin'));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].score).toBe(42);
    expect(res.body.items[0].subjectOwner.ownerId).toBe(OWNER_ID);
    expect(JSON.stringify(res.body)).not.toMatch(/原始需求|低分文案|@example\.com/);
    expect(res.body.items[0]).not.toHaveProperty('sample');
    expect(res.body.items[0]).not.toHaveProperty('variants');
  });

  it('returns de-identified diagnostics for super_admin and validates range', async () => {
    const auth = authorization('super_admin');
    const res = await request(app)
      .get('/api/admin/bad-case-review-packs/diagnostics?from=2026-06-23&to=2026-07-22')
      .set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.summary.tokenCost).toBeNull();
    expect(JSON.stringify(res.body)).not.toMatch(/ownerId|source|variants|@example\.com/);
    expect(mocks.diagnostics).toHaveBeenCalledWith({ from: '2026-06-23', to: '2026-07-22' });

    const invalid = await request(app)
      .get('/api/admin/bad-case-review-packs/diagnostics?from=2026-01-01&to=2026-07-22')
      .set('Authorization', auth);
    expect(invalid.status).toBe(400);
    expect(mocks.diagnostics).toHaveBeenCalledTimes(1);
  });

  it('audits before body and fails closed when audit write fails', async () => {
    const ok = await request(app)
      .get(`/api/admin/bad-case-review-packs/${PACK_ID}`)
      .set('Authorization', authorization('super_admin'));
    expect(ok.status).toBe(200);
    expect(ok.body.sample.source).toBe('原始需求');
    expect(mocks.scope.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.audit.mock.invocationCallOrder[0]!,
    );
    expect(mocks.audit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.detail.mock.invocationCallOrder[0]!,
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-1',
        action: 'admin_view_bad_case_review_pack',
        entityId: PACK_ID,
      }),
    );

    mocks.audit.mockRejectedValueOnce(new Error('audit down'));
    mocks.detail.mockClear();
    const fail = await request(app)
      .get(`/api/admin/bad-case-review-packs/${PACK_ID}`)
      .set('Authorization', authorization('super_admin'));
    expect(fail.status).toBe(500);
    expect(mocks.detail).not.toHaveBeenCalled();
  });

  it('rechecks scope after audit and 404s soft-deleted packs without body read', async () => {
    mocks.visible
      .mockResolvedValueOnce(true) // initial scope visible
      .mockResolvedValueOnce(false); // recheck fails
    const res = await request(app)
      .get(`/api/admin/bad-case-review-packs/${PACK_ID}`)
      .set('Authorization', authorization('super_admin'));
    expect(res.status).toBe(404);
    expect(mocks.audit).toHaveBeenCalled();
    expect(mocks.detail).not.toHaveBeenCalled();
  });

  it('returns 404 when pack missing before audit', async () => {
    mocks.scope.mockResolvedValueOnce(null);
    const res = await request(app)
      .get(`/api/admin/bad-case-review-packs/${PACK_ID}`)
      .set('Authorization', authorization('super_admin'));
    expect(res.status).toBe(404);
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.detail).not.toHaveBeenCalled();
  });

  it('rejects short ids with 400', async () => {
    const res = await request(app)
      .get('/api/admin/bad-case-review-packs/8ac6256c')
      .set('Authorization', authorization('super_admin'));
    expect(res.status).toBe(400);
    expect(mocks.scope).not.toHaveBeenCalled();
  });

  it('maps service conflict and invalid input on writes', async () => {
    const { BadCaseReviewPackError } = await import('../services/badCaseReviewPackService.js');
    mocks.status.mockRejectedValueOnce(new BadCaseReviewPackError(409, 'CONFLICT'));
    const conflict = await request(app)
      .post(`/api/admin/bad-case-review-packs/${PACK_ID}/status`)
      .set('Authorization', authorization('super_admin'))
      .send({ status: 'resolved' });
    expect(conflict.status).toBe(409);

    mocks.assign.mockRejectedValueOnce(new BadCaseReviewPackError(400, 'INVALID_INPUT'));
    const badActor = await request(app)
      .post(`/api/admin/bad-case-review-packs/${PACK_ID}/assign`)
      .set('Authorization', authorization('super_admin'))
      .send({ ownerTeam: 'content_prompt', actorId: 'forged' });
    expect(badActor.status).toBe(400);
  });

  it('accepts assign/status/review/analyze/proposal for super_admin', async () => {
    const auth = authorization('super_admin');
    expect(
      (
        await request(app)
          .post(`/api/admin/bad-case-review-packs/${PACK_ID}/assign`)
          .set('Authorization', auth)
          .send({ ownerTeam: 'content_prompt' })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/api/admin/bad-case-review-packs/${PACK_ID}/status`)
          .set('Authorization', auth)
          .send({ status: 'triaging' })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/api/admin/bad-case-findings/${PACK_ID}/review`)
          .set('Authorization', auth)
          .send({ disposition: 'confirmed' })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/api/admin/bad-case-review-packs/${PACK_ID}/analyze`)
          .set('Authorization', auth)
          .send({})
      ).status,
    ).toBe(200);
    const proposal = await request(app)
      .post(`/api/admin/bad-case-findings/${PACK_ID}/proposal`)
      .set('Authorization', auth)
      .send({
        artifactType: 'rules',
        before: { contentHash: 'x', snapshot: { artifactType: 'rules', manifest: {} } },
        afterPatch: { ops: [] },
      });
    expect(proposal.status).toBe(200);
    expect(proposal.body.publishable).toBe(false);
    expect(proposal.body.status).toBe('pending_review');
  });

  it('returns 429 when analyze is rate limited', async () => {
    const { BadCaseReviewPackError } = await import('../services/badCaseReviewPackService.js');
    mocks.analyze.mockRejectedValueOnce(new BadCaseReviewPackError(429, 'RATE_LIMITED'));
    const res = await request(app)
      .post(`/api/admin/bad-case-review-packs/${PACK_ID}/analyze`)
      .set('Authorization', authorization('super_admin'))
      .send({});
    expect(res.status).toBe(429);
  });
});

