import { defineConfig, devices } from '@playwright/test';

/**
 * Local workbench shell smoke only (mock auth via vite.e2e.config.ts).
 * Base URL defaults to isolated E2E Vite on 5184 — never user :5173.
 */
const baseURL = process.env.E2E_WORKBENCH_BASE_URL || 'http://127.0.0.1:5184';

/** @type {import('@playwright/test').PlaywrightTestConfig} */
export default defineConfig({
  testDir: './e2e',
  testMatch: /workbench-shell-local\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
