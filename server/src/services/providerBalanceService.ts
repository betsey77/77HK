import { proxyFetch } from './proxyFetch.js';

const DEEPSEEK_BALANCE_URL = 'https://api.deepseek.com/user/balance';
const BALANCE_CACHE_MS = 10 * 60 * 1000;
const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;

export interface DeepSeekBalanceInfo {
  currency: 'CNY' | 'USD';
  totalBalance: string;
  grantedBalance: string;
  toppedUpBalance: string;
}

export type DeepSeekProviderBalance = {
  provider: 'deepseek';
  status: 'ok';
  isAvailable: boolean;
  balances: DeepSeekBalanceInfo[];
  fetchedAt: string;
} | {
  provider: 'deepseek';
  status: 'unavailable';
};

let cached: { expiresAt: number; value: DeepSeekProviderBalance & { status: 'ok' } } | null = null;

function decimal(value: unknown): string | null {
  return typeof value === 'string' && DECIMAL_PATTERN.test(value) ? value : null;
}

function parseBalance(body: unknown, now: number): DeepSeekProviderBalance & { status: 'ok' } | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const raw = body as { is_available?: unknown; balance_infos?: unknown };
  if (typeof raw.is_available !== 'boolean' || !Array.isArray(raw.balance_infos)) return null;

  const balances: DeepSeekBalanceInfo[] = [];
  for (const entry of raw.balance_infos) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const item = entry as Record<string, unknown>;
    if (item.currency !== 'CNY' && item.currency !== 'USD') return null;
    const totalBalance = decimal(item.total_balance);
    const grantedBalance = decimal(item.granted_balance);
    const toppedUpBalance = decimal(item.topped_up_balance);
    if (totalBalance === null || grantedBalance === null || toppedUpBalance === null) return null;
    balances.push({
      currency: item.currency,
      totalBalance,
      grantedBalance,
      toppedUpBalance,
    });
  }

  return {
    provider: 'deepseek',
    status: 'ok',
    isAvailable: raw.is_available,
    balances,
    fetchedAt: new Date(now).toISOString(),
  };
}

export async function getDeepSeekProviderBalance(): Promise<DeepSeekProviderBalance> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { provider: 'deepseek', status: 'unavailable' };

  try {
    const response = await proxyFetch(DEEPSEEK_BALANCE_URL, {
      timeout: 5000,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return { provider: 'deepseek', status: 'unavailable' };
    const value = parseBalance(await response.json(), now);
    if (!value) return { provider: 'deepseek', status: 'unavailable' };
    cached = { expiresAt: now + BALANCE_CACHE_MS, value };
    return value;
  } catch {
    return { provider: 'deepseek', status: 'unavailable' };
  }
}

export function resetDeepSeekBalanceCacheForTests(): void {
  cached = null;
}
