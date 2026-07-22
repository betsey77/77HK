import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  getCheckInStatus: vi.fn(),
  performDailyCheckIn: vi.fn(),
  claimCheckInGrant: vi.fn(),
}));

vi.mock('../services/checkInApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/checkInApi')>()),
  getCheckInStatus: mocks.getCheckInStatus,
  performDailyCheckIn: mocks.performDailyCheckIn,
  claimCheckInGrant: mocks.claimCheckInGrant,
}));

import CheckInDialog, {
  checkInDismissalKey,
  hongKongDateKey,
} from '../components/checkin/CheckInDialog';
import { CheckInApiError, type CheckInStatus } from '../services/checkInApi';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const GRANT_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-07-19T04:00:00.000Z');
const getNow = () => NOW;

const BASE_STATUS = {
  checkedInToday: false,
  checkinDateHk: '2026-07-18',
  streakCount: 6,
  streakStartedOn: '2026-07-13',
  rewardEarned: false,
  rewardStatus: 'none' as const,
  grantId: null,
  canClaim: false,
  grantAppliedAt: null,
  subscriptionExpiresAt: '2026-07-25T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('D3 check-in dismissal semantics', () => {
  it('uses the Asia/Hong_Kong boundary and account-scoped date key', () => {
    expect(hongKongDateKey(new Date('2026-07-19T15:59:59.999Z'))).toBe('2026-07-19');
    expect(hongKongDateKey(new Date('2026-07-19T16:00:00.000Z'))).toBe('2026-07-20');
    expect(checkInDismissalKey('user-a', '2026-07-19')).not.toBe(
      checkInDismissalKey('user-b', '2026-07-19'),
    );
    expect(checkInDismissalKey('user-a', '2026-07-19')).not.toBe(
      checkInDismissalKey('user-a', '2026-07-20'),
    );
  });

  it('does not fetch or open again for the same dismissed account/day', () => {
    localStorage.setItem(checkInDismissalKey(OWNER_ID, '2026-07-19'), '1');

    render(<CheckInDialog ownerId={OWNER_ID} getNow={getNow} />);

    expect(screen.queryByRole('dialog', { name: '每日签到' })).not.toBeInTheDocument();
    expect(mocks.getCheckInStatus).not.toHaveBeenCalled();
  });

  it('opens again for the same account on the next Hong Kong date', async () => {
    localStorage.setItem(checkInDismissalKey(OWNER_ID, '2026-07-19'), '1');
    mocks.getCheckInStatus.mockResolvedValue(BASE_STATUS);

    render(
      <CheckInDialog
        ownerId={OWNER_ID}
        getNow={() => new Date('2026-07-19T16:00:00.000Z')}
      />,
    );

    expect(await screen.findByRole('dialog', { name: '每日签到' })).toBeInTheDocument();
    expect(mocks.getCheckInStatus).toHaveBeenCalledTimes(1);
  });

  it('Escape closes the dialog and stores only the account/day dismissal', async () => {
    mocks.getCheckInStatus.mockResolvedValue(BASE_STATUS);
    render(<CheckInDialog ownerId={OWNER_ID} getNow={getNow} />);
    await screen.findByText('连续签到 6 / 7 天');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: '每日签到' })).not.toBeInTheDocument();
    expect(localStorage.length).toBe(1);
    expect(localStorage.key(0)).toBe(checkInDismissalKey(OWNER_ID, '2026-07-19'));
    expect(localStorage.getItem(checkInDismissalKey(OWNER_ID, '2026-07-19'))).toBe('1');
  });
});

