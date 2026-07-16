import { test, expect } from '@playwright/test';

/**
 * Unauthenticated access to /app must enter login flow and keep return intent.
 * Product behavior (App.tsx ProtectedRoute):
 *   window.location.replace(`/login?next=${encodeURIComponent(pathname)}`)
 */
test.describe('protected routes (unauthenticated)', () => {
  test('visiting /app redirects to login with next=/app', async ({ page }) => {
    // Clear any residual storage that could look like a session
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
    });

    const response = await page.goto('/app', { waitUntil: 'domcontentloaded' });
    // May be a navigation chain; final URL is what matters
    expect(response === null || response.status() < 500).toBeTruthy();

    await page.waitForURL(/\/login/, { timeout: 15_000 });
    const url = new URL(page.url());
    expect(url.pathname).toBe('/login');
    const next = url.searchParams.get('next');
    expect(next, 'login must preserve return intent').toBeTruthy();
    // Product encodes pathname; value may be "/app" or "%2Fapp"
    const decoded = decodeURIComponent(next!);
    expect(decoded).toMatch(/^\/app\/?$/);

    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });
});
