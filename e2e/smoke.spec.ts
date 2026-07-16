import { test, expect } from '@playwright/test';

/**
 * Public homepage HTTP/body + scroll reveal.
 * Marketing page uses `.panel-in` / `.is-in` (not legacy data-reveal).
 * Fail hard when the local client is down (no skip-on-unreachable).
 * webServer in playwright.config.mjs starts or reuses baseURL.
 */
test.describe('Phase 0 public smoke', () => {
  test('marketing page responds with product title', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

    expect(response, 'homepage must return an HTTP response').toBeTruthy();
    expect(response!.status(), 'homepage must not be a server error').toBeLessThan(500);

    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
    await expect(page.getByRole('heading', { name: /香港人会点赞|港式/ }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('marketing .panel-in nodes activate after full-page scroll', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response, 'homepage must return an HTTP response').toBeTruthy();
    expect(response!.status()).toBeLessThan(500);

    await page.waitForSelector('.panel-in', { state: 'attached', timeout: 15_000 });

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
        await delay(100);
      }
      window.scrollTo(0, maxY);
      await delay(200);
      window.scrollTo(0, 0);
      await delay(80);
      for (let y = 0; y <= maxY + step; y += step) {
        window.scrollTo(0, y);
        await delay(70);
      }
    });

    await page.waitForFunction(() => {
      const nodes = document.querySelectorAll('.panel-in');
      if (nodes.length === 0) return false;
      return Array.from(nodes).every((n) => n.classList.contains('is-in'));
    }, { timeout: 20_000 });

    // CSS transition after is-in can lag one frame; wait until opacity settles.
    await page.waitForFunction(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.panel-in'));
      if (nodes.length === 0) return false;
      return nodes.every((n) => {
        if (!n.classList.contains('is-in')) return false;
        const opacity = Number.parseFloat(window.getComputedStyle(n).opacity);
        return Number.isFinite(opacity) && opacity > 0.5;
      });
    }, { timeout: 10_000 });

    const stats = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.panel-in'));
      const total = nodes.length;
      const activated = nodes.filter((n) => n.classList.contains('is-in')).length;
      const visible = nodes.filter((n) => {
        const opacity = Number.parseFloat(window.getComputedStyle(n).opacity);
        return Number.isFinite(opacity) && opacity > 0.5;
      }).length;
      return { total, activated, visible };
    });

    expect(stats.total, 'page must expose at least one .panel-in node').toBeGreaterThan(0);
    expect(stats.activated, 'every panel-in node must have is-in after scroll').toBe(stats.total);
    expect(stats.visible, 'every panel-in node must be visible after transition').toBe(stats.total);
  });
});
