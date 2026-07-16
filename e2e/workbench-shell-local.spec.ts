import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Local mock workbench shell smoke.
 * Proves React /app shell composition under fixture auth + blocked remote network.
 * Includes fully local case-library CRUD mock (memory, per-test reset).
 * Does NOT prove real Supabase Auth, JWT, RLS, quotas, or payment.
 */

const shotDir =
  process.env.E2E_SCREENSHOT_DIR?.trim() ||
  'docs/evidence/2026-07-15/workbench-shell-local-smoke/screenshots';

const blockedHosts: string[] = [];

type ApiScenario = 'shell' | 'reviewed-user' | 'admin-pending';

let apiScenario: ApiScenario = 'shell';
let userReviewVersion = 1;

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
    await route.fulfill({
      status: apiScenario === 'admin-pending' ? 200 : 403,
      contentType: 'application/json',
      body: JSON.stringify(apiScenario === 'admin-pending'
        ? {
            totalUsers: 1,
            activeSubscriptions: 0,
            totalGenerations: 0,
            totalFeedback: 0,
            adminUsers: 1,
            role: 'admin',
          }
        : { error: 'E2E local mock: admin not available' }),
    });
    return;
  }

  if (p === '/admin/favorites/pending-summary') {
    await route.fulfill({
      status: apiScenario === 'admin-pending' ? 200 : 403,
      contentType: 'application/json',
      body: JSON.stringify(apiScenario === 'admin-pending'
        ? { count: 2, latestRequestedAt: '2026-07-16T02:30:00.000Z' }
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

  if (apiScenario === 'admin-pending' && p === '/admin/users' && method === 'GET') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ users: [], total: 0 }),
    });
    return;
  }

  if (p.includes('/me/entitlements') || p.endsWith('/entitlements')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        planId: 'free',
        monthlyLimit: 20,
        used: 0,
        remaining: 20,
      }),
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
  test.beforeEach(async ({ page }) => {
    blockedHosts.length = 0;
    apiScenario = 'shell';
    userReviewVersion = 1;
    resetCaseLibraryMock();
    await installNetworkGuard(page);
  });

  test.afterEach(async () => {
    expect(
      blockedHosts,
      `non-localhost requests must be empty; saw: ${blockedHosts.join(' | ')}`,
    ).toEqual([]);
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
    await expect(page.getByText(/Powered by/).first()).toBeVisible();
    await expect(page.getByText(/v1\./).first()).toBeVisible();

    await assertNoHorizontalOverflow(page);
    await softShot(page, 'workbench-shell-desktop-1440-local-mock.png');
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
    await page.reload({ waitUntil: 'networkidle' });
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
});
