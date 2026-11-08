import { getTrustedSupabase } from './trustedSupabase.js';
import type { QuotaDenialReason } from './quotaService.js';

/** Reasons that the quota_denial_events check constraint accepts. */
const PERSISTED_REASONS: ReadonlySet<string> = new Set([
  'no_subscription',
  'inactive_subscription',
  'period_not_started',
  'period_expired',
  'quota_exhausted',
]);

export interface QuotaDenialInput {
  userId: string;
  jobId: string | null;
  traceId: string | null;
  reason: QuotaDenialReason | null;
  planName?: string | null;
  periodEnd?: string | null;
}

/**
 * Best-effort append-only record of a quota denial.
 *
 * Never throws: before the trace migration is applied the table does not exist,
 * and a denied request must still return its 402 rather than a 500.
 */
export async function recordQuotaDenial(input: QuotaDenialInput): Promise<boolean> {
  if (!input.reason || !PERSISTED_REASONS.has(input.reason)) return false;

  try {
    const db = getTrustedSupabase();
    const { error } = await db.from('quota_denial_events').insert({
      user_id: input.userId,
      job_id: input.jobId,
      trace_id: input.traceId,
      reason: input.reason,
      plan_name: input.planName ?? null,
      period_end: input.periodEnd ?? null,
    });
    return !error;
  } catch {
    return false;
  }
}
