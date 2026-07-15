import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { mockPagePay } = vi.hoisted(() => ({
  mockPagePay: vi.fn(),
}));

vi.mock('../services/alipayAdapter.js', () => ({
  createAlipayAdapter: () => ({
    pagePay: mockPagePay,
    tradeQuery: vi.fn(),
    verifyNotify: vi.fn(),
  }),
}));

import { checkout, resetAlipayService } from '../services/alipayService.js';

const ORIGINAL_ENV = { ...process.env };

describe('Alipay checkout failure cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYMENT_MODE = 'alipay_sandbox';
    process.env.ALIPAY_APP_ID = '2021000000000000';
    process.env.ALIPAY_PRIVATE_KEY = 'test-private-key';
    process.env.ALIPAY_PUBLIC_KEY = 'test-public-key';
    delete process.env.ALIPAY_PRIVATE_KEY_FILE;
    delete process.env.ALIPAY_PUBLIC_KEY_FILE;
    resetAlipayService();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetAlipayService();
  });

  it('marks the newly inserted order failed when page-pay signing fails', async () => {
    mockPagePay.mockRejectedValue(new Error('decoder error'));

    const planBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ id: 'plan-pro', name: 'Pro', price_fen: 1900 }],
        error: null,
      }),
    };
    const subscriptionBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const existingOrderBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const insertSingle = vi.fn().mockResolvedValue({
      data: { id: 'order-new' },
      error: null,
    });
    const insertBuilder = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: insertSingle }),
      }),
    };
    const updateSecondEq = vi.fn().mockResolvedValue({ error: null });
    const updateFirstEq = vi.fn().mockReturnValue({ eq: updateSecondEq });
    const update = vi.fn().mockReturnValue({ eq: updateFirstEq });

    const builders = [
      planBuilder,
      subscriptionBuilder,
      existingOrderBuilder,
      insertBuilder,
      { update },
    ];
    const db = { from: vi.fn(() => builders.shift()) };

    await expect(checkout({
      userId: '11111111-1111-1111-1111-111111111111',
      planId: 'pro',
      idempotencyKey: 'failure-cleanup-test',
      returnUrl: 'http://localhost:5173/billing/success',
      notifyUrl: 'https://example.com/api/billing/alipay/notify',
    }, db)).rejects.toThrow('decoder error');

    expect(update).toHaveBeenCalledWith({
      status: 'failed',
      error_code: 'PAYMENT_INIT_FAILED',
    });
    expect(updateFirstEq).toHaveBeenCalledWith('id', 'order-new');
    expect(updateSecondEq).toHaveBeenCalledWith('status', 'pending');
  });
});
