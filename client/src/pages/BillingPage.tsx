/**
 * Slice E: BillingPage (/app/billing)
 *
 * Displays Supabase-backed plan usage for the signed-in account.
 * Online payment can be disabled; internal Preview then uses manual Pro activation.
 *
 * Protected route: requires authentication.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Zap, Clock, BarChart3, Receipt, ArrowRight,
  AlertTriangle, Check, X, Loader2, RefreshCw, MessageCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import HeaderMenu from '../components/layout/HeaderMenu';
import TeamContactDialog from '../components/marketing/TeamContactDialog';
import type {
  PlanEntitlements, PaymentOrder, CheckoutResponse, PlanInfo,
} from '../types';
import { FREE_PLAN, PRO_PLAN, PLANS } from '../types';
import { apiUrl } from '../services/apiBase';

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
  const { state: authState, logout } = useAuth();
  const jwt = authState.session?.access_token ?? null;
  const [successDialogDismissed, setSuccessDialogDismissed] = useState(false);

  // Plans (public — no auth needed, but we fetch to get paymentMode)
  const [paymentMode, setPaymentMode] = useState<'mock' | 'alipay_sandbox'>('mock');
  const [proContactOpen, setProContactOpen] = useState(false);

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

  // ── Fetch public plans to get paymentMode ──
  const fetchPaymentMode = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/billing/plans'));
      if (res.ok) {
        const data = await res.json();
        setPaymentMode(data.paymentMode || 'mock');
      }
    } catch {
      // Default to mock
    }
  }, []);

  // ── Fetch entitlements ──
  const fetchEntitlements = useCallback(async () => {
    if (!jwt) return;
    setEntLoading(true);
    setEntError(null);
    try {
      const res = await fetch(apiUrl('/me/entitlements'), { headers: getAuthHeaders(jwt) });
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
      const res = await fetch(apiUrl('/billing/orders'), { headers: getAuthHeaders(jwt) });
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
    fetchPaymentMode();
    fetchEntitlements();
    fetchOrders();
  }, [fetchPaymentMode, fetchEntitlements, fetchOrders]);

  // ── Handle checkout ──
  async function handleCheckout(planId: string) {
    if (!jwt) return;
    if (paymentMode !== 'alipay_sandbox') {
      setProContactOpen(true);
      return;
    }
    setCheckingOut(true);
    setCheckoutError(null);
    setCheckoutResult(null);
    try {
      // Route based on paymentMode from plans response
      const endpoint = paymentMode === 'alipay_sandbox'
        ? apiUrl('/billing/alipay/checkout')
        : apiUrl('/billing/checkout');

      const body = paymentMode === 'alipay_sandbox'
        ? { planId, idempotencyKey: crypto.randomUUID() }
        : { planId };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(jwt),
        body: JSON.stringify(body),
      });
      const respBody = await res.json();
      if (!res.ok) {
        throw new Error(respBody.error || `HTTP ${res.status}`);
      }
      const result = respBody as CheckoutResponse;
      setCheckoutResult(result);
      // Navigate immediately after successful checkout (no artificial wait)
      window.location.href = result.redirectUrl;
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

  async function handleLogout() {
    await logout();
    window.location.href = '/login';
  }

  function dismissSuccessDialog() {
    setSuccessDialogDismissed(true);
    window.history.replaceState({}, '', '/app/billing');
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

  // Never present fallback quota as real account data when the API is unavailable.
  if (entError || !entitlements) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 light:bg-white">
        <div className="w-full max-w-sm rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-center">
          <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-red-400" />
          <h1 className="text-base font-semibold text-gray-100 light:text-gray-900">套餐信息加载失败</h1>
          <p className="mt-2 text-sm text-red-300 light:text-red-600">
            {entError || '暂时无法读取当前账号额度'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <a href="/app" className="text-sm text-gray-400 hover:text-gray-200 light:text-gray-600 light:hover:text-gray-900">
              返回工作台
            </a>
            <button
              type="button"
              onClick={fetchEntitlements}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-400"
            >
              <RefreshCw className="h-4 w-4" />
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentPlan = getPlan(entitlements.planId) ?? FREE_PLAN;
  const isPro = entitlements.planId === 'pro';
  const used = entitlements.quotaUsed;
  const total = entitlements.quotaTotal;
  const pct = quotaPercent(used, total);
  const returnParams = new URLSearchParams(window.location.search);
  const returnedOrderId = returnParams.get('payment') === 'success'
    ? returnParams.get('orderId')
    : null;
  const verifiedPaidOrder = returnedOrderId
    ? orders.find(order => order.id === returnedOrderId && order.status === 'paid')
    : undefined;
  const showSuccessDialog = !successDialogDismissed && !ordersLoading && !!verifiedPaidOrder;

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
        <HeaderMenu
          userEmail={authState.user?.email ?? null}
          onLogout={handleLogout}
        />
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* ── Mode Banner ── */}
        <div className={`mb-6 rounded-lg border px-4 py-2.5 text-center ${
          paymentMode === 'alipay_sandbox'
            ? 'border-blue-500/30 bg-blue-500/10'
            : 'border-amber-500/30 bg-amber-500/10'
        }`}>
          <p className={`flex items-center justify-center gap-2 text-xs ${
            paymentMode === 'alipay_sandbox' ? 'text-blue-400' : 'text-amber-400'
          }`}>
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>
              {paymentMode === 'alipay_sandbox' ? (
                <><strong>[支付宝沙箱]</strong> 沙箱测试环境。所有支付通过支付宝沙箱网关，未产生真实交易。</>
              ) : (
                <><strong>内部开通</strong> 用量来自实际账号记录；Pro 由管理员人工开通，当前不会自动扣款。</>
              )}
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
                  每自然月 250 次生成 · 优先模型队列 · 高级品牌档案
                </p>
              </div>
              <button
                onClick={() => handleCheckout('pro')}
                disabled={checkingOut}
                aria-label={paymentMode === 'alipay_sandbox' ? '升级到 Pro' : '联系管理员开通 Pro'}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 text-sm font-semibold text-gray-950 transition-colors hover:bg-emerald-300 disabled:opacity-50 light:bg-orange-500 light:text-white light:hover:bg-orange-600 shrink-0"
              >
                {checkingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    创建订单中…
                  </>
                ) : (
                  <>
                    {paymentMode === 'alipay_sandbox' ? (
                      <>升级到 Pro <ArrowRight className="h-4 w-4" /></>
                    ) : (
                      <>联系管理员开通 Pro <MessageCircle className="h-4 w-4" /></>
                    )}
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

            {/* Checkout success (before redirect) — copy follows paymentMode from /api/billing/plans */}
            {checkoutResult && (
              <div className="mt-3 rounded bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400 flex items-center gap-2">
                <Check className="h-3.5 w-3.5" />
                {paymentMode === 'alipay_sandbox'
                  ? `订单 ${checkoutResult.orderId} 已创建，即将跳转到支付宝沙箱支付页…`
                  : `订单 ${checkoutResult.orderId} 已创建，即将跳转到模拟支付页面…`}
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

          {/* Mode label */}
          <p className={`mt-4 text-center text-[10px] ${
            paymentMode === 'alipay_sandbox' ? 'text-blue-500/60' : 'text-amber-500/60'
          }`}>
            {paymentMode === 'alipay_sandbox'
              ? '[支付宝沙箱] 订单存储在数据库中'
              : '当前未启用在线支付，不会产生自动扣款订单'}
          </p>
        </section>
      </div>

      <TeamContactDialog
        open={proContactOpen}
        onClose={() => setProContactOpen(false)}
        context="pro"
      />

      {showSuccessDialog && verifiedPaidOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-success-title"
            className="w-full max-w-sm rounded-xl border border-emerald-500/30 bg-gray-950 p-6 shadow-2xl light:border-orange-300 light:bg-white"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 light:bg-orange-100 light:text-orange-600">
                  <Check className="h-5 w-5" />
                </span>
                <div>
                  <h2 id="billing-success-title" className="text-base font-bold">支付成功</h2>
                  <p className="mt-0.5 text-xs text-gray-500">Pro 套餐已开通</p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissSuccessDialog}
                aria-label="关闭支付成功提示"
                className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-200 light:hover:bg-gray-100 light:hover:text-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-gray-800 bg-gray-900/50 p-3 text-xs light:border-gray-200 light:bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">套餐</span>
                <span className="font-medium">{verifiedPaidOrder.planName}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-gray-500">实付金额</span>
                <span className="font-semibold">¥{verifiedPaidOrder.amountCny}</span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={dismissSuccessDialog}
                className="min-h-10 flex-1 rounded-md border border-gray-700 px-3 text-sm text-gray-300 transition-colors hover:bg-gray-800 light:border-gray-300 light:text-gray-700 light:hover:bg-gray-100"
              >
                留在结算页
              </button>
              <a
                href="/app"
                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-md bg-emerald-400 px-3 text-sm font-semibold text-gray-950 transition-colors hover:bg-emerald-300 light:bg-orange-500 light:text-white light:hover:bg-orange-600"
              >
                开始创作
              </a>
            </div>
          </div>
        </div>
      )}
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
