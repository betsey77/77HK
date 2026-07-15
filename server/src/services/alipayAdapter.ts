/**
 * Slice F1: Alipay Adapter
 *
 * Wraps the alipay-sdk with mock and sandbox modes.
 * NEVER logs private keys, full request bodies, or signatures.
 *
 * MOCK mode: Returns deterministic fake responses. No network calls.
 * SANDBOX mode: Uses alipay-sdk v4.14.0 ESM import for sandbox gateway.
 */

import { AlipaySdk } from 'alipay-sdk';
import type { AlipaySdkConfig } from 'alipay-sdk';
import { loadAlipayConfig } from './alipayConfig.js';
import type { AlipayConfig } from './alipayConfig.js';

export interface PagePayParams {
  outTradeNo: string;
  totalAmount: string;        // yuan string, e.g. "19.00"
  subject: string;
  body?: string;
  productCode?: string;
  returnUrl?: string;
  notifyUrl?: string;
}

export interface PagePayResult {
  redirectUrl: string;       // Alipay page pay redirect URL (GET mode — safe, no HTML injection)
  outTradeNo: string;
  mockMode: boolean;
}

export interface TradeQueryResult {
  outTradeNo: string;
  tradeNo: string | null;
  tradeStatus: string;       // WAIT_BUYER_PAY, TRADE_SUCCESS, TRADE_FINISHED, TRADE_CLOSED
  totalAmount: string;
  buyerLogonId?: string;
  buyerPayAmount?: string;
}

export interface NotifyVerificationResult {
  verified: boolean;
  outTradeNo: string;
  tradeNo: string;
  tradeStatus: string;
  totalAmount: string;
  appId: string;
  sellerId: string;
  buyerId?: string;
  notifyId: string;
  gmtPayment?: string;
}

/**
 * Adapter interface — allows swapping mock/real implementations.
 */
export interface AlipayAdapter {
  pagePay(params: PagePayParams): Promise<PagePayResult>;
  tradeQuery(outTradeNo: string): Promise<TradeQueryResult>;
  verifyNotify(params: Record<string, string>): Promise<NotifyVerificationResult>;
}

/**
 * MOCK adapter — returns deterministic fake responses.
 * Used when PAYMENT_MODE=mock (default).
 */
class MockAlipayAdapter implements AlipayAdapter {
  private mockTradeNoCounter = 0;

  async pagePay(params: PagePayParams): Promise<PagePayResult> {
    this.mockTradeNoCounter += 1;
    const mockTradeNo = `mock_alipay_${Date.now()}_${this.mockTradeNoCounter}`;

    // In mock mode, return a URL that simulates Alipay redirect
    const redirectUrl = `/billing/success?out_trade_no=${params.outTradeNo}&trade_no=${mockTradeNo}&mock=true`;

    return {
      redirectUrl,
      outTradeNo: params.outTradeNo,
      mockMode: true,
    };
  }

  async tradeQuery(outTradeNo: string): Promise<TradeQueryResult> {
    // Mock: always return success after a "payment"
    return {
      outTradeNo,
      tradeNo: `mock_alipay_trade_${outTradeNo}`,
      tradeStatus: 'TRADE_SUCCESS',
      totalAmount: '0.01', // mock
      buyerLogonId: 'mock***@example.com',
      buyerPayAmount: '0.01',
    };
  }

  async verifyNotify(params: Record<string, string>): Promise<NotifyVerificationResult> {
    // Mock: always return verified success
    return {
      verified: true,
      outTradeNo: params.out_trade_no || '',
      tradeNo: params.trade_no || `mock_alipay_notify_trade`,
      tradeStatus: params.trade_status || 'TRADE_SUCCESS',
      totalAmount: params.total_amount || '0.01',
      appId: params.app_id || '',
      sellerId: params.seller_id || '',
      notifyId: params.notify_id || `mock_notify_${Date.now()}`,
    };
  }
}

/**
 * Sandbox adapter — uses real alipay-sdk (ESM static import).
 * Uses pageExecute('GET') for safe redirect URLs (no HTML injection).
 */
