/**
 * Slice F1: Alipay Configuration Loader
 *
 * Loads Alipay credentials from environment variables or file pointers.
 * NEVER logs, exports, or embeds private keys in responses.
 *
 * Configuration priority:
 *   1. ALIPAY_PRIVATE_KEY_FILE / ALIPAY_PUBLIC_KEY_FILE — file pointers
 *   2. ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY — direct env values
 *
 * PAYMENT_MODE controls behaviour:
 *   - 'mock' (default): No real Alipay; all operations return fake responses.
 *   - 'alipay_sandbox': Real sandbox gateway; no production.
 *   - 'production': FORBIDDEN in this slice.
 */

import fs from 'fs';

export type PaymentMode = 'mock' | 'alipay_sandbox' | 'production';

export interface AlipayConfig {
  mode: PaymentMode;
  appId: string;
  privateKey: string;
  publicKey: string;       // Alipay public key (for signature verification)
  gateway: string;
  sellerId?: string;       // PID, optional — used for seller_id validation in notify
  notifyUrl?: string;      // Optional override; default constructed from request
}

function readFileOrValue(envFile: string | undefined, envValue: string | undefined): string | null {
  if (envFile) {
    try {
      const content = fs.readFileSync(envFile, 'utf-8').trim();
      if (content) return content;
    } catch {
      // NEVER expose file content or path details — just say it's unavailable
      throw new Error('Alipay key file is not readable');
    }
  }
  if (envValue) return envValue;
  return null;
}

function parsePaymentMode(): PaymentMode {
  const raw = (process.env.PAYMENT_MODE || 'mock').toLowerCase();
  if (raw === 'production') {
    throw new Error(
      'PAYMENT_MODE=production is FORBIDDEN in this slice. ' +
      'Only "mock" or "alipay_sandbox" are allowed.'
    );
  }
  if (raw !== 'mock' && raw !== 'alipay_sandbox') {
    throw new Error(`Unknown PAYMENT_MODE "${raw}". Allowed: mock, alipay_sandbox`);
  }
  return raw as PaymentMode;
}

/**
 * Load Alipay configuration from environment.
 *
 * In mock mode, only appId/gateway need valid-looking placeholders.
 * In alipay_sandbox mode, private key and Alipay public key are required.
 *
 * Throws if production mode is requested (forbidden).
 * Throws if sandbox mode is requested but keys are missing.
 */
export function loadAlipayConfig(): AlipayConfig {
  const mode = parsePaymentMode();

  const appId = process.env.ALIPAY_APP_ID || '';

  // Keys: file pointer takes priority over direct env value
  const privateKey = readFileOrValue(
    process.env.ALIPAY_PRIVATE_KEY_FILE,
    process.env.ALIPAY_PRIVATE_KEY,
  ) || '';

  const publicKey = readFileOrValue(
    process.env.ALIPAY_PUBLIC_KEY_FILE,
    process.env.ALIPAY_PUBLIC_KEY,
  ) || '';

  const gateway = mode === 'alipay_sandbox'
    ? 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'
    : 'https://openapi.alipay.com/gateway.do'; // placeholder, never called in mock

  const sellerId = process.env.ALIPAY_SELLER_ID || undefined;

  if (mode === 'alipay_sandbox') {
    if (!appId) {
      throw new Error('ALIPAY_APP_ID is required for alipay_sandbox mode');
    }
    if (!privateKey) {
      throw new Error(
        'Alipay private key is required for alipay_sandbox mode. ' +
        'Set ALIPAY_PRIVATE_KEY or ALIPAY_PRIVATE_KEY_FILE.'
      );
    }
    if (!publicKey) {
      throw new Error(
        'Alipay public key is required for alipay_sandbox mode (for signature verification). ' +
        'Set ALIPAY_PUBLIC_KEY or ALIPAY_PUBLIC_KEY_FILE.'
      );
    }
  }

  return { mode, appId, privateKey, publicKey, gateway, sellerId };
}

/** Validate that notify params match the configured app and seller.
 *  - appId MUST match exactly if configured.
 *  - If sellerId is configured, the notify MUST include a matching seller_id;
 *    missing seller_id in the notify when configured is a failure.
 */
export function validateNotifyIds(config: AlipayConfig, notifyAppId: string, notifySellerId?: string): boolean {
  // appId must match exactly
  if (config.appId && config.appId !== notifyAppId) {
    return false;
  }
  // If sellerId is configured, notify MUST include a seller_id and it must match
  if (config.sellerId) {
    if (!notifySellerId || config.sellerId !== notifySellerId) {
      return false;
    }
  }
  return true;
}
