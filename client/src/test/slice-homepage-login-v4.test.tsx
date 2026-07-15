import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MarketingPage from '../components/marketing/MarketingPage';
import LoginPage from '../pages/LoginPage';
import BrandLoader from '../components/shared/BrandLoader';

const login = vi.fn();
const clearError = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    state: {
      isLoading: false,
      isAuthenticated: false,
      user: null,
      session: null,
      error: null,
    },
    login,
    clearError,
  }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    toggleTheme: vi.fn(),
  }),
}));

describe('首页 v4 产品文案与真实入口', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    window.localStorage.clear();
  });

  it('只呈现已实现能力与当前套餐事实', () => {
    render(<MarketingPage />);

    expect(
      screen.getByRole('heading', { name: /把内地腔，写回.*香港人会点赞.*的节奏/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('每 7 天 20 次生成')).toBeInTheDocument();
    expect(screen.getByText('每自然月 250 次生成')).toBeInTheDocument();
    expect(screen.getByText('¥99')).toBeInTheDocument();
    expect(screen.getAllByText('/ 月', { selector: 'small' })).toHaveLength(2);

    expect(screen.queryByText(/产品预览版/)).not.toBeInTheDocument();
    expect(screen.queryByText(/设计稿/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mock/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SSE/)).not.toBeInTheDocument();
  });

  it('展示真实案例，并将登录、工作台、定价和 Pro 接到现有路由', () => {
    render(<MarketingPage />);

    expect(screen.getByRole('heading', { name: '品牌内容案例' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /查看思念香港/ })).toHaveLength(4);

    screen.getAllByRole('link', { name: '登录' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/login');
    });
    expect(screen.getAllByRole('link', { name: /进入工作台|免费开写/ })[0]).toHaveAttribute(
      'href',
      '/app',
    );
    expect(screen.getByRole('link', { name: /查看完整定价/ })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('link', { name: '充值 Pro' })).toHaveAttribute('href', '/app/billing');
  });

  it('与工作台共用主题存储键，并在跳转前立即保存选择', () => {
    window.localStorage.setItem('hk-cantonese-theme', 'dark');
    render(<MarketingPage />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    fireEvent.click(screen.getByRole('button', { name: '切换浅色/深色主题' }));
    expect(window.localStorage.getItem('hk-cantonese-theme')).toBe('light');
  });
});

describe('登录页 v4 视觉与认证入口', () => {
  it('使用新品牌背景，并保留真实登录、注册与找回密码入口', () => {
    render(<LoginPage />);

    expect(screen.getByLabelText('登录页品牌背景')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /77港话通[\s\S]*社媒文案器/ })).toBeInTheDocument();
    expect(screen.getByLabelText('邮箱 Email')).toBeInTheDocument();
    expect(screen.getByLabelText('密码 Password')).toBeInTheDocument();
    expect(document.querySelector('.type-text')?.textContent).toContain('\n');
    expect(screen.getByRole('link', { name: /忘记密码/ })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: /创建账户/ })).toHaveAttribute('href', '/signup');
    expect(screen.queryByText(/Accounts are provisioned/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Design by/i)).not.toBeInTheDocument();
  });

  it('加载动画以 77 为中心并保留可读状态文案', () => {
    render(<BrandLoader label="同步云端数据…" />);

    expect(screen.getByText('77')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('同步云端数据…');
    expect(screen.getByText('同步云端数据…')).toHaveClass(
      'brand-loader-label',
      'text-emerald-400',
      'light:text-orange-500',
    );
  });
});
