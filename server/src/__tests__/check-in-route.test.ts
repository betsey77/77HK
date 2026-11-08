import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const {
  mockVerifyToken,
  mockGetCheckInStatus,
  mockApplyDailyCheckIn,
  mockClaimCheckInMembershipGrant,
} = vi.hoisted(() => ({
  mockVerifyToken: vi.fn(),
  mockGetCheckInStatus: vi.fn(),
  mockApplyDailyCheckIn: vi.fn(),
  mockClaimCheckInMembershipGrant: vi.fn(),
}));

vi.mock('../services/supabase.js', () => ({
  getSupabase: () => null,
  createUserClient: vi.fn(),
  verifyToken: mockVerifyToken,
}));

vi.mock('../services/checkInService.js', () => ({
  getCheckInStatus: mockGetCheckInStatus,
  applyDailyCheckIn: mockApplyDailyCheckIn,
  claimCheckInMembershipGrant: mockClaimCheckInMembershipGrant,
}));

import app from '../app.js';

const USER_A = {
  sub: '11111111-1111-4111-8111-111111111111',
  email: 'a@example.com',
};
const USER_B_ID = '99999999-9999-4999-8999-999999999999';
const GRANT_ID = '22222222-2222-4222-8222-222222222222';
const STATUS = {
  checkedInToday: false,
  checkinDateHk: '2026-07-18',
  streakCount: 6,
  streakStartedOn: '2026-07-13',
  rewardEarned: false,
  rewardStatus: 'pending',
  grantId: GRANT_ID,
  canClaim: true,
  grantAppliedAt: null,
  subscriptionExpiresAt: '2026-07-01T00:00:00.000Z',
};

function authenticate() {
  mockVerifyToken.mockResolvedValue(USER_A);
  return 'Bearer valid-token';
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('check-in route auth', () => {
  it.each([
    ['get', '/api/me/check-in'],
    ['post', '/api/me/check-in'],
    ['post', `/api/me/membership-grants/${GRANT_ID}/claim`],
  ] as const)('rejects anonymous %s %s', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/me/check-in', () => {
  it('uses the authenticated owner and ignores a query userId', async () => {
    mockGetCheckInStatus.mockResolvedValue(STATUS);

    const res = await request(app)
      .get(`/api/me/check-in?userId=${USER_B_ID}`)
      .set('Authorization', authenticate());

    expect(res.status).toBe(200);
    expect(res.body).toEqual(STATUS);
    expect(mockGetCheckInStatus).toHaveBeenCalledWith(USER_A.sub);
  });
});

describe('POST /api/me/check-in', () => {
  it('uses the authenticated owner and ignores client user/date fields', async () => {
    mockApplyDailyCheckIn.mockResolvedValue({ ...STATUS, checkedInToday: true });

    const res = await request(app)
      .post('/api/me/check-in')
      .set('Authorization', authenticate())
      .send({ userId: USER_B_ID, checkinDateHk: '2099-01-01' });

    expect(res.status).toBe(200);
    expect(res.body.checkedInToday).toBe(true);
    expect(mockApplyDailyCheckIn).toHaveBeenCalledWith(USER_A.sub);
  });
});

describe('POST /api/me/membership-grants/:id/claim', () => {
  it('rejects a malformed grant UUID before calling the service', async () => {
    const res = await request(app)
      .post('/api/me/membership-grants/not-a-uuid/claim')
      .set('Authorization', authenticate());

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_GRANT_ID');
    expect(mockClaimCheckInMembershipGrant).not.toHaveBeenCalled();
  });

  it('binds the grant lookup to the authenticated owner', async () => {
    mockClaimCheckInMembershipGrant.mockResolvedValue({
      success: true,
      idempotent: false,
      grantId: GRANT_ID,
      grantStatus: 'applied',
      grantAppliedAt: '2026-07-19T04:00:00.000Z',
      subscriptionExpiresAt: '2026-08-18T04:00:00.000Z',
    });

    const res = await request(app)
      .post(`/api/me/membership-grants/${GRANT_ID}/claim`)
      .set('Authorization', authenticate())
      .send({ userId: USER_B_ID });

    expect(res.status).toBe(200);
    expect(mockClaimCheckInMembershipGrant).toHaveBeenCalledWith(USER_A.sub, GRANT_ID);
  });

  it('maps an unowned or missing grant to 404', async () => {
    mockClaimCheckInMembershipGrant.mockResolvedValue({ success: false, reason: 'not_found' });

    const res = await request(app)
      .post(`/api/me/membership-grants/${GRANT_ID}/claim`)
      .set('Authorization', authenticate());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('REWARD_NOT_FOUND');
  });

  it('maps an active Pro conflict to 409', async () => {
    mockClaimCheckInMembershipGrant.mockResolvedValue({
      success: false,
      reason: 'active_pro',
      grantId: GRANT_ID,
      grantStatus: 'pending',
      subscriptionExpiresAt: '2026-08-01T00:00:00.000Z',
    });

    const res = await request(app)
      .post(`/api/me/membership-grants/${GRANT_ID}/claim`)
      .set('Authorization', authenticate());

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'ACTIVE_PRO',
      grantStatus: 'pending',
      subscriptionExpiresAt: '2026-08-01T00:00:00.000Z',
    });
  });
});

describe('check-in route failures', () => {
  it('returns a generic 503 without leaking trusted-service details', async () => {
    mockGetCheckInStatus.mockRejectedValue({
      code: 'CHECK_IN_UNAVAILABLE',
      message: 'SUPABASE_SECRET_KEY=do-not-leak',
    });

    const res = await request(app)
      .get('/api/me/check-in')
      .set('Authorization', authenticate());

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Check-in service temporarily unavailable');
    expect(JSON.stringify(res.body)).not.toContain('SUPABASE_SECRET_KEY');
  });

  it('returns a generic 500 for unexpected failures', async () => {
    mockApplyDailyCheckIn.mockRejectedValue(new Error('unexpected internal detail'));

    const res = await request(app)
      .post('/api/me/check-in')
      .set('Authorization', authenticate());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toContain('internal detail');
  });

  it('returns a generic 500 for a deterministic invalid account state', async () => {
    mockApplyDailyCheckIn.mockRejectedValue({
      code: 'CHECK_IN_STATE_INVALID',
      message: 'subscription_not_found',
    });

    const res = await request(app)
      .post('/api/me/check-in')
      .set('Authorization', authenticate());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toContain('subscription_not_found');
  });
});
