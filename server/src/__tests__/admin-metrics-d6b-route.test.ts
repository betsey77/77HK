import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(), createUserClient: vi.fn(),
  models: vi.fn(), badCases: vi.fn(), balance: vi.fn(),
}));

vi.mock('../services/supabase.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/supabase.js')>()),
  verifyToken: mocks.verifyToken,
  createUserClient: mocks.createUserClient,
}));

vi.mock('../services/adminMetricsService.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/adminMetricsService.js')>()),
  getAdminModelMetrics: mocks.models,
  getAdminBadCases: mocks.badCases,
}));

vi.mock('../services/providerBalanceService.js', () => ({
  getDeepSeekProviderBalance: mocks.balance,
}));

describe('D6b super-admin metrics routes', () => {
  let app: Awaited<typeof import('../app.js')>['default'];

  beforeAll(async () => { app = (await import('../app.js')).default; });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockRejectedValue(new Error('No token'));
    mocks.models.mockResolvedValue({ from: '2026-07-01', to: '2026-07-19', rows: [] });
    mocks.badCases.mockResolvedValue({ from: '2026-07-01', to: '2026-07-19', threshold: 50, items: [] });
    mocks.balance.mockResolvedValue({ provider: 'deepseek', status: 'unavailable' });
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

  it.each(['/api/admin/metrics/models', '/api/admin/metrics/bad-cases', '/api/admin/metrics/provider-balance'])
  ('requires super_admin for %s', async (path) => {
    expect((await request(app).get(path)).status).toBe(401);
    expect((await request(app).get(path).set('Authorization', authorization())).status).toBe(403);
    expect((await request(app).get(path).set('Authorization', authorization('admin'))).status).toBe(403);
  });

  it('passes validated ranges only after the super-admin gate', async () => {
    const token = authorization('super_admin');
    const models = await request(app)
      .get('/api/admin/metrics/models?from=2026-07-01&to=2026-07-19')
      .set('Authorization', token);
    const badCases = await request(app)
      .get('/api/admin/metrics/bad-cases?from=2026-07-01&to=2026-07-19')
      .set('Authorization', token);
    const balance = await request(app)
      .get('/api/admin/metrics/provider-balance')
      .set('Authorization', token);

    expect([models.status, badCases.status, balance.status]).toEqual([200, 200, 200]);
    expect(mocks.models).toHaveBeenCalledWith({ from: '2026-07-01', to: '2026-07-19' });
    expect(mocks.badCases).toHaveBeenCalledWith({ from: '2026-07-01', to: '2026-07-19' });
    expect(mocks.balance).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid model range before database work', async () => {
    const response = await request(app)
      .get('/api/admin/metrics/models?from=2026/07/01&to=2026-07-19')
      .set('Authorization', authorization('super_admin'));
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'invalid_metrics_range' });
    expect(mocks.models).not.toHaveBeenCalled();
  });
});