describe('D3 check-in dialog states', () => {
  it('shows a retryable loading failure and then renders server progress', async () => {
    mocks.getCheckInStatus
      .mockRejectedValueOnce(new CheckInApiError('暂时不可用', 503, 'CHECK_IN_UNAVAILABLE'))
      .mockResolvedValueOnce(BASE_STATUS);

    render(<CheckInDialog ownerId={OWNER_ID} getNow={getNow} />);

    expect(screen.getByRole('status', { name: '正在读取签到状态' })).toBeInTheDocument();
    await screen.findByText('签到状态暂时无法加载');
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    await screen.findByText('连续签到 6 / 7 天');
    expect(mocks.getCheckInStatus).toHaveBeenCalledTimes(2);
  });

  it('replaces progress with the idempotent POST response and prevents double submit', async () => {
    let resolveCheckIn!: (value: CheckInStatus) => void;
    const pending = new Promise<CheckInStatus>((resolve) => { resolveCheckIn = resolve; });
    mocks.getCheckInStatus.mockResolvedValue(BASE_STATUS);
    mocks.performDailyCheckIn.mockReturnValue(pending);
    render(<CheckInDialog ownerId={OWNER_ID} getNow={getNow} />);
    await screen.findByText('连续签到 6 / 7 天');

    const button = screen.getByRole('button', { name: '立即签到' });
    await userEvent.click(button);
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(mocks.performDailyCheckIn).toHaveBeenCalledTimes(1);

    resolveCheckIn({
      ...BASE_STATUS,
      checkedInToday: true,
      checkinDateHk: '2026-07-19',
      streakCount: 7,
      rewardEarned: true,
      rewardStatus: 'applied',
      grantId: GRANT_ID,
      grantAppliedAt: '2026-07-19T04:00:00.000Z',
      subscriptionExpiresAt: '2026-08-18T04:00:00.000Z',
    });

    await screen.findByText('连续签到 7 / 7 天');
    expect(screen.getByText('今日已签到')).toBeInTheDocument();
    expect(screen.getByText('30 天 Pro 奖励已发放')).toBeInTheDocument();
  });

  it('shows pending guidance without a claim action while current Pro is active', async () => {
    mocks.getCheckInStatus.mockResolvedValue({
      ...BASE_STATUS,
      checkedInToday: true,
      streakCount: 7,
      rewardStatus: 'pending',
      grantId: GRANT_ID,
      canClaim: false,
      subscriptionExpiresAt: '2026-08-01T00:00:00.000Z',
    });

    render(<CheckInDialog ownerId={OWNER_ID} getNow={getNow} />);

    await screen.findByText('奖励已保留');
    expect(screen.getByText(/当前 Pro 到期后即可领取/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '领取 30 天 Pro' })).not.toBeInTheDocument();
  });

  it('merges only the successful claim fields into the existing server status', async () => {
    mocks.getCheckInStatus.mockResolvedValue({
      ...BASE_STATUS,
      checkedInToday: true,
      streakCount: 7,
      rewardStatus: 'pending',
      grantId: GRANT_ID,
      canClaim: true,
    });
    mocks.claimCheckInGrant.mockResolvedValue({
      success: true,
      idempotent: false,
      grantId: GRANT_ID,
      grantStatus: 'applied',
      grantAppliedAt: '2026-07-19T04:00:00.000Z',
      subscriptionExpiresAt: '2026-08-18T04:00:00.000Z',
    });

    render(<CheckInDialog ownerId={OWNER_ID} getNow={getNow} />);
    await userEvent.click(await screen.findByRole('button', { name: '领取 30 天 Pro' }));

    await screen.findByText('30 天 Pro 奖励已发放');
    expect(screen.getByText('连续签到 7 / 7 天')).toBeInTheDocument();
    expect(mocks.claimCheckInGrant).toHaveBeenCalledWith(GRANT_ID);
  });

  it('keeps pending state when claim returns ACTIVE_PRO', async () => {
    mocks.getCheckInStatus.mockResolvedValue({
      ...BASE_STATUS,
      checkedInToday: true,
      streakCount: 7,
      rewardStatus: 'pending',
      grantId: GRANT_ID,
      canClaim: true,
    });
    mocks.claimCheckInGrant.mockRejectedValue(new CheckInApiError(
      '奖励暂时无法领取',
      409,
      'ACTIVE_PRO',
      '2026-08-01T00:00:00.000Z',
    ));

    render(<CheckInDialog ownerId={OWNER_ID} getNow={getNow} />);
    await userEvent.click(await screen.findByRole('button', { name: '领取 30 天 Pro' }));

    await screen.findByText('当前 Pro 仍有效，奖励会保留至到期后领取');
    expect(screen.getByText('奖励已保留')).toBeInTheDocument();
    expect(screen.queryByText('30 天 Pro 奖励已发放')).not.toBeInTheDocument();
  });
});
