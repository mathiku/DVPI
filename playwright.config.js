// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright-konfiguration for DVPI webapp.
 * Kør server på port 4001 og client på 3002 før test, eller brug production build.
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002',
    trace: 'on-first-retry',
    locale: 'da-DK',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  // Start ikke server automatisk – kør selv: node server/index.js + cd client && npm start
  webServer: undefined,
});
