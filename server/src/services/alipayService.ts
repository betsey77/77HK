/**
 * Slice F1: Alipay Business Logic Service
 *
 * Orchestrates checkout, notify verification, and reconciliation.
 * Uses the AlipayAdapter for payment gateway operations.
 *
 * NEVER trusts client-submitted amounts — always reads from DB plans table.
 * NEVER grants Pro entitlement from synchronous return page — only webhook/query.
 */

import crypto from 'crypto';
import { loadAlipayConfig, validateNotifyIds, type AlipayConfig } from './alipayConfig.js';
import { createAlipayAdapter, type AlipayAdapter, type PagePayResult } from './alipayAdapter.js';

// Runtime config — loaded once, but adapter is created lazily per call
let _config: AlipayConfig | null = null;
let _adapter: AlipayAdapter | null = null;

function getConfig(): AlipayConfig {
  if (!_config) {
    _config = loadAlipayConfig();
  }
  return _config;
}

function getAdapter(): AlipayAdapter {
  if (!_adapter) {
    _adapter = createAlipayAdapter(getConfig());
  }
  return _adapter;
}

async function markPaymentInitializationFailed(db: any, orderId: string): Promise<void> {
  try {
    const { error } = await db
      .from('payment_orders')
      .update({
        status: 'failed',
        error_code: 'PAYMENT_INIT_FAILED',
      })
      .eq('id', orderId)
      .eq('status', 'pending');

    if (error) {
      console.error('[billing/checkout] Failed to close payment order:', error.code || 'DB_ERROR');
    }
  } catch {
    console.error('[billing/checkout] Failed to close payment order: UNEXPECTED_ERROR');
  }
}

/** Resets cached config + adapter — for testing. */
export function resetAlipayService(): void {
  _config = null;
  _adapter = null;
}

// ---------------------------------------------------------------------------
// Amount utilities — strict decimal parsing
// ---------------------------------------------------------------------------

/**
 * Parse an Alipay amount string to integer fen (分).
 *
 * Accepts only the official two-decimal format: "19.00", "0.01", "100.50".
 * Rejects: "19", "19.0", "19.00abc", "1e2", "-5.00", "", "19.999".
 *
 * Returns null if the format is invalid (fail-closed).
 */
