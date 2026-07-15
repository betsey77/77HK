/**
 * 2026-07-14: 路由与结算体验定向修复 — 最小回归
 *
 * 1) 官网 CTA 路由矩阵：公开定价 /pricing；工作台与 Pro 为受保护路径
 * 2) BillingPage：mock vs alipay_sandbox 订单创建成功提示不同
 * 3) BillingPage：Pro entitlement 不呈现升级 CTA，不触发 checkout
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../context/AuthContext';
import { AppProvider } from '../context/AppContext';
import MarketingPage from '../components/marketing/MarketingPage';
import PricingPage from '../pages/PricingPage';
import BillingPage from '../pages/BillingPage';

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signOut: vi.fn(),
    },
  },
}));

function setSignedIn() {
  mockGetSession.mockResolvedValue({
    data: {
      session: {
        access_token: 'test-jwt',
        user: {
          id: 'user-001',
          email: 'test@example.com',
          email_confirmed_at: '2026-07-12T00:00:00.000Z',
        },
      },
    },
  });
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
}

function setSignedOut() {
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
}

function mockBillingFetch(options: {
  planId: 'free' | 'pro';
  paymentMode: 'mock' | 'alipay_sandbox';
  checkoutHandler?: (url: string, init?: RequestInit) => Promise<Response> | Response;
}) {
  const entitlements =
    options.planId === 'pro'
      ? {
          planId: 'pro',
          planName: '专业版',
          quotaUsed: 10,
          quotaTotal: 400,
          cycleStart: '2026-07-01T00:00:00.000Z',
          cycleEnd: '2026-08-01T00:00:00.000Z',
          isMock: options.paymentMode === 'mock',
        }
      : {
          planId: 'free',
          planName: '免费版',
          quotaUsed: 0,
          quotaTotal: 20,
          cycleStart: '2026-07-05T00:00:00.000Z',
          cycleEnd: '2026-07-12T00:00:00.000Z',
          isMock: options.paymentMode === 'mock',
        };

  return vi.fn().mockImplementation((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/billing/plans')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          paymentMode: options.paymentMode,
          isMock: options.paymentMode === 'mock',
          plans: [],
        }),
      });
    }
    if (url.includes('/api/me/entitlements')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => entitlements,
      });
    }
    if (url.includes('/api/billing/orders') && (!init || !init.method || init.method === 'GET')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ orders: [], total: 0 }),
      });
    }
    if (options.checkoutHandler && (url.includes('/checkout') || url.includes('/alipay/checkout'))) {
      return options.checkoutHandler(url, init);
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
  });
}

function renderBilling() {
  return render(
    <AuthProvider>
      <AppProvider ownerId="user-001">
        <BillingPage />
      </AppProvider>
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setSignedOut();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

// ── A. 官网 / 定价公开路由矩阵 ──────────────────────────────────

describe('官网 CTA 路由矩阵', () => {
  it('公开定价链接保持 /pricing，工作台与 Pro 为既定受保护路径', () => {
    render(<MarketingPage />);

    // 进入工作台 / 免费开写 / 开始免费创作 → /app（登录保护由路由层处理）
    const appLinks = [
      ...screen.getAllByRole('link', { name: /进入工作台/ }),
      ...screen.getAllByRole('link', { name: /免费开写/ }),
      ...screen.getAllByRole('link', { name: '开始免费创作' }),
    ];
    expect(appLinks.length).toBeGreaterThanOrEqual(3);
    for (const link of appLinks) {
      expect(link).toHaveAttribute('href', '/app');
    }

    // 充值 Pro → /app/billing
    expect(screen.getByRole('link', { name: '充值 Pro' })).toHaveAttribute('href', '/app/billing');

    // 查看完整定价与额度 / 了解套餐详情 / 定价 → 公开 /pricing（不强制登录）
    expect(screen.getByRole('link', { name: /查看完整定价与额度/ })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('link', { name: '了解套餐详情' })).toHaveAttribute('href', '/pricing');
    const pricingNav = screen.getAllByRole('link').find((el) => el.textContent?.trim() === '定价');
    expect(pricingNav).toBeTruthy();
    expect(pricingNav).toHaveAttribute('href', '/pricing');
  });

  it('Pricing 页 Pro CTA：未登录时指向 /login?next=%2Fapp%2Fbilling', () => {
    render(<PricingPage />);
    const proLink = screen.getByText('升级到 Pro').closest('a');
    expect(proLink).toHaveAttribute('href', '/login?next=%2Fapp%2Fbilling');
  });
});

// ── B. BillingPage 支付模式成功提示 ─────────────────────────────

describe('BillingPage 订单创建成功提示', () => {
  it('paymentMode=mock 时显示模拟支付文案', async () => {
    setSignedIn();
    const fetchMock = mockBillingFetch({
      planId: 'free',
      paymentMode: 'mock',
      checkoutHandler: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            orderId: 'mock_order_1',
            redirectUrl: '/billing/result/success?orderId=mock_order_1',
            isMock: true,
          }),
        } as Response),
    });
    vi.stubGlobal('fetch', fetchMock);

    // Prevent actual navigation during redirect delay
    const hrefSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: '', assign: hrefSpy },
      writable: true,
      configurable: true,
    });

    renderBilling();
    expect(await screen.findByText('套餐与结算')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /升级到 Pro/ }));

    expect(await screen.findByText(/订单 mock_order_1 已创建，即将跳转到模拟支付页面/)).toBeInTheDocument();
    expect(screen.queryByText(/支付宝沙箱支付页/)).not.toBeInTheDocument();

    // mock checkout endpoint (not alipay sandbox)
    const checkoutCall = fetchMock.mock.calls.find(
      ([url]: [string]) => String(url).includes('/api/billing/checkout')
        && !String(url).includes('/alipay/'),
    );
    expect(checkoutCall).toBeTruthy();
  });

  it('paymentMode=alipay_sandbox 时显示支付宝沙箱文案', async () => {
    setSignedIn();
    const fetchMock = mockBillingFetch({
      planId: 'free',
      paymentMode: 'alipay_sandbox',
      checkoutHandler: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            orderId: 'sandbox_order_1',
            redirectUrl: 'https://openapi.alipaydev.com/gateway.do?mock=1',
            isMock: false,
          }),
        } as Response),
    });
    vi.stubGlobal('fetch', fetchMock);

    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: '' },
      writable: true,
      configurable: true,
    });

    renderBilling();
    expect(await screen.findByText('套餐与结算')).toBeInTheDocument();
    expect(screen.getAllByText(/支付宝沙箱/).length).toBeGreaterThanOrEqual(1);

    await userEvent.click(screen.getByRole('button', { name: /升级到 Pro/ }));

    expect(
      await screen.findByText(/订单 sandbox_order_1 已创建，即将跳转到支付宝沙箱支付页/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/模拟支付页面/)).not.toBeInTheDocument();

    const sandboxCall = fetchMock.mock.calls.find(([url]: [string]) =>
      String(url).includes('/api/billing/alipay/checkout'),
    );
    expect(sandboxCall).toBeTruthy();
  });
});

// ── C. Pro 用户不展示升级 CTA ───────────────────────────────────

describe('BillingPage Pro entitlement', () => {
  it('Pro 用户不呈现升级 CTA，不能触发 checkout', async () => {
    setSignedIn();
    const fetchMock = mockBillingFetch({
      planId: 'pro',
      paymentMode: 'mock',
    });
    vi.stubGlobal('fetch', fetchMock);

    renderBilling();
    expect(await screen.findByText('套餐与结算')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('PRO')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /升级到 Pro/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/升级到/)).not.toBeInTheDocument();

    // No checkout POST should have been issued
    const postCalls = fetchMock.mock.calls.filter(
      ([, init]: [string, RequestInit?]) => init?.method === 'POST',
    );
    expect(postCalls).toHaveLength(0);
  });
});
