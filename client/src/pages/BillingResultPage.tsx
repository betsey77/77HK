/**
 * Slice E: BillingResultPage — handles /billing/success and /billing/cancel
 *
 * ⚠️ MOCK — simulates post-payment redirect pages.
 * No real order status change occurs. No real Alipay.
 */

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import type { PaymentOrder } from '../types';
import { useAuth } from '../context/AuthContext';

interface Props {
  /** 'success' | 'cancel' */
  outcome: 'success' | 'cancel';
}

export default function BillingResultPage({ outcome }: Props) {
  const { state: authState } = useAuth();
  const jwt = authState.session?.access_token ?? null;

  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orderId = new URLSearchParams(window.location.search).get('orderId');

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

    async function fetchOrder() {
      try {
        const res = await fetch(`/api/billing/orders/${orderId}`, {
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
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取订单信息失败');
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [orderId, jwt]);

  const isSuccess = outcome === 'success';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 light:bg-white p-4">
      <div className="w-full max-w-md text-center">
        {/* ── MOCK Banner ── */}
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2">
          <p className="flex items-center justify-center gap-2 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <strong>[MOCK]</strong> 模拟支付结果页面 — 未产生真实交易
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
        ) : (
          <>
            {isSuccess ? (
              <CheckCircle className="mx-auto h-16 w-16 text-emerald-400 light:text-orange-500" />
            ) : (
              <XCircle className="mx-auto h-16 w-16 text-gray-500" />
            )}

            {/* ── Title ── */}
            <h2 className="mt-4 text-xl font-bold text-gray-100 light:text-gray-900">
              {isSuccess ? '订单创建成功' : '支付已取消'}
            </h2>
            <p className="mt-2 text-sm text-gray-400 light:text-gray-600">
              {isSuccess
                ? '以下为模拟支付成功的结果。实际上尚未接入真实支付宝，权益未实际变更。'
                : '你已取消本次支付。如需升级，可返回结算页重试。'}
            </p>

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
                      {order.status === 'pending' ? '待支付' : order.status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── No order but has orderId ── */}
            {!order && orderId && (
              <p className="mt-4 text-xs text-gray-500">
                订单 <span className="font-mono">{orderId}</span> {isSuccess ? '（Mock 创建成功）' : '（已取消）'}
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
          [MOCK] 本页面为模拟支付结果，未产生真实交易或权益变更。
        </p>
      </div>
    </div>
  );
}
