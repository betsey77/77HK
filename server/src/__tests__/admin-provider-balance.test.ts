import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ proxyFetch: vi.fn() }));

vi.mock('../services/proxyFetch.js', () => ({ proxyFetch: mocks.proxyFetch }));

import {
  getDeepSeekProviderBalance,
  resetDeepSeekBalanceCacheForTests,
} from '../services/providerBalanceService.js';

function response(body: unknown, ok = true): Response {
  return { ok, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

describe('D6b DeepSeek provider balance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    resetDeepSeekBalanceCacheForTests();
    process.env.DEEPSEEK_API_KEY = 'test-secret-key';
  });

  it('returns unavailable without a key and never calls the provider', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    await expect(getDeepSeekProviderBalance()).resolves.toEqual({ provider: 'deepseek', status: 'unavailable' });
    expect(mocks.proxyFetch).not.toHaveBeenCalled();
  });

  it.each([
    ['transport error', () => mocks.proxyFetch.mockRejectedValue(new Error('secret raw error'))],
    ['non-2xx', () => mocks.proxyFetch.mockResolvedValue(response({}, false))],
    ['invalid schema', () => mocks.proxyFetch.mockResolvedValue(response({ is_available: true, balance_infos: [{ currency: 'EUR', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] }))],
  ])('maps %s to a privacy-safe unavailable state', async (_label, arrange) => {
    arrange();
    const result = await getDeepSeekProviderBalance();
    expect(result).toEqual({ provider: 'deepseek', status: 'unavailable' });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('keeps a valid zero balance and is_available=false distinct from provider failure', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T03:00:00Z'));
    mocks.proxyFetch.mockResolvedValue(response({
      is_available: false,
      balance_infos: [{ currency: 'CNY', total_balance: '0.00', granted_balance: '0', topped_up_balance: '0.00' }],
    }));

    await expect(getDeepSeekProviderBalance()).resolves.toEqual({
      provider: 'deepseek', status: 'ok', isAvailable: false,
      balances: [{ currency: 'CNY', totalBalance: '0.00', grantedBalance: '0', toppedUpBalance: '0.00' }],
      fetchedAt: '2026-07-19T03:00:00.000Z',
    });
    expect(mocks.proxyFetch).toHaveBeenCalledWith('https://api.deepseek.com/user/balance', expect.objectContaining({
      timeout: 5000,
      headers: { Authorization: 'Bearer test-secret-key' },
    }));
  });

  it('caches only valid responses for ten minutes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T03:00:00Z'));
    mocks.proxyFetch.mockResolvedValue(response({ is_available: true, balance_infos: [] }));

    await getDeepSeekProviderBalance();
    await getDeepSeekProviderBalance();
    expect(mocks.proxyFetch).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    await getDeepSeekProviderBalance();
    expect(mocks.proxyFetch).toHaveBeenCalledTimes(2);
  });
});
