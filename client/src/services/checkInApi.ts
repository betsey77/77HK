import { authApiFetch } from './api';

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

export interface ClaimCheckInGrantSuccess {
  success: true;
  idempotent: boolean;
  grantId: string;
  grantStatus: 'applied';
  grantAppliedAt: string;
  subscriptionExpiresAt: string | null;
}

export class CheckInApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly subscriptionExpiresAt: string | null;

  constructor(
    message: string,
    status: number,
    code: string,
    subscriptionExpiresAt: string | null = null,
  ) {
    super(message);
    this.name = 'CheckInApiError';
    this.status = status;
    this.code = code;
    this.subscriptionExpiresAt = subscriptionExpiresAt;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function parseStatus(value: unknown): CheckInStatus {
  if (!isRecord(value)) throw new CheckInApiError('签到状态响应异常', 502, 'MALFORMED_RESPONSE');
  const rewardStatus = value.rewardStatus;
  if (
    typeof value.checkedInToday !== 'boolean'
    || !isNullableString(value.checkinDateHk)
    || typeof value.streakCount !== 'number'
    || !Number.isInteger(value.streakCount)
    || value.streakCount < 0
    || !isNullableString(value.streakStartedOn)
    || typeof value.rewardEarned !== 'boolean'
    || (rewardStatus !== 'none' && rewardStatus !== 'pending' && rewardStatus !== 'applied')
    || !isNullableString(value.grantId)
    || typeof value.canClaim !== 'boolean'
    || !isNullableString(value.grantAppliedAt)
    || !isNullableString(value.subscriptionExpiresAt)
  ) {
    throw new CheckInApiError('签到状态响应异常', 502, 'MALFORMED_RESPONSE');
  }
  return {
    checkedInToday: value.checkedInToday,
    checkinDateHk: value.checkinDateHk,
    streakCount: value.streakCount,
    streakStartedOn: value.streakStartedOn,
    rewardEarned: value.rewardEarned,
    rewardStatus,
    grantId: value.grantId,
    canClaim: value.canClaim,
    grantAppliedAt: value.grantAppliedAt,
    subscriptionExpiresAt: value.subscriptionExpiresAt,
  };
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function errorCode(body: unknown): string {
  return isRecord(body) && typeof body.code === 'string' ? body.code : 'REQUEST_FAILED';
}

function errorExpiry(body: unknown): string | null {
  return isRecord(body) && isNullableString(body.subscriptionExpiresAt)
    ? body.subscriptionExpiresAt
    : null;
}

async function requestStatus(method: 'GET' | 'POST'): Promise<CheckInStatus> {
  const response = await authApiFetch('/me/check-in', { method });
  const body = await readJson(response);
  if (!response.ok) {
    const message = response.status === 401
      ? '登录状态已失效'
      : response.status === 503
        ? '签到服务暂时不可用'
        : method === 'GET'
          ? '签到状态加载失败'
          : '签到失败，请重试';
    throw new CheckInApiError(message, response.status, errorCode(body));
  }
  return parseStatus(body);
}

export function getCheckInStatus(): Promise<CheckInStatus> {
  return requestStatus('GET');
}

export function performDailyCheckIn(): Promise<CheckInStatus> {
  return requestStatus('POST');
}

export async function claimCheckInGrant(grantId: string): Promise<ClaimCheckInGrantSuccess> {
  const response = await authApiFetch(
    `/me/membership-grants/${encodeURIComponent(grantId)}/claim`,
    { method: 'POST' },
  );
  const body = await readJson(response);
  if (!response.ok) {
    throw new CheckInApiError(
      '奖励暂时无法领取',
      response.status,
      errorCode(body),
      errorExpiry(body),
    );
  }
  if (
    !isRecord(body)
    || body.success !== true
    || typeof body.idempotent !== 'boolean'
    || typeof body.grantId !== 'string'
    || body.grantStatus !== 'applied'
    || typeof body.grantAppliedAt !== 'string'
    || !isNullableString(body.subscriptionExpiresAt)
  ) {
    throw new CheckInApiError('奖励领取响应异常', 502, 'MALFORMED_RESPONSE');
  }
  return {
    success: true,
    idempotent: body.idempotent,
    grantId: body.grantId,
    grantStatus: 'applied',
    grantAppliedAt: body.grantAppliedAt,
    subscriptionExpiresAt: body.subscriptionExpiresAt,
  };
}
