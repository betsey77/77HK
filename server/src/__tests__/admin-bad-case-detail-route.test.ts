import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(), createUserClient: vi.fn(),
  exists: vi.fn(), audit: vi.fn(), detail: vi.fn(), attempts: vi.fn(),
}));

vi.mock('../services/supabase.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/supabase.js')>()),
  verifyToken: mocks.verifyToken,
  createUserClient: mocks.createUserClient,
}));

vi.mock('../services/adminService.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/adminService.js')>()),
  adminGenerationExists: mocks.exists,
  writeAdminAuditLog: mocks.audit,
  getAdminGenerationDetail: mocks.detail,
}));

vi.mock('../services/adminMetricsService.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/adminMetricsService.js')>()),
  getAdminBadCaseModelAttempts: mocks.attempts,
}));

const JOB_ID = '7f177000-0000-4000-8000-000000000001';

describe('D6c audited bad-case detail route', () => {
  let app: Awaited<typeof import('../app.js')>['default'];

  beforeAll(async () => { app = (await import('../app.js')).default; });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockRejectedValue(new Error('No token'));
    mocks.exists.mockResolvedValue(true);
    mocks.audit.mockResolvedValue(undefined);
    mocks.detail.mockResolvedValue({ id: JOB_ID, source: '原始需求', variants: { ig: '低分文案' } });
    mocks.attempts.mockResolvedValue({ status: 'unavailable', items: [] });
  });

  function authorization(role: 'admin' | 'super_admin') {
    mocks.verifyToken.mockResolvedValue({ sub: 'actor-1', email: 'actor@example.com' });
    mocks.createUserClient.mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [{ role }], error: null }) }) }) }),
    });
    return 'Bearer valid-token';
  }

  it('requires super_admin and a full UUID', async () => {
    expect((await request(app).get(`/api/admin/metrics/bad-cases/${JOB_ID}`)).status).toBe(401);
    expect((await request(app).get(`/api/admin/metrics/bad-cases/${JOB_ID}`).set('Authorization', authorization('admin'))).status).toBe(403);
    expect((await request(app).get('/api/admin/metrics/bad-cases/8ac6256c').set('Authorization', authorization('super_admin'))).status).toBe(400);
    expect(mocks.exists).not.toHaveBeenCalled();
  });

  it('audits before reading the task body and returns detail when telemetry is unavailable', async () => {
    const response = await request(app)
      .get(`/api/admin/metrics/bad-cases/${JOB_ID}`)
      .set('Authorization', authorization('super_admin'));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      job: { id: JOB_ID, source: '原始需求', variants: { ig: '低分文案' } },
      modelAttempts: { status: 'unavailable', items: [] },
    });
    expect(mocks.exists).toHaveBeenCalledWith(JOB_ID, { actorId: 'actor-1', actorRole: 'super_admin' });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'actor-1', action: 'admin_view_bad_case_detail', entityId: JOB_ID,
    }));
    expect(mocks.audit.mock.invocationCallOrder[0]).toBeLessThan(mocks.detail.mock.invocationCallOrder[0]);
    expect(mocks.detail.mock.invocationCallOrder[0]).toBeLessThan(mocks.attempts.mock.invocationCallOrder[0]);
  });

  it('fails closed when the audit write fails', async () => {
    mocks.audit.mockRejectedValue(new Error('audit unavailable'));
    const response = await request(app)
      .get(`/api/admin/metrics/bad-cases/${JOB_ID}`)
      .set('Authorization', authorization('super_admin'));

    expect(response.status).toBe(500);
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(mocks.attempts).not.toHaveBeenCalled();
  });
});
