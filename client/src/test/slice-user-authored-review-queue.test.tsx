import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React, { useContext, useEffect, type ReactNode } from 'react';
import { AppContext, AppProvider } from '../context/AppContext';
import { PlanAccessContext, type PlanAccessContextValue } from '../context/PlanAccessContext';
import { DEFAULT_SETTINGS } from '../constants';
import type { BookmarkedCopy, FavoriteRecord } from '../types';
import { bookmarkToSyncFavorite, favoriteRecordToBookmark } from '../services/cloudSync';

const mockApi = vi.hoisted(() => ({
  checkAdminAccess: vi.fn(),
  getAdminPendingReviewSummary: vi.fn(),
  getAdminStats: vi.fn(),
  getAdminUsers: vi.fn().mockResolvedValue({ users: [], total: 0 }),
  getAdminGenerations: vi.fn().mockResolvedValue({ jobs: [], total: 0 }),
  getAdminFeedback: vi.fn().mockResolvedValue({ feedback: [], total: 0 }),
  getAdminSubscriptions: vi.fn().mockResolvedValue({ subscriptions: [], total: 0 }),
  getAdminAuditLog: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
  getAdminFavorites: vi.fn(),
  getAdminFavoriteDetail: vi.fn(),
  putAdminFavoriteReview: vi.fn(),
  getAdminCaseLibraryDetail: vi.fn(),
}));

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  ...mockApi,
}));

function bookmark(over: Partial<BookmarkedCopy> = {}): BookmarkedCopy {
  return {
    id: 'bm-1',
    savedAt: '2026-07-15T12:00:00.000Z',
    variantKey: 'ig',
    content: '用户原创文案',
    source: '用户自写',
    settings: {
      ...DEFAULT_SETTINGS,
      brandName: '港饮',
      copyType: 'social',
      publishPlatform: 'ig',
    },
    isUserAuthored: true,
    reviewRequested: true,
    reviewRequestedAt: '2026-07-15T12:00:00.000Z',
    ...over,
  };
}

function planWrapper({ children }: { children: ReactNode }) {
  const plan: PlanAccessContextValue = {
    planId: 'pro', isLoading: false, error: null, refresh: async () => {},
  };
  return (
    <PlanAccessContext.Provider value={plan}>
      <AppProvider ownerId="authored-test">{children}</AppProvider>
    </PlanAccessContext.Provider>
  );
}

describe('user-authored favorite cloud contract', () => {
  it('round-trips review flags but never sends the database-owned timestamp', () => {
    const request = bookmarkToSyncFavorite(bookmark());
    expect(request).toMatchObject({ isUserAuthored: true, reviewRequested: true });
    expect(request).not.toHaveProperty('reviewRequestedAt');

    const record: FavoriteRecord = {
      id: 'server-1', ownerId: 'u1', clientId: 'bm-1', variantKey: 'ig',
      content: '用户原创文案', source: '用户自写', settings: bookmark().settings,
      savedAt: '2026-07-15T12:00:00.000Z', createdAt: '2026-07-15T12:00:00.000Z',
      updatedAt: '2026-07-15T12:00:00.000Z', isUserAuthored: true,
      reviewRequested: true, reviewRequestedAt: '2026-07-15T12:00:01.000Z',
    };
    expect(favoriteRecordToBookmark(record)).toMatchObject({
      isUserAuthored: true,
      reviewRequested: true,
      reviewRequestedAt: '2026-07-15T12:00:01.000Z',
    });
  });
});

describe('FavoritesPanel user-authored flow', () => {
  beforeEach(() => cleanup());

  it('creates a required-metadata favorite with an explicit review choice', async () => {
    const { default: FavoritesPanel } = await import('../components/favorites/FavoritesPanel');
    render(<FavoritesPanel isOpen onClose={() => undefined} />, { wrapper: planWrapper });

    fireEvent.click(screen.getByRole('button', { name: '添加自写文案' }));
    fireEvent.change(screen.getByLabelText('品牌名称'), { target: { value: '港饮新店' } });
    fireEvent.change(screen.getByLabelText('文案类型'), { target: { value: 'spoken' } });
    fireEvent.change(screen.getByLabelText('发布平台'), { target: { value: 'ig' } });
    fireEvent.change(screen.getByLabelText('文案正文'), { target: { value: '今晚冻柠茶，够醒神。' } });
    fireEvent.click(screen.getByLabelText('提交管理员审核'));
    fireEvent.click(screen.getByRole('button', { name: '保存到收藏库' }));

    expect(await screen.findByText('今晚冻柠茶，够醒神。')).toBeInTheDocument();
    expect(screen.getByTestId('bookmark-review-requested')).toHaveTextContent('待管理员审核');
  });

  it('edits an existing favorite copy type', async () => {
    const { default: FavoritesPanel } = await import('../components/favorites/FavoritesPanel');
    function Seed() {
      const { dispatch } = useContext(AppContext);
      useEffect(() => dispatch({ type: 'HYDRATE_BOOKMARKS', payload: [bookmark()] }), [dispatch]);
      return <FavoritesPanel isOpen onClose={() => undefined} />;
    }
    render(<Seed />, { wrapper: planWrapper });
    const select = await screen.findByLabelText('文案类型');
    fireEvent.change(select, { target: { value: 'spoken' } });
    expect(screen.getByTestId('bookmark-copy-type')).toHaveValue('spoken');
  });
});

