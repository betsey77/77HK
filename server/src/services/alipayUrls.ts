/**
 * Resolve Alipay return / notify URLs from env — never from request Host.
 *
 * Priority (highest first):
 *   ALIPAY_RETURN_URL / ALIPAY_NOTIFY_URL
 *   APP_FRONTEND_URL (return) / APP_API_URL (notify)
 *   APP_PUBLIC_URL (compat: both)
 *   Local defaults (mock only): 5173 / 3001
 *
 * Sandbox without required config → fail closed with variable name hints.
 */

export type AlipayUrlResult =
  | { ok: true; returnUrl: string; notifyUrl: string }
  | { ok: false; error: string };

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '');
}

export function resolveAlipayUrls(env: NodeJS.ProcessEnv = process.env): AlipayUrlResult {
  const paymentMode = (env.PAYMENT_MODE || 'mock').trim();
  const isSandbox = paymentMode === 'alipay_sandbox';

  const explicitReturn = (env.ALIPAY_RETURN_URL || '').trim();
  const explicitNotify = (env.ALIPAY_NOTIFY_URL || '').trim();
  const frontendBase = stripTrailingSlashes(
    (env.APP_FRONTEND_URL || env.APP_PUBLIC_URL || '').trim(),
  );
  const apiBase = stripTrailingSlashes(
    (env.APP_API_URL || env.APP_PUBLIC_URL || '').trim(),
  );

  let returnUrl = explicitReturn;
  let notifyUrl = explicitNotify;

  if (!returnUrl) {
    if (frontendBase) {
      returnUrl = `${frontendBase}/billing/success`;
    } else if (!isSandbox) {
      returnUrl = 'http://localhost:5173/billing/success';
    }
  }

  if (!notifyUrl) {
    if (apiBase) {
      notifyUrl = `${apiBase}/api/billing/alipay/notify`;
    } else if (!isSandbox) {
      notifyUrl = 'http://localhost:3001/api/billing/alipay/notify';
    }
  }

  if (isSandbox) {
    if (!returnUrl) {
      return {
        ok: false,
        error:
          'Alipay return URL not configured. Set APP_FRONTEND_URL, APP_PUBLIC_URL, or ALIPAY_RETURN_URL.',
      };
    }
    if (!notifyUrl) {
      return {
        ok: false,
        error:
          'Alipay notify URL not configured. Set APP_API_URL, APP_PUBLIC_URL, or ALIPAY_NOTIFY_URL.',
      };
    }
  }

  return {
    ok: true,
    returnUrl: returnUrl || 'http://localhost:5173/billing/success',
    notifyUrl: notifyUrl || 'http://localhost:3001/api/billing/alipay/notify',
  };
}
