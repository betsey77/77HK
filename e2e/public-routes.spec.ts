import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Screenshot directory:
 * - E2E_SCREENSHOT_DIR (absolute or relative) when set by the Windows harness
 * - else default relative path under the repo (historical public-smoke folder)
 */
const shotDir =
  process.env.E2E_SCREENSHOT_DIR?.trim() ||
  'docs/evidence/2026-07-15/playwright-runner-public-smoke/screenshots';

async function ensureShotDir() {
  mkdirSync(shotDir, { recursive: true });
}

async function softShot(page: Page, name: string) {
  await ensureShotDir();
  await page.screenshot({
    path: path.join(shotDir, name),
    fullPage: true,
  });
}

test.describe('public routes smoke', () => {
  test('home loads product chrome (desktop)', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(res, 'home must respond').toBeTruthy();
    expect(res!.status()).toBeLessThan(500);

    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('77 港话通').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /进入工作台|免费开写/ }).first()).toBeVisible();
    await softShot(page, 'home-desktop.png');
  });

  test('home critical controls visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(res, 'home must respond').toBeTruthy();
    expect(res!.status()).toBeLessThan(500);

    await expect(page.getByText('77 港话通').first()).toBeVisible({ timeout: 15_000 });
    // Primary CTA or menu entry must remain reachable
    const primary = page.getByRole('link', { name: /免费开写|进入工作台/ }).first();
    await expect(primary).toBeVisible();
    const box = await primary.boundingBox();
    expect(box, 'primary CTA must have layout box').toBeTruthy();
    expect(box!.width).toBeGreaterThan(40);
    expect(box!.height).toBeGreaterThan(20);
    await softShot(page, 'home-mobile-390.png');
  });

  test('pricing page shows plan area without user-facing mock badge', async ({ page }) => {
    const res = await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    expect(res, 'pricing must respond').toBeTruthy();
    expect(res!.status()).toBeLessThan(500);

    await expect(page.getByRole('heading', { name: /简单透明的套餐|定价|套餐/ }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Free|免费/i).first()).toBeVisible();
    await expect(page.getByText(/Pro/i).first()).toBeVisible();
    await expect(page.getByText(/团队|Team/i).first()).toBeVisible();

    const body = await page.locator('body').innerText();
    // Comment-only MOCK in source is fine; user-visible banner with bare "MOCK" is not
    expect(body).not.toMatch(/\bMOCK\b/);
    await softShot(page, 'pricing-desktop.png');
  });

  test('login page shows sign-in form', async ({ page }) => {
    const res = await page.goto('/login', { waitUntil: 'domcontentloaded' });
    expect(res, 'login must respond').toBeTruthy();
    expect(res!.status()).toBeLessThan(500);

    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /登录|Sign in/i }).first()).toBeVisible();
    await softShot(page, 'login-desktop.png');
  });

  test('pricing critical text readable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const res = await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    expect(res).toBeTruthy();
    expect(res!.status()).toBeLessThan(500);
    await expect(page.getByText(/简单透明的套餐|套餐/).first()).toBeVisible({ timeout: 15_000 });
    await softShot(page, 'pricing-mobile-390.png');
  });
});
