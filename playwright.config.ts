import { defineConfig, devices } from '@playwright/test';

const localBaseUrl = 'http://127.0.0.1:3000';
const serverCommand = process.env.CI ? 'npm run build && npm start' : 'npm run dev';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? localBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: serverCommand,
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000
      },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } }
  ]
});
