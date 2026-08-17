/**
 * Playwright config — REAL browser E2E against a REAL Next.js dev process.
 *
 * `webServer` boots `next dev -p 3210` (a genuine Next.js app process, not a
 * jsdom fake) and waits for it to accept connections. Tests then drive a real
 * Chromium page through the actual client-side agent path (initAgentConfig →
 * ChatService → Pi runtime → React → DOM) using a deterministic faux provider
 * (see src/lib/e2e-provider.ts) so no real API key is needed.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 3210;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e/.report' }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Reuse the ms-playwright-bundled Chromium (already cached on this host).
    channel: undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: process.env.SVTON_E2E_SERVER_COMMAND ?? 'pnpm dev',
    env: { SVTON_E2E_VISUAL_CAPTURE: '1' },
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
