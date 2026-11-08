import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock('../services/trustedSupabase.js', () => ({
  getTrustedSupabase: () => ({ rpc: mockRpc }),
}));

import { reserveQuotaWithReason } from '../services/quotaService.js';

const RESERVATION = {
  reservation_id: 'ledger-0000-0000-4000-a000-000000000001',
  user_id: 'user-001',
  subscription_id: 'sub-00000000-0000-4000-a000-000000000001',
  amount: 1,
  idempotency_key: 'ik-001',
};

describe('reserveQuotaWithReason', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the reservation from reserve_quota_v2 on success', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { reserved: true, ...RESERVATION },
      error: null,
    });

    const outcome = await reserveQuotaWithReason('user-001', 'ik-001');

    expect(mockRpc).toHaveBeenCalledWith('reserve_quota_v2', {
      _user_id: 'user-001',
      _idempotency_key: 'ik-001',
    });
    expect(outcome.reservation?.reservationId).toBe(RESERVATION.reservation_id);
    expect(outcome.reason).toBeNull();
  });

  it('returns the precise denial reason instead of a bare null', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        reserved: false,
        reason: 'period_expired',
        plan_name: 'Pro',
        period_end: '2026-09-22T01:31:24.000Z',
      },
      error: null,
    });

    const outcome = await reserveQuotaWithReason('user-001', 'ik-001');

    expect(outcome.reservation).toBeNull();
    expect(outcome.reason).toBe('period_expired');
    expect(outcome.planName).toBe('Pro');
    expect(outcome.periodEnd).toBe('2026-09-22T01:31:24.000Z');
  });

  it('maps an unknown reason string to "unknown"', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { reserved: false, reason: 'something_new' },
      error: null,
    });

    const outcome = await reserveQuotaWithReason('user-001', 'ik-001');

    expect(outcome.reason).toBe('unknown');
  });

  it('falls back to reserve_quota when the v2 function is not deployed', async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST202',
          message: 'Could not find the function public.reserve_quota_v2 in the schema cache',
        },
      })
      .mockResolvedValueOnce({ data: RESERVATION, error: null });

    const outcome = await reserveQuotaWithReason('user-001', 'ik-001');

    expect(mockRpc).toHaveBeenNthCalledWith(1, 'reserve_quota_v2', expect.anything());
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'reserve_quota', expect.anything());
    expect(outcome.reservation?.reservationId).toBe(RESERVATION.reservation_id);
    expect(outcome.reason).toBeNull();
  });

  it('reports "unknown" when even the v1 fallback is denied', async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Unknown RPC: reserve_quota_v2' },
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const outcome = await reserveQuotaWithReason('user-001', 'ik-001');

    expect(outcome.reservation).toBeNull();
    expect(outcome.reason).toBe('unknown');
  });

  it('accepts a legacy v1-shaped payload without a reserved flag', async () => {
    mockRpc.mockResolvedValueOnce({ data: RESERVATION, error: null });

    const outcome = await reserveQuotaWithReason('user-001', 'ik-001');

    expect(outcome.reservation?.reservationId).toBe(RESERVATION.reservation_id);
    expect(outcome.reason).toBeNull();
  });
});
