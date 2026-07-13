import { getTrustedSupabase } from './trustedSupabase.js';

// ============================================================
// Types
// ============================================================

export interface QuotaReservation {
  reservationId: string;   // usage_ledger row id
  userId: string;
  subscriptionId: string;
  amount: number;          // reserved amount (fixed at 1)
  idempotencyKey: string;
}

export interface UserEntitlement {
  planName: string;
  quotaUsed: number;
  quotaTotal: number;
  remaining: number;
}

// ============================================================
// Parsing helpers
// ============================================================

/** Parse the jsonb result from the reserve_quota RPC into a QuotaReservation. */
function parseReservationResult(data: unknown): QuotaReservation | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (!obj.reservation_id || !obj.user_id || !obj.subscription_id) return null;
  return {
    reservationId: obj.reservation_id as string,
    userId: obj.user_id as string,
    subscriptionId: obj.subscription_id as string,
    amount: (obj.amount as number) ?? 1,
    idempotencyKey: obj.idempotency_key as string,
  };
}

// ============================================================
// reserveQuota
// ============================================================

/**
 * Atomically reserve one quota unit for a user.
 *
 * Calls the `reserve_quota(_user_id, _idempotency_key)` PostgreSQL RPC which:
 *  1. Locks the user's active subscription (FOR UPDATE).
 *  2. Checks idempotency: returns existing reservation if already reserved.
 *  3. Checks quota_used < quota_per_cycle; returns null if exhausted.
 *  4. INSERTs a 'reserve' event into usage_ledger.
 *  5. Atomically increments subscription.quota_used (same transaction).
 *
 * Returns null when:
 *  - No active subscription exists
 *  - Quota is exhausted (quota_used >= quota_per_cycle)
 *
 * Idempotent: duplicate (user_id, idempotency_key) calls return the existing
 * reservation without double-counting.
 *
 * @C2a-ATOMIC: The entire reserve operation happens inside a single PostgreSQL
 * function with FOR UPDATE locking. Concurrent calls for the same user are
 * serialised — no check-then-act race, no over-selling possible.
 */
export async function reserveQuota(
  userId: string,
  idempotencyKey: string,
): Promise<QuotaReservation | null> {
  const db = getTrustedSupabase();

  const { data, error } = await db.rpc('reserve_quota', {
    _user_id: userId,
    _idempotency_key: idempotencyKey,
  });

  if (error) {
    throw new Error(`Quota reserve failed: ${(error as any)?.message ?? 'unknown error'}`);
  }

  return parseReservationResult(data);
}

// ============================================================
// consumeQuota
// ============================================================

/**
 * Atomically mark a reserved quota as consumed.
 *
 * Calls the `consume_quota(_user_id, _reservation_id)` PostgreSQL RPC which:
 *  1. Reads the immutable reservation and locks its subscription row.
 *  2. Verifies ownership and state (must be 'reserve').
 *  3. Checks idempotency: if a terminal event already exists, returns true.
 *  4. INSERTs a new 'consume' event with reservation_id linking to the
 *     original reserve row (append-only — does not mutate the reserve row).
 *
 * Returns true if the reservation was consumed (or already consumed).
 * Returns false if the reservation is not found or belongs to a different user.
 *
 * @C2a-APPEND-ONLY: Consume INSERTs a new terminal event. The original reserve
 * event is never UPDATEd or DELETEd. The ledger is an immutable audit trail.
 */
export async function consumeQuota(
  userId: string,
  reservationId: string,
): Promise<boolean> {
  const db = getTrustedSupabase();

  const { data, error } = await db.rpc('consume_quota', {
    _user_id: userId,
    _reservation_id: reservationId,
  });

  if (error) {
    throw new Error(`Failed to consume reservation: ${(error as any)?.message ?? 'unknown error'}`);
  }

  return data === true;
}

// ============================================================
// releaseQuota
// ============================================================

/**
 * Atomically release a reserved quota back to the user's balance.
 *
 * Calls the `release_quota(_user_id, _reservation_id)` PostgreSQL RPC which:
 *  1. Reads the immutable reservation and locks its subscription row.
 *  2. Verifies ownership and state (must be 'reserve').
 *  3. Checks idempotency: if a terminal event already exists, returns true.
 *  4. INSERTs a new 'release' event with reservation_id linking to the
 *     original reserve row (append-only — does not mutate the reserve row).
 *  5. Atomically decrements subscription.quota_used within the same transaction.
 *
 * Returns true if the reservation was released (or already released).
 * Returns false if the reservation is not found or belongs to a different user.
 *
 * @C2a-NO-FALLBACK: There is no TOCTOU fallback path. The quota_used decrement
 * happens inside the same PostgreSQL transaction as the INSERT. If the RPC
 * fails, the caller must retry. No SELECT-then-UPDATE in application code.
 */
export async function releaseQuota(
  userId: string,
  reservationId: string,
): Promise<boolean> {
  const db = getTrustedSupabase();

  const { data, error } = await db.rpc('release_quota', {
    _user_id: userId,
    _reservation_id: reservationId,
  });

  if (error) {
    throw new Error(`Failed to release reservation: ${(error as any)?.message ?? 'unknown error'}`);
  }

  return data === true;
}

// ============================================================
// getUserEntitlement
// ============================================================

/**
 * Get the user's current subscription and remaining quota.
 *
 * Returns null if the user has no active subscription.
 */
export async function getUserEntitlement(
  userId: string,
): Promise<UserEntitlement | null> {
  const db = getTrustedSupabase();
  const now = new Date().toISOString();

  const { data: sub, error } = await db
    .from('subscriptions')
    .select('id, quota_used, plan:plan_id(name, quota_per_cycle)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .lte('current_period_start', now)
    .gt('current_period_end', now)
    .maybeSingle();

  if (error || !sub) return null;

  const planData = (sub as any).plan;
  const planName: string = planData?.name ?? 'Unknown';
  const quotaTotal: number = planData?.quota_per_cycle ?? 0;
  const quotaUsed: number = (sub as any).quota_used ?? 0;

  return {
    planName,
    quotaUsed,
    quotaTotal,
    remaining: Math.max(0, quotaTotal - quotaUsed),
  };
}
