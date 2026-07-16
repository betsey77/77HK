import { defineConfig, devices } from '@playwright/test';

/**
 * Public-route smoke harness.
 * Full business E2E deferred — docs/release/2026-07-14-playwright-smoke-plan.md
 *
 * Base URL: E2E_BASE_URL || http://localhost:5173
 *
 * Server lifecycle:
 * - Always use Playwright webServer for HTTP readiness (no fixed sleep).
 * - reuseExistingServer: true outside CI so a developer Vite is reused.
 * - CI starts a fresh `npm run dev:client` and tears it down.
 *
 * Config is .mjs on purpose: Node 26 + package "type":"module" caused
 * `@playwright/test` to hang with zero output when loading playwright.config.ts.
 *
 * Windows path note (2026-07-15): when the *project root realpath* contains
 * non-ASCII characters (e.g. 港话通 in the folder name), Playwright test
 * workers can hang with zero reporter output even though `--list` works and
 * `chromium.launch()` works. CI uses ASCII paths + Node 22. Local Windows:
 * use `npm run test:e2e:smoke:win` (scripts/e2e-public-smoke.ps1) which runs
 * from C:\work\77hk-e2e (ASCII cwd + junctions).
 *
 * If webServer itself hangs in a given environment, set E2E_NO_WEBSERVER=1 and
 * ensure baseURL is already serving; tests hard-fail when the URL is down.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const noWebServer = process.env.E2E_NO_WEBSERVER === '1';

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 45_000,
  expect: { timeout: 12_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
};

if (!noWebServer) {
  config.webServer = {
    command: 'npm run dev:client',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  };
}

export default defineConfig(config);
