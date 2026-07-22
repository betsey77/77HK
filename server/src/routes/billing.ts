/**
 * Slice E: MOCK Billing Routes
 *
 * ⚠️ MOCK IMPLEMENTATION — ALL data is in-memory, per-process.
 * NO database writes, NO real Alipay, NO remote orders.
 * Real Alipay integration requires explicit user authorization.
 *
 * Endpoints:
 *   GET  /api/me/entitlements   — Current plan, usage, cycle
 *   POST /api/billing/checkout   — Create a MOCK order (redirect simulation)
 *   GET  /api/billing/orders     — List MOCK orders
 *   GET  /api/billing/orders/:id — Get MOCK order detail
 */

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import type {
  PlanId, PlanInfo, PlanEntitlements,
  CheckoutRequest, CheckoutResponse, PaymentOrder,
} from '../types/index.js';

const router = Router();

// ============================================================
// MOCK plan definitions (source of truth; mirrored in client)
// ============================================================

const FREE_PLAN: PlanInfo = {
  id: 'free',
  name: 'Free',
  nameZh: '免费版',
  priceCny: 0,
  quotaPerCycle: 20,
  cycleDescription: '每滚动 7 天',
  cycleDays: 7,
  features: [
    '每 7 天 20 次完整生成',
    '5 类港式平台文案',
    '质量审核与诊断',
    '消费者反馈模拟',
    '最多 10 条收藏',
    '最新 15 条生成历史',
  ],
};

const PRO_PLAN: PlanInfo = {
  id: 'pro',
  name: 'Pro',
  nameZh: '专业版',
  priceCny: 19,
  quotaPerCycle: 250,
  cycleDescription: '每自然月',
  cycleDays: null,
  features: [
    '每自然月 250 次生成',
    'Free 全部功能',
    '收藏与生成历史全部解锁',
    '优先模型队列',
    '更多消费者画像',
    '高级品牌档案',
  ],
};

const PLANS: Record<PlanId, PlanInfo> = { free: FREE_PLAN, pro: PRO_PLAN };

// ============================================================
// MOCK state (per-process, resets on restart — intentional)
// ============================================================

/** Per-user MOCK entitlements. Keyed by userId. */
const mockEntitlements = new Map<string, PlanEntitlements>();

/** Per-user MOCK order history. Keyed by userId. */
const mockOrders = new Map<string, PaymentOrder[]>();

/** Global MOCK order store for lookup by order ID. */
const mockOrdersById = new Map<string, PaymentOrder & { userId: string }>();

let orderCounter = 0;

// ============================================================
// Helpers
// ============================================================

function generateMockOrderId(): string {
  orderCounter += 1;
  return `mock_order_${Date.now()}_${orderCounter}`;
}

/** Compute Free plan cycle: rolling 7 days ending at now */
function computeFreeCycle(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString(),
    end: now.toISOString(),
  };
}

