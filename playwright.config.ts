import { defineConfig } from "@playwright/test";

// In Docker the e2e container sets E2E_BASE_URL to the production `web` service.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./src/tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    browserName: "chromium",
    trace: "on-first-retry",
  },
  // The three widths every screen must work at (docs/PLAN.md §12.13).
  projects: [
    {
      name: "phone-390",
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: "tablet-834",
      use: { viewport: { width: 834, height: 1194 }, hasTouch: true },
    },
    {
      name: "desktop-1280",
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
});
