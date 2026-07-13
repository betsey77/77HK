/**
 * Slice G1-regression: Tests for Area A (reference cases), B (calendar coverage),
 * and C (pricing linkage + next-path security).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ============================================================
// Area A: ReferenceCaseSelector — "可用 N 条" header count
// ============================================================

import { AppProvider, AppContext } from '../context/AppContext';

// We import the real component to verify rendering, but seed context directly.
import ReferenceCaseSelector from '../components/input/ReferenceCaseSelector';

function WrapperWithContext({ children, initialState }: { children: React.ReactNode; initialState?: any }) {
  return (
    <AppProvider ownerId="test-user-a">
      <InnerWrapper initialState={initialState}>{children}</InnerWrapper>
    </AppProvider>
  );
}

function InnerWrapper({ children, initialState }: { children: React.ReactNode; initialState?: any }) {
  const { state, dispatch } = React.useContext(AppContext);
  React.useEffect(() => {
    if (initialState?.bookmarkedCopies) {
      dispatch({ type: 'HYDRATE_BOOKMARKS', payload: initialState.bookmarkedCopies });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

describe('Area A — ReferenceCaseSelector header count', () => {
  it('shows "可用 0 条" when no rated bookmarks exist', () => {
    render(
      <AppProvider ownerId="test-user-a">
        <ReferenceCaseSelector />
      </AppProvider>,
    );
    const button = screen.getByRole('button', { expanded: false });
    expect(button.textContent).toMatch(/可用\s*0\s*条/);
    expect(button.textContent).toMatch(/已选\s*0\/3/);
  });

  it('shows "可用 2 条" when 2 bookmarks rated >= 4', () => {
    const bookmarks = [
      { id: '1', content: '好正！', rating: 5, savedAt: '2026-07-12T10:00:00Z', variantKey: 'ig' },
      { id: '2', content: '美食推荐', rating: 4, savedAt: '2026-07-12T09:00:00Z', variantKey: 'facebook' },
    ];
    localStorage.setItem('hk-cantonese-bookmarks:test-user-b', JSON.stringify(bookmarks));

    render(
      <AppProvider ownerId="test-user-b">
        <ReferenceCaseSelector />
      </AppProvider>,
    );
    const button = screen.getByRole('button', { expanded: false });
    expect(button.textContent).toMatch(/可用\s*2\s*条/);
  });

  it('does not count bookmarks rated < 4', () => {
    const bookmarks = [
      { id: '1', content: '好正！', rating: 5, savedAt: '2026-07-12T10:00:00Z', variantKey: 'ig' },
      { id: '2', content: '一般', rating: 3, savedAt: '2026-07-12T09:00:00Z', variantKey: 'facebook' },
      { id: '3', content: '不错', rating: 2, savedAt: '2026-07-12T08:00:00Z', variantKey: 'shorts' },
    ];
    localStorage.setItem('hk-cantonese-bookmarks:test-user-c', JSON.stringify(bookmarks));

    render(
      <AppProvider ownerId="test-user-c">
        <ReferenceCaseSelector />
      </AppProvider>,
    );
    const button = screen.getByRole('button', { expanded: false });
    expect(button.textContent).toMatch(/可用\s*1\s*条/);
  });

  it('expanded panel shows rated bookmarks with content and rating', () => {
    const bookmarks = [
      { id: '1', content: '超好味！必試！', rating: 5, savedAt: '2026-07-12T10:00:00Z', variantKey: 'ig', reasonTags: ['hook'], notes: '这条很好' },
    ];
    localStorage.setItem('hk-cantonese-bookmarks:test-user-d', JSON.stringify(bookmarks));

    render(
      <AppProvider ownerId="test-user-d">
        <ReferenceCaseSelector />
      </AppProvider>,
    );

    const button = screen.getByRole('button', { expanded: false });
    fireEvent.click(button);

    expect(screen.getByText(/超好味/)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('这条很好')).toBeInTheDocument();
  });

  it('shows "暂无可用案例" when expanded with no rated bookmarks', () => {
    render(
      <AppProvider ownerId="test-user-e">
        <ReferenceCaseSelector />
      </AppProvider>,
    );

    const button = screen.getByRole('button', { expanded: false });
    fireEvent.click(button);

    expect(screen.getByText(/暂无可用案例/)).toBeInTheDocument();
    expect(screen.getByText(/收藏并评分.*4.*星/)).toBeInTheDocument();
  });
});

// ---- Area A helper components ----

/** Wrapper that dispatches HYDRATE_BOOKMARKS on mount */
function HydratedWrapper({
  children,
  bookmarks,
}: {
  children: React.ReactNode;
  bookmarks: any[];
}) {
  const { dispatch } = React.useContext(AppContext);
  React.useEffect(() => {
    dispatch({ type: 'HYDRATE_BOOKMARKS', payload: bookmarks });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

/** Inline component that displays current selectedReferenceCaseIds */
function SelectionTracker() {
  const { state } = React.useContext(AppContext);
  const ids = state.settings.selectedReferenceCaseIds ?? [];
  return <div data-testid="selected-ids">{ids.join(',')}</div>;
}

// ============================================================
// Area A extended: Cloud hydration, selection, payload,
// cross-account isolation
// ============================================================

describe('Area A — Cloud hydration → ReferenceCaseSelector', () => {
  const OWNER = 'test-hydrate-user';

  beforeEach(() => {
    localStorage.clear();
  });

  it('shows bookmarks after HYDRATE_BOOKMARKS via reducer', () => {
    render(
      <AppProvider ownerId={OWNER}>
        <HydratedWrapper
          bookmarks={[
            {
              id: 'r1', content: '超正嘅豬肉！', rating: 5,
              savedAt: '2026-07-12T10:00:00Z', variantKey: 'ig',
              reasonTags: ['hook'], notes: '语气好贴地',
            },
            {
              id: 'r2', content: '夏日冰涼特飲', rating: 4,
              savedAt: '2026-07-12T09:00:00Z', variantKey: 'facebook',
              reasonTags: ['tone'], notes: '',
            },
          ]}
        >
          <ReferenceCaseSelector />
        </HydratedWrapper>
      </AppProvider>,
    );

    const button = screen.getByRole('button', { expanded: false });
    expect(button.textContent).toMatch(/可用\s*2\s*条/);
    expect(button.textContent).toMatch(/已选\s*0\/3/);
  });

  it('expanded panel shows hydrated bookmarks with notes and tags', () => {
    render(
      <AppProvider ownerId={OWNER}>
        <HydratedWrapper
          bookmarks={[
            {
              id: 'r3', content: '必試新品！', rating: 5,
              savedAt: '2026-07-12T08:00:00Z', variantKey: 'shorts',
              reasonTags: ['hook', 'creative'], notes: '開頭 hook 夠搶眼',
            },
          ]}
        >
          <ReferenceCaseSelector />
        </HydratedWrapper>
      </AppProvider>,
    );

    const button = screen.getByRole('button', { expanded: false });
    fireEvent.click(button);

    expect(screen.getByText(/必試新品/)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('開頭 hook 夠搶眼')).toBeInTheDocument();
    expect(screen.getByText(/hook 吸睛/)).toBeInTheDocument();
  });

  it('hydrated bookmarks rated < 4 are not counted', () => {
    render(
      <AppProvider ownerId={OWNER}>
        <HydratedWrapper
          bookmarks={[
            { id: 'lo1', content: '一般啦', rating: 2,
              savedAt: '2026-07-12T10:00:00Z', variantKey: 'ig' },
            { id: 'lo2', content: 'OK', rating: 3,
              savedAt: '2026-07-12T09:00:00Z', variantKey: 'facebook' },
          ]}
        >
          <ReferenceCaseSelector />
        </HydratedWrapper>
      </AppProvider>,
    );

    const button = screen.getByRole('button', { expanded: false });
    expect(button.textContent).toMatch(/可用\s*0\s*条/);
  });
});

describe('Area A — Selection toggle and max 3 constraint', () => {
  const OWNER = 'test-select-user';

  beforeEach(() => {
    localStorage.clear();
  });

  it('selects and deselects reference cases', () => {
    render(
      <AppProvider ownerId={OWNER}>
        <HydratedWrapper
          bookmarks={[
            {
              id: 's1', content: 'Test content 1', rating: 5,
              savedAt: '2026-07-12T10:00:00Z', variantKey: 'ig',
            },
            {
              id: 's2', content: 'Test content 2', rating: 4,
              savedAt: '2026-07-12T09:00:00Z', variantKey: 'facebook',
            },
          ]}
        >
          <SelectionTracker />
          <ReferenceCaseSelector />
        </HydratedWrapper>
      </AppProvider>,
    );

    const button = screen.getByRole('button', { expanded: false });
    fireEvent.click(button);

    const bm1 = screen.getByText(/Test content 1/).closest('button')!;
    fireEvent.click(bm1);
    expect(screen.getByTestId('selected-ids').textContent).toContain('s1');

    fireEvent.click(bm1);
    expect(screen.getByTestId('selected-ids').textContent).toBe('');

    const bm2 = screen.getByText(/Test content 2/).closest('button')!;
    fireEvent.click(bm2);
    expect(screen.getByTestId('selected-ids').textContent).toContain('s2');
  });

  it('cannot select more than 3', () => {
    render(
      <AppProvider ownerId={OWNER}>
        <HydratedWrapper
          bookmarks={[
            { id: 'm1', content: 'A', rating: 5, savedAt: '2026-07-12T10:00:00Z', variantKey: 'ig' },
            { id: 'm2', content: 'B', rating: 5, savedAt: '2026-07-12T09:00:00Z', variantKey: 'facebook' },
            { id: 'm3', content: 'C', rating: 5, savedAt: '2026-07-12T08:00:00Z', variantKey: 'shorts' },
            { id: 'm4', content: 'D', rating: 5, savedAt: '2026-07-12T07:00:00Z', variantKey: 'standardHK' },
          ]}
        >
          <SelectionTracker />
          <ReferenceCaseSelector />
        </HydratedWrapper>
      </AppProvider>,
    );

    const button = screen.getByRole('button', { expanded: false });
    fireEvent.click(button);

    fireEvent.click(screen.getByText('A').closest('button')!);
    fireEvent.click(screen.getByText('B').closest('button')!);
    fireEvent.click(screen.getByText('C').closest('button')!);

    const idsAfter3 = screen.getByTestId('selected-ids').textContent!;
    expect(idsAfter3.split(',').length).toBe(3);

    fireEvent.click(screen.getByText('D').closest('button')!);
    const idsAfter4 = screen.getByTestId('selected-ids').textContent!;
    expect(idsAfter4.split(',').length).toBe(3);
    expect(idsAfter4).not.toContain('m4');
  });

  it('clear all button resets selection', () => {
    render(
      <AppProvider ownerId={OWNER}>
        <HydratedWrapper
          bookmarks={[
            { id: 'c1', content: 'Clear test', rating: 5, savedAt: '2026-07-12T08:00:00Z', variantKey: 'ig' },
          ]}
        >
          <SelectionTracker />
          <ReferenceCaseSelector />
        </HydratedWrapper>
      </AppProvider>,
    );

    const button = screen.getByRole('button', { expanded: false });
    fireEvent.click(button);

    fireEvent.click(screen.getByText(/Clear test/).closest('button')!);
    expect(screen.getByTestId('selected-ids').textContent).toContain('c1');

    fireEvent.click(screen.getByText('清除'));
    expect(screen.getByTestId('selected-ids').textContent).toBe('');
  });
});

describe('Area A — Cross-account isolation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('user A bookmarks do not leak to user B', () => {
    localStorage.setItem('hk-cantonese-bookmarks:user-a', JSON.stringify([
      { id: 'a1', content: 'User A content', rating: 5, savedAt: '2026-07-12T10:00:00Z', variantKey: 'ig' },
    ]));

    render(
      <AppProvider ownerId="user-b">
        <ReferenceCaseSelector />
      </AppProvider>,
    );

    const button = screen.getByRole('button', { expanded: false });
    expect(button.textContent).toMatch(/可用\s*0\s*条/);
  });

  it('user A and user B each see their own rated bookmarks', () => {
    localStorage.setItem('hk-cantonese-bookmarks:user-a', JSON.stringify([
      { id: 'a1', content: 'A bookmark', rating: 5, savedAt: '2026-07-12T10:00:00Z', variantKey: 'ig' },
    ]));
    localStorage.setItem('hk-cantonese-bookmarks:user-b', JSON.stringify([
      { id: 'b1', content: 'B bookmark', rating: 5, savedAt: '2026-07-12T09:00:00Z', variantKey: 'facebook' },
    ]));

    const { unmount } = render(
      <AppProvider ownerId="user-a">
        <ReferenceCaseSelector />
      </AppProvider>,
    );

    const buttonA = screen.getByRole('button', { expanded: false });
    expect(buttonA.textContent).toMatch(/可用\s*1\s*条/);
    fireEvent.click(buttonA);
    expect(screen.getByText(/A bookmark/)).toBeInTheDocument();
    unmount();

    render(
      <AppProvider ownerId="user-b">
        <ReferenceCaseSelector />
      </AppProvider>,
    );

    const buttonB = screen.getByRole('button', { expanded: false });
    expect(buttonB.textContent).toMatch(/可用\s*1\s*条/);
    fireEvent.click(buttonB);
    expect(screen.getByText(/B bookmark/)).toBeInTheDocument();
    expect(screen.queryByText(/A bookmark/)).not.toBeInTheDocument();
  });
});


