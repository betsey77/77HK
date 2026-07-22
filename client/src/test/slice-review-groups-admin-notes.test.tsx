/**
 * R1 — review groups + admin notes UI / mapping / homepage tel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import React, { useContext, useEffect, type ReactNode } from 'react';
import { AppContext, AppProvider } from '../context/AppContext';
import { PlanAccessContext, type PlanAccessContextValue } from '../context/PlanAccessContext';
import { ThemeProvider } from '../context/ThemeContext';
import type { BookmarkedCopy, FavoriteRecord, AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import {
  bookmarkToSyncFavorite,
  favoriteRecordToBookmark,
} from '../services/cloudSync';
import { withDefaultPublishPlatform } from '../utils/publishPlatform';

const mockApi = vi.hoisted(() => ({
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
  checkAdminAccess: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    ...actual,
    ...mockApi,
  };
});

function makeSettings(over: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, ...over };
}

function makeBookmark(over: Partial<BookmarkedCopy> = {}): BookmarkedCopy {
  return {
    id: 'bm-1',
    savedAt: '2026-07-14T10:00:00.000Z',
    variantKey: 'ig',
    content: '测试文案内容',
    source: '原文',
    settings: withDefaultPublishPlatform(
      makeSettings({
        brandName: '港饮',
        productName: '冻柠茶',
        copyType: 'social',
        platform: 'ig',
      }),
      'ig',
    ),
    ...over,
  };
}

function makeFavoriteRecord(over: Partial<FavoriteRecord> = {}): FavoriteRecord {
  return {
    id: 'server-1',
    ownerId: 'u1',
    clientId: 'bm-1',
    variantKey: 'ig',
    content: '云端文案',
    source: '源',
    settings: {},
    savedAt: '2026-07-14T10:00:00.000Z',
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
    ...over,
  };
}

describe('R1 mapping — admin review preserve / not sync-writable', () => {
  it('favoriteRecordToBookmark keeps adminReview; bookmarkToSyncFavorite omits it', () => {
    const fr = makeFavoriteRecord({
      adminReview: {
        status: 'changes_requested',
        note: '请改开场',
        updatedAt: '2026-07-14T12:00:00.000Z',
      },
    });
    const bm = favoriteRecordToBookmark(fr);
    expect(bm.adminReview).toEqual({
      status: 'changes_requested',
      note: '请改开场',
      updatedAt: '2026-07-14T12:00:00.000Z',
    });

    const withReview = makeBookmark({
      adminReview: {
        status: 'adopted',
        note: '很好',
        updatedAt: '2026-07-14T12:00:00.000Z',
      },
    });
    const req = bookmarkToSyncFavorite(withReview);
    expect(req).not.toHaveProperty('adminReview');
    expect(JSON.stringify(req)).not.toContain('adminReview');
    expect(JSON.stringify(req)).not.toContain('很好');
  });
});

describe('R1 FavoritesPanel admin review card', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('shows highlighted admin review when collapsed; hides empty when no review', async () => {
    const { default: FavoritesPanel } = await import('../components/favorites/FavoritesPanel');
    const withReview = makeBookmark({
      adminReview: {
        status: 'adopted',
        note: '开场很有港味',
        updatedAt: '2026-07-14T12:00:00.000Z',
      },
    });

    function Seed({ children }: { children: ReactNode }) {
      const { dispatch } = useContext(AppContext);
      useEffect(() => {
        dispatch({ type: 'HYDRATE_BOOKMARKS', payload: [withReview] });
      }, [dispatch]);
      return <>{children}</>;
    }

    const plan: PlanAccessContextValue = {
      planId: 'pro',
      isLoading: false,
      error: null,
      refresh: async () => {},
    };

    render(
      <PlanAccessContext.Provider value={plan}>
        <AppProvider ownerId="r1-user">
          <Seed>
            <FavoritesPanel isOpen onClose={() => undefined} />
          </Seed>
        </AppProvider>
      </PlanAccessContext.Provider>,
    );

    const block = await screen.findByTestId('bookmark-admin-review');
    expect(block).toHaveTextContent('已采纳');
    expect(block).toHaveTextContent('管理员审核意见');
    expect(block).toHaveTextContent('开场很有港味');
  });

  it('does not render empty admin review box without review', async () => {
    const { default: FavoritesPanel } = await import('../components/favorites/FavoritesPanel');
    const bare = makeBookmark({ adminReview: null });

    function Seed({ children }: { children: ReactNode }) {
      const { dispatch } = useContext(AppContext);
      useEffect(() => {
        dispatch({ type: 'HYDRATE_BOOKMARKS', payload: [bare] });
      }, [dispatch]);
      return <>{children}</>;
    }

    const plan: PlanAccessContextValue = {
      planId: 'pro',
      isLoading: false,
      error: null,
      refresh: async () => {},
    };

    render(
      <PlanAccessContext.Provider value={plan}>
        <AppProvider ownerId="r1-user-2">
          <Seed>
            <FavoritesPanel isOpen onClose={() => undefined} />
          </Seed>
        </AppProvider>
      </PlanAccessContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('测试文案内容')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('bookmark-admin-review')).toBeNull();
  });
});

describe('R1 AdminPage review editor', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockApi.checkAdminAccess.mockResolvedValue(true);
    mockApi.getAdminStats.mockResolvedValue({
      totalUsers: 1,
      activeSubscriptions: 0,
      totalGenerations: 0,
      totalFeedback: 0,
      adminUsers: 1,
      role: 'admin',
      reviewGroup: 'group1',
    });
    mockApi.getAdminFavorites.mockResolvedValue({
      favorites: [{
        id: 'f1',
        ownerReviewGroup: 'group1',
        ownerDisplayName: '用户甲',
        userEmail: 'a@test.com',
        variantKey: 'ig',
        rating: 5,
        notes: '备注',
        favoriteReason: null,
        reasonTags: ['hook'],
        savedAt: '2026-07-14T00:00:00.000Z',
        brandName: '港饮',
        productName: '冻柠茶',
        copyType: 'social',
        platform: 'ig',
        publishPlatform: 'ig',
        reviewStatus: null,
        reviewNote: null,
        reviewUpdatedAt: null,
      }],
      total: 1,
    });
    mockApi.getAdminFavoriteDetail.mockResolvedValue({
      id: 'f1',
      ownerDisplayName: '用户甲',
      userEmail: 'a@test.com',
      variantKey: 'ig',
      content: '详情正文',
      rating: 5,
      notes: '备注',
      favoriteReason: null,
      reasonTags: ['hook'],
      savedAt: '2026-07-14T00:00:00.000Z',
      brandName: '港饮',
      productName: '冻柠茶',
      copyType: 'social',
      platform: 'ig',
      publishPlatform: 'ig',
      reviewStatus: null,
      reviewNote: null,
      reviewUpdatedAt: null,
    });
    mockApi.putAdminFavoriteReview.mockResolvedValue({
      favoriteId: 'f1',
      reviewStatus: 'adopted',
      reviewNote: '可以发布',
      reviewUpdatedAt: '2026-07-14T15:00:00.000Z',
    });
  });

  it('saves adopted review and updates list chip', async () => {
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);

    await waitFor(() => expect(mockApi.getAdminStats).toHaveBeenCalled());
    expect(screen.getByTestId('admin-scope-badge')).toHaveTextContent('group1');
    fireEvent.click(await screen.findByRole('button', { name: /用户收藏/ }));

    await waitFor(() => expect(mockApi.getAdminFavorites).toHaveBeenCalled());
    expect(screen.getByTestId('admin-favorite-review-group')).toHaveTextContent('group1');
    expect(screen.getByTestId('admin-review-status-chip')).toHaveTextContent('未审核');

    fireEvent.click(screen.getByRole('button', { name: '查看收藏详情' }));
    await waitFor(() => expect(mockApi.getAdminFavoriteDetail).toHaveBeenCalledWith('f1'));

    fireEvent.click(await screen.findByTestId('review-status-adopted'));
    fireEvent.change(screen.getByTestId('review-note-input'), {
      target: { value: '可以发布' },
    });
    fireEvent.click(screen.getByTestId('review-save-btn'));

    await waitFor(() =>
      expect(mockApi.putAdminFavoriteReview).toHaveBeenCalledWith('f1', {
        status: 'adopted',
        note: '可以发布',
        annotations: [],
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('review-success')).toHaveTextContent('审核已保存'),
    );
    expect(screen.getByTestId('admin-review-status-chip')).toHaveTextContent('已采纳');
  });

  it('anchors a sentence annotation to the selected text and saves it with the review', async () => {
    mockApi.putAdminFavoriteReview.mockResolvedValueOnce({
      favoriteId: 'f1',
      reviewStatus: 'adopted',
      reviewNote: null,
      reviewUpdatedAt: '2026-07-14T15:00:00.000Z',
      reviewAnnotations: [{
        id: 'saved-a1', startOffset: 0, endOffset: 2,
        quotedText: '详情', note: '这一句更口语一些',
      }],
    });
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);
    await waitFor(() => expect(mockApi.getAdminStats).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: /用户收藏/ }));
    await waitFor(() => expect(mockApi.getAdminFavorites).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '查看收藏详情' }));
    await waitFor(() => expect(mockApi.getAdminFavoriteDetail).toHaveBeenCalled());

    const body = screen.getByTestId('favorite-review-body') as HTMLTextAreaElement;
    body.setSelectionRange(0, 2);
    fireEvent.click(screen.getByRole('button', { name: /批注选中文字/ }));
    fireEvent.change(screen.getByLabelText('修改建议'), {
      target: { value: '这一句更口语一些' },
    });
    fireEvent.click(screen.getByRole('button', { name: '加入批注' }));
    fireEvent.click(screen.getByTestId('review-status-adopted'));
    fireEvent.click(screen.getByTestId('review-save-btn'));

    await waitFor(() => expect(mockApi.putAdminFavoriteReview).toHaveBeenCalledWith(
      'f1',
      expect.objectContaining({
        status: 'adopted',
        annotations: [expect.objectContaining({
          startOffset: 0,
          endOffset: 2,
          quotedText: '详情',
          note: '这一句更口语一些',
        })],
      }),
    ));
  });

  it('shows Chinese error when save fails', async () => {
    mockApi.putAdminFavoriteReview.mockRejectedValueOnce(new Error('fail'));
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);
    await waitFor(() => expect(mockApi.getAdminStats).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: /用户收藏/ }));
    await waitFor(() => expect(mockApi.getAdminFavorites).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '查看收藏详情' }));
    await waitFor(() => expect(mockApi.getAdminFavoriteDetail).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('review-status-adopted'));
    fireEvent.click(screen.getByTestId('review-save-btn'));
    await waitFor(() =>
      expect(screen.getByTestId('review-error')).toHaveTextContent('保存失败'),
    );
    expect(screen.getByTestId('review-error')).toHaveAttribute('role', 'alert');
  });

  it('keeps controls reachable while the favorite body is vertically resizable', async () => {
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);
    await waitFor(() => expect(mockApi.getAdminStats).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: /用户收藏/ }));
    await waitFor(() => expect(mockApi.getAdminFavorites).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '查看收藏详情' }));
    await waitFor(() => expect(mockApi.getAdminFavoriteDetail).toHaveBeenCalled());

    expect(await screen.findByTestId('favorite-review-content-region')).toHaveClass('overflow-y-auto');
    expect(screen.getByTestId('favorite-review-body')).toHaveClass('resize-y');
    expect(screen.getByText(/可拖动正文框右下角调整高度/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭收藏详情' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制文案' })).toBeInTheDocument();
  });
});

describe('R1 homepage tel contact', () => {
  it('renders team admin review contact with tel link', async () => {
    const { default: MarketingPage } = await import('../components/marketing/MarketingPage');
    render(
      <ThemeProvider>
        <MarketingPage />
      </ThemeProvider>,
    );
    const el = screen.getByTestId('admin-review-contact');
    expect(el).toHaveTextContent('团队需要管理员审核功能？请联系产品开发：TEL：18595680518');
    const link = el.querySelector('a[href="tel:18595680518"]');
    expect(link).not.toBeNull();
    expect(link).toHaveTextContent('18595680518');
  });
});
