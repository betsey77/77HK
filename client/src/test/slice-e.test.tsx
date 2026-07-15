/**
 * Slice E: Pricing & Billing — client behavior tests (TDD)
 *
 * Coverage:
 * - PricingPage: MOCK banner, plan cards, features, CTA links
 * - BillingResultPage: success/cancel states, order summary, MOCK labels
 * - Types: FREE_PLAN/PRO_PLAN constants shape
 * - API: getEntitlements, createCheckout, listOrders, getOrder (fetch mock)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth, type AuthState } from '../context/AuthContext';
import { AppProvider } from '../context/AppContext';
import PricingPage from '../pages/PricingPage';
import BillingPage from '../pages/BillingPage';
import BillingResultPage, { getVerifiedBillingRedirect } from '../pages/BillingResultPage';
import { FREE_PLAN, PRO_PLAN, PLANS } from '../types';
import type { PlanEntitlements, CheckoutResponse, PaymentOrder } from '../types';

// ── Helpers for fetch mocking ────────────────────────────────────

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

// ── Mock Supabase auth — return a signed-in user by default ──────

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
        user: { id: 'user-001', email: 'test@example.com', email_confirmed_at: '2026-07-12T00:00:00.000Z' },
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

beforeEach(() => {
  vi.clearAllMocks();
  setSignedOut();
  localStorage.clear();
  sessionStorage.clear();
});

// ============================================================
// PricingPage tests
// ============================================================

describe('PricingPage', () => {
  it('renders the MOCK banner', () => {
    render(<PricingPage />);
    const mockElements = screen.getAllByText(/\[MOCK\]/);
    expect(mockElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/演示定价页/)).toBeInTheDocument();
  });

  it('renders Free and Pro plan names', () => {
    render(<PricingPage />);
    expect(screen.getByText('免费版')).toBeInTheDocument();
    expect(screen.getByText('专业版')).toBeInTheDocument();
  });

  it('renders plan prices', () => {
    render(<PricingPage />);
    expect(screen.getByText('¥0')).toBeInTheDocument();
    expect(screen.getByText('¥19')).toBeInTheDocument();
  });

  it('renders plan quotas', () => {
    render(<PricingPage />);
    expect(screen.getByText(/20 次生成/)).toBeInTheDocument();
    const proQuota = screen.getAllByText(/250 次生成/);
    expect(proQuota.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Free features', () => {
    render(<PricingPage />);
    for (const feature of FREE_PLAN.features.slice(0, 3)) {
      expect(screen.getByText(feature)).toBeInTheDocument();
    }
  });

  it('renders Pro features', () => {
    render(<PricingPage />);
    expect(screen.getByText(PRO_PLAN.features[0])).toBeInTheDocument();
  });

  it('has CTA link to signup with next param for Free', () => {
    render(<PricingPage />);
    const freeLink = screen.getByText('免费开始');
    expect(freeLink.closest('a')).toHaveAttribute('href', '/signup?next=%2Fapp');
  });

  it('has CTA link to login with billing next for Pro', () => {
    render(<PricingPage />);
    const proLink = screen.getByText('升级到 Pro');
    expect(proLink.closest('a')).toHaveAttribute('href', '/login?next=%2Fapp%2Fbilling');
  });

  it('renders FAQ section', () => {
    render(<PricingPage />);
    expect(screen.getByText('常见问题')).toBeInTheDocument();
  });

  it('renders MOCK label on each plan card', () => {
    render(<PricingPage />);
    const mockLabels = screen.getAllByText(/\[MOCK\] 演示用/);
    expect(mockLabels.length).toBeGreaterThanOrEqual(2);
  });

  it('renders footer with MOCK disclaimer', () => {
    render(<PricingPage />);
    expect(screen.getByText(/Mock 演示/)).toBeInTheDocument();
  });

  it('clips the uploaded logo inside a black rounded container', () => {
    render(<PricingPage />);
    const logo = screen.getByRole('link', { name: /77港话通社媒文案器/ }).querySelector('img');
    expect(logo).toHaveAttribute('src', '/brand/77-logo.png');
    expect(logo?.parentElement).toHaveClass('overflow-hidden', 'bg-black');
  });
});

describe('BillingPage', () => {
  it('renders protected MOCK billing state with the clipped shared logo', async () => {
    setSignedIn();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/api/me/entitlements')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            planId: 'free', planName: '免费版', quotaUsed: 0, quotaTotal: 20,
            cycleStart: '2026-07-05T00:00:00.000Z', cycleEnd: '2026-07-12T00:00:00.000Z', isMock: true,
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ orders: [], total: 0 }) });
    }));

    render(
      <AuthProvider>
        <AppProvider ownerId="user-001">
          <BillingPage />
        </AppProvider>
      </AuthProvider>,
    );

    expect(await screen.findByText('套餐与结算')).toBeInTheDocument();
    expect(screen.getByText(/此为演示结算页/)).toBeInTheDocument();
    const logo = screen.getByRole('link', { name: /77港话通社媒文案器/ }).querySelector('img');
    expect(logo?.parentElement).toHaveClass('overflow-hidden', 'bg-black');
  });

  it('collapses the signed-in account details into the shared header menu', async () => {
    setSignedIn();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/api/me/entitlements')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            planId: 'free', planName: '免费版', quotaUsed: 0, quotaTotal: 20,
            cycleStart: '2026-07-05T00:00:00.000Z', cycleEnd: '2026-07-12T00:00:00.000Z', isMock: true,
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ orders: [], total: 0 }) });
    }));

    render(
      <AuthProvider>
        <AppProvider ownerId="user-001">
          <BillingPage />
        </AppProvider>
      </AuthProvider>,
    );

    const trigger = await screen.findByRole('button', { name: '账户与更多选项' });
    expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
    await userEvent.click(trigger);
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('shows the success dialog only when the returned order is verified as paid', async () => {
    setSignedIn();
    const paidOrder: PaymentOrder = {
      id: 'paid-order-001', planId: 'pro', planName: '专业版', amountCny: 19,
      status: 'paid', createdAt: '2026-07-13T00:00:00.000Z', paidAt: '2026-07-13T00:01:00.000Z', isMock: false,
    };
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?payment=success&orderId=paid-order-001' },
      writable: true,
      configurable: true,
    });
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/api/me/entitlements')) {
        return Promise.resolve({
          ok: true, status: 200, json: async () => ({
            planId: 'pro', planName: '专业版', quotaUsed: 0, quotaTotal: 250,
            cycleStart: '2026-07-13T00:00:00.000Z', cycleEnd: '2026-08-13T00:00:00.000Z', isMock: false,
          }),
        });
      }
      if (url.includes('/api/billing/orders')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ orders: [paidOrder], total: 1 }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ paymentMode: 'alipay_sandbox', isMock: false }) });
    }));

    render(
      <AuthProvider>
        <AppProvider ownerId="user-001">
          <BillingPage />
        </AppProvider>
      </AuthProvider>,
    );

    expect(await screen.findByRole('dialog', { name: '支付成功' })).toBeInTheDocument();
    expect(screen.getByText(/Pro 套餐已开通/)).toBeInTheDocument();
  });
});

// ============================================================
// BillingResultPage tests
// ============================================================

describe('BillingResultPage — success', () => {
  beforeEach(() => {
    setSignedIn();
  });

  it('renders success state', async () => {
    // Mock the history.pushState to set URL search params
    const originalSearch = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?orderId=mock_order_123' },
      writable: true,
      configurable: true,
    });

    const fetchMock = mockFetch(200, {
      id: 'mock_order_123',
      planId: 'pro',
      planName: '专业版',
      amountCny: 19,
      status: 'pending',
      createdAt: new Date().toISOString(),
      paidAt: null,
      isMock: true,
    });
    globalThis.fetch = fetchMock;

    await act(async () => {
      render(
        <AuthProvider>
          <BillingResultPage outcome="success" />
        </AuthProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('订单创建成功')).toBeInTheDocument();
    });

    // Cleanup
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: originalSearch },
      writable: true,
      configurable: true,
    });
  });

  it('renders MOCK banner', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
      configurable: true,
    });

    globalThis.fetch = mockFetch(200, {});
    await act(async () => {
      render(
        <AuthProvider>
          <BillingResultPage outcome="success" />
        </AuthProvider>,
      );
    });

    const mockElements = screen.getAllByText(/\[MOCK\]/);
    expect(mockElements.length).toBeGreaterThanOrEqual(1);
  });

  it('builds an automatic billing return only for a server-verified paid order', () => {
    const paidOrder: PaymentOrder = {
      id: 'paid-order-001', planId: 'pro', planName: '专业版', amountCny: 19,
      status: 'paid', createdAt: '2026-07-13T00:00:00.000Z', paidAt: '2026-07-13T00:01:00.000Z', isMock: false,
    };
    expect(getVerifiedBillingRedirect('success', paidOrder))
      .toBe('/app/billing?payment=success&orderId=paid-order-001');
    expect(getVerifiedBillingRedirect('success', { ...paidOrder, status: 'pending' })).toBeNull();
    expect(getVerifiedBillingRedirect('cancel', paidOrder)).toBeNull();
  });
});

describe('BillingResultPage — cancel', () => {
  beforeEach(() => {
    setSignedIn();
  });

  it('renders cancel state', async () => {
    const originalSearch = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?orderId=mock_order_456' },
      writable: true,
      configurable: true,
    });

    const fetchMock = mockFetch(200, {
      id: 'mock_order_456',
      planId: 'pro',
      planName: '专业版',
      amountCny: 19,
      status: 'pending',
      createdAt: new Date().toISOString(),
      paidAt: null,
      isMock: true,
    });
    globalThis.fetch = fetchMock;

    await act(async () => {
      render(
        <AuthProvider>
          <BillingResultPage outcome="cancel" />
        </AuthProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('支付已取消')).toBeInTheDocument();
    });

    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: originalSearch },
      writable: true,
      configurable: true,
    });
  });

  it('shows missing orderId message when no orderId param', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
      configurable: true,
    });

    globalThis.fetch = mockFetch(200, {});
    await act(async () => {
      render(
        <AuthProvider>
          <BillingResultPage outcome="cancel" />
        </AuthProvider>,
      );
    });

    expect(screen.getByText(/缺少订单 ID/)).toBeInTheDocument();
  });
});

// ============================================================
// Types — constant shapes
// ============================================================

describe('Slice E type constants', () => {
  it('FREE_PLAN has expected shape', () => {
    expect(FREE_PLAN.id).toBe('free');
    expect(FREE_PLAN.priceCny).toBe(0);
    expect(FREE_PLAN.quotaPerCycle).toBe(20);
    expect(FREE_PLAN.cycleDays).toBe(7);
    expect(FREE_PLAN.isMock).toBe(true);
    expect(FREE_PLAN.features.length).toBeGreaterThan(0);
  });

  it('PRO_PLAN has expected shape', () => {
    expect(PRO_PLAN.id).toBe('pro');
    expect(PRO_PLAN.priceCny).toBe(19);
    expect(PRO_PLAN.quotaPerCycle).toBe(250);
    expect(PRO_PLAN.cycleDays).toBeNull();
    expect(PRO_PLAN.isMock).toBe(true);
    expect(PRO_PLAN.features.length).toBeGreaterThan(0);
  });

  it('PLANS contains both plans', () => {
    expect(PLANS).toHaveLength(2);
    expect(PLANS.find(p => p.id === 'free')).toBeDefined();
    expect(PLANS.find(p => p.id === 'pro')).toBeDefined();
  });

  it('PLANS.isMock is true for all plans', () => {
    for (const plan of PLANS) {
      expect(plan.isMock).toBe(true);
    }
  });
});

// ============================================================
// API client unit tests (mocked fetch)
// ============================================================

import { getEntitlements, createCheckout, listOrders, getOrder } from '../services/api';

describe('Billing API client', () => {
  beforeEach(() => {
    setSignedIn();
  });

  it('getEntitlements returns mock data', async () => {
    const mockEntitlements: PlanEntitlements = {
      planId: 'free',
      planName: '免费版',
      quotaUsed: 5,
      quotaTotal: 20,
      cycleStart: '2026-07-05T00:00:00.000Z',
      cycleEnd: '2026-07-12T00:00:00.000Z',
      isMock: true,
    };
    globalThis.fetch = mockFetch(200, mockEntitlements);

    const result = await getEntitlements();
    expect(result.planId).toBe('free');
    expect(result.quotaTotal).toBe(20);
    expect(result.isMock).toBe(true);
  });

  it('getEntitlements throws on error', async () => {
    globalThis.fetch = mockFetch(401, { error: 'Unauthorized' });
    await expect(getEntitlements()).rejects.toThrow();
  });

  it('createCheckout returns mock order', async () => {
    const mockResponse: CheckoutResponse = {
      orderId: 'mock_order_test',
      planId: 'pro',
      planName: '专业版',
      amountCny: 19,
      redirectUrl: '/billing/success?orderId=mock_order_test',
      isMock: true,
    };
    globalThis.fetch = mockFetch(201, mockResponse);

    const result = await createCheckout({ planId: 'pro' });
    expect(result.planId).toBe('pro');
    expect(result.amountCny).toBe(19);
    expect(result.isMock).toBe(true);
    expect(result.redirectUrl).toContain('/billing/success');
  });

  it('createCheckout throws on validation error', async () => {
    globalThis.fetch = mockFetch(400, { error: '无效的套餐 ID' });
    await expect(createCheckout({ planId: 'invalid' as 'pro' })).rejects.toThrow();
  });

  it('listOrders returns order list', async () => {
    globalThis.fetch = mockFetch(200, {
      orders: [
        {
          id: 'mock_order_1',
          planId: 'pro',
          planName: '专业版',
          amountCny: 19,
          status: 'pending',
          createdAt: '2026-07-12T10:00:00.000Z',
          paidAt: null,
          isMock: true,
        },
      ],
      total: 1,
    });

    const result = await listOrders();
    expect(result.orders).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.orders[0].isMock).toBe(true);
  });

  it('getOrder returns single order', async () => {
    const mockOrder: PaymentOrder = {
      id: 'mock_order_detail',
      planId: 'pro',
      planName: '专业版',
      amountCny: 19,
      status: 'pending',
      createdAt: '2026-07-12T10:00:00.000Z',
      paidAt: null,
      isMock: true,
    };
    globalThis.fetch = mockFetch(200, mockOrder);

    const result = await getOrder('mock_order_detail');
    expect(result.id).toBe('mock_order_detail');
    expect(result.isMock).toBe(true);
  });

  it('getOrder throws on 404', async () => {
    globalThis.fetch = mockFetch(404, { error: '订单不存在' });
    await expect(getOrder('nonexistent')).rejects.toThrow();
  });
});
