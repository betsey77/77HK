import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useContext } from 'react';
import { AppContext, AppProvider } from '../context/AppContext';
import Header from '../components/layout/Header';
import { DEFAULT_SETTINGS } from '../constants';
import type { BookmarkedCopy } from '../types';

const bookmark: BookmarkedCopy = {
  id: 'bookmark-a',
  savedAt: '2026-07-12T00:00:00.000Z',
  variantKey: 'ig',
  content: '测试收藏',
  source: '测试原文',
  settings: { ...DEFAULT_SETTINGS },
};

function StateHarness() {
  const { state, dispatch } = useContext(AppContext);

  return (
    <div>
      <span data-testid="bookmark-count">{state.bookmarkedCopies.length}</span>
      <span data-testid="settings">{JSON.stringify(state.settings)}</span>
      <button onClick={() => dispatch({ type: 'ADD_BOOKMARK', payload: bookmark })}>add</button>
      <button
        onClick={() => {
          dispatch({ type: 'SET_STRUCTURED_BRIEF_ENABLED', payload: true });
          dispatch({ type: 'SET_CREATIVITY_LEVEL', payload: 4 });
          dispatch({ type: 'SET_CANTO_LEVEL', payload: 0 });
          dispatch({ type: 'SET_ENGLISH_LEVEL', payload: 5 });
          dispatch({
            type: 'SET_CONSUMER_PERSONAS',
            payload: [{ id: 'p1', name: '测试用户', ageRange: '', occupation: '', habits: '', apps: '', notes: '' }],
          });
          dispatch({ type: 'SET_BRAND_NAME', payload: '保留品牌' });
        }}
      >
        mutate
      </button>
      <button onClick={() => dispatch({ type: 'RESTORE_DEFAULT_GENERATION_SETTINGS' })}>restore</button>
    </div>
  );
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
});

describe('C2a 客户端账户隔离', () => {
  it('不会把归属不明的旧全局收藏自动分配给当前账户', () => {
    localStorage.setItem('hk-cantonese-bookmarks', JSON.stringify([bookmark]));

    render(<AppProvider ownerId="user-a"><StateHarness /></AppProvider>);

    expect(screen.getByTestId('bookmark-count')).toHaveTextContent('0');
  });

  it('同一浏览器内不同 user.id 的收藏互不可见', () => {
    const accountA = render(<AppProvider ownerId="user-a"><StateHarness /></AppProvider>);
    fireEvent.click(screen.getByText('add'));
    expect(screen.getByTestId('bookmark-count')).toHaveTextContent('1');
    accountA.unmount();

    const accountB = render(<AppProvider ownerId="user-b"><StateHarness /></AppProvider>);
    expect(screen.getByTestId('bookmark-count')).toHaveTextContent('0');
    accountB.unmount();

    render(<AppProvider ownerId="user-a"><StateHarness /></AppProvider>);
    expect(screen.getByTestId('bookmark-count')).toHaveTextContent('1');
  });
});

describe('复原默认创作配置', () => {
  it('恢复指定五项默认值，并保留未要求清空的品牌字段', () => {
    render(<AppProvider ownerId="user-a"><StateHarness /></AppProvider>);
    fireEvent.click(screen.getByText('mutate'));
    fireEvent.click(screen.getByText('restore'));

    const settings = JSON.parse(screen.getByTestId('settings').textContent ?? '{}');
    expect(settings.structuredBriefEnabled).toBe(false);
    expect(settings.creativityLevel).toBe(1);
    expect(settings.cantoneseLevel).toBe(4);
    expect(settings.englishMixingLevel).toBe(1);
    expect(settings.consumerPersonas).toEqual([]);
    expect(settings.brandName).toBe('保留品牌');
  });

  it('工作台右上角提供复原配置入口（UX-F1 菜单收纳）', () => {
    render(<AppProvider ownerId="user-a"><Header onLogout={vi.fn()} /></AppProvider>);
    // UX-F1: 复原配置已收纳到 HeaderMenu 下拉菜单中，菜单触发器应存在
    const menuTrigger = screen.getByRole('button', { name: /账户与更多选项/ });
    expect(menuTrigger).toBeInTheDocument();
  });
});
