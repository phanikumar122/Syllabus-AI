import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: ["weave.spec.ts", "interface-theme.spec.ts"],
  use: {
    baseURL: "http://127.0.0.1:3010",
    channel: process.env.CI ? undefined : "chrome",
    headless: true,
  },
  webServer: {
    command: "npm run preview -- --host=127.0.0.1 --port=3010",
    url: "http://127.0.0.1:3010",
    reuseExistingServer: true,
    timeout: 90000,
  },
  workers: 1,
});
