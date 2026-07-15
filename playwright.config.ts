import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 0 minimal smoke harness only.
 * Full business E2E (Auth/RLS/billing/admin) is intentionally deferred
 * to Phase 2 — see docs/release/2026-07-14-playwright-smoke-plan.md
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