function amountToFen(raw: string): number | null {
  if (typeof raw !== 'string' || !raw) return null;
  // Must match exactly: digits, dot, exactly 2 digits
  if (!/^\d+\.\d{2}$/.test(raw)) return null;
  const parts = raw.split('.');
  const yuan = parseInt(parts[0], 10);
  const cents = parseInt(parts[1], 10);
  if (isNaN(yuan) || isNaN(cents)) return null;
  const fen = yuan * 100 + cents;
  // Must be positive and within reasonable range
  if (fen <= 0) return null;
  if (fen > 999_999_99) return null; // ~1 million CNY max
  return fen;
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export interface CheckoutParams {
  userId: string;
  planId: string;
  idempotencyKey: string;
  returnUrl: string;
  notifyUrl: string;
}

export interface CheckoutResult {
  orderId: string;
  outTradeNo: string;
  planName: string;
  amountFen: number;
  amountYuan: string;
  redirectUrl: string;   // Alipay page pay redirect URL (sandbox) or mock URL
  paymentMode: string;
  mockMode: boolean;
}

/**
 * Create a payment order and generate the Alipay page-pay redirect URL.
 *
 * 1. Validates the plan exists and has a price > 0.
 * 2. Checks user does not already have an active Pro subscription (409).
 * 3. Creates a payment_orders row in DB (sandbox) or mock.
 * 4. Calls Alipay pageExecute to generate the redirect URL.
 * 5. Returns the redirect URL + order metadata.
 *
 * In MOCK mode: creates a fake order and returns a mock redirect URL.
 * In SANDBOX mode: creates a real DB order and calls the Alipay sandbox gateway.
 */
export async function checkout(
  params: CheckoutParams,
  db: any, // Supabase client (service_role for trusted write in sandbox)
): Promise<CheckoutResult> {
  const config = getConfig();
  const adapter = getAdapter();

  const { userId, planId, idempotencyKey, returnUrl, notifyUrl } = params;

  // 1. Read plan from DB to get the authoritative price
  const { data: plans, error: planErr } = await db
    .from('plans')
    .select('id, name, price_fen')
    .eq('name', planId === 'pro' ? 'Pro' : planId)
    .limit(1);

  if (planErr || !plans || plans.length === 0) {
    throw Object.assign(new Error('Plan not found'), { statusCode: 400 });
  }

  const plan = plans[0];
  if (plan.price_fen <= 0) {
    throw Object.assign(new Error('Cannot purchase a free plan'), { statusCode: 400 });
  }

  const amountYuan = (plan.price_fen / 100).toFixed(2);
  const outTradeNo = `HK77_${userId.slice(0, 8)}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  // 2. In sandbox mode: check for active Pro subscription BEFORE creating order
  //    This prevents duplicate purchases (active Pro → 409).
  if (config.mode === 'alipay_sandbox') {
    const { data: activeSubs } = await db
      .from('subscriptions')
      .select('id, status, current_period_end')
      .eq('user_id', userId)
      .eq('plan_id', plan.id)
      .eq('status', 'active')
      .gt('current_period_end', new Date().toISOString())
      .limit(1);

    if (activeSubs && activeSubs.length > 0) {
      throw Object.assign(
        new Error('你已有生效中的 Pro 套餐，无需重复购买'),
        { statusCode: 409 },
      );
    }

    // Check for existing idempotencyKey
    const { data: existing, error: existingErr } = await db
      .from('payment_orders')
      .select('id, out_trade_no, status')
      .eq('user_id', userId)
      .eq('idempotency_key', idempotencyKey)
      .limit(1);

    if (existing && existing.length > 0) {
      const order = existing[0];
      if (order.status === 'paid') {
        throw Object.assign(new Error('Order already paid'), { statusCode: 409 });
      }
      // Reuse existing pending order — regenerate redirect with enriched URL
      let enrichedReturnUrl: string;
      try {
        const url = new URL(returnUrl);
        url.searchParams.set('orderId', order.id);
        url.searchParams.set('paymentMode', config.mode);
        enrichedReturnUrl = url.toString();
      } catch {
        const sep = returnUrl.includes('?') ? '&' : '?';
        enrichedReturnUrl = `${returnUrl}${sep}orderId=${encodeURIComponent(order.id)}&paymentMode=${encodeURIComponent(config.mode)}`;
      }
      let result: PagePayResult;
      try {
        result = await adapter.pagePay({
          outTradeNo: order.out_trade_no,
          totalAmount: amountYuan,
          subject: `77港话通 — ${plan.name} 套餐`,
          productCode: 'FAST_INSTANT_TRADE_PAY',
          returnUrl: enrichedReturnUrl,
          notifyUrl,
        });
      } catch (error) {
        await markPaymentInitializationFailed(db, order.id);
        throw error;
      }
      return {
        orderId: order.id,
        outTradeNo: order.out_trade_no,
        planName: plan.name,
        amountFen: plan.price_fen,
        amountYuan,
        redirectUrl: result.redirectUrl,
        paymentMode: config.mode,
        mockMode: false,
      };
    }

    // Create new order
    const { data: newOrder, error: insertErr } = await db
      .from('payment_orders')
      .insert({
        user_id: userId,
        plan_id: plan.id,
        out_trade_no: outTradeNo,
        amount_fen: plan.price_fen,
        currency: 'CNY',
        provider: 'alipay',
        environment: 'sandbox',
        status: 'pending',
        idempotency_key: idempotencyKey,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    if (insertErr) {
      // UNIQUE constraint violation — idempotencyKey conflict (race)
      if (insertErr.code === '23505') {
        throw Object.assign(new Error('Duplicate idempotency key'), { statusCode: 409 });
      }
      throw insertErr;
    }

    const orderId = newOrder.id;

    // 3. Append orderId + paymentMode to return URL (server-side, never trust Host)
    let enrichedReturnUrl: string;
    try {
      const url = new URL(returnUrl);
      url.searchParams.set('orderId', orderId);
      url.searchParams.set('paymentMode', config.mode);
      enrichedReturnUrl = url.toString();
    } catch {
      // Fallback for relative URLs (mock/dev): append as query params
      const sep = returnUrl.includes('?') ? '&' : '?';
      enrichedReturnUrl = `${returnUrl}${sep}orderId=${encodeURIComponent(orderId)}&paymentMode=${encodeURIComponent(config.mode)}`;
    }

    // 4. Call Alipay page pay → get redirect URL
    let result: PagePayResult;
    try {
      result = await adapter.pagePay({
        outTradeNo,
        totalAmount: amountYuan,
        subject: `77港话通 — ${plan.name} 套餐`,
        productCode: 'FAST_INSTANT_TRADE_PAY',
        returnUrl: enrichedReturnUrl,
        notifyUrl,
      });
    } catch (error) {
      await markPaymentInitializationFailed(db, orderId);
      throw error;
    }

    return {
      orderId,
      outTradeNo,
      planName: plan.name,
      amountFen: plan.price_fen,
      amountYuan,
      redirectUrl: result.redirectUrl,
      paymentMode: config.mode,
      mockMode: false,
    };
  }

  // MOCK mode: no DB, return fake order
  const mockOrderId = crypto.randomUUID();

  // Enrich return URL with orderId + paymentMode (same as sandbox)
  let enrichedReturnUrl: string;
  try {
    const url = new URL(returnUrl);
    url.searchParams.set('orderId', mockOrderId);
    url.searchParams.set('paymentMode', 'mock');
    enrichedReturnUrl = url.toString();
  } catch {
    const sep = returnUrl.includes('?') ? '&' : '?';
    enrichedReturnUrl = `${returnUrl}${sep}orderId=${encodeURIComponent(mockOrderId)}&paymentMode=mock`;
  }

  const result = await adapter.pagePay({
    outTradeNo,
    totalAmount: amountYuan,
    subject: `77港话通 — ${plan.name} 套餐 [MOCK]`,
    productCode: 'FAST_INSTANT_TRADE_PAY',
    returnUrl: enrichedReturnUrl,
    notifyUrl,
  });

  return {
    orderId: mockOrderId,
    outTradeNo,
    planName: plan.name,
    amountFen: plan.price_fen,
    amountYuan,
    redirectUrl: result.redirectUrl,
    paymentMode: 'mock',
    mockMode: true,
  };
}

// ---------------------------------------------------------------------------
// Notify (async webhook from Alipay)
// ---------------------------------------------------------------------------

export interface NotifyResult {
  success: boolean;
  reason?: string;
  orderId?: string;
  outTradeNo?: string;
}

/**
 * Process an Alipay asynchronous notification.
 *
 * Security order (MUST be followed — verification BEFORE any DB mutation):
 * 1. Parse params (done by express.urlencoded)
 * 2. SDK verify signature → invalid = return fail, ZERO DB writes
 * 3. Validate app_id, seller_id
 * 4. Validate trade_status (only TRADE_SUCCESS/TRADE_FINISHED)
 * 5. Strict decimal amount parsing
 * 6. Find order by out_trade_no, validate amount against order
 * 7. Create/read dedup webhook event (only after all checks pass)
 * 8. If already paid → idempotent, return success
 * 9. Call atomic SECURITY DEFINER RPC
 *
 * Returns NotifyResult. Caller must return "success" or "fail" as plain text.
 * Duplicate notifications for already-paid orders return success=true
 * so Alipay stops retrying.
 */
export async function processNotify(
  params: Record<string, string>,
  db: any,
  trustedDb: any,
): Promise<NotifyResult> {
  const config = getConfig();
  const adapter = getAdapter();

  // ═══ STEP 1: Verify signature — ZERO DB mutations before this ═══
  const verifyResult = await adapter.verifyNotify(params);

  if (!verifyResult.verified) {
    // IMPORTANT: No DB insert for invalid signatures.
    // Invalid signature means we cannot trust any of the params.
    return { success: false, reason: 'invalid_signature' };
  }

  // ═══ STEP 2: Validate app_id and seller_id ═══
  const { appId: notifyAppId, sellerId: notifySellerId } = verifyResult;
  if (!validateNotifyIds(config, notifyAppId, notifySellerId)) {
    return { success: false, reason: 'app_id_or_seller_mismatch' };
  }

  // ═══ STEP 3: Only TRADE_SUCCESS / TRADE_FINISHED trigger provisioning ═══
  const allowedStatuses = ['TRADE_SUCCESS', 'TRADE_FINISHED'];
  if (!allowedStatuses.includes(verifyResult.tradeStatus)) {
    return { success: false, reason: `trade_status_${verifyResult.tradeStatus}` };
  }

  // ═══ STEP 4: Strict decimal amount parsing ═══
  const notifyAmountFen = amountToFen(verifyResult.totalAmount);
  if (notifyAmountFen === null) {
    return { success: false, reason: 'invalid_amount_format' };
  }

  // ═══ STEP 5: Find the payment order and validate amount ═══
  const { data: orders, error: orderErr } = await db
    .from('payment_orders')
    .select('id, out_trade_no, amount_fen, status')
    .eq('out_trade_no', verifyResult.outTradeNo)
    .limit(1);

  if (orderErr || !orders || orders.length === 0) {
    return { success: false, reason: 'unknown_order', outTradeNo: verifyResult.outTradeNo };
  }

  const order = orders[0];

  // ═══ STEP 6: Strict amount validation against DB order ═══
  if (order.amount_fen !== notifyAmountFen) {
    return { success: false, reason: 'amount_mismatch', orderId: order.id };
  }

  // ═══ STEP 7: Create/read dedup webhook event (only after all checks pass) ═══
  const payloadForHash = [
    verifyResult.outTradeNo,
    verifyResult.tradeNo,
    verifyResult.totalAmount,
    verifyResult.tradeStatus,
    verifyResult.notifyId,
  ].join('|');
  const payloadHash = crypto.createHash('sha256').update(payloadForHash).digest('hex');

  const eventKey = verifyResult.notifyId || `fallback_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  let webhookEventId: string;

  try {
    const { data: webhookEvent, error: webhookErr } = await db
      .from('payment_webhook_events')
      .insert({
        provider: 'alipay',
        event_key: eventKey,
        notify_id: verifyResult.notifyId || null,
        out_trade_no: verifyResult.outTradeNo,
        payload_hash: payloadHash,
        process_status: 'received',
        received_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (webhookErr) {
      // Duplicate notify_id — check existing state (idempotent)
      if (webhookErr.code === '23505') {
        const { data: existingEvent } = await db
          .from('payment_webhook_events')
          .select('id, process_status')
          .eq('event_key', eventKey)
          .limit(1);

        const existing = existingEvent?.[0];
        if (existing) {
          // Already applied or duplicate for a paid order → return success
          if (existing.process_status === 'applied' || existing.process_status === 'duplicate') {
            if (order.status === 'paid') {
              return { success: true, reason: 'already_processed', orderId: order.id };
            }
          }
          // Still processing — Alipay will retry
          return { success: false, reason: 'duplicate_processing' };
        }
        return { success: false, reason: 'duplicate_notification' };
      }
      throw webhookErr;
    }

    webhookEventId = webhookEvent.id;
  } catch (err: any) {
    return { success: false, reason: 'webhook_event_insert_failed' };
  }

  // ═══ STEP 8: Already paid? Idempotent success ═══
  if (order.status === 'paid') {
    await db.from('payment_webhook_events')
      .update({
        process_status: 'duplicate',
        processed_at: new Date().toISOString(),
      })
      .eq('id', webhookEventId);
    return { success: true, reason: 'already_paid', orderId: order.id };
  }

  // ═══ STEP 9: Call atomic SECURITY DEFINER RPC ═══
  try {
    const { data: rpcResult, error: rpcErr } = await trustedDb.rpc('apply_alipay_payment', {
      _order_id: order.id,
      _provider_trade_no: verifyResult.tradeNo,
      _notify_amount_fen: notifyAmountFen,
      _webhook_event_id: webhookEventId,
    });

    if (rpcErr) {
      throw rpcErr;
    }

    const result = rpcResult as Record<string, any>;
    return {
      success: result?.success === true,
      reason: result?.success ? undefined : (result?.reason || 'rpc_failed'),
      orderId: order.id,
      outTradeNo: verifyResult.outTradeNo,
    };
  } catch (err: any) {
    await db.from('payment_webhook_events')
      .update({
        process_status: 'error',
        error_code: err?.message?.slice(0, 200) || 'rpc_exception',
        processed_at: new Date().toISOString(),
      })
      .eq('id', webhookEventId);
    return { success: false, reason: 'rpc_exception', orderId: order.id };
  }
}

// ---------------------------------------------------------------------------
// Reconcile (query Alipay for order status)
// ---------------------------------------------------------------------------

export interface ReconcileResult {
  orderId: string;
  outTradeNo: string;
  tradeNo: string | null;
  status: string;
  totalAmount: string;
  buyerLogonId?: string;
  paid: boolean;
  mockMode: boolean;
  reconcileError?: string;
}

// Simple in-memory rate limiter — per key, minimum interval in ms
const reconcileTimestamps = new Map<string, number>();

const RECONCILE_MIN_INTERVAL_MS = 10_000; // 10 seconds per user+order

function checkReconcileRateLimit(userId: string, orderId: string): boolean {
  const key = `reconcile:${userId}:${orderId}`;
  const last = reconcileTimestamps.get(key) || 0;
  const now = Date.now();
  if (now - last < RECONCILE_MIN_INTERVAL_MS) {
    return false;
  }
  reconcileTimestamps.set(key, now);
  // Clean up old entries periodically
  if (reconcileTimestamps.size > 1000) {
    const cutoff = now - RECONCILE_MIN_INTERVAL_MS * 2;
    for (const [k, v] of reconcileTimestamps) {
      if (v < cutoff) reconcileTimestamps.delete(k);
    }
  }
  return true;
}

/**
 * Reconcile a payment order by querying Alipay for its current status.
 *
 * If Alipay confirms payment (TRADE_SUCCESS/FINISHED) but our DB doesn't
 * reflect it, call the apply RPC to provision the subscription.
 *
 * Rate-limited: 1 per user+order per 10 seconds.
 * Synchronous return pages MUST NOT grant Pro — only this query/webhook path.
 */
export async function reconcileOrder(
  order: {
    id: string;
    out_trade_no: string;
    status: string;
    user_id: string;
  },
  db: any,
  trustedDb?: any,
): Promise<ReconcileResult & { rateLimited?: boolean }> {
  const config = getConfig();
  const adapter = getAdapter();

  // Rate limit check
  if (!checkReconcileRateLimit(order.user_id, order.id)) {
    throw Object.assign(new Error('请求过于频繁，请稍后再试'), { statusCode: 429 });
  }

  // Already marked paid in DB — return early
  if (order.status === 'paid') {
    return {
      orderId: order.id,
      outTradeNo: order.out_trade_no,
      tradeNo: null,
      status: 'paid',
      totalAmount: '0',
      paid: true,
      mockMode: config.mode === 'mock',
    };
  }

  // Query Alipay for current trade status
  const queryResult = await adapter.tradeQuery(order.out_trade_no);

  const paid = queryResult.tradeStatus === 'TRADE_SUCCESS' ||
    queryResult.tradeStatus === 'TRADE_FINISHED';

  // In sandbox mode, if Alipay says paid but our DB doesn't,
  // we MUST call the apply RPC to provision the subscription.
  // This handles the case where the async notify was missed.
  let serverAppliedStatus = order.status;
  if (paid && config.mode === 'alipay_sandbox' && trustedDb) {
    const notifyAmountFen = amountToFen(queryResult.totalAmount);
    if (notifyAmountFen !== null) {
      const { data: rpcResult, error: rpcErr } = await trustedDb.rpc('apply_alipay_payment', {
        _order_id: order.id,
        _provider_trade_no: queryResult.tradeNo || '',
        _notify_amount_fen: notifyAmountFen,
        _webhook_event_id: null, // no webhook event for reconcile
      });

      // Check RPC result — do NOT report paid if RPC failed
      if (rpcErr) {
        // RPC error: report the actual DB status (not paid)
        return {
          orderId: order.id,
          outTradeNo: order.out_trade_no,
          tradeNo: queryResult.tradeNo,
          status: order.status,
          totalAmount: queryResult.totalAmount,
          buyerLogonId: queryResult.buyerLogonId,
          paid: false,
          mockMode: false,
          reconcileError: 'rpc_call_failed',
        };
      }

      const rpcData = rpcResult as Record<string, any> | null;
      if (rpcData?.success === true) {
        serverAppliedStatus = 'paid';
      }
      // If RPC returned success=false, keep the original status
    }
  }

  return {
    orderId: order.id,
    outTradeNo: order.out_trade_no,
    tradeNo: queryResult.tradeNo,
    status: serverAppliedStatus,
    totalAmount: queryResult.totalAmount,
    buyerLogonId: queryResult.buyerLogonId,
    paid: serverAppliedStatus === 'paid',
    mockMode: config.mode === 'mock',
  };
}
