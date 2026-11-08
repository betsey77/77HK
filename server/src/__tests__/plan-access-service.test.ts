import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('../services/trustedSupabase.js', () => ({
  getTrustedSupabase: () => ({ from: mockFrom }),
}));

import { resolveUserPlanId } from '../services/planAccessService.js';

function chain(result: { data: unknown; error: unknown }) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = vi.fn(self);
  api.eq = vi.fn(self);
  api.lte = vi.fn(self);
  api.gt = vi.fn(self);
  api.order = vi.fn(self);
  api.limit = vi.fn(async () => result);
  return api;
}

describe('resolveUserPlanId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYMENT_MODE = 'mock';
  });

  it('returns pro for active Pro subscription even when PAYMENT_MODE=mock', async () => {
    mockFrom.mockReturnValue(chain({
      data: [{ plans: { name: 'Pro' } }],
      error: null,
    }));

    await expect(resolveUserPlanId('user-pro')).resolves.toBe('pro');
  });

  it('bounds the query by current_period_start/end so an expired Pro row cannot unlock Pro', async () => {
    const api = chain({
      data: [{ plans: { name: 'Pro' } }],
      error: null,
    });
    mockFrom.mockReturnValue(api);

    await expect(resolveUserPlanId('user-expired')).resolves.toBe('pro');

    // SQL-level filtering is the contract: the DB must only return a started,
    // unexpired subscription. The client never decides expiry.
    expect(api.lte).toHaveBeenCalledWith('current_period_start', expect.any(String));
    expect(api.gt).toHaveBeenCalledWith('current_period_end', expect.any(String));
  });

  it('returns free when no started/unexpired subscription row is returned', async () => {
    mockFrom.mockReturnValue(chain({
      data: [],
      error: null,
    }));

    await expect(resolveUserPlanId('user-expired')).resolves.toBe('free');
  });

  it('returns free when no active subscription exists', async () => {
    mockFrom.mockReturnValue(chain({
      data: [],
      error: null,
    }));

    await expect(resolveUserPlanId('user-free')).resolves.toBe('free');
  });

  it('returns free when trusted DB throws', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Trusted service unavailable');
    });

    await expect(resolveUserPlanId('user-x')).resolves.toBe('free');
  });
});
