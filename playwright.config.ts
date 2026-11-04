import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PW_CHROMIUM_PATH || (require("node:fs").existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3200", launchOptions: { executablePath } },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 900 }, launchOptions: { executablePath } } },
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions: { executablePath } }, grep: /@mobile/ },
  ],
  webServer: {
    command: "npx next start -p 3200",
    url: "http://localhost:3200/api/status",
    reuseExistingServer: false,
    // A fake key so the UI reports Live Mode as configured; E2E never reaches OpenAI (API calls are intercepted).
    env: { OPENAI_API_KEY: "e2e-not-a-real-key" },
  },
});
