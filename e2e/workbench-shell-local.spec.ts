import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { GenerateResponse } from '../client/src/types';

/**
 * Local mock workbench shell smoke.
 * Proves React /app shell composition under fixture auth + blocked remote network.
 * Includes fully local case-library CRUD mock (memory, per-test reset).
 * Does NOT prove real Supabase Auth, JWT, RLS, quotas, or payment.
 * Billing assertions prove only that the UI renders a trusted entitlement DTO.
 */

const shotDir =
  process.env.E2E_SCREENSHOT_DIR?.trim() ||
  'docs/evidence/2026-07-15/workbench-shell-local-smoke/screenshots';

const blockedHosts: string[] = [];

type ApiScenario =
  | 'shell'
  | 'reviewed-user'
  | 'admin-pending'
  | 'admin-metrics'
  | 'check-in-earn'
  | 'check-in-claim';

let apiScenario: ApiScenario = 'shell';
let userReviewVersion = 1;
let checkInStatus = initialCheckInStatus();
let generateVersion = 0;

function initialCheckInStatus() {
  return {
    checkedInToday: false,
    checkinDateHk: '2026-07-19',
    streakCount: 6,
    streakStartedOn: '2026-07-14',
    rewardEarned: false,
    rewardStatus: 'none',
    grantId: null as string | null,
    canClaim: false,
    grantAppliedAt: null as string | null,
    subscriptionExpiresAt: null as string | null,
  };
}

function reviewedFavoriteRecord() {
  const changed = userReviewVersion > 1;
  return {
    id: 'cloud-favorite-reviewed',
    ownerId: 'e2e-local-user',
    clientId: 'favorite-reviewed',
    variantKey: 'ig',
    content: '今晚冻柠茶，够醒神。',
    source: '用户自写',
    settings: {
      brandName: '港饮',
      productName: '冻柠茶',
      copyType: 'social',
      platform: 'all',
      publishPlatform: 'ig',
    },
    savedAt: '2026-07-16T01:00:00.000Z',
    createdAt: '2026-07-16T01:00:00.000Z',
    updatedAt: changed ? '2026-07-16T02:00:00.000Z' : '2026-07-16T01:30:00.000Z',
    contentRevision: changed ? 2 : 1,
    isUserAuthored: true,
    reviewRequested: true,
    reviewRequestedAt: '2026-07-16T01:05:00.000Z',
    adminReview: {
      status: changed ? 'changes_requested' : 'adopted',
      note: changed ? '请修改开场句' : '可以发布',
      annotations: [],
      updatedAt: changed ? '2026-07-16T02:00:00.000Z' : '2026-07-16T01:30:00.000Z',
    },
  };
}

const pendingAdminFavorite = {
  id: 'admin-favorite-pending',
  ownerDisplayName: '本地测试用户',
  userEmail: 'e2e@example.invalid',
  variantKey: 'ig',
  rating: null,
  notes: null,
  favoriteReason: null,
  reasonTags: [],
  savedAt: '2026-07-16T01:00:00.000Z',
  brandName: '港饮',
  productName: '冻柠茶',
  copyType: 'social',
  platform: 'all',
  publishPlatform: 'ig',
  reviewStatus: null,
  reviewNote: null,
  reviewUpdatedAt: null,
  isUserAuthored: true,
  reviewRequested: true,
  reviewRequestedAt: '2026-07-16T02:30:00.000Z',
  isPendingReview: true,
};

