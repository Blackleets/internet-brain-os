import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://127.0.0.1:3000',
    viewport: { width: 1536, height: 1024 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1536, height: 1024 } } }],
  webServer: [
    {
      command: 'node e2e/kernel-fixture.mjs',
      cwd: __dirname,
      url: 'http://127.0.0.1:4100/health',
      reuseExistingServer: false,
      timeout: 15_000,
    },
    {
      command: './node_modules/.bin/next dev --hostname 127.0.0.1 --port 3000',
      cwd: __dirname,
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
