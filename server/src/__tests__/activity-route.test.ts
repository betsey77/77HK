import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRecordAppActivity, mockVerifyToken } = vi.hoisted(() => ({
  mockRecordAppActivity: vi.fn(),
  mockVerifyToken: vi.fn(),
}));

vi.mock('../services/supabase.js', () => ({
  createUserClient: vi.fn(),
  verifyToken: mockVerifyToken,
}));

vi.mock('../services/telemetryService.js', () => ({
  recordAppActivity: mockRecordAppActivity,
}));

import meRouter from '../routes/me.js';

const app = express();
app.use(express.json());
app.use('/api', meRouter);

describe('POST /api/me/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyToken.mockResolvedValue({
      sub: '22222222-2222-4222-8222-222222222222',
      email: 'activity@example.invalid',
    });
    mockRecordAppActivity.mockResolvedValue(undefined);
  });

  it('records the authenticated user without accepting a client date or user id', async () => {
    const response = await request(app)
      .post('/api/me/activity')
      .set('Authorization', 'Bearer valid-token')
      .send({
        userId: '99999999-9999-4999-8999-999999999999',
        activityDateHk: '1999-01-01',
      });

    expect(response.status).toBe(204);
    expect(mockRecordAppActivity).toHaveBeenCalledTimes(1);
    expect(mockRecordAppActivity).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
    );
  });

  it('requires authentication and sanitizes an unavailable telemetry writer', async () => {
    const anonymous = await request(app).post('/api/me/activity');
    expect(anonymous.status).toBe(401);

    mockRecordAppActivity.mockRejectedValueOnce(new Error('database detail'));
    const unavailable = await request(app)
      .post('/api/me/activity')
      .set('Authorization', 'Bearer valid-token');

    expect(unavailable.status).toBe(503);
    expect(unavailable.body).toEqual({ error: 'Activity telemetry unavailable' });
    expect(JSON.stringify(unavailable.body)).not.toContain('database detail');
  });
});
