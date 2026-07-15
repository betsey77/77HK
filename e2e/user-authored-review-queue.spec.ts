import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const evidenceDir = 'docs/evidence/2026-07-15/user-authored-review-queue/screenshots';

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem('sb-qiotocumkbwckiezuptr-auth-token', JSON.stringify({
      access_token: 'e2e-access-token',
      refresh_token: 'e2e-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      user: {
        id: 'e2e-user',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'admin@example.com',
        email_confirmed_at: new Date().toISOString(),
        phone: '',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        identities: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }));
  });
}

async function mockApi(page: Page, admin: boolean) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/sync/bootstrap')) {
      await route.fulfill({ json: { favorites: [], savedConfigs: [], brandProfile: null } });
      return;
    }
    if (path.endsWith('/me/entitlements')) {
      await route.fulfill({ json: { planId: 'pro', monthlyLimit: 250, used: 0, remaining: 250 } });
      return;
    }
    if (path.endsWith('/admin/stats')) {
      await route.fulfill(admin
        ? { json: { totalUsers: 1, activeSubscriptions: 1, totalGenerations: 2, totalFeedback: 0, adminUsers: 1, role: 'admin' } }
        : { status: 403, json: { error: 'Forbidden' } });
      return;
    }
    if (path.endsWith('/admin/favorites/pending-summary')) {
      await route.fulfill({ json: { count: 2, latestRequestedAt: '2026-07-15T12:30:00.000Z' } });
      return;
    }
    if (path.endsWith('/admin/favorites')) {
      await route.fulfill({ json: {
        favorites: [{
          id: 'f1', ownerDisplayName: '用户甲', userEmail: 'user@example.com', variantKey: 'ig',
          rating: null, notes: '新品宣传', favoriteReason: null, reasonTags: [],
          savedAt: '2026-07-15T12:00:00.000Z', brandName: '港饮', productName: null,
          copyType: 'social', platform: 'all', publishPlatform: 'ig', reviewStatus: null,
          reviewNote: null, reviewUpdatedAt: null, isUserAuthored: true, reviewRequested: true,
          reviewRequestedAt: '2026-07-15T12:30:00.000Z', isPendingReview: true,
        }],
        total: 1,
      } });
      return;
    }
    if (path.endsWith('/sync/favorites') && route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: {
        id: 'server-f1', ownerId: 'e2e-user', ...body,
        reviewRequestedAt: body.reviewRequested ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      } });
      return;
    }
    await route.fulfill({ status: 200, json: {} });
  });
}

test.beforeAll(() => mkdirSync(evidenceDir, { recursive: true }));

test('desktop and mobile user-authored form stay within the viewport', async ({ page }) => {
  await seedSession(page);
  await mockApi(page, false);
  await page.goto('/app');
  await page.getByTitle('文案收藏库').click();
  await page.getByRole('button', { name: '添加自写文案' }).click();
  await page.getByLabel('品牌名称').fill('港饮新店');
  await page.getByLabel('文案类型').selectOption('spoken');
  await page.getByLabel('发布平台').selectOption('ig');
  await page.getByLabel('文案正文').fill('今晚冻柠茶，够醒神。');
  await page.getByLabel('提交管理员审核').check();
  await expect(page.getByRole('button', { name: '保存到收藏库' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `${evidenceDir}/desktop-user-authored-form.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('文案正文')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `${evidenceDir}/mobile-user-authored-form.png`, fullPage: true });
});

test('admin deep link shows pending badge, filter, reminder, and highlighted row', async ({ page }) => {
  await seedSession(page);
  await mockApi(page, true);
  await page.goto('/admin?tab=favorites&pending=1');
  await expect(page.getByTestId('admin-favorites-pending-badge')).toHaveText('2');
  await expect(page.getByRole('button', { name: '只看待审核' })).toBeVisible();
  await expect(page.getByTestId('admin-pending-row')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `${evidenceDir}/desktop-admin-pending-queue.png`, fullPage: true });
});
