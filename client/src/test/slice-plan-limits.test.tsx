import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext, type ReactNode } from 'react';
import { AppContext, AppProvider } from '../context/AppContext';
import { PlanAccessContext, type PlanAccessContextValue } from '../context/PlanAccessContext';
import BookmarkButton from '../components/results/BookmarkButton';
import FavoritesPanel from '../components/favorites/FavoritesPanel';
import type { BookmarkedCopy, PlanId } from '../types';

const OWNER_ID = 'plan-limit-user';

function makeBookmark(index: number): BookmarkedCopy {
  return {
    id: `bookmark-${index}`,
    savedAt: new Date(Date.now() - index * 1000).toISOString(),
    variantKey: 'ig',
    content: `容量收藏 ${index}`,
    source: `原文 ${index}`,
    rating: 5,
    settings: {
      platform: 'ig',
      tone: '活潑',
      cantoneseLevel: 4,
      englishMixingLevel: 1,
      creativityLevel: 1,
      inputLanguage: 'mandarin',
      brandName: index === 1 ? '思念' : '',
      productName: index === 1 ? '煎饺王' : '',
      brandRedLines: '',
      structuredBriefEnabled: false,
      consumerPersonas: [],
      competitorQueries: [],
      selectedReferenceCaseIds: [],
      selectedCalendarEventIds: [],
    },
  };
}

function wrapperFor(planId: PlanId) {
  const value: PlanAccessContextValue = {
    planId,
    isLoading: false,
    error: null,
    refresh: async () => {},
  };
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <PlanAccessContext.Provider value={value}>
        <AppProvider ownerId={OWNER_ID}>{children}</AppProvider>
      </PlanAccessContext.Provider>
    );
  };
}

beforeEach(() => localStorage.clear());

describe('Free 收藏容量', () => {
  it('已有 10 条时阻止新增并显示 Pro 解锁入口', async () => {
    localStorage.setItem(
      `hk-cantonese-bookmarks:${OWNER_ID}`,
      JSON.stringify(Array.from({ length: 10 }, (_, index) => makeBookmark(index + 1))),
    );

    function Harness() {
      const { state } = useContext(AppContext);
      return (
        <>
          <span data-testid="count">{state.bookmarkedCopies.length}</span>
          <BookmarkButton bookmarkId={undefined} buildBookmark={() => makeBookmark(11)} />
        </>
      );
    }

    render(<Harness />, { wrapper: wrapperFor('free') });
    await userEvent.click(screen.getByTitle('收藏此文案'));

    expect(screen.getByTestId('count')).toHaveTextContent('10');
    expect(screen.getByRole('dialog', { name: '收藏容量已满' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '升级 Pro' })).toHaveAttribute('href', '/app/billing');
  });

  it('删除一条释放容量后可继续收藏', async () => {
    localStorage.setItem(
      `hk-cantonese-bookmarks:${OWNER_ID}`,
      JSON.stringify(Array.from({ length: 10 }, (_, index) => makeBookmark(index + 1))),
    );

    function Harness() {
      const { state, dispatch } = useContext(AppContext);
      return (
        <>
          <span data-testid="count">{state.bookmarkedCopies.length}</span>
          <button onClick={() => dispatch({ type: 'REMOVE_BOOKMARK', payload: 'bookmark-1' })}>释放一条</button>
          <BookmarkButton bookmarkId={undefined} buildBookmark={() => makeBookmark(11)} />
        </>
      );
    }

    render(<Harness />, { wrapper: wrapperFor('free') });
    await userEvent.click(screen.getByText('释放一条'));
    await userEvent.click(screen.getByTitle('收藏此文案'));
    expect(screen.getByTestId('count')).toHaveTextContent('10');
  });

  it('Pro 用户可新增第 11 条收藏', async () => {
    localStorage.setItem(
      `hk-cantonese-bookmarks:${OWNER_ID}`,
      JSON.stringify(Array.from({ length: 10 }, (_, index) => makeBookmark(index + 1))),
    );

    function Harness() {
      const { state } = useContext(AppContext);
      return (
        <>
          <span data-testid="count">{state.bookmarkedCopies.length}</span>
          <BookmarkButton bookmarkId={undefined} buildBookmark={() => makeBookmark(11)} />
        </>
      );
    }

    render(<Harness />, { wrapper: wrapperFor('pro') });
    await userEvent.click(screen.getByTitle('收藏此文案'));
    expect(screen.getByTestId('count')).toHaveTextContent('11');
  });
});

describe('收藏库 Pro 解锁收纳', () => {
  it('Free 只展示最新 10 条并显示锁定数量', () => {
    localStorage.setItem(
      `hk-cantonese-bookmarks:${OWNER_ID}`,
      JSON.stringify(Array.from({ length: 11 }, (_, index) => makeBookmark(index + 1))),
    );
    render(<FavoritesPanel isOpen onClose={vi.fn()} />, { wrapper: wrapperFor('free') });

    expect(screen.getByText(/Free 可使用 10 条收藏，另有 1 条需 Pro 解锁/)).toBeInTheDocument();
    expect(screen.queryByText('容量收藏 11')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '解锁全部收藏' })).toHaveAttribute('href', '/app/billing');
  });

  it('Pro 可通过分页访问全部收藏且不显示锁定提示', async () => {
    localStorage.setItem(
      `hk-cantonese-bookmarks:${OWNER_ID}`,
      JSON.stringify(Array.from({ length: 11 }, (_, index) => makeBookmark(index + 1))),
    );
    render(<FavoritesPanel isOpen onClose={vi.fn()} />, { wrapper: wrapperFor('pro') });

    expect(screen.queryByText(/需 Pro 解锁/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(screen.getByText('容量收藏 11')).toBeInTheDocument();
  });
});