/** Compute Pro plan cycle: current calendar month */
function computeProCycle(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function getOrCreateEntitlements(userId: string, planId: PlanId): PlanEntitlements {
  const existing = mockEntitlements.get(userId);
  if (existing) return existing;

  const plan = PLANS[planId];
  const cycle = planId === 'free' ? computeFreeCycle() : computeProCycle();

  const entitlements: PlanEntitlements = {
    planId: plan.id,
    planName: plan.nameZh,
    quotaUsed: 0,
    quotaTotal: plan.quotaPerCycle,
    cycleStart: cycle.start,
    cycleEnd: cycle.end,
    isMock: true,
  };

  mockEntitlements.set(userId, entitlements);
  return entitlements;
}

// ============================================================
// Routes
// ============================================================

/**
 * GET /api/billing/plans
 *
 * Public — returns the plan catalogue.
 * MOCK mode: returns in-memory plan definitions.
 * Sandbox mode: reads from the database plans table (public-safe fields only).
 */
router.get('/billing/plans', async (req: Request, res: Response) => {
  try {
    const paymentMode = (process.env.PAYMENT_MODE || 'mock') as string;

    if (paymentMode === 'alipay_sandbox') {
      // Sandbox: read from DB plans table
      const { getTrustedSupabase } = await import('../services/trustedSupabase.js');
      const db = getTrustedSupabase();
      const { data: dbPlans, error } = await db
        .from('plans')
        .select('id, name, price_fen, quota_per_cycle, period_unit, period_count, features, is_public')
        .eq('is_public', true)
        .order('price_fen', { ascending: true });

      if (error) {
        console.error('[billing/plans] Database query failed:', error.code, error.message);
        res.status(500).json({ error: 'Internal server error' });
        return;
      }

      const plans = (dbPlans || []).map((p: Record<string, any>) => {
        const planId: PlanId = p.name?.toLowerCase() === 'pro' ? 'pro' : 'free';
        const cataloguePlan = PLANS[planId];
        return {
          id: planId,
          name: p.name || cataloguePlan.name,
          nameZh: cataloguePlan.nameZh,
          priceCny: Math.round((p.price_fen || 0) / 100),
          quotaPerCycle: p.quota_per_cycle ?? cataloguePlan.quotaPerCycle,
          cycleDescription: cataloguePlan.cycleDescription,
          cycleDays: cataloguePlan.cycleDays,
          features: Array.isArray(p.features) && p.features.length > 0
            ? p.features
            : cataloguePlan.features,
        };
      });

      res.json({
        plans,
        paymentMode,
        isMock: false,
      });
      return;
    }

    // Mock: return in-memory catalogue
    res.json({
      plans: Object.values(PLANS).map((p) => ({
        id: p.id,
        name: p.name,
        nameZh: p.nameZh,
        priceCny: p.priceCny,
        quotaPerCycle: p.quotaPerCycle,
        cycleDescription: p.cycleDescription,
        cycleDays: p.cycleDays,
        features: p.features,
      })),
      paymentMode,
      isMock: true,
    });
  } catch (err) {
    console.error(
      '[billing/plans] Unexpected failure:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/me/entitlements
 *
 * Returns the current user's plan, usage, and cycle info.
 * Uses the trusted subscriptions table whenever Supabase is configured.
 * Local mock data is only a development fallback when no trusted client exists.
 */
router.get('/me/entitlements', requireAuth, async (_req: Request, res: Response) => {
  try {
    const userId = _req.userId!;
    const paymentMode = (process.env.PAYMENT_MODE || 'mock') as string;

    const { getTrustedSupabase } = await import('../services/trustedSupabase.js');
    let db: ReturnType<typeof getTrustedSupabase> | undefined;
    try {
      db = getTrustedSupabase();
    } catch {
      if (paymentMode === 'alipay_sandbox') throw new Error('Trusted Supabase is required');
    }

    if (db) {

      // Read active subscription
      const { data: subs, error: subErr } = await db
        .from('subscriptions')
        .select('id, plan_id, status, quota_used, current_period_start, current_period_end, plans(name, quota_per_cycle)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('current_period_end', { ascending: false })
        .limit(1);

      if (subErr) {
        res.status(500).json({ error: 'Internal server error' });
        return;
      }

      if (subs && subs.length > 0) {
        const sub = subs[0] as Record<string, any>;
        const plansData = (sub.plans as Record<string, any> | null);
        const planName = plansData?.name || 'Free';
        const planId = planName === 'Pro' ? 'pro' : 'free';
        const quotaTotal = plansData?.quota_per_cycle || (planId === 'pro' ? 250 : 20);

        res.json({
          planId,
          planName: planName === 'Pro' ? '专业版' : '免费版',
          quotaUsed: sub.quota_used || 0,
          quotaTotal,
          cycleStart: sub.current_period_start,
          cycleEnd: sub.current_period_end,
          isMock: false,
        });
        return;
      }

      // No active subscription → trusted Free-tier view. The generation route
      // remains fail-closed because reserve_quota still requires a subscription.
      res.json({
        planId: 'free',
        planName: '免费版',
        quotaUsed: 0,
        quotaTotal: 20,
        cycleStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        cycleEnd: new Date().toISOString(),
        isMock: false,
      });
      return;
    }

    // Local development fallback only. Deployed Preview has trusted Supabase.
    const entitlements = getOrCreateEntitlements(userId, 'free');
    res.json(entitlements);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/billing/checkout
 *
 * Creates a MOCK order — simulates what would happen before
 * redirecting to Alipay. Returns a redirectUrl that points to
 * our own mock success/cancel pages.
 *
 * Validation:
 *   - planId must be 'free' or 'pro'
 *   - Pro→Pro or Free→Free is rejected (already on that plan)
 *   - Free→Pro is allowed; Pro→Free is rejected (no downgrade MVP)
 *
 * ⚠️ This is MOCK — no real payment is initiated.
 */
router.post('/billing/checkout', requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const body = req.body as Partial<CheckoutRequest> | null;

    // Runtime allowlist: do not use object-property lookup for untrusted input,
    // because inherited keys such as "constructor" are not valid plan IDs.
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || (body.planId !== 'free' && body.planId !== 'pro')) {
      res.status(400).json({
        error: '无效的套餐 ID',
        allowedPlans: ['free', 'pro'],
      });
      return;
    }

    // Get current entitlements
    const current = getOrCreateEntitlements(userId, 'free');

    // Already on this plan
    if (current.planId === body.planId) {
      res.status(400).json({
        error: `你当前已是「${PLANS[body.planId].nameZh}」套餐，无需重复${body.planId === 'free' ? '' : '升级'}`,
      });
      return;
    }

    // Pro→Free downgrade not allowed in MVP
    if (current.planId === 'pro' && body.planId === 'free') {
      res.status(400).json({
        error: 'MVP 暂不支持降级到免费版。如需降级请联系客服。',
      });
      return;
    }

    const targetPlan = PLANS[body.planId];

    // Create MOCK order
    const orderId = generateMockOrderId();
    const order: PaymentOrder & { userId: string } = {
      id: orderId,
      userId,
      planId: targetPlan.id,
      planName: targetPlan.nameZh,
      amountCny: targetPlan.priceCny,
      status: 'pending',
      createdAt: new Date().toISOString(),
      paidAt: null,
      isMock: true,
    };

    // Store in MOCK state
    mockOrdersById.set(orderId, order);
    const userOrders = mockOrders.get(userId) || [];
    userOrders.push(order);
    mockOrders.set(userId, userOrders);

    // Build redirect URL (MOCK — simulates Alipay cancel/auth page)
    const redirectUrl = `/billing/success?orderId=${orderId}`;

    const response: CheckoutResponse = {
      orderId,
      planId: targetPlan.id,
      planName: targetPlan.nameZh,
      amountCny: targetPlan.priceCny,
      redirectUrl,
      isMock: true,
    };

    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/billing/orders
 *
 * Returns the current user's order history.
 * MOCK mode: in-memory per-process data.
 * Sandbox mode: reads from DB payment_orders (owner-scoped via RLS + explicit filter).
 */
router.get('/billing/orders', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const paymentMode = (process.env.PAYMENT_MODE || 'mock') as string;

    if (paymentMode === 'alipay_sandbox') {
      const { getTrustedSupabase } = await import('../services/trustedSupabase.js');
      const db = getTrustedSupabase();

      const { data: dbOrders, error } = await db
        .from('payment_orders')
        .select('id, plan_id, out_trade_no, amount_fen, status, created_at, paid_at, environment')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        res.status(500).json({ error: 'Internal server error' });
        return;
      }

      const orders = (dbOrders || []).map((o: Record<string, any>) => ({
        id: o.id,
        planId: o.plan_id,
        planName: '专业版', // Only Pro is purchasable
        amountCny: Math.round((o.amount_fen || 0) / 100),
        amountFen: o.amount_fen,
        outTradeNo: o.out_trade_no,
        status: o.status,
        createdAt: o.created_at,
        paidAt: o.paid_at,
        paymentMode: 'alipay_sandbox' as const,
        isMock: false,
      }));

      res.json({ orders, total: orders.length });
      return;
    }

    // Mock mode
    const userOrders = mockOrders.get(userId) || [];
    const sorted = [...userOrders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    res.json({
      orders: sorted,
      total: sorted.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/billing/orders/:id
 *
 * Returns a single order by ID.
 * Only the order owner can view it (userId check).
 * MOCK mode: in-memory lookup.
 * Sandbox mode: DB lookup with explicit owner filter.
 */
router.get('/billing/orders/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const orderId = String(req.params.id);
    const paymentMode = (process.env.PAYMENT_MODE || 'mock') as string;

    if (paymentMode === 'alipay_sandbox') {
      const { getTrustedSupabase } = await import('../services/trustedSupabase.js');
      const db = getTrustedSupabase();

      const { data: dbOrders, error } = await db
        .from('payment_orders')
        .select('id, user_id, plan_id, out_trade_no, amount_fen, status, created_at, paid_at, environment')
        .eq('id', orderId)
        .limit(1);

      if (error || !dbOrders || dbOrders.length === 0) {
        res.status(404).json({ error: '订单不存在' });
        return;
      }

      const o = dbOrders[0];

      // Owner check
      if (o.user_id !== userId) {
        res.status(403).json({ error: '无权访问此订单' });
        return;
      }

      res.json({
        id: o.id,
        planId: o.plan_id,
        planName: '专业版',
        amountCny: Math.round((o.amount_fen || 0) / 100),
        amountFen: o.amount_fen,
        outTradeNo: o.out_trade_no,
        status: o.status,
        createdAt: o.created_at,
        paidAt: o.paid_at,
        paymentMode: 'alipay_sandbox' as const,
        isMock: false,
      });
      return;
    }

    // Mock mode
    const order = mockOrdersById.get(orderId);
    if (!order) {
      res.status(404).json({ error: '订单不存在' });
      return;
    }

    if (order.userId !== userId) {
      res.status(403).json({ error: '无权访问此订单' });
      return;
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────────
// Slice F1: Alipay sandbox routes
// ────────────────────────────────────────────────────────────────
// Note: urlencoded parser for /api/billing/alipay/notify is registered
// in app.ts (BEFORE the global JSON parser). Do NOT duplicate here.

/**
 * POST /api/billing/alipay/checkout
 *
 * Creates a payment order and returns an Alipay redirect URL (sandbox mode)
 * or a mock redirect (mock mode).
 *
 * Body: { planId: 'pro', idempotencyKey: string }
 * Response: { orderId, outTradeNo, planName, amountFen, amountYuan,
 *              redirectUrl, paymentMode, mockMode }
 *
 * Auth required. Amount is ALWAYS read from the DB plans table.
 *
 * Security:
 *   - returnUrl/notifyUrl come from server config (ALIPAY_* >
 *     APP_FRONTEND_URL/APP_API_URL > APP_PUBLIC_URL), NEVER from
 *     req.protocol/host (Host header injection risk).
 *   - Sandbox mode missing config → fail closed 503.
 *   - Returns a safe redirect URL, NOT raw HTML (avoids XSS/CSP issues).
 */
router.post('/billing/alipay/checkout', requireAuth, async (req: Request, res: Response) => {
  try {
    const { checkout: alipayCheckout } = await import('../services/alipayService.js');
    const userId = req.userId!;
    const body = req.body as Record<string, unknown> | null;

    if (!body || typeof body !== 'object' || body.planId !== 'pro') {
      res.status(400).json({ error: '无效的套餐 ID，仅支持 pro' });
      return;
    }

    const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.length >= 1
      ? body.idempotencyKey
      : null;

    if (!idempotencyKey) {
      res.status(400).json({ error: '缺少幂等键 (idempotencyKey)' });
      return;
    }

    // ── Construct return/notify URLs from server config ONLY ──
    // NEVER trust req.protocol or req.get('host') — Host header injection risk.
    // Priority: ALIPAY_* > APP_FRONTEND_URL / APP_API_URL > APP_PUBLIC_URL > local defaults.
    const { resolveAlipayUrls } = await import('../services/alipayUrls.js');
    const urls = resolveAlipayUrls(process.env);
    if (!urls.ok) {
      res.status(503).json({ error: urls.error });
      return;
    }
    const { returnUrl, notifyUrl } = urls;

    const { getTrustedSupabase } = await import('../services/trustedSupabase.js');
    const db = getTrustedSupabase();

    const result = await alipayCheckout({
      userId,
      planId: body.planId as string,
      idempotencyKey,
      returnUrl,
      notifyUrl,
    }, db);

    res.status(201).json({
      orderId: result.orderId,
      outTradeNo: result.outTradeNo,
      planName: result.planName,
      amountFen: result.amountFen,
      amountYuan: result.amountYuan,
      redirectUrl: result.redirectUrl,
      paymentMode: result.paymentMode,
      mockMode: result.mockMode,
    });
  } catch (err: any) {
    const status = err?.statusCode || 500;
    res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
  }
});

/**
 * POST /api/billing/alipay/notify
 *
 * Receives Alipay async payment notification (application/x-www-form-urlencoded).
 * This route is PUBLIC (no auth) — Alipay's server calls it directly.
 *
 * Body parsing: express.urlencoded({extended:false,limit:100kb}) is mounted
 * on the exact path /api/billing/alipay/notify in app.ts (before the global
 * JSON parser). The global JSON parser in app.ts skips when req.body is
 * already an object (including empty {}), preventing stream re-read hangs.
 *
 * Security:
 *   - Signature verification before any DB mutation
 *   - Amount validated via strict decimal parser (only "XX.XX" format)
 *   - Only TRADE_SUCCESS/TRADE_FINISHED trigger provisioning
 *   - Returns plain text "success" or "fail" (Alipay protocol)
 *   - Duplicate paid-order notifications return "success" to stop retries
 */
router.post('/billing/alipay/notify', async (req: Request, res: Response) => {
  try {
    const { processNotify } = await import('../services/alipayService.js');
    const params = req.body as Record<string, string>;

    if (!params || typeof params !== 'object' || Object.keys(params).length === 0) {
      res.type('text/plain').send('fail');
      return;
    }

    const { getTrustedSupabase } = await import('../services/trustedSupabase.js');
    const db = getTrustedSupabase();
    const trustedDb = getTrustedSupabase();

    const result = await processNotify(params, db, trustedDb);

    // Always return plain text — success or fail (Alipay protocol)
    res.type('text/plain').send(result.success ? 'success' : 'fail');
  } catch (err) {
    // Never expose internal errors — fail closed
    res.type('text/plain').send('fail');
  }
});

/**
 * POST /api/billing/orders/:id/reconcile
 *
 * Owner-only. Queries Alipay for the current trade status.
 * If Alipay confirms payment but DB doesn't reflect it, calls the apply RPC.
 *
 * Rate-limited at the route level: max 1 call per user+order per 10s (HTTP 429).
 * Synchronous return pages MUST NOT grant Pro — only this and webhook path.
 */
router.post('/billing/orders/:id/reconcile', requireAuth, async (req: Request, res: Response) => {
  try {
    const { reconcileOrder } = await import('../services/alipayService.js');
    const userId = req.userId!;
    const orderId = String(req.params.id);

    const { getTrustedSupabase } = await import('../services/trustedSupabase.js');
    const db = getTrustedSupabase();

    const { data: orders, error: fetchErr } = await db
      .from('payment_orders')
      .select('id, user_id, out_trade_no, status, amount_fen')
      .eq('id', orderId)
      .limit(1);

    if (fetchErr || !orders || orders.length === 0) {
      res.status(404).json({ error: '订单不存在' });
      return;
    }

    const order = orders[0];

    // Ownership check
    if (order.user_id !== userId) {
      res.status(403).json({ error: '无权访问此订单' });
      return;
    }

    const trustedDb = getTrustedSupabase();

    const result = await reconcileOrder({
      id: order.id,
      out_trade_no: order.out_trade_no,
      status: order.status,
      user_id: order.user_id,
    }, db, trustedDb);

    res.json(result);
  } catch (err: any) {
    const status = err?.statusCode || 500;
    res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
  }
});

export { router as billingRouter, mockEntitlements, mockOrders, mockOrdersById };
export { FREE_PLAN, PRO_PLAN };
