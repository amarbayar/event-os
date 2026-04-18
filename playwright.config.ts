import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-browser",
  globalSetup: "./tests/e2e-browser/global-setup.ts",
  outputDir: "./test-results",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command:
      "PORT=3100 DB_DIALECT=sqlite SQLITE_PATH=playwright-e2e.db AUTH_SECRET=test-secret SERVICE_TOKEN=test-token NEXTAUTH_URL=http://localhost:3100 NEXT_PUBLIC_APP_URL=http://localhost:3100 npm run dev",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
