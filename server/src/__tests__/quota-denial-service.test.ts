import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('../services/trustedSupabase.js', () => ({
  getTrustedSupabase: () => ({ from: mocks.from }),
}));

import { recordQuotaDenial } from '../services/quotaDenialService.js';

const USER_ID = '44444444-4444-4444-8444-444444444444';
const JOB_ID = '55555555-5555-4555-8555-555555555555';
const TRACE_ID = '66666666-6666-4666-8666-666666666666';

describe('recordQuotaDenial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it('persists the machine-readable denial with trace and period', async () => {
    await expect(recordQuotaDenial({
      userId: USER_ID,
      jobId: JOB_ID,
      traceId: TRACE_ID,
      reason: 'period_expired',
      planName: 'Pro',
      periodEnd: '2026-09-22T01:31:24.000Z',
    })).resolves.toBe(true);

    expect(mocks.from).toHaveBeenCalledWith('quota_denial_events');
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: USER_ID,
      job_id: JOB_ID,
      trace_id: TRACE_ID,
      reason: 'period_expired',
      plan_name: 'Pro',
      period_end: '2026-09-22T01:31:24.000Z',
    });
  });

  it('does not persist the synthetic "unknown" reason', async () => {
    await expect(recordQuotaDenial({
      userId: USER_ID,
      jobId: JOB_ID,
      traceId: TRACE_ID,
      reason: 'unknown',
    })).resolves.toBe(false);

    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('is best-effort: a missing table or DB error never throws', async () => {
    mocks.insert.mockResolvedValue({ error: { code: '42P01', message: 'relation does not exist' } });

    await expect(recordQuotaDenial({
      userId: USER_ID,
      jobId: null,
      traceId: null,
      reason: 'quota_exhausted',
    })).resolves.toBe(false);
  });
});
