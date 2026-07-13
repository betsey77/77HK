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
    '历史记录与收藏',
  ],
};

const PRO_PLAN: PlanInfo = {
  id: 'pro',
  name: 'Pro',
  nameZh: '专业版',
  priceCny: 19,
  quotaPerCycle: 400,
  cycleDescription: '每自然月',
  cycleDays: null,
  features: [
    '每自然月 400 次生成',
    'Free 全部功能',
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
 * GET /api/me/entitlements
 *
 * Returns the current user's plan, usage, and cycle info.
 * All data is MOCK — does NOT read from the database.
 */
router.get('/me/entitlements', requireAuth, (_req: Request, res: Response) => {
  try {
    const userId = _req.userId!;
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
 * Returns the current user's MOCK order history.
 */
router.get('/billing/orders', requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const userOrders = mockOrders.get(userId) || [];

    // Sort by createdAt descending
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
 * Returns a single MOCK order by ID.
 * Only the order owner can view it (userId check).
 */
router.get('/billing/orders/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const orderId = String(req.params.id);

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

export { router as billingRouter, mockEntitlements, mockOrders, mockOrdersById };
export { FREE_PLAN, PRO_PLAN };