describe('generated favorite review queue', () => {
  it('submits a newly bookmarked generated copy for admin review immediately', async () => {
    const { default: BookmarkButton } = await import('../components/results/BookmarkButton');
    function Harness() {
      const { state } = useContext(AppContext);
      return (
        <>
          <BookmarkButton
            buildBookmark={() => bookmark({ isUserAuthored: false, reviewRequested: false })}
          />
          <output data-testid="generated-review-requested">
            {String(state.bookmarkedCopies[0]?.reviewRequested ?? false)}
          </output>
        </>
      );
    }

    render(<Harness />, { wrapper: planWrapper });
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(await screen.findByTestId('generated-review-requested')).toHaveTextContent('true');
  });
});

describe('admin pending badge and merged reminder', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockApi.checkAdminAccess.mockResolvedValue(true);
    mockApi.getAdminPendingReviewSummary.mockResolvedValue({
      count: 2,
      latestRequestedAt: '2026-07-15T12:30:00.000Z',
    });
    mockApi.getAdminStats.mockResolvedValue({
      totalUsers: 1, activeSubscriptions: 0, totalGenerations: 0,
      totalFeedback: 0, adminUsers: 1, role: 'admin',
    });
    mockApi.getAdminFavorites.mockResolvedValue({
      favorites: [{
        id: 'f1', ownerDisplayName: '用户甲', userEmail: 'a@test.com', variantKey: 'ig',
        rating: null, notes: null, favoriteReason: null, reasonTags: [],
        savedAt: '2026-07-15T12:00:00.000Z', brandName: '港饮', productName: null,
        copyType: 'social', platform: 'all', publishPlatform: 'ig', reviewStatus: null,
        reviewNote: null, reviewUpdatedAt: null, isUserAuthored: true,
        reviewRequested: true, reviewRequestedAt: '2026-07-15T12:30:00.000Z',
        isPendingReview: true,
      }],
      total: 1,
    });
  });

  it('shows a count badge and deduplicates the same reminder after focus refresh', async () => {
    const { default: HeaderMenu } = await import('../components/layout/HeaderMenu');
    render(<AppProvider ownerId="admin-menu"><HeaderMenu userEmail="admin@test.com" /></AppProvider>);

    expect(await screen.findByTestId('admin-pending-badge')).toHaveTextContent('2');
    expect(screen.getByRole('status')).toHaveTextContent('2 条文案待审核');
    fireEvent.click(screen.getByRole('button', { name: '稍后审核' }));
    fireEvent.focus(window);
    await waitFor(() => expect(mockApi.getAdminPendingReviewSummary).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('status')).toBeNull();

    mockApi.getAdminPendingReviewSummary.mockResolvedValueOnce({
      count: 1,
      latestRequestedAt: '2026-07-15T12:00:00.000Z',
    });
    fireEvent.focus(window);
    await waitFor(() => expect(mockApi.getAdminPendingReviewSummary).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole('status')).toBeNull();

    mockApi.getAdminPendingReviewSummary.mockResolvedValueOnce({
      count: 2,
      latestRequestedAt: '2026-07-15T12:40:00.000Z',
    });
    fireEvent.focus(window);
    expect(await screen.findByRole('status')).toHaveTextContent('2 条文案待审核');
  });

  it('filters and highlights pending rows in the admin favorites tab', async () => {
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);
    fireEvent.click(await screen.findByRole('button', { name: /用户收藏/ }));
    expect(await screen.findByTestId('admin-favorites-pending-badge')).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('button', { name: '只看待审核' }));
    await waitFor(() => expect(mockApi.getAdminFavorites).toHaveBeenLastCalledWith(20, 0, '', true));
    expect(await screen.findByTestId('admin-pending-row')).toBeInTheDocument();
  });

  it('shows the bottom-right reminder on the admin page and opens the pending queue', async () => {
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage userEmail="admin-page@test.com" />);

    const reminder = await screen.findByTestId('admin-page-review-reminder');
    expect(reminder).toHaveTextContent('2 条文案待审核');
    fireEvent.click(screen.getByRole('button', { name: '立刻审核' }));
    await waitFor(() => expect(mockApi.getAdminFavorites).toHaveBeenLastCalledWith(20, 0, '', true));
  });

  it('explains an empty pending queue without hiding reviewed favorites', async () => {
    mockApi.getAdminPendingReviewSummary.mockResolvedValue({
      count: 0,
      latestRequestedAt: null,
    });
    mockApi.getAdminFavorites.mockResolvedValue({ favorites: [], total: 0 });

    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);
    fireEvent.click(await screen.findByRole('button', { name: /用户收藏/ }));
    fireEvent.click(screen.getByRole('button', { name: '只看待审核' }));

    expect(await screen.findByText('当前没有待管理员审核的文案')).toBeInTheDocument();
    expect(screen.getByText(/已通过或需用户修改的文案/)).toBeInTheDocument();
    expect(screen.getByText('只看待审核（0）')).toBeInTheDocument();
  });
});
