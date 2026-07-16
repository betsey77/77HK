import { defineConfig } from '@playwright/test';

/** Minimal config for hang diagnosis — no webServer, no devices spread. */
export default defineConfig({
  testDir: './e2e',
  testMatch: /smoke\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: [['line']],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    browserName: 'chromium',
  },
});
