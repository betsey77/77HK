import type { PlanId } from '../types/index.js';
import { getTrustedSupabase } from './trustedSupabase.js';

export const FREE_FAVORITE_LIMIT = 10;
export const FREE_HISTORY_LIMIT = 15;

/** Resolve the trusted active subscription. Any uncertainty falls back to Free. */
export async function resolveUserPlanId(userId: string): Promise<PlanId> {
  if ((process.env.PAYMENT_MODE || 'mock') === 'mock') return 'free';

  try {
    const db = getTrustedSupabase();
    const { data, error } = await db
      .from('subscriptions')
      .select('plans(name)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('current_period_end', { ascending: false })
      .limit(1);

    if (error || !data?.length) return 'free';

    const relation = (data[0] as Record<string, unknown>).plans;
    const plan = Array.isArray(relation) ? relation[0] : relation;
    const name = plan && typeof plan === 'object'
      ? (plan as Record<string, unknown>).name
      : null;
    return typeof name === 'string' && name.toLowerCase() === 'pro' ? 'pro' : 'free';
  } catch {
    return 'free';
  }
}
