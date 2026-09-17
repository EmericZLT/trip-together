import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./flows",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 90000,
  use: {
    actionTimeout: 15000,
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:8791",
    ...devices["iPhone 13"],
    defaultBrowserType:
      process.env.PW_BROWSER === "webkit" ? "webkit" : "chromium",
    trace: "retain-on-failure",
    reducedMotion: "reduce",
  },
  outputDir: "../.local/test-results",
});
