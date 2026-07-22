import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  createUserClient: vi.fn(),
  getOverview: vi.fn(),
}));

vi.mock('../services/supabase.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/supabase.js')>();
  return {
    ...actual,
    verifyToken: mocks.verifyToken,
    createUserClient: mocks.createUserClient,
  };
});

vi.mock('../services/adminMetricsService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/adminMetricsService.js')>();
  return { ...actual, getAdminMetricsOverview: mocks.getOverview };
});

describe('D6a admin metrics overview route', () => {
  let app: Awaited<typeof import('../app.js')>['default'];

  beforeAll(async () => {
    app = (await import('../app.js')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockRejectedValue(new Error('No token'));
    mocks.getOverview.mockResolvedValue({
      scope: 'group',
      reviewGroup: 'group-a',
      from: '2026-07-01',
      to: '2026-07-19',
      activity: { dau: 1, wau: 2, mau: 3 },
      membershipGrants: { total: 1, pending: 0, applied: 1 },
      quota: { consumed: 4, remaining: 16 },
    });
  });

  function authorization(role?: 'admin' | 'super_admin') {
    mocks.verifyToken.mockResolvedValue({ sub: 'actor-1', email: 'actor@example.com' });
    mocks.createUserClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => Promise.resolve({ data: role ? [{ role }] : [], error: null }),
          }),
        }),
      }),
    });
    return 'Bearer valid-token';
  }

  it('returns 401 for anonymous requests and 403 for non-admin users', async () => {
    expect((await request(app).get('/api/admin/metrics/overview')).status).toBe(401);
    expect((await request(app)
      .get('/api/admin/metrics/overview')
      .set('Authorization', authorization())).status).toBe(403);
    expect(mocks.getOverview).not.toHaveBeenCalled();
  });

  it('passes server-verified actor scope and validated dates to the service', async () => {
    const response = await request(app)
      .get('/api/admin/metrics/overview?from=2026-07-01&to=2026-07-19')
      .set('Authorization', authorization('admin'));

    expect(response.status).toBe(200);
    expect(mocks.getOverview).toHaveBeenCalledWith(
      { actorId: 'actor-1', actorRole: 'admin' },
      { from: '2026-07-01', to: '2026-07-19' },
    );
  });

  it('rejects invalid dates before querying metrics', async () => {
    const response = await request(app)
      .get('/api/admin/metrics/overview?from=2026/07/01&to=2026-07-19')
      .set('Authorization', authorization('super_admin'));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'invalid_metrics_range' });
    expect(mocks.getOverview).not.toHaveBeenCalled();
  });
});