// ============================================================
// Area C: Next-path security
// ============================================================

import { resolveNextPath } from '../services/nextPath';

describe('Area C — Next-path allowlist security', () => {
  it('allows /app', () => {
    expect(resolveNextPath('/app')).toBe('/app');
  });

  it('allows /app/billing', () => {
    expect(resolveNextPath('/app/billing')).toBe('/app/billing');
  });

  it('allows /app/history', () => {
    expect(resolveNextPath('/app/history')).toBe('/app/history');
  });

  it('allows /app/favorites', () => {
    expect(resolveNextPath('/app/favorites')).toBe('/app/favorites');
  });

  it('rejects null/undefined/empty', () => {
    expect(resolveNextPath(null)).toBeNull();
    expect(resolveNextPath(undefined)).toBeNull();
    expect(resolveNextPath('')).toBeNull();
    expect(resolveNextPath('   ')).toBeNull();
  });

  it('rejects external HTTP URL', () => {
    expect(resolveNextPath('http://evil.com')).toBeNull();
  });

  it('rejects external HTTPS URL', () => {
    expect(resolveNextPath('https://evil.com')).toBeNull();
  });

  it('rejects protocol-relative URL (//evil)', () => {
    expect(resolveNextPath('//evil.com')).toBeNull();
  });

  it('rejects path traversal', () => {
    expect(resolveNextPath('/app/../evil')).toBeNull();
    expect(resolveNextPath('..')).toBeNull();
    expect(resolveNextPath('/../etc/passwd')).toBeNull();
  });

  it('rejects unknown paths not in allowlist', () => {
    expect(resolveNextPath('/admin')).toBeNull();
    expect(resolveNextPath('/evil')).toBeNull();
    expect(resolveNextPath('/app/settings/admin')).toBeNull();
  });

  it('rejects paths with query params', () => {
    expect(resolveNextPath('/app?foo=bar')).toBeNull();
  });

  it('rejects paths with hash', () => {
    expect(resolveNextPath('/app#section')).toBeNull();
  });

  it('rejects paths not starting with /', () => {
    expect(resolveNextPath('app')).toBeNull();
  });

  it('allows /app/settings/profile', () => {
    expect(resolveNextPath('/app/settings/profile')).toBe('/app/settings/profile');
  });

  it('allows /app/settings/brand', () => {
    expect(resolveNextPath('/app/settings/brand')).toBe('/app/settings/brand');
  });

  it('handles URL-encoded next param', () => {
    // Simulating what happens after decodeURIComponent
    const encoded = '%2Fapp%2Fbilling';
    const decoded = decodeURIComponent(encoded);
    expect(resolveNextPath(decoded)).toBe('/app/billing');
  });
});


