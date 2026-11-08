import type { SupabaseClient } from '@supabase/supabase-js';
import { getTrustedSupabase } from './trustedSupabase.js';

export type RewardStatus = 'none' | 'pending' | 'applied';

export interface CheckInStatus {
  checkedInToday: boolean;
  checkinDateHk: string | null;
  streakCount: number;
  streakStartedOn: string | null;
  rewardEarned: boolean;
  rewardStatus: RewardStatus;
  grantId: string | null;
  canClaim: boolean;
  grantAppliedAt: string | null;
  subscriptionExpiresAt: string | null;
}

export type ClaimCheckInGrantResult =
  | { success: false; reason: 'not_found' }
  | {
      success: false;
      reason: 'active_pro';
      grantId: string;
      grantStatus: 'pending';
      subscriptionExpiresAt: string | null;
    }
  | {
      success: true;
      idempotent: boolean;
      grantId: string;
      grantStatus: 'applied';
      grantAppliedAt: string;
      subscriptionExpiresAt: string | null;
    };

export class CheckInServiceError extends Error {
  readonly code = 'CHECK_IN_UNAVAILABLE';

  constructor() {
    super('Check-in service unavailable');
    this.name = 'CheckInServiceError';
  }
}

export class CheckInStateError extends Error {
  readonly code = 'CHECK_IN_STATE_INVALID';

