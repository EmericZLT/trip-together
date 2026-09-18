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
    // Keep independent browser runs from sharing the local login rate-limit bucket.
    extraHTTPHeaders: { "CF-Connecting-IP": `e2e-${crypto.randomUUID()}` },
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:8791",
    ...devices["iPhone 13"],
    defaultBrowserType:
      process.env.PW_BROWSER === "webkit" ? "webkit" : "chromium",
    trace: "retain-on-failure",
    reducedMotion: "reduce",
  },
  outputDir: "../.local/test-results",
});