/** Minimal DTO matching client CaseLibraryEntry (camelCase). */
interface MockCaseLibraryEntry {
  id: string;
  caseType: 'good' | 'bad';
  title: string | null;
  body: string;
  reason: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** Per-test in-memory case-library store (reset in beforeEach). */
const caseLibraryStore: MockCaseLibraryEntry[] = [];

/** Counts real case-library route hits by method (reset in beforeEach). */
const caseLibraryMethodHits = {
  GET: 0,
  POST: 0,
  PATCH: 0,
  DELETE: 0,
};

function resetCaseLibraryMock() {
  caseLibraryStore.length = 0;
  caseLibraryMethodHits.GET = 0;
  caseLibraryMethodHits.POST = 0;
  caseLibraryMethodHits.PATCH = 0;
  caseLibraryMethodHits.DELETE = 0;
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

function normalizeApiPath(pathname: string): string {
  return (pathname.replace(/^\/api/, '') || '/').replace(/\/+$/, '') || '/';
}

function parseCaseLibraryBody(raw: unknown): {
  caseType: 'good' | 'bad';
  title: string | null;
  body: string;
  reason: string;
  tags: string[];
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const caseType = o.caseType === 'bad' ? 'bad' : o.caseType === 'good' ? 'good' : null;
  if (!caseType) return null;
  if (typeof o.body !== 'string' || typeof o.reason !== 'string') return null;
  const titleRaw = o.title;
  const title =
    titleRaw === null || titleRaw === undefined
      ? null
      : typeof titleRaw === 'string'
        ? titleRaw.trim() || null
        : null;
  const tags = Array.isArray(o.tags)
    ? o.tags.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean)
    : [];
  return {
    caseType,
    title,
    body: o.body,
    reason: o.reason,
    tags,
  };
}

function filterCaseLibraryItems(url: URL): MockCaseLibraryEntry[] {
  let items = [...caseLibraryStore];
  const caseType = url.searchParams.get('caseType');
  if (caseType === 'good' || caseType === 'bad') {
    items = items.filter((e) => e.caseType === caseType);
  }
  const query = (url.searchParams.get('query') ?? '').trim().toLowerCase();
  if (query) {
    items = items.filter((e) => {
      const hay = [e.title ?? '', e.body, e.reason, ...e.tags, e.caseType]
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }
  return items;
}

async function fulfillCaseLibrary(route: Route): Promise<boolean> {
  const req = route.request();
  const url = new URL(req.url());
  const p = normalizeApiPath(url.pathname);
  const method = req.method().toUpperCase();

  const isRoot = p === '/case-library';
  const idMatch = p.match(/^\/case-library\/([^/]+)$/);
  if (!isRoot && !idMatch) return false;

  if (method === 'GET' && isRoot) {
    caseLibraryMethodHits.GET += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: filterCaseLibraryItems(url) }),
    });
    return true;
  }

  if (method === 'POST' && isRoot) {
    caseLibraryMethodHits.POST += 1;
    let raw: unknown;
    try {
      raw = req.postDataJSON();
    } catch {
      raw = null;
    }
    const input = parseCaseLibraryBody(raw);
    if (!input) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'E2E local mock: invalid CaseLibraryInput' }),
      });
      return true;
    }
    const now = new Date().toISOString();
    const entry: MockCaseLibraryEntry = {
      id: randomUUID(),
      caseType: input.caseType,
      title: input.title,
      body: input.body,
      reason: input.reason,
      tags: input.tags,
      createdAt: now,
      updatedAt: now,
    };
    caseLibraryStore.unshift(entry);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(entry),
    });
    return true;
  }

  if (method === 'PATCH' && idMatch) {
    caseLibraryMethodHits.PATCH += 1;
    const id = decodeURIComponent(idMatch[1]);
    const idx = caseLibraryStore.findIndex((e) => e.id === id);
    if (idx < 0) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      });
      return true;
    }
    let raw: unknown;
    try {
      raw = req.postDataJSON();
    } catch {
      raw = null;
    }
    const input = parseCaseLibraryBody(raw);
    if (!input) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'E2E local mock: invalid CaseLibraryInput' }),
      });
      return true;
    }
    const prev = caseLibraryStore[idx];
    const updated: MockCaseLibraryEntry = {
      ...prev,
      caseType: input.caseType,
      title: input.title,
      body: input.body,
      reason: input.reason,
      tags: input.tags,
      updatedAt: new Date().toISOString(),
    };
    caseLibraryStore[idx] = updated;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(updated),
    });
    return true;
  }

  if (method === 'DELETE' && idMatch) {
    caseLibraryMethodHits.DELETE += 1;
    const id = decodeURIComponent(idMatch[1]);
    const idx = caseLibraryStore.findIndex((e) => e.id === id);
    if (idx < 0) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      });
      return true;
    }
    caseLibraryStore.splice(idx, 1);
    await route.fulfill({ status: 204, body: '' });
    return true;
  }

  await route.fulfill({
    status: 405,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'E2E local mock: case-library method not allowed' }),
  });
  return true;
}

