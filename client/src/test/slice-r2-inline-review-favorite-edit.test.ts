import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useContext, useEffect, type ReactNode } from 'react';
import { buildAnnotatedSegments } from '../utils/reviewAnnotations';
import { bookmarkToSyncFavorite, favoriteRecordToBookmark } from '../services/cloudSync';
import type { BookmarkedCopy, FavoriteRecord } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { AppContext, AppProvider } from '../context/AppContext';
import { PlanAccessContext, type PlanAccessContextValue } from '../context/PlanAccessContext';

const mockUpdateFavoriteContent = vi.hoisted(() => vi.fn());

vi.mock('../services/cloudSync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/cloudSync')>();
  return { ...actual, updateFavoriteContent: mockUpdateFavoriteContent };
});

vi.mock('../services/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));

function wrapper(ownerId = 'r2-user') {
  const plan: PlanAccessContextValue = {
    planId: 'pro', isLoading: false, error: null, refresh: async () => undefined,
  };
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      PlanAccessContext.Provider,
      { value: plan },
      React.createElement(AppProvider, { ownerId }, children),
    );
  };
}

describe('R2 inline review anchors', () => {
  it('builds safe highlighted segments for valid non-overlapping anchors', () => {
    const result = buildAnnotatedSegments('第一句。第二句需要修改。第三句。', [{
      id: 'a1',
      startOffset: 4,
      endOffset: 11,
      quotedText: '第二句需要修改',
      note: '语气再自然一点',
    }]);

    expect(result.invalid).toEqual([]);
    expect(result.segments.some((part) => part.annotation?.id === 'a1')).toBe(true);
    expect(result.segments.map((part) => part.text).join('')).toBe('第一句。第二句需要修改。第三句。');
  });

  it('does not attach a stale anchor to different text', () => {
    const result = buildAnnotatedSegments('正文已经改变', [{
      id: 'a1',
      startOffset: 0,
      endOffset: 2,
      quotedText: '旧文',
      note: '旧意见',
    }]);

    expect(result.segments).toEqual([{ text: '正文已经改变' }]);
    expect(result.invalid).toHaveLength(1);
  });
});

describe('R2/R2.1 cloud mapping', () => {
  it('hydrates read-only annotations and edit metadata but never uploads admin review', () => {
    const record: FavoriteRecord = {
      id: 'server-1', ownerId: 'u1', clientId: 'bm-1', variantKey: 'ig',
      content: '文案', source: '原文', settings: {},
      savedAt: '2026-07-14T00:00:00.000Z', createdAt: '2026-07-14T00:00:00.000Z',
      updatedAt: '2026-07-14T00:00:00.000Z', contentRevision: 2,
      contentEditedAt: '2026-07-14T01:00:00.000Z',
      adminReview: {
        status: 'changes_requested', note: '请修改', updatedAt: '2026-07-14T02:00:00.000Z',
        annotations: [{ id: 'a1', startOffset: 0, endOffset: 2, quotedText: '文案', note: '更口语' }],
      },
    };
    const bookmark = favoriteRecordToBookmark(record);
    expect(bookmark.contentRevision).toBe(2);
    expect(bookmark.contentEditedAt).toBe('2026-07-14T01:00:00.000Z');
    expect(bookmark.adminReview?.annotations).toHaveLength(1);

    const request = bookmarkToSyncFavorite({
      ...(bookmark as BookmarkedCopy),
      settings: { ...DEFAULT_SETTINGS },
    });
    expect(request).not.toHaveProperty('adminReview');
    expect(request).not.toHaveProperty('contentEditedAt');
    expect(JSON.stringify(request)).not.toContain('更口语');
  });
});

describe('R2.1 favorite content editing', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUpdateFavoriteContent.mockReset();
  });

  it('keeps the draft open on failure and marks a successful edit pending review', async () => {
    const { default: FavoritesPanel } = await import('../components/favorites/FavoritesPanel');
    const bookmark: BookmarkedCopy = {
      id: 'bm-edit', savedAt: '2026-07-14T00:00:00.000Z', variantKey: 'ig',
      content: '旧文案', source: '原文', settings: { ...DEFAULT_SETTINGS },
      adminReview: { status: 'adopted', note: '旧审核', updatedAt: '2026-07-14T01:00:00.000Z' },
    };

    function Seed() {
      const { dispatch } = useContext(AppContext);
      useEffect(() => dispatch({ type: 'HYDRATE_BOOKMARKS', payload: [bookmark] }), [dispatch]);
      return React.createElement(FavoritesPanel, { isOpen: true, onClose: () => undefined });
    }

    const user = userEvent.setup();
    render(React.createElement(Seed), { wrapper: wrapper() });
    await user.click(await screen.findByRole('button', { name: '编辑文案' }));
    const textarea = screen.getByRole('textbox', { name: '编辑收藏文案' });
    await user.clear(textarea);
    await user.type(textarea, '修改后的文案');

    mockUpdateFavoriteContent.mockRejectedValueOnce(new Error('network'));
    await user.click(screen.getByRole('button', { name: '保存文案' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败');
    expect(textarea).toHaveValue('修改后的文案');

    mockUpdateFavoriteContent.mockResolvedValueOnce({
      ...bookmark,
      content: '修改后的文案',
      contentRevision: 2,
      contentEditedAt: '2026-07-14T02:00:00.000Z',
      reviewRequested: true,
      reviewRequestedAt: '2026-07-14T02:00:00.000Z',
      adminReview: null,
    });
    await user.click(screen.getByRole('button', { name: '保存文案' }));

    await waitFor(() => expect(screen.getByText('修改后待审核')).toBeInTheDocument());
    expect(screen.queryByText('旧审核')).not.toBeInTheDocument();
    expect(screen.getByTestId('bookmark-review-requested')).toBeInTheDocument();
    expect(mockUpdateFavoriteContent).toHaveBeenLastCalledWith('bm-edit', '修改后的文案');
  });
});
