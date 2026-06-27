import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    // Demo mode + gate disabled so E2E never needs a key or the access cookie.
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_DEMO_MODE: "true",
      BETA_GATE_ENABLED: "false",
      BETA_ACCESS_CODE: "test-code",
      BETA_SESSION_SECRET: "test-secret-for-e2e-only-32-characters-min",
    },
  },
});
