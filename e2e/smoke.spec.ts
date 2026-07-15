import { test, expect } from '@playwright/test';

/**
 * Phase 0 smoke — public homepage HTTP/body + real scroll reveal.
 * Does not cover Auth, generate, billing, admin, or RLS.
 * Fail hard when the local client is down (no skip-on-unreachable).
 * Prerequisite: npm run dev:client (or equivalent) on baseURL.
 */
test.describe('Phase 0 public smoke', () => {
  test('marketing page responds with product title', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

    expect(response, 'homepage must return an HTTP response').toBeTruthy();
    expect(response!.status(), 'homepage must not be a server error').toBeLessThan(500);

    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('marketing [data-reveal] nodes activate after full-page scroll', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response, 'homepage must return an HTTP response').toBeTruthy();
    expect(response!.status()).toBeLessThan(500);

    // Wait until reveal targets are mounted
    await page.waitForSelector('[data-reveal]', { state: 'attached', timeout: 15_000 });

    // Real segmented scroll so IntersectionObserver fires (screenshot alone is not enough)
    await page.evaluate(async () => {
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const maxY = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        0,
      );
      const step = Math.max(180, Math.floor(window.innerHeight * 0.55));
      for (let y = 0; y <= maxY + step; y += step) {
        window.scrollTo(0, y);
        await delay(120);
      }
      window.scrollTo(0, maxY);
      await delay(200);
      // Second pass top → bottom for any late observers
      window.scrollTo(0, 0);
      await delay(100);
      for (let y = 0; y <= maxY + step; y += step) {
        window.scrollTo(0, y);
        await delay(80);
      }
    });

    await page.waitForFunction(() => {
      const nodes = document.querySelectorAll('[data-reveal]');
      if (nodes.length === 0) return false;
      return Array.from(nodes).every((n) => n.classList.contains('is-in'));
    }, { timeout: 20_000 });

    const stats = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
      const total = nodes.length;
      const activated = nodes.filter((n) => n.classList.contains('is-in')).length;
      const hidden = nodes.filter((n) => {
        const opacity = window.getComputedStyle(n).opacity;
        return opacity === '0' || Number.parseFloat(opacity) === 0;
      }).length;
      return { total, activated, hidden };
    });

    expect(stats.total, 'page must expose at least one [data-reveal] node').toBeGreaterThan(0);
    expect(stats.activated, 'every reveal node must have is-in after scroll').toBe(stats.total);
    expect(stats.hidden, 'no reveal node may remain at opacity 0').toBe(0);
  });
});
