/**
 * Login visual polish + favorites card header + admin notes/tags + InputPanel accordion.
 * Scope: frontend layout only — no AuthContext / API / Migration changes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useContext, useEffect, type ReactNode } from 'react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppContext, AppProvider } from '../context/AppContext';
import { PlanAccessContext, type PlanAccessContextValue } from '../context/PlanAccessContext';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import FavoritesPanel from '../components/favorites/FavoritesPanel';
import InputPanel from '../components/input/InputPanel';
import Footer from '../components/layout/Footer';
import { withDefaultPublishPlatform } from '../utils/publishPlatform';
import { formatAdminReasonTag, formatAdminReasonTags } from '../utils/adminDisplayLabels';
import type { BookmarkedCopy, AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Mocks ─────────────────────────────────────────────────────

const mockApi = vi.hoisted(() => ({
  checkAdminAccess: vi.fn().mockResolvedValue(true),
  getAdminStats: vi.fn().mockResolvedValue({
    totalUsers: 1,
    activeSubscriptions: 0,
    totalGenerations: 0,
    totalFeedback: 0,
    adminUsers: 1,
    role: 'admin' as const,
  }),
  getAdminUsers: vi.fn().mockResolvedValue({ users: [], total: 0 }),
  getAdminGenerations: vi.fn().mockResolvedValue({ jobs: [], total: 0 }),
  getAdminFeedback: vi.fn().mockResolvedValue({ feedback: [], total: 0 }),
  getAdminSubscriptions: vi.fn().mockResolvedValue({ subscriptions: [], total: 0 }),
  getAdminAuditLog: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
  getAdminFavorites: vi.fn(),
  getAdminFavoriteDetail: vi.fn(),
  getAdminCaseLibraryDetail: vi.fn(),
  generateCopy: vi.fn(),
  listCaseLibrary: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return { ...actual, ...mockApi };
});

const { mockSupabase } = vi.hoisted(() => {
  const m = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  };
  return { mockSupabase: m };
});

vi.mock('../services/supabase', () => ({
  supabase: mockSupabase,
}));

vi.mock('../hooks/useGenerate', () => ({
  useGenerate: () => ({
    generate: vi.fn(),
    isLoading: false,
    canGenerate: false,
    quotaDialogOpen: false,
    closeQuotaDialog: vi.fn(),
  }),
}));

// ── Helpers ───────────────────────────────────────────────────

function makeSettings(over: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, ...over };
}

function makeBookmark(over: Partial<BookmarkedCopy> = {}): BookmarkedCopy {
  return {
    id: 'bm-1',
    savedAt: '2026-07-14T08:00:00Z',
    variantKey: 'ig',
    content: 'IG 文案正文用于布局',
    source: '原文',
    settings: withDefaultPublishPlatform(
      makeSettings({
        platform: 'all',
        brandName: '港饮品牌很长名字测试',
        productName: '冻柠茶系列',
        copyType: 'social',
      }),
      'ig',
    ),
    ...over,
  };
}

function AuthWrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}

async function awaitAuthReady() {
  await waitFor(() => {
    expect(mockSupabase.auth.getSession).toHaveBeenCalled();
  });
}

function favoritesWrapper(ownerId = 'layout-fav-user') {
  const value: PlanAccessContextValue = {
    planId: 'pro',
    isLoading: false,
    error: null,
    refresh: async () => {},
  };
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <PlanAccessContext.Provider value={value}>
        <AppProvider ownerId={ownerId}>{children}</AppProvider>
      </PlanAccessContext.Provider>
    );
  };
}

const sampleFavorite = {
  id: 'fav-1',
  ownerDisplayName: '用户甲',
  userEmail: 'a@example.com',
  variantKey: 'ig',
  rating: 5,
  notes: '语气不错，可做模板',
  favoriteReason: '开头好',
  reasonTags: ['hook', 'tone', 'unknown_custom_tag'],
  savedAt: '2026-07-14T10:00:00Z',
  brandName: '港饮',
  productName: '冻柠茶',
  copyType: 'spoken',
  platform: 'all',
  publishPlatform: 'ig' as string | null,
};

beforeEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove('light');
  vi.clearAllMocks();
  mockApi.checkAdminAccess.mockResolvedValue(true);
  mockApi.getAdminStats.mockResolvedValue({
    totalUsers: 1,
    activeSubscriptions: 0,
    totalGenerations: 0,
    totalFeedback: 0,
    adminUsers: 1,
    role: 'admin',
  });
  mockApi.getAdminFavorites.mockResolvedValue({ favorites: [sampleFavorite], total: 1 });
  mockApi.getAdminFavoriteDetail.mockResolvedValue({
    ...sampleFavorite,
    content: '收藏正文仅详情可读',
  });
  mockApi.listCaseLibrary.mockResolvedValue({ items: [], total: 0 });
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
});

// ── A. Login visual ───────────────────────────────────────────

describe('登录页视觉与认证行为', () => {
  it('显示原稿品牌大字，并保留邮箱/密码、忘记密码与注册入口', async () => {
    render(<LoginPage />, { wrapper: AuthWrapper });
    await awaitAuthReady();

    const logo = document.querySelector('img[src="/brand/77-logo.png"]');
    expect(logo).toBeTruthy();
    expect(screen.getByRole('heading', { name: /77港话通[\s\S]*社媒文案器/ })).toBeInTheDocument();
    expect(screen.getByLabelText('邮箱 Email')).toHaveAttribute('id', 'login-email');
    expect(screen.getByLabelText('密码 Password')).toHaveAttribute('id', 'login-password');
    expect(screen.getByRole('link', { name: /忘记密码/ })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: /创建账户/ })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('button', { name: /登录/i })).toBeInTheDocument();
    expect(screen.queryByTestId('auth-capability')).not.toBeInTheDocument();
  });

  it('共享 AuthLayout 注册/忘记密码页不回归：仍有 logo 与主题切换', async () => {
    const { unmount } = render(<SignupPage />, { wrapper: AuthWrapper });
    await awaitAuthReady();
    expect(document.querySelector('img[src="/brand/77-logo.png"]')).toBeTruthy();
    expect(screen.getByLabelText(/切换至/)).toBeInTheDocument();
    unmount();

    render(<ForgotPasswordPage />, { wrapper: AuthWrapper });
    await awaitAuthReady();
    expect(document.querySelector('img[src="/brand/77-logo.png"]')).toBeTruthy();
    expect(screen.getByText('忘记密码')).toBeInTheDocument();
  });

  it('AuthLayout 不引入超大撑满标题 class，且不改 AuthContext 登录调用', () => {
    const layoutSrc = fs.readFileSync(
      path.resolve(__dirname, '../components/auth/AuthLayout.tsx'),
      'utf8',
    );
    expect(layoutSrc).toContain('/brand/77-logo.png');
    expect(layoutSrc).not.toMatch(/text-5xl|text-\[clamp\(3rem/);
    expect(layoutSrc).not.toContain('AuthContext');
    expect(layoutSrc).not.toContain('supabase');

    const loginSrc = fs.readFileSync(
      path.resolve(__dirname, '../pages/LoginPage.tsx'),
      'utf8',
    );
    expect(loginSrc).toContain('variant="login-v4"');
    expect(loginSrc).toContain('resolveNextPath');
  });

  it('AuthLayout 登录分支保留原稿打字机和花朵背景结构', () => {
    const layoutSrc = fs.readFileSync(
      path.resolve(__dirname, '../components/auth/AuthLayout.tsx'),
      'utf8',
    );
    expect(layoutSrc).toContain('77港话通\\n社媒文案器');
    expect(layoutSrc).toContain('className="veil-flowers"');
    expect(layoutSrc).toContain('className="type-title"');
    expect(layoutSrc).toContain('className="panel"');
    expect(layoutSrc).toContain('prefers-reduced-motion: reduce');
  });
});

// ── B. Favorites card header ──────────────────────────────────

describe('收藏卡片头部窄宽布局', () => {
  it('元信息可换行，日期与发布平台、三操作均在 DOM 且操作区 shrink-0', async () => {
    function SeedAndPanel() {
      const { dispatch, state } = useContext(AppContext);
      useEffect(() => {
        dispatch({ type: 'ADD_BOOKMARK', payload: makeBookmark() });
      }, [dispatch]);
      return (
        <>
          <span data-testid="count">{state.bookmarkedCopies.length}</span>
          <div style={{ width: 320 }}>
            <FavoritesPanel isOpen onClose={() => undefined} />
          </div>
        </>
      );
    }

    render(<SeedAndPanel />, { wrapper: favoritesWrapper() });
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));

    const platform = await screen.findByTestId('bookmark-publish-platform');
    expect(platform).toHaveAttribute('aria-label', '发布平台');
    expect(screen.getByTestId('bookmark-copy-type')).toBeInTheDocument();
    expect(screen.getByTestId('bookmark-variant')).toBeInTheDocument();
    expect(screen.getByTestId('bookmark-saved-at')).toBeInTheDocument();

    const actions = screen.getByTestId('bookmark-card-actions');
    expect(actions.className).toMatch(/shrink-0/);
    expect(within(actions).getByTitle(/复制/)).toBeInTheDocument();
    expect(within(actions).getByTitle(/载入参数/)).toBeInTheDocument();
    expect(within(actions).getByTitle(/删除收藏/)).toBeInTheDocument();

    // 头部容器支持换行
    const meta = screen.getByTestId('bookmark-card-meta');
    expect(meta.className).toMatch(/flex-wrap|flex-col|min-w-0/);
  });
});

// ── C. Admin notes / tags ─────────────────────────────────────

describe('管理员收藏表备注高亮与标签 chip', () => {
  it('文案类型为明显彩色 chip（非灰），平台保持绿色语义，中文映射不变', async () => {
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('用户收藏')).toBeInTheDocument());
    fireEvent.click(screen.getByText('用户收藏'));
    await waitFor(() => expect(mockApi.getAdminFavorites).toHaveBeenCalled());

    const typeChip = await screen.findByTestId('admin-copy-type-chip');
    expect(typeChip).toHaveTextContent('口播稿');
    expect(typeChip.className).toMatch(/sky|blue/);
    expect(typeChip.className).not.toMatch(/bg-gray-800|text-gray-300/);
    // 不回退英文枚举
    expect(typeChip.textContent).not.toMatch(/\bspoken\b/i);

    const platformChip = screen.getByTestId('admin-platform-chip');
    expect(platformChip).toHaveTextContent('IG');
    expect(platformChip.className).toMatch(/emerald|green/);
    // 类型与平台色系可区分
    expect(typeChip.className).not.toEqual(platformChip.className);
  });

  it('备注低饱和强调 + 标签中文 chip；表头可换行；详情安全路径不变', async () => {
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('用户收藏')).toBeInTheDocument());
    fireEvent.click(screen.getByText('用户收藏'));
    await waitFor(() => expect(mockApi.getAdminFavorites).toHaveBeenCalled());

    const notesCell = await screen.findByTestId('admin-favorite-notes-tags');
    expect(within(notesCell).getByTestId('admin-favorite-notes')).toHaveTextContent('语气不错');
    expect(within(notesCell).getByTestId('admin-favorite-notes').className).toMatch(
      /amber|emerald|orange/,
    );

    const chips = within(notesCell).getAllByTestId('admin-reason-tag-chip');
    expect(chips.length).toBe(3);
    expect(chips.map((c) => c.textContent)).toEqual([
      formatAdminReasonTag('hook'),
      formatAdminReasonTag('tone'),
      formatAdminReasonTag('unknown_custom_tag'),
    ]);
    expect(notesCell.textContent).not.toMatch(/\bhook\b/);
    expect(notesCell.textContent).not.toContain('unknown_custom_tag');

    const th = screen.getByTestId('admin-th-notes-tags');
    expect(th.className).toMatch(/whitespace-normal|break-words|leading/);

    // 详情仍走 getAdminFavoriteDetail（审计先行 fail-closed 服务端）
    fireEvent.click(screen.getByRole('button', { name: '查看收藏详情' }));
    await waitFor(() => expect(mockApi.getAdminFavoriteDetail).toHaveBeenCalledWith('fav-1'));
  });

  it('formatAdminReasonTags 保持字符串 API，chip 用 formatAdminReasonTag', () => {
    expect(formatAdminReasonTags(['hook', 'zzz'])).toBe('开场吸睛 · 自定义标签');
    expect(formatAdminReasonTag('cta')).toBe('行动引导有力');
  });
});

// ── D. InputPanel accordion ───────────────────────────────────

describe('工作台左侧四大折叠页', () => {
  function InputWrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider>
        <PlanAccessContext.Provider
          value={{ planId: 'pro', isLoading: false, error: null, refresh: async () => {} }}
        >
          <AppProvider ownerId="accordion-user">{children}</AppProvider>
        </PlanAccessContext.Provider>
      </ThemeProvider>
    );
  }

  it('工作台页脚显示统一 API 品牌和当前产品版本', () => {
    render(<Footer />, { wrapper: InputWrapper });

    expect(screen.getByText('Powered by CANTONESE API')).toBeInTheDocument();
    expect(screen.getByText('v2.1')).toBeInTheDocument();
    expect(screen.queryByText(/DeepSeek API/)).not.toBeInTheDocument();
  });

  it('四个折叠页默认全部收起，使用主题强调色；Source/Language 始终可见', async () => {
    render(<InputPanel />, { wrapper: InputWrapper });

    expect(screen.getByTestId('input-section-source')).toBeInTheDocument();
    // LanguageToggle may not have testid — assert brand of source area + accordion headers
    const brand = screen.getByRole('button', { name: /品牌与内容场景/ });
    const params = screen.getByRole('button', { name: /文案参数/ });
    const audience = screen.getByRole('button', { name: /目标受众与参考/ });
    const config = screen.getByRole('button', { name: /配置管理/ });

    expect(brand).toHaveAttribute('aria-expanded', 'false');
    expect(params).toHaveAttribute('aria-expanded', 'false');
    expect(audience).toHaveAttribute('aria-expanded', 'false');
    expect(config).toHaveAttribute('aria-expanded', 'false');

    for (const trigger of [brand, params, audience, config]) {
      const chevron = trigger.lastElementChild;
      expect(chevron).toHaveClass('text-emerald-400', 'light:text-orange-500');
    }

    // 折叠内容保持挂载（hidden 而非卸载）
    expect(screen.getByTestId('input-accordion-panel-brand')).toBeInTheDocument();
    expect(screen.getByTestId('input-accordion-panel-params')).toBeInTheDocument();
    expect(screen.getByTestId('input-accordion-panel-audience')).toBeInTheDocument();
    expect(screen.getByTestId('input-accordion-panel-config')).toBeInTheDocument();
    expect(screen.getByTestId('input-accordion-panel-audience').className).toMatch(/hidden/);
    expect(screen.getByTestId('input-accordion-panel-config').className).toMatch(/hidden/);
    expect(screen.getByTestId('input-accordion-panel-brand').className).toMatch(/hidden/);
    expect(screen.getByTestId('input-accordion-panel-params').className).toMatch(/hidden/);

    // 生成按钮在折叠组之后
    expect(screen.getByRole('button', { name: /生成文案/ })).toBeInTheDocument();
  });

  it('点击折叠头可切换 aria-expanded，组件仍在 DOM', async () => {
    const user = userEvent.setup();
    render(<InputPanel />, { wrapper: InputWrapper });

    const audience = screen.getByRole('button', { name: /目标受众与参考/ });
    expect(audience).toHaveAttribute('aria-expanded', 'false');
    await user.click(audience);
    expect(audience).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('input-accordion-panel-audience').className).not.toMatch(/\bhidden\b/);

    await user.click(audience);
    expect(audience).toHaveAttribute('aria-expanded', 'false');
    // 仍挂载
    expect(document.body.innerHTML).toMatch(/PersonaManager|ReferenceCaseSelector|CaseLibrary|目标受众|参考/);
    expect(screen.getByTestId('input-accordion-panel-audience')).toBeInTheDocument();
  });

  it('InputPanel 源码包含四个分组与既有子组件，不删除业务字段', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../components/input/InputPanel.tsx'),
      'utf8',
    );
    for (const name of [
      'SourceEditor',
      'LanguageToggle',
      'CopyTypeSelector',
      'BrandInput',
      'BrandRedLinesInput',
      'TargetDatePicker',
      'CompetitorSearchInput',
      'StructuredBriefToggle',
      'CreativitySliderComponent',
      'PlatformSelector',
      'LengthControl',
      'ToneSelector',
      'CantoneseSlider',
      'EnglishMixingSlider',
      'PersonaManager',
      'ReferenceCaseSelector',
      'CaseLibraryPanel',
      'ConfigManager',
    ]) {
      expect(src).toContain(name);
    }
    expect(src).toContain('品牌与内容场景');
    expect(src).toContain('文案参数');
    expect(src).toContain('目标受众与参考');
    expect(src).toContain('配置管理');
  });
});
