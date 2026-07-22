import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

vi.mock('../services/supabase', () => ({
  supabase: { auth: { getSession: mockGetSession } },
}));

import {
  getAdminBadCaseDetail,
  getAdminBadCases,
  getAdminMetricsOverview,
  getAdminModelMetrics,
  getAdminProviderBalance,
} from '../services/adminMetricsApi';

describe('D6 admin metrics API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'session-jwt' } }, error: null });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(
      () => Promise.resolve(new Response('{}', { status: 200 })),
    ));
  });

  it('uses authenticated GET requests for the four allowlisted metrics paths', async () => {
    await Promise.all([
      getAdminMetricsOverview(),
      getAdminModelMetrics(),
      getAdminBadCases(),
      getAdminProviderBalance(),
    ]);

    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      '/api/admin/metrics/overview',
      '/api/admin/metrics/models',
      '/api/admin/metrics/bad-cases',
      '/api/admin/metrics/provider-balance',
    ]);
    for (const [, init] of vi.mocked(fetch).mock.calls) {
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer session-jwt');
    }
  });

  it('preserves the forbidden state for super-admin-only endpoints', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })));
    await expect(getAdminModelMetrics()).rejects.toThrow('FORBIDDEN');
  });

  it('requests an audited bad-case detail with the full encoded UUID', async () => {
    await getAdminBadCaseDetail('7f177000-0000-4000-8000-000000000001');
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/metrics/bad-cases/7f177000-0000-4000-8000-000000000001',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer session-jwt' }) }),
    );
  });
});
