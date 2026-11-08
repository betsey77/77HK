import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('../services/trustedSupabase.js', () => ({
  getTrustedSupabase: () => ({ from: mocks.from }),
}));

import { recordModelCall, type ModelCallLogInput } from '../services/telemetryService.js';

const TRACE_ID = '33333333-3333-4333-8333-333333333333';

function input(overrides: Partial<ModelCallLogInput> = {}): ModelCallLogInput {
  return {
    jobId: null,
    requestId: '11111111-1111-4111-8111-111111111111',
    operation: 'generate',
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    status: 'success',
    errorClass: null,
    latencyMs: 100,
    attempt: 1,
    traceId: TRACE_ID,
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 15,
    cacheHitTokens: null,
    cacheMissTokens: null,
    usageSource: 'provider',
    ...overrides,
  };
}

describe('model call trace fields (post-migration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it('writes trace_id and HTTP status when provided', async () => {
    await expect(recordModelCall(input({ httpStatus: 502 }))).resolves.toBe(true);

    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      trace_id: TRACE_ID,
      http_status: 502,
    }));
  });

  it('retries the legacy row shape when the extended columns do not exist yet', async () => {
    mocks.insert
      .mockResolvedValueOnce({
        error: {
          code: 'PGRST204',
          message: "Could not find the 'trace_id' column of 'model_call_logs' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null });

    await expect(recordModelCall(input())).resolves.toBe(true);

    expect(mocks.insert).toHaveBeenCalledTimes(2);
    const first = mocks.insert.mock.calls[0][0] as Record<string, unknown>;
    const second = mocks.insert.mock.calls[1][0] as Record<string, unknown>;
    expect(first.trace_id).toBe(TRACE_ID);
    expect(second).not.toHaveProperty('trace_id');
  });

  it('keeps omitting extended columns after the database rejected them', async () => {
    await expect(recordModelCall(input())).resolves.toBe(true);

    const payload = mocks.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('trace_id');
  });
});
