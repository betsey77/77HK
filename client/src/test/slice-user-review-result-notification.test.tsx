import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import React, { useContext, useEffect, type ReactNode } from 'react';
import { DEFAULT_SETTINGS } from '../constants';
import { AppContext, AppProvider } from '../context/AppContext';
import { PlanAccessContext, type PlanAccessContextValue } from '../context/PlanAccessContext';
import type { BookmarkedCopy } from '../types';
import ReviewResultNotifier from '../components/favorites/ReviewResultNotifier';
import FavoritesPanel from '../components/favorites/FavoritesPanel';
import {
  OPEN_REVIEWED_FAVORITE_EVENT,
  buildReviewResultKey,
  getReviewResultStorageKey,
} from '../services/reviewResultNotifications';

function reviewedBookmark(overrides: Partial<BookmarkedCopy> = {}): BookmarkedCopy {
  return {
    id: 'favorite-1',
    savedAt: '2026-07-15T12:00:00.000Z',
    variantKey: 'ig',
    content: '今晚冻柠茶，够醒神。',
    source: '用户自写',
    settings: { ...DEFAULT_SETTINGS, brandName: '港饮' },
    contentRevision: 2,
    adminReview: {
      status: 'adopted',
      note: '可以发布',
      updatedAt: '2026-07-15T12:30:00.000Z',
    },
    ...overrides,
  };
}

function Seed({ bookmarks, children }: { bookmarks: BookmarkedCopy[]; children: ReactNode }) {
  const { dispatch } = useContext(AppContext);
  useEffect(() => {
    dispatch({ type: 'HYDRATE_BOOKMARKS', payload: bookmarks });
  }, [bookmarks, dispatch]);
  return <>{children}</>;
}

function renderNotifier(ownerId: string, bookmarks: BookmarkedCopy[]) {
  return render(
    <AppProvider ownerId={ownerId}>
      <Seed bookmarks={bookmarks}>
        <ReviewResultNotifier ownerId={ownerId} />
      </Seed>
    </AppProvider>,
  );
}

const proPlan: PlanAccessContextValue = {
  planId: 'pro',
  isLoading: false,
  error: null,
  refresh: async () => undefined,
};

describe('user review result notification', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('shows adopted and changes-requested copy from the owner-scoped bookmarks', async () => {
    const { unmount } = renderNotifier('owner-adopted', [reviewedBookmark()]);
    expect(await screen.findByRole('dialog', { name: '文案审核结果' }))
      .toHaveTextContent('你的「港饮」文案已通过审核，请立即查看');
    unmount();

    renderNotifier('owner-changes', [reviewedBookmark({
      settings: { ...DEFAULT_SETTINGS, brandName: '茶记' },
      adminReview: {
        status: 'changes_requested',
        note: '请修改开场',
        updatedAt: '2026-07-15T12:45:00.000Z',
      },
    })]);
    expect(await screen.findByRole('dialog', { name: '文案审核结果' }))
      .toHaveTextContent('你的「茶记」文案未通过审核，请立即查看');
  });

  it('falls back to a natural subject when the brand is empty', async () => {
    renderNotifier('owner-no-brand', [reviewedBookmark({
      settings: { ...DEFAULT_SETTINGS, brandName: '' },
    })]);
    const dialog = await screen.findByRole('dialog', { name: '文案审核结果' });
    expect(dialog).toHaveTextContent('你的文案已通过审核，请立即查看');
    expect(dialog).not.toHaveTextContent('「」');
  });

  it('marks the result seen only after user action and isolates seen state by owner', async () => {
    const bookmark = reviewedBookmark();
    const first = renderNotifier('owner-a', [bookmark]);
    await screen.findByRole('dialog', { name: '文案审核结果' });
    expect(localStorage.getItem(getReviewResultStorageKey('owner-a'))).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '稍后查看' }));
    const key = buildReviewResultKey('owner-a', bookmark);
    expect(JSON.parse(localStorage.getItem(getReviewResultStorageKey('owner-a')) ?? '[]'))
      .toContain(key);
    first.unmount();

    const sameOwner = renderNotifier('owner-a', [bookmark]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '文案审核结果' })).toBeNull());
    sameOwner.unmount();

    const reviewedAgain = reviewedBookmark({
      adminReview: {
        status: 'changes_requested',
        note: '第二次审核',
        updatedAt: '2026-07-15T13:00:00.000Z',
      },
    });
    localStorage.removeItem('hk-cantonese-bookmarks:owner-a');
    const newReview = renderNotifier('owner-a', [reviewedAgain]);
    expect(await screen.findByRole('dialog', { name: '文案审核结果' }))
      .toHaveTextContent('未通过审核');
    newReview.unmount();

    renderNotifier('owner-b', [bookmark]);
    expect(await screen.findByRole('dialog', { name: '文案审核结果' })).toBeInTheDocument();
  });

  it('does not notify incomplete reviews and emits the favorite id on immediate view', async () => {
    const incomplete = reviewedBookmark({ contentRevision: undefined });
    const first = renderNotifier('owner-incomplete', [incomplete]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '文案审核结果' })).toBeNull());
    first.unmount();

    let openedId: string | null = null;
    const listener = (event: Event) => {
      openedId = (event as CustomEvent<{ favoriteId: string }>).detail.favoriteId;
    };
    window.addEventListener(OPEN_REVIEWED_FAVORITE_EVENT, listener);
    renderNotifier('owner-open', [reviewedBookmark()]);
    fireEvent.click(await screen.findByRole('button', { name: '立即查看' }));
    expect(openedId).toBe('favorite-1');
    window.removeEventListener(OPEN_REVIEWED_FAVORITE_EVENT, listener);
  });

  it('rescans when a later cloud refresh adds a new review result', async () => {
    const initial = reviewedBookmark({ adminReview: null });
    const view = renderNotifier('owner-later-review', [initial]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '文案审核结果' })).toBeNull());

    view.rerender(
      <AppProvider ownerId="owner-later-review">
        <Seed bookmarks={[reviewedBookmark({
          adminReview: {
            status: 'adopted',
            note: '新审核',
            updatedAt: '2026-07-15T14:00:00.000Z',
          },
        })]}>
          <ReviewResultNotifier ownerId="owner-later-review" />
        </Seed>
      </AppProvider>,
    );

    expect(await screen.findByRole('dialog', { name: '文案审核结果' }))
      .toHaveTextContent('已通过审核');
  });
});

describe('reviewed favorite focus', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('moves to the target page and highlights the reviewed favorite', async () => {
    const bookmarks = Array.from({ length: 11 }, (_, index) => reviewedBookmark({
      id: `favorite-${index}`,
      content: index === 10 ? '需要定位的审核文案' : `普通收藏 ${index}`,
      savedAt: `2026-07-15T${String(23 - index).padStart(2, '0')}:00:00.000Z`,
      adminReview: null,
    }));

    render(
      <PlanAccessContext.Provider value={proPlan}>
        <AppProvider ownerId="focus-owner">
          <Seed bookmarks={bookmarks}>
            <FavoritesPanel
              isOpen
              onClose={() => undefined}
              focusBookmarkId="favorite-10"
            />
          </Seed>
        </AppProvider>
      </PlanAccessContext.Provider>,
    );

    expect(await screen.findByText('需要定位的审核文案')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('bookmark-card-favorite-10')).toHaveAttribute('data-focused', 'true');
    });
    expect(screen.getByText('第 2 / 2 页')).toBeInTheDocument();
  });
});
