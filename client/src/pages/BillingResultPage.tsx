/**
 * Slice E/F1: BillingResultPage — handles /billing/success and /billing/cancel
 *
 * Mock mode: simulates post-payment redirect pages.
 * Sandbox mode: shows "等待服务端确认" and polls order status.
 *
 * IMPORTANT: Synchronous return URL parameters never grant Pro entitlement.
 * Only the async notify webhook or reconciliation confirms payment.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import type { PaymentOrder } from '../types';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../services/apiBase';

interface Props {
  /** 'success' | 'cancel' */
  outcome: 'success' | 'cancel';
}

/** Poll interval in ms for sandbox mode order status check */
const POLL_INTERVAL_MS = 3000;
/** Max poll attempts before giving up */
const MAX_POLL_ATTEMPTS = 20;
const VERIFIED_RETURN_DELAY_MS = 1800;

export function getVerifiedBillingRedirect(
  outcome: Props['outcome'],
  order: PaymentOrder | null,
): string | null {
  if (outcome !== 'success' || order?.status !== 'paid' || order.isMock !== false) {
    return null;
  }
  return `/app/billing?payment=success&orderId=${encodeURIComponent(order.id)}`;
}

export default function BillingResultPage({ outcome }: Props) {
  const { state: authState } = useAuth();
  const jwt = authState.session?.access_token ?? null;

  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const orderId = searchParams.get('orderId');
  const queryPaymentMode = searchParams.get('paymentMode') as 'mock' | 'alipay_sandbox' | null;
  // Detect sandbox from query params (server-generated, trusted) OR from order data
  const isSandbox = queryPaymentMode === 'alipay_sandbox'
    || order?.paymentMode === 'alipay_sandbox'
    || order?.isMock === false;

  // ── Fetch order ──
  const fetchOrder = useCallback(async () => {
    if (!orderId || !jwt) return;
    try {
      const res = await fetch(apiUrl(`/billing/orders/${orderId}`), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: PaymentOrder = await res.json();
      setOrder(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取订单信息失败');
      return null;
    }
  }, [orderId, jwt]);

  // ── Reconcile (query Alipay for real status) ──
  const reconcile = useCallback(async () => {
    if (!orderId || !jwt) return;
    setReconciling(true);
    try {
      const res = await fetch(apiUrl(`/billing/orders/${orderId}/reconcile`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.paid) {
          // Refresh order to get updated status
          await fetchOrder();
        }
      }
    } catch {
      // Reconcile failures are non-fatal — we'll keep polling
    } finally {
      setReconciling(false);
    }
  }, [orderId, jwt, fetchOrder]);

  // ── Initial fetch ──
  useEffect(() => {
    if (!orderId) {
      setError('缺少订单 ID');
      setLoading(false);
      return;
    }
    if (!jwt) {
      setLoading(false);
      return;
    }

    fetchOrder().finally(() => setLoading(false));
  }, [orderId, jwt, fetchOrder]);

  // ── Poll for sandbox orders ──
  useEffect(() => {
    // Only poll if sandbox mode, success outcome, order is pending, and not already polling
    if (!jwt || !orderId || outcome !== 'success' || !isSandbox) return;
    if (order?.status === 'paid') {
      // Stop polling — order is confirmed
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      if (attempts > MAX_POLL_ATTEMPTS) {
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }

      // Fetch latest order status
      try {
        const res = await fetch(apiUrl(`/billing/orders/${orderId}`), {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
        });
        if (res.ok) {
          const data: PaymentOrder = await res.json();
          setOrder(data);
          if (data.status === 'paid') {
            if (pollRef.current) clearInterval(pollRef.current);
            return;
          }
        }
      } catch {
        // Keep polling
      }

      // Every 3rd attempt, also try reconcile
      if (attempts % 3 === 0) {
        await reconcile();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId, jwt, outcome, isSandbox, order?.status, reconcile]);

  const isSuccess = outcome === 'success';
  const showAwaitingConfirm = isSandbox && isSuccess && order && order.status !== 'paid';
  const isPaid = order?.status === 'paid';
  const showMockSuccess = !isSandbox && isSuccess && !loading && !error && !isPaid;
  const verifiedBillingRedirect = getVerifiedBillingRedirect(outcome, order);

  useEffect(() => {
    if (!verifiedBillingRedirect) return;
    const timer = window.setTimeout(() => {
      window.location.replace(verifiedBillingRedirect);
    }, VERIFIED_RETURN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [verifiedBillingRedirect]);

  // ── Determine mode label ──
  const modeLabel = isSandbox ? '[支付宝沙箱]' : '[MOCK]';
  const modeColor = isSandbox
    ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-400';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 light:bg-white p-4">
      <div className="w-full max-w-md text-center">
        {/* ── Mode Banner ── */}
        <div className={`mb-6 rounded-lg border px-4 py-2 ${modeColor}`}>
          <p className="flex items-center justify-center gap-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5" />
            <strong>{modeLabel}</strong>
            {!isSandbox
              ? ' 模拟支付结果页面 — 未产生真实交易'
              : ' 支付宝沙箱支付 — 等待服务端确认'}
          </p>
        </div>

        {/* ── Icon ── */}
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-400 light:text-orange-500" />
            <p className="text-sm text-gray-500">加载订单信息…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <XCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : showAwaitingConfirm ? (
          <>
            {/* ── Awaiting confirmation (sandbox) ── */}
            <Loader2 className="mx-auto h-16 w-16 animate-spin text-blue-400" />
            <h2 className="mt-4 text-xl font-bold text-gray-100 light:text-gray-900">
              等待服务端确认
            </h2>
            <p className="mt-2 text-sm text-gray-400 light:text-gray-600">
              你已完成支付宝沙箱支付，正在等待异步通知确认。请稍候…
            </p>
            <p className="mt-1 text-xs text-gray-500">
              同步跳转不能直接授予权益，系统将在收到支付宝确认后自动开通 Pro 套餐。
            </p>
            {order && (
              <div className="mt-6 rounded-xl border border-gray-800 light:border-gray-200 bg-gray-900/40 light:bg-gray-50 p-4 text-left">
                <h3 className="text-xs font-semibold text-gray-500 mb-3">订单摘要</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">订单号</span>
                    <span className="text-gray-300 light:text-gray-700 font-mono text-xs">{order.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">套餐</span>
                    <span className="text-gray-100 light:text-gray-900">{order.planName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">金额</span>
                    <span className="text-gray-100 light:text-gray-900 font-semibold">¥{order.amountCny}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">状态</span>
                    <span className={reconciling ? 'text-blue-400' : 'text-amber-400'}>
                      {reconciling ? '确认中…' : '待确认'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              每 3 秒自动查询订单状态…
            </div>
          </>
        ) : (
          <>
            {isSuccess && isPaid ? (
              <CheckCircle className="mx-auto h-16 w-16 text-emerald-400 light:text-orange-500" />
            ) : isSuccess && showMockSuccess ? (
              <CheckCircle className="mx-auto h-16 w-16 text-emerald-400 light:text-orange-500" />
            ) : isSuccess && isSandbox ? (
              <AlertTriangle className="mx-auto h-16 w-16 text-amber-400" />
            ) : (
              <XCircle className="mx-auto h-16 w-16 text-gray-500" />
            )}

            {/* ── Title ── */}
            <h2 className="mt-4 text-xl font-bold text-gray-100 light:text-gray-900">
              {isSuccess && isPaid
                ? '支付成功，Pro 已开通'
                : isSuccess && showMockSuccess
                  ? '订单创建成功'
                  : isSuccess && isSandbox
                    ? '等待服务端确认'
                    : isSuccess
                      ? '订单创建成功'
                      : '支付已取消'}
            </h2>
            <p className="mt-2 text-sm text-gray-400 light:text-gray-600">
              {isSuccess && isPaid
                ? '你的 Pro 套餐已生效，现在可以享受更多生成次数。'
                : isSuccess && showMockSuccess
                  ? '以下为模拟支付成功的结果。实际上尚未接入真实支付宝，权益未实际变更。'
                  : isSuccess && isSandbox
                    ? '订单已创建，正在等待支付宝异步通知确认。同步跳转不能授予 Pro 权益。'
                    : isSuccess
                      ? '以下为模拟支付成功的结果。实际上尚未接入真实支付宝，权益未实际变更。'
                      : '你已取消本次支付。如需升级，可返回结算页重试。'}
            </p>
            {verifiedBillingRedirect && (
              <p className="mt-2 text-xs text-emerald-400 light:text-orange-600">
                支付已由服务端确认，正在返回结算页…
              </p>
            )}

            {/* ── Order Summary ── */}
            {order && (
              <div className="mt-6 rounded-xl border border-gray-800 light:border-gray-200 bg-gray-900/40 light:bg-gray-50 p-4 text-left">
                <h3 className="text-xs font-semibold text-gray-500 mb-3">订单摘要</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">订单号</span>
                    <span className="text-gray-300 light:text-gray-700 font-mono text-xs">{order.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">套餐</span>
                    <span className="text-gray-100 light:text-gray-900">{order.planName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">金额</span>
                    <span className="text-gray-100 light:text-gray-900 font-semibold">¥{order.amountCny}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">状态</span>
                    <span className={order.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}>
                      {order.status === 'pending' ? '待支付' : order.status === 'paid' ? '已支付' : order.status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── No order but has orderId ── */}
            {!order && orderId && (
              <p className="mt-4 text-xs text-gray-500">
                订单 <span className="font-mono">{orderId}</span>
                {isSuccess
                  ? (isSandbox ? '（等待服务端确认）' : '（Mock 创建成功）')
                  : '（已取消）'}
              </p>
            )}

            {/* ── Missing orderId ── */}
            {!orderId && (
              <p className="mt-4 text-xs text-amber-400">未提供订单号，无法显示订单详情。</p>
            )}
          </>
        )}

        {/* ── Actions ── */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/app/billing"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-gray-700 light:border-gray-300 px-4 text-sm text-gray-300 light:text-gray-700 hover:bg-gray-800 light:hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回结算页
          </a>
          <a
            href="/app"
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-400 px-4 text-sm font-semibold text-gray-950 hover:bg-emerald-300 transition-colors light:bg-orange-500 light:text-white light:hover:bg-orange-600"
          >
            返回工作台
          </a>
        </div>

        <p className="mt-6 text-[10px] text-amber-500/60">
          {modeLabel} 本页面为{!isSandbox ? '模拟' : '沙箱'}支付结果。
          {!isSandbox ? ' 未产生真实交易或权益变更。' : ''}
        </p>
      </div>
    </div>
  );
}
