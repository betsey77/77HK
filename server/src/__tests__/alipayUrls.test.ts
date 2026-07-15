/**
 * Alipay return/notify URL construction — split frontend/API origins.
 */

import { describe, it, expect } from 'vitest';
import { resolveAlipayUrls } from '../services/alipayUrls.js';

describe('resolveAlipayUrls', () => {
  it('uses local 5173/3001 fallbacks in mock mode without public URLs', () => {
    const r = resolveAlipayUrls({ PAYMENT_MODE: 'mock' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.returnUrl).toBe('http://localhost:5173/billing/success');
    expect(r.notifyUrl).toBe('http://localhost:3001/api/billing/alipay/notify');
  });

  it('uses APP_PUBLIC_URL for both return and notify (compat fallback)', () => {
    const r = resolveAlipayUrls({
      PAYMENT_MODE: 'alipay_sandbox',
      APP_PUBLIC_URL: 'https://legacy.example.com',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.returnUrl).toBe('https://legacy.example.com/billing/success');
    expect(r.notifyUrl).toBe('https://legacy.example.com/api/billing/alipay/notify');
  });

  it('splits APP_FRONTEND_URL and APP_API_URL when origins differ', () => {
    const r = resolveAlipayUrls({
      PAYMENT_MODE: 'alipay_sandbox',
      APP_FRONTEND_URL: 'https://app.vercel.app',
      APP_API_URL: 'https://api.vercel.app',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.returnUrl).toBe('https://app.vercel.app/billing/success');
    expect(r.notifyUrl).toBe('https://api.vercel.app/api/billing/alipay/notify');
  });

  it('strips trailing slashes on frontend/API bases', () => {
    const r = resolveAlipayUrls({
      PAYMENT_MODE: 'alipay_sandbox',
      APP_FRONTEND_URL: 'https://app.example.com/',
      APP_API_URL: 'https://api.example.com///',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.returnUrl).toBe('https://app.example.com/billing/success');
    expect(r.notifyUrl).toBe('https://api.example.com/api/billing/alipay/notify');
  });

  it('gives ALIPAY_RETURN_URL / ALIPAY_NOTIFY_URL highest priority', () => {
    const r = resolveAlipayUrls({
      PAYMENT_MODE: 'alipay_sandbox',
      APP_FRONTEND_URL: 'https://app.example.com',
      APP_API_URL: 'https://api.example.com',
      APP_PUBLIC_URL: 'https://legacy.example.com',
      ALIPAY_RETURN_URL: 'https://custom.example.com/billing/ok',
      ALIPAY_NOTIFY_URL: 'https://hooks.example.com/alipay/notify',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.returnUrl).toBe('https://custom.example.com/billing/ok');
    expect(r.notifyUrl).toBe('https://hooks.example.com/alipay/notify');
  });

  it('fail-closed sandbox without return URL names APP_FRONTEND_URL / APP_PUBLIC_URL / ALIPAY_RETURN_URL', () => {
    const r = resolveAlipayUrls({
      PAYMENT_MODE: 'alipay_sandbox',
      APP_API_URL: 'https://api.example.com',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/APP_FRONTEND_URL/);
    expect(r.error).toMatch(/APP_PUBLIC_URL/);
    expect(r.error).toMatch(/ALIPAY_RETURN_URL/);
  });

  it('fail-closed sandbox without notify URL names APP_API_URL / APP_PUBLIC_URL / ALIPAY_NOTIFY_URL', () => {
    const r = resolveAlipayUrls({
      PAYMENT_MODE: 'alipay_sandbox',
      APP_FRONTEND_URL: 'https://app.example.com',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/APP_API_URL/);
    expect(r.error).toMatch(/APP_PUBLIC_URL/);
    expect(r.error).toMatch(/ALIPAY_NOTIFY_URL/);
  });

  it('does not use APP_API_URL as return base', () => {
    const r = resolveAlipayUrls({
      PAYMENT_MODE: 'alipay_sandbox',
      APP_FRONTEND_URL: 'https://frontend.only',
      APP_API_URL: 'https://api.only',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.returnUrl).not.toContain('api.only');
    expect(r.notifyUrl).not.toContain('frontend.only');
  });
});
