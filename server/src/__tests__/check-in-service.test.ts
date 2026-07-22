import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetTrustedSupabase } = vi.hoisted(() => ({
  mockGetTrustedSupabase: vi.fn(),
}));

vi.mock('../services/trustedSupabase.js', () => ({
  getTrustedSupabase: mockGetTrustedSupabase,
}));

import {
  CheckInServiceError,
  CheckInStateError,
  applyDailyCheckIn,
  claimCheckInMembershipGrant,
  getCheckInStatus,
} from '../services/checkInService.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const GRANT_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-07-19T04:00:00.000Z');

function createQuery(data: unknown, error: unknown = null) {
  const query: Record<string, any> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  return query;
}

function configureReads(options: {
  checkIn?: unknown;
  grant?: unknown;
  subscription?: unknown;
  checkInError?: unknown;
}) {
  const queries = {
    daily_checkins: createQuery(options.checkIn ?? null, options.checkInError),
    membership_grants: createQuery(options.grant ?? null),
    subscriptions: createQuery(options.subscription ?? null),
  };
  const db = {
    from: vi.fn((table: keyof typeof queries) => queries[table]),
    rpc: vi.fn(),
  };
  mockGetTrustedSupabase.mockReturnValue(db);
  return { db, queries };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCheckInStatus', () => {
  it('returns an owner-scoped pending reward that can be claimed after Pro expires', async () => {
    const { queries } = configureReads({
      checkIn: {
        checkin_date_hk: '2026-07-19',
        streak_count: 7,
        streak_started_on: '2026-07-13',
      },
      grant: {
        id: GRANT_ID,
        status: 'pending',
        applied_at: null,
      },
      subscription: {
        status: 'active',
        current_period_start: '2026-06-01T00:00:00.000Z',
        current_period_end: '2026-07-01T00:00:00.000Z',
        plans: { name: 'Pro' },
      },
    });

    await expect(getCheckInStatus(USER_ID, NOW)).resolves.toEqual({
      checkedInToday: true,
      checkinDateHk: '2026-07-19',
      streakCount: 7,
      streakStartedOn: '2026-07-13',
      rewardEarned: false,
      rewardStatus: 'pending',
      grantId: GRANT_ID,
      canClaim: true,
      grantAppliedAt: null,
      subscriptionExpiresAt: '2026-07-01T00:00:00.000Z',
    });

    expect(queries.daily_checkins.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(queries.membership_grants.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(queries.membership_grants.eq).toHaveBeenCalledWith('source', 'checkin_7day');
    expect(queries.subscriptions.eq).toHaveBeenCalledWith('user_id', USER_ID);
  });

  it('keeps yesterday streak visible but blocks claim while Pro is active', async () => {
    configureReads({
      checkIn: {
        checkin_date_hk: '2026-07-18',
        streak_count: 6,
        streak_started_on: '2026-07-13',
      },
      grant: { id: GRANT_ID, status: 'pending', applied_at: null },
      subscription: {
        status: 'active',
        current_period_start: '2026-07-01T00:00:00.000Z',
        current_period_end: '2026-08-01T00:00:00.000Z',
        plans: [{ name: 'Pro' }],
      },
    });

    const result = await getCheckInStatus(USER_ID, NOW);

    expect(result.checkedInToday).toBe(false);
    expect(result.streakCount).toBe(6);
    expect(result.canClaim).toBe(false);
  });

  it('resets the effective streak when the last check-in is older than yesterday', async () => {
    configureReads({
      checkIn: {
        checkin_date_hk: '2026-07-17',
        streak_count: 4,
        streak_started_on: '2026-07-14',
      },
      grant: null,
      subscription: {
        status: 'active',
        current_period_start: '2026-07-01T00:00:00.000Z',
        current_period_end: '2026-07-26T00:00:00.000Z',
        plans: { name: 'Free' },
      },
    });

    const result = await getCheckInStatus(USER_ID, NOW);

    expect(result).toMatchObject({
      checkedInToday: false,
      checkinDateHk: '2026-07-17',
      streakCount: 0,
      streakStartedOn: null,
      rewardStatus: 'none',
      canClaim: false,
    });
  });

  it('changes checked-in-today at the Asia/Hong_Kong midnight boundary', async () => {
    configureReads({
      checkIn: {
        checkin_date_hk: '2026-07-19',
        streak_count: 3,
        streak_started_on: '2026-07-17',
      },
      grant: null,
      subscription: null,
    });

    const beforeMidnight = await getCheckInStatus(
      USER_ID,
      new Date('2026-07-19T15:59:59.999Z'),
    );
    const afterMidnight = await getCheckInStatus(
      USER_ID,
      new Date('2026-07-19T16:00:00.000Z'),
    );

    expect(beforeMidnight.checkedInToday).toBe(true);
    expect(afterMidnight.checkedInToday).toBe(false);
    expect(afterMidnight.streakCount).toBe(3);
  });

  it('sanitizes database failures', async () => {
    configureReads({
      checkInError: { message: 'SUPABASE_SECRET_KEY=do-not-leak' },
    });

    const error = await getCheckInStatus(USER_ID, NOW).catch((caught) => caught);

    expect(error).toBeInstanceOf(CheckInServiceError);
    expect(error.message).toBe('Check-in service unavailable');
    expect(error.message).not.toContain('SUPABASE_SECRET_KEY');
  });
});

describe('applyDailyCheckIn', () => {
  it('calls the trusted RPC with only the authenticated user and maps snake_case', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        checkin_id: '33333333-3333-4333-8333-333333333333',
        checkin_date_hk: '2026-07-19',
        checked_in_today: true,
        streak_count: 7,
        streak_started_on: '2026-07-13',
        reward_earned: true,
        grant_id: GRANT_ID,
        grant_status: 'applied',
        grant_applied_at: '2026-07-19T04:00:00.000Z',
        subscription_expires_at: '2026-08-18T04:00:00.000Z',
      },
      error: null,
    });
    mockGetTrustedSupabase.mockReturnValue({ rpc });

    const result = await applyDailyCheckIn(USER_ID, NOW);

    expect(rpc).toHaveBeenCalledWith('apply_daily_checkin', { _user_id: USER_ID });
    expect(result).toEqual({
      checkedInToday: true,
      checkinDateHk: '2026-07-19',
      streakCount: 7,
      streakStartedOn: '2026-07-13',
      rewardEarned: true,
      rewardStatus: 'applied',
      grantId: GRANT_ID,
      canClaim: false,
      grantAppliedAt: '2026-07-19T04:00:00.000Z',
      subscriptionExpiresAt: '2026-08-18T04:00:00.000Z',
    });
  });

  it('returns the same claimability model as GET for an expired pending reward', async () => {
    const { db, queries } = configureReads({
      subscription: {
        status: 'active',
        current_period_start: '2026-06-01T00:00:00.000Z',
        current_period_end: '2026-07-01T00:00:00.000Z',
        plans: { name: 'Pro' },
      },
    });
    db.rpc.mockResolvedValue({
      data: {
        checkin_id: '33333333-3333-4333-8333-333333333333',
        checkin_date_hk: '2026-07-19',
        checked_in_today: true,
        streak_count: 7,
        streak_started_on: '2026-07-13',
        reward_earned: false,
        grant_id: GRANT_ID,
        grant_status: 'pending',
        grant_applied_at: null,
        subscription_expires_at: '2026-07-01T00:00:00.000Z',
      },
      error: null,
    });

    const result = await applyDailyCheckIn(USER_ID, NOW);

    expect(result.canClaim).toBe(true);
    expect(queries.subscriptions.eq).toHaveBeenCalledWith('user_id', USER_ID);
  });

  it('fails closed for malformed RPC data', async () => {
    mockGetTrustedSupabase.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: { checked_in_today: true }, error: null }),
    });

    await expect(applyDailyCheckIn(USER_ID)).rejects.toBeInstanceOf(CheckInServiceError);
  });

  it('sanitizes RPC failures', async () => {
    mockGetTrustedSupabase.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'SUPABASE_SECRET_KEY=do-not-leak' },
      }),
    });

    const error = await applyDailyCheckIn(USER_ID).catch((caught) => caught);

    expect(error).toBeInstanceOf(CheckInServiceError);
    expect(error.message).toBe('Check-in service unavailable');
    expect(error.message).not.toContain('SUPABASE_SECRET_KEY');
  });

  it('separates a deterministic account-state failure from an unavailable service', async () => {
    mockGetTrustedSupabase.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'subscription_not_found' },
      }),
    });

    const error = await applyDailyCheckIn(USER_ID).catch((caught) => caught);

    expect(error).toBeInstanceOf(CheckInStateError);
    expect(error.code).toBe('CHECK_IN_STATE_INVALID');
    expect(error.message).not.toContain('subscription_not_found');
  });
});