  constructor() {
    super('Check-in account state is invalid');
    this.name = 'CheckInStateError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function throwRpcError(error: unknown): never {
  const message = isRecord(error) && typeof error.message === 'string'
    ? error.message
    : '';
  if (message.includes('subscription_not_found') || message.includes('pro_plan_not_found')) {
    throw new CheckInStateError();
  }
  throw new CheckInServiceError();
}

function rewardStatus(value: unknown): RewardStatus {
  if (value === 'pending' || value === 'applied') return value;
  return 'none';
}

function hongKongDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function previousDate(date: string): string {
  const midnightUtc = new Date(`${date}T00:00:00.000Z`);
  return new Date(midnightUtc.getTime() - 86_400_000).toISOString().slice(0, 10);
}

function planName(value: unknown): string | null {
  const plan = Array.isArray(value) ? value[0] : value;
  return isRecord(plan) && typeof plan.name === 'string' ? plan.name : null;
}

function isActivePro(subscription: unknown, now: Date): boolean {
  if (!isRecord(subscription)) return false;
  const start = subscription.current_period_start;
  const end = subscription.current_period_end;
  if (subscription.status !== 'active' || planName(subscription.plans) !== 'Pro') return false;
  if (typeof start !== 'string' || typeof end !== 'string') return false;
  const nowMs = now.getTime();
  return Date.parse(start) <= nowMs && Date.parse(end) > nowMs;
}

async function readOwnedSubscription(db: SupabaseClient, userId: string): Promise<unknown> {
  const result = await db
    .from('subscriptions')
    .select('status, current_period_start, current_period_end, plans(name)')
    .eq('user_id', userId)
    .maybeSingle();
  if (result.error) throw new CheckInServiceError();
  return result.data;
}

function mapApplyResult(data: unknown): CheckInStatus {
  if (!isRecord(data)) throw new CheckInServiceError();
  const status = rewardStatus(data.grant_status);
  if (
    typeof data.checked_in_today !== 'boolean'
    || typeof data.checkin_date_hk !== 'string'
    || typeof data.streak_count !== 'number'
    || typeof data.streak_started_on !== 'string'
    || typeof data.reward_earned !== 'boolean'
    || !isNullableString(data.grant_id)
    || !isNullableString(data.grant_applied_at)
    || !isNullableString(data.subscription_expires_at)
  ) {
    throw new CheckInServiceError();
  }

  return {
    checkedInToday: data.checked_in_today,
    checkinDateHk: data.checkin_date_hk,
    streakCount: data.streak_count,
    streakStartedOn: data.streak_started_on,
    rewardEarned: data.reward_earned,
    rewardStatus: status,
    grantId: data.grant_id,
    canClaim: false,
    grantAppliedAt: data.grant_applied_at,
    subscriptionExpiresAt: data.subscription_expires_at,
  };
}

function mapClaimResult(data: unknown): ClaimCheckInGrantResult {
  if (!isRecord(data) || typeof data.success !== 'boolean') {
    throw new CheckInServiceError();
  }
  if (!data.success && data.reason === 'not_found') {
    return { success: false, reason: 'not_found' };
  }
  if (
    !data.success
    && data.reason === 'active_pro'
    && typeof data.grant_id === 'string'
    && data.grant_status === 'pending'
    && isNullableString(data.subscription_expires_at)
  ) {
    return {
      success: false,
      reason: 'active_pro',
      grantId: data.grant_id,
      grantStatus: 'pending',
      subscriptionExpiresAt: data.subscription_expires_at,
    };
  }
  if (
    data.success
    && typeof data.idempotent === 'boolean'
    && typeof data.grant_id === 'string'
    && data.grant_status === 'applied'
    && typeof data.grant_applied_at === 'string'
    && isNullableString(data.subscription_expires_at)
  ) {
    return {
      success: true,
      idempotent: data.idempotent,
      grantId: data.grant_id,
      grantStatus: 'applied',
      grantAppliedAt: data.grant_applied_at,
      subscriptionExpiresAt: data.subscription_expires_at,
    };
  }
  throw new CheckInServiceError();
}

export async function getCheckInStatus(
  userId: string,
  now = new Date(),
): Promise<CheckInStatus> {
  try {
    const db = getTrustedSupabase();
    const checkInResult = await db
      .from('daily_checkins')
      .select('checkin_date_hk, streak_count, streak_started_on')
      .eq('user_id', userId)
      .order('checkin_date_hk', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (checkInResult.error) throw new CheckInServiceError();

    const grantResult = await db
      .from('membership_grants')
      .select('id, status, applied_at')
      .eq('user_id', userId)
      .eq('source', 'checkin_7day')
      .maybeSingle();
    if (grantResult.error) throw new CheckInServiceError();

    const subscriptionData = await readOwnedSubscription(db, userId);

    const checkIn = isRecord(checkInResult.data) ? checkInResult.data : null;
    const grant = isRecord(grantResult.data) ? grantResult.data : null;
    const subscription = isRecord(subscriptionData) ? subscriptionData : null;
    const today = hongKongDate(now);
    const lastDate = checkIn && typeof checkIn.checkin_date_hk === 'string'
      ? checkIn.checkin_date_hk
      : null;
    const streakIsCurrent = lastDate === today || lastDate === previousDate(today);
    const status = rewardStatus(grant?.status);
    const activePro = isActivePro(subscription, now);

    return {
      checkedInToday: lastDate === today,
      checkinDateHk: lastDate,
      streakCount: streakIsCurrent && typeof checkIn?.streak_count === 'number'
        ? checkIn.streak_count
        : 0,
      streakStartedOn: streakIsCurrent && typeof checkIn?.streak_started_on === 'string'
        ? checkIn.streak_started_on
        : null,
      rewardEarned: false,
      rewardStatus: status,
      grantId: typeof grant?.id === 'string' ? grant.id : null,
      canClaim: status === 'pending' && !activePro,
      grantAppliedAt: typeof grant?.applied_at === 'string' ? grant.applied_at : null,
      subscriptionExpiresAt: typeof subscription?.current_period_end === 'string'
        ? subscription.current_period_end
        : null,
    };
  } catch (error) {
    if (error instanceof CheckInServiceError) throw error;
    throw new CheckInServiceError();
  }
}

export async function applyDailyCheckIn(
  userId: string,
  now = new Date(),
): Promise<CheckInStatus> {
  try {
    const db = getTrustedSupabase();
    const { data, error } = await db.rpc('apply_daily_checkin', {
      _user_id: userId,
    });
    if (error) throwRpcError(error);
    const result = mapApplyResult(data);
    if (result.rewardStatus === 'pending') {
      const subscription = await readOwnedSubscription(db, userId);
      result.canClaim = !isActivePro(subscription, now);
    }
    return result;
  } catch (error) {
    if (error instanceof CheckInServiceError || error instanceof CheckInStateError) throw error;
    throw new CheckInServiceError();
  }
}

export async function claimCheckInMembershipGrant(
  userId: string,
  grantId: string,
): Promise<ClaimCheckInGrantResult> {
  try {
    const { data, error } = await getTrustedSupabase().rpc(
      'claim_checkin_membership_grant',
      { _user_id: userId, _grant_id: grantId },
    );
    if (error) throwRpcError(error);
    return mapClaimResult(data);
  } catch (error) {
    if (error instanceof CheckInServiceError || error instanceof CheckInStateError) throw error;
    throw new CheckInServiceError();
  }
}
