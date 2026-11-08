import { useContext, useEffect, useState, type ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckInDialog from '../components/checkin/CheckInDialog';
import ReviewResultNotifier from '../components/favorites/ReviewResultNotifier';
import { DEFAULT_SETTINGS } from '../constants';
import { AppContext, AppProvider } from '../context/AppContext';
import type { BookmarkedCopy } from '../types';

const mocks = vi.hoisted(() => ({
  getCheckInStatus: vi.fn(),
}));

vi.mock('../services/checkInApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/checkInApi')>()),
  getCheckInStatus: mocks.getCheckInStatus,
}));

const OWNER_ID = '77777777-7777-4777-8777-777777777777';

const reviewedBookmark: BookmarkedCopy = {
  id: 'reviewed-favorite',
  savedAt: '2026-07-22T08:00:00.000Z',
  variantKey: 'ig',
  content: '今晚八点，港味新品准时登场。',
  source: '用户自写',
  settings: { ...DEFAULT_SETTINGS, brandName: '通知验收' },
  contentRevision: 1,
  adminReview: {
    status: 'adopted',
    note: '可以发布',
    updatedAt: '2026-07-22T08:30:00.000Z',
  },
};

function Seed({ children }: { children: ReactNode }) {
  const { dispatch } = useContext(AppContext);
  useEffect(() => {
    dispatch({ type: 'HYDRATE_BOOKMARKS', payload: [reviewedBookmark] });
  }, [dispatch]);
  return <>{children}</>;
}

describe('V2.1 notification priority', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.getCheckInStatus.mockResolvedValue({
      checkedInToday: false,
      checkinDateHk: '2026-07-22',
      streakCount: 1,
      streakStartedOn: '2026-07-22',
      rewardEarned: false,
      rewardStatus: 'none',
      grantId: null,
      canClaim: false,
      grantAppliedAt: null,
      subscriptionExpiresAt: null,
    });
  });

  it('keeps the review action clickable by deferring check-in until the review result closes', async () => {
    render(
      <AppProvider ownerId={OWNER_ID}>
        <Seed>
          <ReviewResultNotifier ownerId={OWNER_ID} />
          <CheckInDialog ownerId={OWNER_ID} />
        </Seed>
      </AppProvider>,
    );

    expect(await screen.findByRole('dialog', { name: '文案审核结果' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '每日签到' })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '稍后查看' }));
    expect(await screen.findByRole('dialog', { name: '每日签到' })).toBeInTheDocument();
  });

  it('keeps check-in deferred when it mounts after the review result is already open', async () => {
    function LateMountHarness() {
      const [showCheckIn, setShowCheckIn] = useState(false);
      return (
        <>
          <ReviewResultNotifier ownerId={OWNER_ID} />
          <button type="button" onClick={() => setShowCheckIn(true)}>挂载签到</button>
          {showCheckIn && <CheckInDialog ownerId={OWNER_ID} />}
        </>
      );
    }

    render(
      <AppProvider ownerId={OWNER_ID}>
        <Seed>
          <LateMountHarness />
        </Seed>
      </AppProvider>,
    );

    expect(await screen.findByRole('dialog', { name: '文案审核结果' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '挂载签到' }));
    expect(screen.queryByRole('dialog', { name: '每日签到' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '稍后查看' }));
    expect(await screen.findByRole('dialog', { name: '每日签到' })).toBeInTheDocument();
  });
});
