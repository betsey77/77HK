import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { AppProvider } from '../context/AppContext';
import { AuthContext, type AuthContextValue } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import FavoritesPanel from '../components/favorites/FavoritesPanel';
import ReferenceCaseSelector from '../components/input/ReferenceCaseSelector';
import SignupPage from '../pages/SignupPage';
import type { BookmarkedCopy } from '../types';

const OWNER_ID = 'ui-polish-user';

function makeBookmark(notes?: string): BookmarkedCopy {
  return {
    id: 'bookmark-ui-1',
    savedAt: new Date().toISOString(),
    variantKey: 'ig',
    content: '返工赶时间，都想件装备够轻、够耐用。',
    source: '新品上线，适合通勤。',
    rating: 5,
    notes,
    settings: {
      platform: 'ig',
      tone: '活潑',
      cantoneseLevel: 4,
      englishMixingLevel: 1,
      creativityLevel: 1,
      inputLanguage: 'mandarin',
      brandName: '',
      productName: '',
      brandRedLines: '',
      structuredBriefEnabled: false,
      consumerPersonas: [],
      competitorQueries: [],
      selectedReferenceCaseIds: [],
      selectedCalendarEventIds: [],
    },
  };
}

function AppWrapper({ children }: { children: ReactNode }) {
  return <AppProvider ownerId={OWNER_ID}>{children}</AppProvider>;
}

beforeEach(() => {
  localStorage.clear();
});

describe('收藏备注快速识别', () => {
  it('保存备注并收起参数详情后，在卡片外层高亮显示备注', async () => {
    localStorage.setItem(`hk-cantonese-bookmarks:${OWNER_ID}`, JSON.stringify([makeBookmark()]));
    render(<FavoritesPanel isOpen onClose={vi.fn()} />, { wrapper: AppWrapper });

    await userEvent.click(screen.getByRole('button', { name: '查看参数详情' }));
    await userEvent.click(screen.getByRole('button', { name: '编辑收藏备注' }));
    await userEvent.type(screen.getByPlaceholderText('添加备注...'), '这个开头适合通勤主题');
    await userEvent.click(screen.getByRole('button', { name: '储存备注' }));
    await userEvent.click(screen.getByRole('button', { name: '收起参数详情' }));

    const note = screen.getByText('这个开头适合通勤主题');
    const noteSummary = note.closest('button');
    expect(noteSummary).not.toBeNull();
    expect(noteSummary?.className).toContain('amber');
  });
});

describe('参考收藏案例折叠面板', () => {
  it('没有达到四星的收藏时仍显示入口，并在展开后说明使用条件', async () => {
    render(<ReferenceCaseSelector />, { wrapper: AppWrapper });

    const toggle = screen.getByRole('button', { name: /参考收藏案例/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);

    expect(screen.getByText(/收藏并评分.*4.*星/)).toBeInTheDocument();
  });

  it('默认折叠，展开后显示收藏备注', async () => {
    localStorage.setItem(
      `hk-cantonese-bookmarks:${OWNER_ID}`,
      JSON.stringify([makeBookmark('重点参考第一句的节奏')]),
    );
    render(<ReferenceCaseSelector />, { wrapper: AppWrapper });

    const toggle = screen.getByRole('button', { name: /参考收藏案例/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('重点参考第一句的节奏')).toBeNull();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('重点参考第一句的节奏')).toBeInTheDocument();
  });
});

describe('注册确认提示', () => {
  it('明确提示查收邮件、点击验证链接并刷新页面', async () => {
    const authValue: AuthContextValue = {
      state: {
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        lastAuthEvent: null,
      },
      login: async () => {},
      signup: async () => ({ needsConfirmation: true }),
      logout: async () => {},
      resetPassword: async () => true,
      updatePassword: async () => true,
      clearError: () => {},
    };

    const { container } = render(
      <ThemeProvider>
        <AuthContext.Provider value={authValue}>
          <SignupPage />
        </AuthContext.Provider>
      </ThemeProvider>,
    );

    await userEvent.type(container.querySelector('#signup-email') as HTMLInputElement, 'new@example.com');
    await userEvent.type(container.querySelector('#signup-password') as HTMLInputElement, 'secret123');
    await userEvent.type(container.querySelector('#signup-confirm-password') as HTMLInputElement, 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /Sign Up/ }));

    expect(await screen.findByText(/请耐心查收邮件/)).toBeInTheDocument();
    expect(screen.getByText(/刷新当前网页/)).toBeInTheDocument();
  });
});