class SandboxAlipayAdapter implements AlipayAdapter {
  private sdk: AlipaySdk;
  private config: AlipayConfig;

  constructor(config: AlipayConfig) {
    this.config = config;

    const sdkConfig: AlipaySdkConfig = {
      appId: config.appId,
      privateKey: config.privateKey,
      alipayPublicKey: config.publicKey,
      gateway: config.gateway,
      signType: 'RSA2',
      // Alipay's key tool commonly exports PKCS8 (BEGIN PRIVATE KEY), while
      // alipay-sdk defaults to PKCS1. Passing the wrong type makes the SDK
      // re-wrap the PEM incorrectly and OpenSSL rejects it during RSA2 signing.
      keyType: config.privateKey.includes('-----BEGIN PRIVATE KEY-----')
        ? 'PKCS8'
        : 'PKCS1',
    };

    this.sdk = new AlipaySdk(sdkConfig);
  }

  /**
   * Computer website payment — generates a redirect URL (GET mode).
   *
   * Uses pageExecute('GET') to produce a safe, navigable URL.
   * NO HTML form injection — the client navigates via window.location.href.
   * This avoids XSS / CSP risks.
   */
  async pagePay(params: PagePayParams): Promise<PagePayResult> {
    // pageExecute with 'GET' returns a URL string (not HTML form)
    const redirectUrl = this.sdk.pageExecute('alipay.trade.page.pay', 'GET', {
      bizContent: {
        out_trade_no: params.outTradeNo,
        product_code: params.productCode || 'FAST_INSTANT_TRADE_PAY',
        total_amount: params.totalAmount,
        subject: params.subject,
        body: params.body || '',
      },
      returnUrl: params.returnUrl,
      notifyUrl: params.notifyUrl,
    });

    return {
      redirectUrl,
      outTradeNo: params.outTradeNo,
      mockMode: false,
    };
  }

  /**
   * Trade query — calls alipay.trade.query via exec().
   *
   * exec() is the correct API for server-side Alipay OpenAPI calls.
   * SDK 4.14 #formatExecHttpResponse directly returns camelCase business
   * objects (tradeStatus/outTradeNo/tradeNo/totalAmount), NOT the raw
   * alipay_trade_query_response envelope.
   */
  async tradeQuery(outTradeNo: string): Promise<TradeQueryResult> {
    const result = await this.sdk.exec('alipay.trade.query', {
      bizContent: {
        out_trade_no: outTradeNo,
      },
    });

    // SDK 4.14 returns camelCase directly — no envelope key
    const resp = result as Record<string, unknown>;
    return {
      outTradeNo: (resp.outTradeNo as string) ?? outTradeNo,
      tradeNo: (resp.tradeNo as string) ?? null,
      tradeStatus: (resp.tradeStatus as string) ?? 'WAIT_BUYER_PAY',
      totalAmount: (resp.totalAmount as string) ?? '0',
      buyerLogonId: resp.buyerLogonId as string | undefined,
      buyerPayAmount: resp.buyerPayAmount as string | undefined,
    };
  }

  /**
   * Notify signature verification — uses checkNotifySignV2.
   */
  async verifyNotify(params: Record<string, string>): Promise<NotifyVerificationResult> {
    const signVerified = this.sdk.checkNotifySignV2(params);

    return {
      verified: signVerified,
      outTradeNo: params.out_trade_no || '',
      tradeNo: params.trade_no || '',
      tradeStatus: params.trade_status || '',
      totalAmount: params.total_amount || '0',
      appId: params.app_id || '',
      sellerId: params.seller_id || '',
      buyerId: params.buyer_id,
      notifyId: params.notify_id || '',
      gmtPayment: params.gmt_payment,
    };
  }
}

/**
 * Factory: returns the correct adapter based on AlipayConfig.mode.
 */
export function createAlipayAdapter(config: AlipayConfig): AlipayAdapter {
  if (config.mode === 'alipay_sandbox') {
    return new SandboxAlipayAdapter(config);
  }
  return new MockAlipayAdapter();
}
