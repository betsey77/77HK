import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./docs/evidence/2026-07-15/playwright-runtime-repair",
  testMatch: "trivial.spec.ts",
  workers: 1,
  reporter: "line",
});