describe('claimCheckInMembershipGrant', () => {
  it('maps not_found and sends the owner id with the grant id', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { success: false, reason: 'not_found' },
      error: null,
    });
    mockGetTrustedSupabase.mockReturnValue({ rpc });

    await expect(claimCheckInMembershipGrant(USER_ID, GRANT_ID)).resolves.toEqual({
      success: false,
      reason: 'not_found',
    });
    expect(rpc).toHaveBeenCalledWith('claim_checkin_membership_grant', {
      _user_id: USER_ID,
      _grant_id: GRANT_ID,
    });
  });

  it('maps active_pro without exposing internal subscription ids', async () => {
    mockGetTrustedSupabase.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: {
          success: false,
          reason: 'active_pro',
          grant_id: GRANT_ID,
          grant_status: 'pending',
          subscription_expires_at: '2026-08-01T00:00:00.000Z',
        },
        error: null,
      }),
    });

    await expect(claimCheckInMembershipGrant(USER_ID, GRANT_ID)).resolves.toEqual({
      success: false,
      reason: 'active_pro',
      grantId: GRANT_ID,
      grantStatus: 'pending',
      subscriptionExpiresAt: '2026-08-01T00:00:00.000Z',
    });
  });

  it('maps a successful idempotent claim without exposing subscription_id', async () => {
    mockGetTrustedSupabase.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: {
          success: true,
          idempotent: true,
          grant_id: GRANT_ID,
          grant_status: 'applied',
          grant_applied_at: '2026-07-19T04:00:00.000Z',
          subscription_id: 'internal-subscription-id',
          subscription_expires_at: '2026-08-18T04:00:00.000Z',
        },
        error: null,
      }),
    });

    await expect(claimCheckInMembershipGrant(USER_ID, GRANT_ID)).resolves.toEqual({
      success: true,
      idempotent: true,
      grantId: GRANT_ID,
      grantStatus: 'applied',
      grantAppliedAt: '2026-07-19T04:00:00.000Z',
      subscriptionExpiresAt: '2026-08-18T04:00:00.000Z',
    });
  });
});
