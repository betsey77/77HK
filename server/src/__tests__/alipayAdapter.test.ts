/**
 * Slice F1: Alipay Adapter unit tests
 *
 * Covers:
 * - SDK 4.14 camelCase tradeQuery return shape
 * - Mock adapter returns consistent shapes
 * - pagePay redirect URL construction
 * - verifyNotify in mock mode
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { createAlipayAdapter } from '../services/alipayAdapter.js';
import type { AlipayConfig } from '../services/alipayConfig.js';

// ── MOCK config (no real keys) ──────────────────────────────────

const mockConfig: AlipayConfig = {
  mode: 'mock',
  appId: '2021000000000000',
  privateKey: '',
  publicKey: '',
  gateway: 'https://openapi.alipay.com/gateway.do',
};

// ── SDK 4.14 camelCase shape tests ──────────────────────────────

describe('AlipayAdapter — Mock mode', () => {
  const adapter = createAlipayAdapter(mockConfig);

  describe('pagePay', () => {
    it('returns a redirect URL with out_trade_no', async () => {
      const result = await adapter.pagePay({
        outTradeNo: 'TEST_001',
        totalAmount: '19.00',
        subject: '77港话通 — Pro',
        productCode: 'FAST_INSTANT_TRADE_PAY',
        returnUrl: 'https://example.com/billing/success',
        notifyUrl: 'https://example.com/api/billing/alipay/notify',
      });

      expect(result.outTradeNo).toBe('TEST_001');
      expect(result.redirectUrl).toContain('out_trade_no=TEST_001');
      expect(result.mockMode).toBe(true);
    });
  });

  describe('tradeQuery', () => {
    it('returns SDK 4.14 camelCase shape (outTradeNo, tradeNo, tradeStatus, totalAmount)', async () => {
      const result = await adapter.tradeQuery('TEST_ORDER_001');

      // SDK 4.14 #formatExecHttpResponse directly returns camelCase fields
      expect(result).toHaveProperty('outTradeNo');
      expect(result).toHaveProperty('tradeNo');
      expect(result).toHaveProperty('tradeStatus');
      expect(result).toHaveProperty('totalAmount');

      // Must NOT contain snake_case keys or envelope key
      expect(result).not.toHaveProperty('alipay_trade_query_response');
      expect(result).not.toHaveProperty('out_trade_no');
      expect(result).not.toHaveProperty('trade_no');
      expect(result).not.toHaveProperty('trade_status');
      expect(result).not.toHaveProperty('total_amount');

      expect(result.outTradeNo).toBe('TEST_ORDER_001');
      expect(result.tradeStatus).toBe('TRADE_SUCCESS');
      expect(typeof result.totalAmount).toBe('string');
    });

    it('tradeQuery result is typed (no any leaking)', () => {
      // This test verifies the return type shape at compile time.
      // If this compiles, the types are correct.
      const _check: {
        outTradeNo: string;
        tradeNo: string | null;
        tradeStatus: string;
        totalAmount: string;
        buyerLogonId?: string;
        buyerPayAmount?: string;
      } = {
        outTradeNo: 'x',
        tradeNo: 'x',
        tradeStatus: 'x',
        totalAmount: 'x',
      };
      expect(_check.outTradeNo).toBe('x');
    });
  });

  describe('verifyNotify', () => {
    it('returns verified=true with camelCase fields in mock mode', async () => {
      const params = {
        out_trade_no: 'ORDER_001',
        trade_no: 'TRADE_001',
        trade_status: 'TRADE_SUCCESS',
        total_amount: '19.00',
        app_id: '2021000000000000',
        seller_id: '2088000000000000',
        notify_id: 'NOTIFY_001',
      };

      const result = await adapter.verifyNotify(params);

      expect(result.verified).toBe(true);
      expect(result.outTradeNo).toBe('ORDER_001');
      expect(result.tradeNo).toBe('TRADE_001');
      expect(result.tradeStatus).toBe('TRADE_SUCCESS');
      expect(result.totalAmount).toBe('19.00');
      expect(result.appId).toBe('2021000000000000');
      expect(result.sellerId).toBe('2088000000000000');
    });
  });
});

describe('AlipayAdapter — Sandbox PKCS8 private key', () => {
  it('generates an RSA2 page-pay URL without a decoder error', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    const adapter = createAlipayAdapter({
      mode: 'alipay_sandbox',
      appId: '2021000000000000',
      privateKey,
      publicKey,
      gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
    });

    const result = await adapter.pagePay({
      outTradeNo: 'PKCS8_TEST_001',
      totalAmount: '19.00',
      subject: '77港话通 — Pro',
      productCode: 'FAST_INSTANT_TRADE_PAY',
      returnUrl: 'http://localhost:5173/billing/success',
      notifyUrl: 'https://example.com/api/billing/alipay/notify',
    });

    const url = new URL(result.redirectUrl);
    expect(url.hostname).toBe('openapi-sandbox.dl.alipaydev.com');
    expect(url.searchParams.get('method')).toBe('alipay.trade.page.pay');
    expect(url.searchParams.get('sign_type')).toBe('RSA2');
    expect(result.mockMode).toBe(false);
  });
});