async function fulfillApi(route: Route) {
  const url = new URL(route.request().url());
  const p = normalizeApiPath(url.pathname);
  const method = route.request().method();

  if (p === '/generate' && method === 'POST') {
    generateVersion += 1;
    const prefix = generateVersion === 1 ? '第一版' : '第二版';
    const responseBody: GenerateResponse = {
      diagnosis: { hasSimplifiedChars: false, mainlandPhrases: [], issues: [] },
      variants: {
        standardHK: `${prefix}標準繁體`,
        lightCantonese: `${prefix}輕粵語`,
        ig: `${prefix}IG`,
        facebook: `${prefix}Facebook`,
        shorts: `${prefix}Shorts`,
      },
      audit: {
        thermometer: {
          overall: 90,
          dimensions: {
            cantoneseFeel: 4,
            culturalFit: 4,
            platformFit: 4,
            brandSafety: 5,
            tradConsistency: 5,
            hookStrength: 4,
            visualStrategy: 4,
            engagementFit: 4,
          },
        },
        issues: [],
        replacements: [],
        risks: [],
        comments: [],
      },
      generationEngine: 'deepseek',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseBody),
    });
    return;
  }

  if (p === '/me/check-in' && method === 'GET') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(checkInStatus),
    });
    return;
  }

  if (p === '/me/check-in' && method === 'POST') {
    checkInStatus = apiScenario === 'check-in-earn'
      ? {
          ...checkInStatus,
          checkedInToday: true,
          streakCount: 7,
          rewardEarned: true,
          rewardStatus: 'applied',
          grantId: 'e2e-check-in-grant',
          grantAppliedAt: '2026-07-19T04:00:00.000Z',
          subscriptionExpiresAt: '2026-08-18T04:00:00.000Z',
        }
      : { ...checkInStatus, checkedInToday: true };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(checkInStatus),
    });
    return;
  }

  if (/^\/me\/membership-grants\/[^/]+\/claim$/.test(p) && method === 'POST') {
    checkInStatus = {
      ...checkInStatus,
      rewardStatus: 'applied',
      canClaim: false,
      grantAppliedAt: '2026-07-19T04:00:00.000Z',
      subscriptionExpiresAt: '2026-08-18T04:00:00.000Z',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        idempotent: false,
        grantId: checkInStatus.grantId,
        grantStatus: 'applied',
        grantAppliedAt: checkInStatus.grantAppliedAt,
        subscriptionExpiresAt: checkInStatus.subscriptionExpiresAt,
      }),
    });
    return;
  }

  if (p.endsWith('/sync/review-result-summary') || p === '/sync/review-result-summary') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        latestUpdatedAt: apiScenario === 'reviewed-user'
          ? reviewedFavoriteRecord().adminReview.updatedAt
          : null,
      }),
    });
    return;
  }

  if (p.endsWith('/sync/bootstrap') || p === '/sync/bootstrap') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        favorites: apiScenario === 'reviewed-user' ? [reviewedFavoriteRecord()] : [],
        savedConfigs: [],
        brandProfile: null,
      }),
    });
    return;
  }

  if (p === '/admin/stats') {
    const isAdmin = apiScenario === 'admin-pending' || apiScenario === 'admin-metrics';
    await route.fulfill({
      status: isAdmin ? 200 : 403,
      contentType: 'application/json',
      body: JSON.stringify(isAdmin
        ? {
            totalUsers: 1,
            activeSubscriptions: 0,
            totalGenerations: 0,
            totalFeedback: 0,
            adminUsers: 1,
            role: apiScenario === 'admin-metrics' ? 'super_admin' : 'admin',
            reviewGroup: null,
          }
        : { error: 'E2E local mock: admin not available' }),
    });
    return;
  }

  if (p === '/admin/favorites/pending-summary') {
    const isAdmin = apiScenario === 'admin-pending' || apiScenario === 'admin-metrics';
    await route.fulfill({
      status: isAdmin ? 200 : 403,
      contentType: 'application/json',
      body: JSON.stringify(isAdmin
        ? (apiScenario === 'admin-pending'
          ? { count: 2, latestRequestedAt: '2026-07-16T02:30:00.000Z' }
          : { count: 0, latestRequestedAt: null })
        : { error: 'E2E local mock: admin not available' }),
    });
    return;
  }

  if (p === '/admin/favorites' && method === 'GET') {
    await route.fulfill({
      status: apiScenario === 'admin-pending' ? 200 : 403,
      contentType: 'application/json',
      body: JSON.stringify(apiScenario === 'admin-pending'
        ? { favorites: [pendingAdminFavorite], total: 1 }
        : { error: 'E2E local mock: admin not available' }),
    });
    return;
  }

  if ((apiScenario === 'admin-pending' || apiScenario === 'admin-metrics') && p === '/admin/users' && method === 'GET') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ users: [], total: 0 }),
    });
    return;
  }

  if (apiScenario === 'admin-metrics' && p === '/admin/metrics/overview') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        scope: 'global', reviewGroup: null, from: '2026-06-20', to: '2026-07-19',
        activity: { dau: 12, wau: 38, mau: 91 },
        membershipGrants: { total: 7, pending: 2, applied: 5 },
        quota: { consumed: 146, remaining: 854 },
      }),
    });
    return;
  }

  if (apiScenario === 'admin-metrics' && p === '/admin/metrics/models') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        from: '2026-06-20', to: '2026-07-19',
        rows: [{
          provider: 'deepseek', model: 'deepseek-v4-flash', total: 128, success: 121, error: 7,
          errorRate: 0.0547, avgLatencyMs: 1820, p95LatencyMs: 4210,
          promptTokens: 48200, completionTokens: 17300, totalTokens: 65500,
          cacheHitTokens: 12800, cacheMissTokens: 35400, unavailableUsageCount: 3,
        }],
      }),
    });
    return;
  }

  if (apiScenario === 'admin-metrics' && p === '/admin/metrics/bad-cases') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        from: '2026-06-20', to: '2026-07-19', threshold: 50,
        items: [{
          id: '7f177000-0000-4000-8000-000000000001', score: 42, platform: 'ig', tone: '生鬼',
          generationEngine: 'deepseek', createdAt: '2026-07-18T03:00:00.000Z', completedAt: '2026-07-18T03:01:00.000Z',
        }],
      }),
    });
    return;
  }

  if (apiScenario === 'admin-metrics' && p === '/admin/metrics/bad-cases/7f177000-0000-4000-8000-000000000001') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        job: {
          id: '7f177000-0000-4000-8000-000000000001', status: 'completed', source: '夏日冻柠茶新品推广',
          platform: 'ig', tone: '生鬼', generation_engine: 'deepseek',
          variants: { ig: '热到溶？饮啖冻柠茶先啦。' },
          diagnosis: { issues: ['港味表达不足'] }, audit: { issues: [{ severity: 'medium', tag: '港味', description: '粤语词密度偏低' }] },
          scores: { generated: { total: 42, naturalness: 38 } },
          created_at: '2026-07-18T03:00:00.000Z', completed_at: '2026-07-18T03:01:00.000Z',
        },
        modelAttempts: {
          status: 'available',
          items: [{ createdAt: '2026-07-18T03:00:05.000Z', operation: 'generate', provider: 'deepseek', model: 'deepseek-v4-flash', status: 'success', errorClass: null, latencyMs: 1820, attempt: 1, promptTokens: 460, completionTokens: 120, totalTokens: 580, cacheHitTokens: 0, cacheMissTokens: 460, usageSource: 'provider' }],
        },
      }),
    });
    return;
  }

  if (apiScenario === 'admin-metrics' && p === '/admin/metrics/provider-balance') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        provider: 'deepseek', status: 'ok', isAvailable: true,
        balances: [{ currency: 'CNY', totalBalance: '88.60', grantedBalance: '8.60', toppedUpBalance: '80.00' }],
        fetchedAt: '2026-07-19T03:00:00.000Z',
      }),
    });
    return;
  }

  if (apiScenario === 'admin-metrics' && p === '/admin/bad-case-review-packs/diagnostics') {
    const emptyCategory = { count: 0, share: 0 };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        from: '2026-06-20', to: '2026-07-19',
        summary: {
          categoryDistribution: {
            total: 3,
            byCategory: {
              input_contract: emptyCategory, context_resolution: emptyCategory,
              prompt_instruction: emptyCategory, knowledge_retrieval: emptyCategory,
              model_transport: emptyCategory, model_output_schema: emptyCategory,
              content_quality: { count: 2, share: 0.6667 },
              compliance: { count: 1, share: 0.3333 },
              persistence: emptyCategory, ui_presentation: emptyCategory,
              evaluation_gap: emptyCategory,
            },
          },
          recurrence: {
            totalFindings: 3, sampleRecurrenceRate: 0.6667,
            categoryRecurrenceRate: 0.5, duplicateSampleCount: 1,
          },
          dispositionRates: {
            total: 3, reviewed: 2, reviewCoverage: 0.6667,
            confirmationRate: 0.5, falsePositiveRate: 0.5,
          },
          criterionCoverage: {
            total: 4, evaluated: 3, notEvaluated: 1,
            evaluatedRate: 0.75, notEvaluatedRate: 0.25,
            failRateAmongEvaluated: 0.3333,
          },
          resolutionLatency: {
            sampleSize: 2, p50Ms: 3_600_000, p95Ms: 86_400_000, invalidCount: 1,
          },
          tokenCost: {
            costStatus: 'partial', sumCny: 0.12, okCount: 1,
            unavailableCount: 1, sampleSize: 2,
          },
        },
      }),
    });
    return;
  }

  if (p === '/billing/plans') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ paymentMode: 'mock', isMock: true, plans: [] }),
    });
    return;
  }

  if (p === '/billing/orders' && method === 'GET') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ orders: [], total: 0 }),
    });
    return;
  }

  if (p.includes('/me/entitlements') || p.endsWith('/entitlements')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        planId: 'free',
        planName: '免费版',
        quotaUsed: 2,
        quotaTotal: 20,
        cycleStart: '2026-07-16T00:00:00.000Z',
        cycleEnd: '2026-07-23T00:00:00.000Z',
        isMock: false,
        monthlyLimit: 20,
        used: 2,
        remaining: 18,
      }),
    });
    return;
  }

  if (p === '/localize-selling-point' && method === 'POST') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cantoneseText: '夠輕身，拎出街都方便' }),
    });
    return;
  }

  // Inspiration panel may POST for language-vibe during shell mount; keep empty local DTO.
  if (p.includes('/inspiration/') || p.includes('language-vibe')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], source: 'e2e-local-mock' }),
    });
    return;
  }

  // Stateful personal case library (not admin): GET/POST/PATCH/DELETE
  if (p === '/case-library' || p.startsWith('/case-library/')) {
    await fulfillCaseLibrary(route);
    return;
  }

  if (p.includes('pending-summary') || p.includes('/admin')) {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'E2E local mock: admin not available' }),
    });
    return;
  }

  // Minimal empty OK for other shell-adjacent GETs
  if (method === 'GET') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
    return;
  }

  await route.fulfill({
    status: 501,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'E2E local mock: method not stubbed for shell smoke' }),
  });
}

