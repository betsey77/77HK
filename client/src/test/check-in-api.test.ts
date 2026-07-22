import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAuthApiFetch } = vi.hoisted(() => ({
  mockAuthApiFetch: vi.fn(),
}));

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  authApiFetch: mockAuthApiFetch,
}));

import {
  CheckInApiError,
  claimCheckInGrant,
  getCheckInStatus,
  performDailyCheckIn,
} from '../services/checkInApi';

const STATUS = {
  checkedInToday: false,
  checkinDateHk: '2026-07-18',
  streakCount: 6,
  streakStartedOn: '2026-07-13',
  rewardEarned: false,
  rewardStatus: 'none' as const,
  grantId: null,
  canClaim: false,
  grantAppliedAt: null,
  subscriptionExpiresAt: '2026-07-25T00:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('check-in API client', () => {
  it('loads the authenticated status without sending user or date fields', async () => {
    mockAuthApiFetch.mockResolvedValue(jsonResponse(STATUS));

    await expect(getCheckInStatus()).resolves.toEqual(STATUS);
    expect(mockAuthApiFetch).toHaveBeenCalledWith('/me/check-in', expect.objectContaining({
      method: 'GET',
    }));
    expect(JSON.stringify(mockAuthApiFetch.mock.calls[0])).not.toContain('userId');
    expect(JSON.stringify(mockAuthApiFetch.mock.calls[0])).not.toContain('checkinDate');
  });

  it('posts an empty authenticated check-in and validates the full status response', async () => {
    mockAuthApiFetch.mockResolvedValue(jsonResponse({
      ...STATUS,
      checkedInToday: true,
      checkinDateHk: '2026-07-19',
      streakCount: 7,
      rewardEarned: true,
      rewardStatus: 'applied',
    }));

    const result = await performDailyCheckIn();

    expect(result.streakCount).toBe(7);
    expect(mockAuthApiFetch).toHaveBeenCalledWith('/me/check-in', expect.objectContaining({
      method: 'POST',
    }));
    expect(mockAuthApiFetch.mock.calls[0][1]?.body).toBeUndefined();
  });

  it('rejects malformed status instead of inventing client defaults', async () => {
    mockAuthApiFetch.mockResolvedValue(jsonResponse({ checkedInToday: true }));

    const error = await getCheckInStatus().catch((caught) => caught);

    expect(error).toBeInstanceOf(CheckInApiError);
    expect(error.code).toBe('MALFORMED_RESPONSE');
  });

  it('preserves claim status/code/details for UI branching without exposing raw text', async () => {
    mockAuthApiFetch.mockResolvedValue(jsonResponse({
      error: 'Current Pro period is still active',
      code: 'ACTIVE_PRO',
      grantStatus: 'pending',
      subscriptionExpiresAt: '2026-08-01T00:00:00.000Z',
    }, 409));

    const error = await claimCheckInGrant('22222222-2222-4222-8222-222222222222')
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(CheckInApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'ACTIVE_PRO',
      subscriptionExpiresAt: '2026-08-01T00:00:00.000Z',
    });
    expect(error.message).toBe('奖励暂时无法领取');
  });

  it('maps a successful claim without treating it as a full check-in status', async () => {
    mockAuthApiFetch.mockResolvedValue(jsonResponse({
      success: true,
      idempotent: false,
      grantId: '22222222-2222-4222-8222-222222222222',
      grantStatus: 'applied',
      grantAppliedAt: '2026-07-19T04:00:00.000Z',
      subscriptionExpiresAt: '2026-08-18T04:00:00.000Z',
    }));

    const result = await claimCheckInGrant('22222222-2222-4222-8222-222222222222');

    expect(result.success).toBe(true);
    expect(result.grantStatus).toBe('applied');
    expect(mockAuthApiFetch).toHaveBeenCalledWith(
      '/me/membership-grants/22222222-2222-4222-8222-222222222222/claim',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
