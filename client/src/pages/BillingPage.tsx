/**
 * Slice E: BillingPage (/app/billing)
 *
 * ⚠️ MOCK — displays current plan, usage, and upgrade flow.
 * All data is MOCK — no real Alipay, no remote order writes.
 *
 * Protected route: requires authentication.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Zap, Clock, BarChart3, Receipt, ArrowRight,
  AlertTriangle, Check, X, Loader2, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type {
  PlanEntitlements, PaymentOrder, CheckoutResponse, PlanInfo,
} from '../types';
import { FREE_PLAN, PRO_PLAN, PLANS } from '../types';

// ── Helpers ──

function getAuthHeaders(jwt: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`,
  };
}

function quotaPercent(used: number, total: number): number {
  if (total <= 0) return 100;
  return Math.min(100, Math.round((used / total) * 100));
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('zh-HK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ── Plan info lookup ──
function getPlan(id: string): PlanInfo | undefined {
  return PLANS.find(p => p.id === id);
}

export default function BillingPage() {
  const { state: authState } = useAuth();
  const jwt = authState.session?.access_token ?? null;

  // Entitlements
  const [entitlements, setEntitlements] = useState<PlanEntitlements | null>(null);
  const [entLoading, setEntLoading] = useState(true);
  const [entError, setEntError] = useState<string | null>(null);

  // Orders
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Checkout
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResponse | null>(null);

  // ── Fetch entitlements ──
  const fetchEntitlements = useCallback(async () => {
    if (!jwt) return;
    setEntLoading(true);
    setEntError(null);
    try {
      const res = await fetch('/api/me/entitlements', { headers: getAuthHeaders(jwt) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: PlanEntitlements = await res.json();
      setEntitlements(data);
    } catch (err) {
      setEntError(err instanceof Error ? err.message : '获取套餐信息失败');
    } finally {
      setEntLoading(false);
    }
  }, [jwt]);

  // ── Fetch orders ──
  const fetchOrders = useCallback(async () => {
    if (!jwt) return;
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const res = await fetch('/api/billing/orders', { headers: getAuthHeaders(jwt) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : '获取订单记录失败');
    } finally {
      setOrdersLoading(false);
    }
  }, [jwt]);

  useEffect(() => {
    fetchEntitlements();
    fetchOrders();
  }, [fetchEntitlements, fetchOrders]);

  // ── Handle checkout ──
  async function handleCheckout(planId: string) {
    if (!jwt) return;
    setCheckingOut(true);
    setCheckoutError(null);
    setCheckoutResult(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: getAuthHeaders(jwt),
        body: JSON.stringify({ planId }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const result = body as CheckoutResponse;
      setCheckoutResult(result);
      // Navigate to the mock redirect URL after a brief delay
      setTimeout(() => {
        window.location.href = result.redirectUrl;
      }, 1500);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : '创建订单失败');
    } finally {
      setCheckingOut(false);
    }
  }

  // ── Refresh handlers ──
  function handleRefresh() {
    fetchEntitlements();
    fetchOrders();
  }

  // ── Not authenticated ──
  if (!authState.isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 light:bg-white">
        <p className="text-sm text-gray-400">请先登录</p>
      </div>
    );
  }

  // ── Loading ──
  if (entLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 light:bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400 light:text-orange-500" />
          <p className="text-sm text-gray-500">加载套餐信息…</p>
        </div>
      </div>
    );
  }

  const currentPlan = (entitlements ? getPlan(entitlements.planId) : FREE_PLAN) ?? FREE_PLAN;
  const isPro = entitlements?.planId === 'pro';
  const used = entitlements?.quotaUsed ?? 0;
  const total = entitlements?.quotaTotal ?? 20;
  const pct = quotaPercent(used, total);

  return (
    <div className="min-h-screen bg-gray-950 light:bg-white text-gray-100 light:text-gray-900">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 light:border-gray-200">
        <a href="/app" className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-[9px] bg-black">
            <img
              src="/brand/77-logo.png"
              alt=""
              className="h-full w-full scale-[1.035] object-cover"
            />
          </span>
          <div>
            <h1 className="text-sm font-bold tracking-tight">77港话通社媒文案器</h1>
            <p className="text-[10px] text-gray-600 light:text-gray-500">HK Cantonese Social Copywriter</p>
          </div>
        </a>
        <span className="text-xs text-gray-500">{authState.user?.email ?? ''}</span>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* ── MOCK Banner ── */}
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center">
          <p className="flex items-center justify-center gap-2 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>
              <strong>[MOCK]</strong> 此为演示结算页。所有套餐数据和订单均为本地 Mock，未接入真实支付宝支付。
            </span>
          </p>
        </div>

        <h2 className="text-xl font-bold mb-6">套餐与结算</h2>

        {/* ── Current Plan Card ── */}
        <section className="rounded-xl border border-gray-800 light:border-gray-200 bg-gray-900/40 light:bg-gray-50 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {currentPlan.nameZh}
                {isPro && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 light:bg-orange-100 light:text-orange-600">
                    PRO
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500 light:text-gray-400 mt-0.5">
                {entitlements?.planId === 'free' ? '每滚动 7 天' : '每自然月'} · ¥{currentPlan.priceCny}{currentPlan.priceCny > 0 ? '/月' : ''}
              </p>
            </div>
            <Zap className={`h-5 w-5 ${isPro ? 'text-emerald-400 light:text-orange-500' : 'text-gray-600'}`} />
          </div>

          {/* Usage bar */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1.5 text-gray-400 light:text-gray-600">
                <BarChart3 className="h-3.5 w-3.5" />
                已用 {used} / {total} 次
              </span>
              <span className="text-gray-500">{pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-800 light:bg-gray-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  pct > 90
                    ? 'bg-red-500'
                    : pct > 70
                      ? 'bg-amber-500'
                      : 'bg-emerald-400 light:bg-orange-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Cycle info */}
          {entitlements && (
            <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500 light:text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              <span>
                周期：{formatDate(entitlements.cycleStart)} — {formatDate(entitlements.cycleEnd)}
              </span>
            </div>
          )}
        </section>

        {/* ── Upgrade CTA (if Free) ── */}
        {!isPro && (
          <section className="rounded-xl border-2 border-emerald-500/30 light:border-orange-500/30 bg-emerald-500/5 light:bg-orange-50 p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  升级到 {PRO_PLAN.nameZh}
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400 light:bg-orange-100 light:text-orange-600">
                    ¥{PRO_PLAN.priceCny}/月
                  </span>
                </h3>
                <p className="text-xs text-gray-400 light:text-gray-600 mt-1">
                  每自然月 400 次生成 · 优先模型队列 · 高级品牌档案
                </p>
              </div>
              <button
                onClick={() => handleCheckout('pro')}
                disabled={checkingOut}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 text-sm font-semibold text-gray-950 transition-colors hover:bg-emerald-300 disabled:opacity-50 light:bg-orange-500 light:text-white light:hover:bg-orange-600 shrink-0"
              >
                {checkingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    创建订单中…
                  </>
                ) : (
                  <>
                    升级到 Pro <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            {/* Checkout error */}
            {checkoutError && (
              <p className="mt-3 text-xs text-red-400 flex items-center gap-1.5">
                <X className="h-3.5 w-3.5" />
                {checkoutError}
              </p>
            )}

            {/* Checkout success (before redirect) */}
            {checkoutResult && (
              <div className="mt-3 rounded bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400 flex items-center gap-2">
                <Check className="h-3.5 w-3.5" />
                订单 {checkoutResult.orderId} 已创建，即将跳转到模拟支付页面…
              </div>
            )}
          </section>
        )}

        {/* ── Order History ── */}
        <section className="rounded-xl border border-gray-800 light:border-gray-200 bg-gray-900/40 light:bg-gray-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              订单记录
            </h3>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 light:hover:text-gray-700 transition-colors"
              title="刷新"
            >
              <RefreshCw className="h-3 w-3" />
              刷新
            </button>
          </div>

          {ordersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            </div>
          ) : ordersError ? (
            <div className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">{ordersError}</div>
          ) : orders.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500 light:text-gray-400">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>暂无订单记录</p>
              <p className="text-xs mt-1">升级套餐后，订单将显示在这里</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg border border-gray-800 light:border-gray-200 px-3 py-2.5"
                >
                  <div>
                    <p className="text-xs font-medium">
                      {order.planName} · ¥{order.amountCny}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {order.id} · {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
              ))}
            </div>
          )}

          {/* MOCK label */}
          <p className="mt-4 text-center text-[10px] text-amber-500/60">
            [MOCK] 所有订单记录存储在内存中，重启后清空
          </p>
        </section>
      </div>
    </div>
  );
}

/** Small badge for order status */
function OrderStatusBadge({ status }: { status: PaymentOrder['status'] }) {
  const config: Record<string, { label: string; cls: string }> = {
    pending: { label: '待支付', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    paid: { label: '已支付', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    cancelled: { label: '已取消', cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
    expired: { label: '已过期', cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
    failed: { label: '失败', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  };
  const c = config[status] || { label: status, cls: 'bg-gray-500/15 text-gray-400' };
  return (
    <span className={`rounded border px-2 py-0.5 text-[10px] font-medium ${c.cls}`}>
      {c.label}
    </span>
  );
}
