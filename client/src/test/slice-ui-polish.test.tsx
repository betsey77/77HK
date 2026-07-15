import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { AppProvider } from '../context/AppContext';
import { AuthContext, type AuthContextValue } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { PlanAccessContext } from '../context/PlanAccessContext';
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
  return (
    <PlanAccessContext.Provider value={{ planId: 'pro', isLoading: false, error: null, refresh: async () => {} }}>
      <AppProvider ownerId={OWNER_ID}>{children}</AppProvider>
    </PlanAccessContext.Provider>
  );
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

describe('收藏卡片品牌与产品信息', () => {
  it('在平台标签左侧显示品牌名和产品名', () => {
    const bookmark = makeBookmark();
    bookmark.settings.brandName = '思念';
    bookmark.settings.productName = '煎饺王';
    localStorage.setItem(`hk-cantonese-bookmarks:${OWNER_ID}`, JSON.stringify([bookmark]));

    render(<FavoritesPanel isOpen onClose={vi.fn()} />, { wrapper: AppWrapper });

    const brandProduct = screen.getByText('思念 · 煎饺王');
    const platform = screen.getByTestId('bookmark-variant');
    expect(brandProduct).toHaveClass('text-red-400', 'light:text-red-600');
    expect(
      brandProduct.compareDocumentPosition(platform) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('收藏库批量删除', () => {
  it('支持多选并只删除确认的收藏', async () => {
    const first = makeBookmark();
    first.id = 'bookmark-bulk-1';
    first.content = '批量删除第一条收藏';
    const second = makeBookmark();
    second.id = 'bookmark-bulk-2';
    second.content = '保留第二条收藏';
    localStorage.setItem(
      `hk-cantonese-bookmarks:${OWNER_ID}`,
      JSON.stringify([first, second]),
    );

    render(<FavoritesPanel isOpen onClose={vi.fn()} />, { wrapper: AppWrapper });
    await userEvent.click(screen.getByRole('button', { name: '批量管理' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /选择收藏：批量删除第一条收藏/ }));
    expect(screen.getByText('已选 1 / 2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /删除所选/ }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('确认批量删除收藏');
    await userEvent.click(screen.getByRole('button', { name: '确认删除 1 条' }));

    expect(screen.queryByText('批量删除第一条收藏')).not.toBeInTheDocument();
    expect(screen.getByText('保留第二条收藏')).toBeInTheDocument();
  });

  it('支持全选当前收藏，退出多选会清空选择', async () => {
    const first = makeBookmark();
    first.id = 'bookmark-select-1';
    first.content = '全选第一条';
    const second = makeBookmark();
    second.id = 'bookmark-select-2';
    second.content = '全选第二条';
    localStorage.setItem(`hk-cantonese-bookmarks:${OWNER_ID}`, JSON.stringify([first, second]));

    render(<FavoritesPanel isOpen onClose={vi.fn()} />, { wrapper: AppWrapper });
    await userEvent.click(screen.getByRole('button', { name: '批量管理' }));
    await userEvent.click(screen.getByRole('checkbox', { name: '全选当前收藏' }));
    expect(screen.getByText('已选 2 / 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '完成' }));
    expect(screen.queryByText('已选 2 / 2')).not.toBeInTheDocument();
  });
});

describe('收藏库检索与分页', () => {
  it('可按品牌、产品、原文或收藏文案快速检索', async () => {
    const target = makeBookmark();
    target.id = 'bookmark-search-target';
    target.content = '香港返工快手早餐';
    target.settings.brandName = '思念';
    target.settings.productName = '煎饺王';
    const other = makeBookmark();
    other.id = 'bookmark-search-other';
    other.content = '另一条收藏';
    other.settings.brandName = '其他品牌';

    localStorage.setItem(
      `hk-cantonese-bookmarks:${OWNER_ID}`,
      JSON.stringify([target, other]),
    );
    render(<FavoritesPanel isOpen onClose={vi.fn()} />, { wrapper: AppWrapper });

    await userEvent.type(
      screen.getByRole('searchbox', { name: '搜索收藏' }),
      '煎饺王',
    );
    expect(screen.getByText('香港返工快手早餐')).toBeInTheDocument();
    expect(screen.queryByText('另一条收藏')).not.toBeInTheDocument();
  });

  it('收藏超过 10 条时分页，并只全选当前页', async () => {
    const bookmarks = Array.from({ length: 11 }, (_, index) => {
      const bookmark = makeBookmark();
      bookmark.id = `bookmark-page-${index + 1}`;
      bookmark.content = `分页收藏 ${index + 1}`;
      bookmark.savedAt = new Date(Date.now() - index * 1000).toISOString();
      return bookmark;
    });
    localStorage.setItem(`hk-cantonese-bookmarks:${OWNER_ID}`, JSON.stringify(bookmarks));

    render(<FavoritesPanel isOpen onClose={vi.fn()} />, { wrapper: AppWrapper });
    expect(screen.getByText('第 1 / 2 页')).toBeInTheDocument();
    expect(screen.getByText('分页收藏 10')).toBeInTheDocument();
    expect(screen.queryByText('分页收藏 11')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '批量管理' }));
    await userEvent.click(screen.getByRole('checkbox', { name: '全选当前收藏' }));
    expect(screen.getByText('已选 10 / 11')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(screen.getByText('分页收藏 11')).toBeInTheDocument();
    expect(screen.getByText('已选 10 / 11')).toBeInTheDocument();
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