// ============================================================
// Area C: Pricing page CTA links
// ============================================================

import PricingPage from '../pages/PricingPage';

describe('Area C — PricingPage CTA links', () => {
  it('Free CTA links to signup with next=/app', () => {
    render(<PricingPage />);
    const freeLink = screen.getByText('免费开始').closest('a');
    expect(freeLink).toHaveAttribute('href', '/signup?next=%2Fapp');
  });

  it('Pro CTA links to login with next=/app/billing', () => {
    render(<PricingPage />);
    const proLink = screen.getByText('升级到 Pro').closest('a');
    expect(proLink).toHaveAttribute('href', '/login?next=%2Fapp%2Fbilling');
  });
});


// ============================================================
// Area C: MarketingPage pricing section
// ============================================================

import MarketingPage from '../components/marketing/MarketingPage';

describe('Area C — MarketingPage pricing linkage', () => {
  it('has a link to /pricing from the plans section', () => {
    render(<MarketingPage />);
    const link = screen.getByText(/查看完整定价/).closest('a');
    expect(link).toHaveAttribute('href', '/pricing');
  });

  it('nav has a /pricing link', () => {
    render(<MarketingPage />);
    const navLinks = screen.getAllByRole('link', { name: undefined });
    const pricingLink = navLinks.find(el => el.getAttribute('href') === '/pricing');
    expect(pricingLink).toBeTruthy();
  });
});