async function installNetworkGuard(page: Page) {
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());

    if (!isLocalHost(url.hostname)) {
      blockedHosts.push(url.href);
      await route.abort('failed');
      return;
    }

    if (url.pathname.startsWith('/api') || url.pathname.includes('/api/')) {
      await fulfillApi(route);
      return;
    }

    await route.continue();
  });
}

async function softShot(page: Page, name: string) {
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({
    path: path.join(shotDir, name),
    fullPage: true,
    animations: 'disabled',
  });
}

async function softViewportShot(page: Page, name: string) {
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({
    path: path.join(shotDir, name),
    fullPage: false,
    animations: 'disabled',
  });
}

async function softLocatorShot(locator: Locator, name: string) {
  mkdirSync(shotDir, { recursive: true });
  await locator.screenshot({
    path: path.join(shotDir, name),
    animations: 'disabled',
  });
}

/** Document-level horizontal overflow only — never treat scrollIntoView of clipped panels as pass. */
async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
  expect(
    overflow.scrollWidth,
    `horizontal overflow: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

function collectPageErrors(page: Page): string[] {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(`console.error: ${msg.text()}`);
  });
  return pageErrors;
}

function hardPageErrors(pageErrors: string[]): string[] {
  return pageErrors.filter((e) => !e.startsWith('console.error:'));
}

/** Expand workbench accordion + case library (both default collapsed). */
async function expandCaseLibrarySection(page: Page) {
  const audience = page.getByRole('button', { name: /目标受众与参考/ });
  await expect(audience).toBeVisible({ timeout: 15_000 });
  await audience.scrollIntoViewIfNeeded();
  // Open if currently collapsed
  if ((await audience.getAttribute('aria-expanded')) !== 'true') {
    await audience.click();
  }
  await expect(page.getByTestId('case-library-panel')).toBeVisible();

  const toggle = page.getByTestId('case-library-toggle');
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

test.describe('workbench shell local mock', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    blockedHosts.length = 0;
    apiScenario = 'shell';
    userReviewVersion = 1;
    checkInStatus = initialCheckInStatus();
    generateVersion = 0;
    resetCaseLibraryMock();
    if (!testInfo.title.includes('daily check-in')) {
      await page.addInitScript(() => {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Hong_Kong',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(new Date());
        const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        const dateHk = `${value.year}-${value.month}-${value.day}`;
        localStorage.setItem(
          `hk-cantonese-checkin-dismissed:e2e-local-user:${dateHk}`,
          '1',
        );
      });
    }
    await installNetworkGuard(page);
  });

  test.afterEach(async () => {
    expect(
      blockedHosts,
      `non-localhost requests must be empty; saw: ${blockedHosts.join(' | ')}`,
    ).toEqual([]);
  });

  test('signup keeps entered email and shows the confirmation dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/signup', { waitUntil: 'networkidle' });

    await page.getByLabel('邮箱 Email').fill('new@example.com');
    await page.getByLabel('密码 Password').fill('secret123');
    await page.getByLabel('确认密码 Confirm Password').fill('secret123');
    await page.getByRole('button', { name: /Sign Up/ }).click();

    const dialog = page.getByRole('dialog', { name: '请验证注册邮箱' });
    await expect(dialog).toContainText('new@example.com');
    await expect(dialog).toContainText('垃圾邮件');
    await softShot(page, 'signup-confirmation-dialog-desktop-1440-local-mock.png');
    await dialog.getByRole('button', { name: '我知道了' }).click();
    await expect(page.getByRole('heading', { name: '请检查邮箱' })).toBeVisible();
    await expect(page.getByText(/验证邮件已发送至/)).toContainText('new@example.com');
  });

  test('desktop /app loads workbench shell under local mock auth', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const pageErrors = collectPageErrors(page);

    const res = await page.goto('/app', { waitUntil: 'networkidle' });
    expect(res, '/app must respond').toBeTruthy();
    expect(res!.status()).toBeLessThan(500);

    // Must not bounce to login
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/app\/?$/);

    // Finish cloud-sync hydration loader if shown
    await expect(page.getByText('同步云端数据…')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('正在准备 77 工作台…')).toHaveCount(0, { timeout: 5_000 });

    // Prefer stable product chrome (regex tolerates whitespace/newlines in headings)
    await expect(page.getByText(/77港话通[\s\S]*社媒文案器/).first()).toBeVisible({
      timeout: 15_000,
    });
    // Hard JS pageerrors only (console.error may include non-fatal network noise)
    expect(
      hardPageErrors(pageErrors),
      `page JS errors: ${pageErrors.join(' | ')}`,
    ).toEqual([]);

    // Desktop: three panels simultaneously visible
    await expect(page.getByText('品牌与内容场景').first()).toBeVisible();
    await expect(page.getByText('文案参数').first()).toBeVisible();
    await expect(page.getByText(/在左边贴上原文/).first()).toBeVisible();
    await expect(page.getByText(/审核结果会显示在这里/).first()).toBeVisible();

    // Desktop must not show mobile segment tab bar
    await expect(page.getByTestId('workbench-mobile-tablist')).not.toBeVisible();

    // Footer
    await expect(page.getByText('Powered by CANTONESE API')).toBeVisible();
    await expect(page.getByText('v2.1')).toBeVisible();

    const pageHeight = await page.evaluate(() => ({
      body: document.body.scrollHeight,
      root: document.documentElement.scrollHeight,
      viewport: window.innerHeight,
    }));
    expect(pageHeight.body).toBeLessThanOrEqual(pageHeight.viewport + 1);
    expect(pageHeight.root).toBeLessThanOrEqual(pageHeight.viewport + 1);

    await assertNoHorizontalOverflow(page);
    await softShot(page, 'workbench-shell-desktop-1440-local-mock.png');
  });

  test('desktop workbench stays pinned when the document becomes scrollable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app', { waitUntil: 'networkidle' });
    await expect(page.getByText('同步云端数据…')).toHaveCount(0, { timeout: 20_000 });

    // Reproduce the reported blank area: browser state or injected page content
    // makes the document taller, then the user scrolls the page instead of a panel.
    await page.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.setAttribute('data-testid', 'document-overflow-probe');
      spacer.style.height = '900px';
      document.body.appendChild(spacer);
      window.scrollTo(0, document.documentElement.scrollHeight);
    });

    const geometry = await page.getByTestId('workbench-shell').evaluate((shell) => {
      const rect = shell.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        viewport: window.innerHeight,
      };
    });

    expect(Math.abs(geometry.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.bottom - geometry.viewport)).toBeLessThanOrEqual(1);
    await expect(page.getByText('Powered by CANTONESE API')).toBeVisible();
    await softViewportShot(page, 'workbench-pinned-desktop-1440-local-mock.png');
  });

  test('regenerating copy clears the previous edit highlight on desktop and mobile', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app', { waitUntil: 'networkidle' });
    await expect(page.getByText('同步云端数据…')).toHaveCount(0, { timeout: 20_000 });

    await page
      .getByPlaceholder('喺度贴上普通话/简体中文/英文嘅社媒文案或 campaign brief...')
      .fill('书展期间推广爆汁美食');
    const firstResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/generate') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /生成文案/ }).click();
    expect((await firstResponsePromise).status()).toBe(200);
    await page.getByRole('button', { name: '轻粤语', exact: true }).click();
    await expect(page.getByText('第一版輕粵語')).toBeVisible();

    await page.getByTitle('手动编辑文案').click();
    const editor = page.getByTestId('workbench-panel-results').locator('textarea');
    await expect(editor).toHaveValue('第一版輕粵語');
    await editor.fill('第一版輕粵語（人工修改）');
    await page.getByRole('button', { name: '储存' }).click();
    await expect(page.getByText('红色标记为修改内容')).toBeVisible();

    await page.getByTitle('同参数换一种写法，产出不同的版本').click();
    await expect(page.getByText('第二版輕粵語')).toBeVisible();
    await expect(page.getByText('红色标记为修改内容')).toHaveCount(0);
    await softShot(page, 'workbench-regenerate-clean-desktop-1440-local-mock.png');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('workbench-tab-results').click();
    await expect(page.getByText('第二版輕粵語')).toBeVisible();
    await expect(page.getByText('红色标记为修改内容')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
    await softShot(page, 'workbench-regenerate-clean-mobile-390-local-mock.png');
    expect(hardPageErrors(pageErrors), `page JS errors: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('desktop daily check-in earns and locally dismisses the 7-day reward', async ({ page }) => {
    apiScenario = 'check-in-earn';
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app', { waitUntil: 'networkidle' });

    const dialog = page.getByRole('dialog', { name: '每日签到' });
    await expect(dialog).toContainText('连续签到 6 / 7 天');
    await dialog.getByRole('button', { name: '立即签到' }).click();
    await expect(dialog).toContainText('连续签到 7 / 7 天');
    await expect(dialog).toContainText('30 天 Pro 奖励已发放');
    await softShot(page, 'check-in-applied-desktop-1440-local-mock.png');
    await assertNoHorizontalOverflow(page);

    await dialog.getByRole('button', { name: '关闭每日签到' }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('dialog', { name: '每日签到' })).toHaveCount(0);
  });

  test('mobile daily check-in claims a pending reward inside 390px viewport', async ({ page }) => {
    apiScenario = 'check-in-claim';
    checkInStatus = {
      ...initialCheckInStatus(),
      checkedInToday: true,
      streakCount: 7,
      rewardEarned: true,
      rewardStatus: 'pending',
      grantId: 'e2e-check-in-grant',
      canClaim: true,
    };
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app', { waitUntil: 'networkidle' });

    const dialog = page.getByRole('dialog', { name: '每日签到' });
    await expect(dialog).toContainText('奖励已保留');
    await dialog.getByRole('button', { name: '领取 30 天 Pro' }).click();
    await expect(dialog).toContainText('30 天 Pro 奖励已发放');
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    await softShot(page, 'check-in-claim-mobile-390-local-mock.png');
    await assertNoHorizontalOverflow(page);
  });

  test('product selling point localizes and remains usable on desktop and mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app', { waitUntil: 'networkidle' });
    await expect(page.getByText('同步云端数据…')).toHaveCount(0, { timeout: 20_000 });

    await page.getByRole('button', { name: /品牌与内容场景/ }).click();
    await page.getByPlaceholder('输入一条产品卖点（最多 200 字）').fill('轻便易携带');
    await page.getByRole('button', { name: '添加并港化' }).click();

    await expect(page.getByText('轻便易携带')).toBeVisible();
    await expect(page.getByText('夠輕身，拎出街都方便')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await softLocatorShot(
      page.getByTestId('product-selling-points'),
      'product-selling-points-desktop-1440-local-mock.png',
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText('夠輕身，拎出街都方便')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await softLocatorShot(
      page.getByTestId('product-selling-points'),
      'product-selling-points-mobile-390-local-mock.png',
    );
  });

  test('mobile /app shell uses segment tabs — one full panel, no horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const pageErrors = collectPageErrors(page);

    const res = await page.goto('/app', { waitUntil: 'domcontentloaded' });
    expect(res).toBeTruthy();
    expect(res!.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);

    await expect(page.getByText('同步云端数据…')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText(/77港话通[\s\S]*社媒文案器/).first()).toBeVisible({
      timeout: 15_000,
    });
    expect(
      hardPageErrors(pageErrors),
      `page JS errors: ${pageErrors.join(' | ')}`,
    ).toEqual([]);

    const tablist = page.getByTestId('workbench-mobile-tablist');
    await expect(tablist).toBeVisible();

    const inputTab = page.getByTestId('workbench-tab-input');
    const resultsTab = page.getByTestId('workbench-tab-results');
    const auditTab = page.getByTestId('workbench-tab-audit');

    // Default: 输入
    await expect(inputTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('workbench-panel-input')).toBeVisible();
    await expect(page.getByText('品牌与内容场景').first()).toBeVisible();
    // Other panels must not be "visible via clipped overflow" — they are hidden
    await expect(page.getByTestId('workbench-panel-results')).not.toBeVisible();
    await expect(page.getByTestId('workbench-panel-audit')).not.toBeVisible();
    await assertNoHorizontalOverflow(page);
    await softShot(page, 'workbench-shell-mobile-390-input.png');

    // Switch to 文案 — center empty state reachable; input hidden
    await resultsTab.click();
    await expect(resultsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('workbench-panel-results')).toBeVisible();
    await expect(page.getByText(/在左边贴上原文/).first()).toBeVisible();
    await expect(page.getByTestId('workbench-panel-input')).not.toBeVisible();
    await expect(page.getByTestId('workbench-panel-audit')).not.toBeVisible();
    await assertNoHorizontalOverflow(page);
    await softShot(page, 'workbench-shell-mobile-390-results.png');

    // Switch to 审核 — audit empty state reachable; center hidden
    await auditTab.click();
    await expect(auditTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('workbench-panel-audit')).toBeVisible();
    await expect(page.getByText(/审核结果会显示在这里/).first()).toBeVisible();
    await expect(page.getByTestId('workbench-panel-results')).not.toBeVisible();
    await expect(page.getByTestId('workbench-panel-input')).not.toBeVisible();
    await assertNoHorizontalOverflow(page);
    await softShot(page, 'workbench-shell-mobile-390-audit.png');

    // Tab bar remains fixed chrome (still visible after switches)
    await expect(tablist).toBeVisible();
  });

  test('desktop case-library full local CRUD via memory mock (dark + light)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const pageErrors = collectPageErrors(page);

    const createTitle = 'E2E本地正例标题';
    const createBody =
      '这是一条本地 E2E 正例正文，字数超过二十个字以便通过校验。';
    const createReason = '语气自然有港味';
    const createTags = '港味, 种草';
    const updatedTitle = 'E2E本地正例标题-已改';
    const updatedReason = '更新后的收录原因说明';

    const res = await page.goto('/app', { waitUntil: 'networkidle' });
    expect(res, '/app must respond').toBeTruthy();
    expect(res!.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText('同步云端数据…')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText(/77港话通[\s\S]*社媒文案器/).first()).toBeVisible({
      timeout: 15_000,
    });

    await expandCaseLibrarySection(page);

    // Empty state under memory mock
    await expect(page.getByText(/暂无案例/)).toBeVisible();

    // Create
    await page.getByTestId('case-library-add').click();
    await expect(page.getByTestId('case-library-form')).toBeVisible();
    // Default radio is 正例 (good)
    await page.getByTestId('case-library-title').fill(createTitle);
    await page.getByTestId('case-library-body').fill(createBody);
    await page.getByTestId('case-library-reason').fill(createReason);
    await page.getByTestId('case-library-tags').fill(createTags);

    const postWait = page.waitForResponse(
      (r) =>
        r.url().includes('/api/case-library') &&
        r.request().method() === 'POST' &&
        (r.status() === 200 || r.status() === 201),
    );
    await page.getByTestId('case-library-save').click();
    await postWait;
    await expect(page.getByTestId('case-library-form')).toHaveCount(0);
    await expect(page.getByTestId('case-library-list')).toBeVisible();
    await expect(page.getByText(createTitle)).toBeVisible();
    expect(caseLibraryStore.length).toBe(1);
    expect(caseLibraryStore[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    // Select entry → selected region appears
    const selectBtn = page.locator('[data-testid^="case-library-select-"]');
    await expect(selectBtn).toHaveCount(1);
    await selectBtn.click();
    await expect(page.getByTestId('case-library-selected')).toBeVisible();
    await expect(page.getByTestId('case-library-selected')).toContainText(createTitle);

    // Edit
    const editBtn = page.locator('[data-testid^="case-library-edit-"]');
    await editBtn.click();
    await expect(page.getByTestId('case-library-form')).toBeVisible();
    await page.getByTestId('case-library-title').fill(updatedTitle);
    await page.getByTestId('case-library-reason').fill(updatedReason);
    const patchWait = page.waitForResponse(
      (r) =>
        r.url().includes('/api/case-library/') &&
        r.request().method() === 'PATCH' &&
        r.status() === 200,
    );
    await page.getByTestId('case-library-save').click();
    await patchWait;
    await expect(page.getByTestId('case-library-form')).toHaveCount(0);
    const caseList = page.getByTestId('case-library-list');
    await expect(caseList.getByText(updatedTitle, { exact: true })).toBeVisible();
    await expect(caseList.getByText(createTitle, { exact: true })).toHaveCount(0);
    expect(caseLibraryStore[0]?.title).toBe(updatedTitle);
    expect(caseLibraryStore[0]?.reason).toBe(updatedReason);

    // Dark screenshot
    await softLocatorShot(
      page.getByTestId('case-library-panel'),
      'workbench-case-library-dark-1440-local-mock.png',
    );

    // Switch to light via localStorage and reload — memory mock still holds entry
    await page.evaluate(() => {
      localStorage.setItem('hk-cantonese-theme', 'light');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('同步云端数据…')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.locator('html')).toHaveClass(/light/);
    await expandCaseLibrarySection(page);
    await expect(
      page.getByTestId('case-library-list').getByText(updatedTitle, { exact: true }),
    ).toBeVisible();
    expect(caseLibraryStore.length).toBe(1);
    await softLocatorShot(
      page.getByTestId('case-library-panel'),
      'workbench-case-library-light-1440-local-mock.png',
    );

    // Delete + alertdialog
    const deleteBtn = page.locator('[data-testid^="case-library-delete-"]');
    await deleteBtn.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('删除案例？');
    await expect(dialog).toContainText('删除后无法恢复');
    const deleteWait = page.waitForResponse(
      (r) =>
        r.url().includes('/api/case-library/') &&
        r.request().method() === 'DELETE' &&
        r.status() === 204,
    );
    await dialog.getByRole('button', { name: '确认删除' }).click();
    await deleteWait;
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(updatedTitle)).toHaveCount(0);
    await expect(page.getByText(/暂无案例/)).toBeVisible();
    expect(caseLibraryStore.length).toBe(0);

    // Prove mutations hit route mock
    expect(caseLibraryMethodHits.POST, 'POST must hit case-library mock').toBeGreaterThanOrEqual(1);
    expect(caseLibraryMethodHits.PATCH, 'PATCH must hit case-library mock').toBeGreaterThanOrEqual(
      1,
    );
    expect(
      caseLibraryMethodHits.DELETE,
      'DELETE must hit case-library mock',
    ).toBeGreaterThanOrEqual(1);
    expect(
      hardPageErrors(pageErrors),
      `page JS errors: ${pageErrors.join(' | ')}`,
    ).toEqual([]);
  });

  test('user review result is deduplicated and a newer review notifies again', async ({ page }) => {
    apiScenario = 'reviewed-user';
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.clock.install();
    await page.goto('/app', { waitUntil: 'networkidle' });

    const approved = page.getByRole('dialog', { name: '文案审核结果' });
    await expect(approved).toContainText('你的「港饮」文案已通过审核，请立即查看');
    await softShot(page, 'review-result-adopted-desktop-1440-local-mock.png');

    await approved.getByRole('button', { name: '稍后查看' }).click();
    await expect(approved).toHaveCount(0);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('dialog', { name: '文案审核结果' })).toHaveCount(0);

    userReviewVersion = 2;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.fastForward(15_000);
    const changesRequested = page.getByRole('dialog', { name: '文案审核结果' });
    await expect(changesRequested).toContainText('你的「港饮」文案未通过审核，请立即查看');
    const box = await changesRequested.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(391);
    expect(box!.y + box!.height).toBeLessThanOrEqual(845);
    await assertNoHorizontalOverflow(page);
    await softShot(page, 'review-result-changes-mobile-390-local-mock.png');
  });

  test('user can open and focus the reviewed favorite immediately', async ({ page }) => {
    apiScenario = 'reviewed-user';
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app', { waitUntil: 'networkidle' });

    const resultDialog = page.getByRole('dialog', { name: '文案审核结果' });
    await resultDialog.getByRole('button', { name: '立即查看' }).click();
    await expect(page.getByRole('heading', { name: '文案收藏库' })).toBeVisible();
    const focused = page.getByTestId('bookmark-card-favorite-reviewed');
    await expect(focused).toBeVisible();
    await expect(focused).toHaveAttribute('data-focused', 'true');
    await expect(focused).toContainText('今晚冻柠茶，够醒神。');
    await softShot(page, 'review-result-immediate-favorite-desktop-1440-local-mock.png');
  });

  test('admin pending reminder supports later and immediate queue navigation', async ({ page }) => {
    apiScenario = 'admin-pending';
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin', { waitUntil: 'networkidle' });

    const reminder = page.getByTestId('admin-page-review-reminder');
    await expect(reminder).toContainText('2 条文案待审核');
    await softShot(page, 'admin-pending-reminder-desktop-1440-local-mock.png');
    await reminder.getByRole('button', { name: '稍后审核' }).click();
    await expect(reminder).toHaveCount(0);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByTestId('admin-page-review-reminder')).toHaveCount(0);

    await page.evaluate(() => sessionStorage.clear());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    const mobileReminder = page.getByTestId('admin-page-review-reminder');
    await expect(mobileReminder).toContainText('2 条文案待审核');
    await mobileReminder.getByRole('button', { name: '立刻审核' }).click();
    await expect(page.getByRole('button', { name: '只看待审核' })).toContainText('2');
    await expect(page.getByTestId('admin-pending-row')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await softShot(page, 'admin-pending-queue-mobile-390-local-mock.png');
  });

  test('super admin metrics remain readable on desktop and mobile', async ({ page }) => {
    apiScenario = 'admin-metrics';
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin', { waitUntil: 'networkidle' });

    const diagnostics = page.getByTestId('bad-case-diagnostics-panel');
    await expect(diagnostics.getByTestId('bad-case-diagnostics-attention')).toContainText('5 类指标需关注');
    await expect(diagnostics.getByRole('button', { name: '展开 Bad Case 诊断指标' })).toHaveAttribute('aria-expanded', 'false');
    const diagnosticsAlert = page.getByTestId('bad-case-diagnostics-alert');
    await expect(diagnosticsAlert).toContainText('Bad Case 诊断发现 5 类指标需关注');
    await softShot(page, 'admin-bad-case-diagnostics-alert-desktop-1440-local-mock.png');
    await diagnosticsAlert.getByRole('button', { name: '展开查看' }).click();
    await expect(diagnostics.getByTestId('bad-case-diagnostics-category')).toBeVisible();

    const panel = page.getByTestId('admin-metrics-panel');
    await expect(panel).toContainText('运营概览');
    await expect(panel).toContainText('模型健康');
    await expect(panel).toContainText('deepseek / deepseek-v4-flash');
    await expect(panel).toContainText('88.60');
    await expect(panel).toContainText('42 分');
    await panel.getByRole('button', { name: /查看低分任务 7f177000/ }).click();
    const badCaseDialog = page.getByRole('dialog', { name: '低分任务详情' });
    await expect(badCaseDialog).toContainText('7f177000-0000-4000-8000-000000000001');
    await expect(badCaseDialog).toContainText('夏日冻柠茶新品推广');
    await expect(badCaseDialog).toContainText('deepseek-v4-flash');
    await softShot(page, 'admin-bad-case-detail-desktop-1440-local-mock.png');
    await badCaseDialog.getByRole('button', { name: '关闭低分任务详情' }).click();
    await assertNoHorizontalOverflow(page);
    await softShot(page, 'admin-metrics-super-desktop-1440-local-mock.png');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByTestId('bad-case-diagnostics-alert')).toHaveCount(0);
    const mobileDiagnostics = page.getByTestId('bad-case-diagnostics-panel');
    await expect(mobileDiagnostics.getByTestId('bad-case-diagnostics-attention')).toContainText('5 类指标需关注');
    await mobileDiagnostics.getByRole('button', { name: '展开 Bad Case 诊断指标' }).click();
    await expect(mobileDiagnostics.getByTestId('bad-case-diagnostics-category')).toBeVisible();
    await expect(page.getByTestId('admin-metrics-panel')).toContainText('模型健康');
    await page.getByTestId('admin-metrics-panel').getByRole('button', { name: /查看低分任务 7f177000/ }).click();
    const mobileBadCaseDialog = page.getByRole('dialog', { name: '低分任务详情' });
    await expect(mobileBadCaseDialog).toContainText('夏日冻柠茶新品推广');
    const dialogBox = await mobileBadCaseDialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(391);
    await assertNoHorizontalOverflow(page);
    await softShot(page, 'admin-bad-case-detail-mobile-390-local-mock.png');
    await mobileBadCaseDialog.getByRole('button', { name: '关闭低分任务详情' }).click();
    await softShot(page, 'admin-metrics-super-mobile-390-local-mock.png');
  });

  test('billing shows trusted usage and manual Pro contact on desktop and mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app/billing', { waitUntil: 'networkidle' });

    await expect(page.getByText('已用 2 / 20 次')).toBeVisible();
    await expect(page.getByText(/用量来自实际账号记录/)).toBeVisible();
    await expect(page.getByText(/\[MOCK\]/)).toHaveCount(0);
    await page.getByRole('button', { name: '联系管理员开通 Pro' }).click();
    await expect(page.getByRole('dialog', { name: '联系开通 Pro' })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await softShot(page, 'billing-manual-pro-desktop-1440.png');

    await page.getByRole('button', { name: '关闭联系弹窗' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '联系管理员开通 Pro' }).click();
    const dialog = page.getByRole('dialog', { name: '联系开通 Pro' });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(391);
    await assertNoHorizontalOverflow(page);
    await softShot(page, 'billing-manual-pro-mobile-390.png');
  });
});
