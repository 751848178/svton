import { expect, test } from '@playwright/test';
import { appReady, seedE2e } from './helpers';

const SHOTS = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i04-background-startup/screenshots';
const RAW_SECRET = 'e2e-startup-secret-token-value';

test.describe('startup source failure and in-place retry', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  for (const source of ['config', 'chat', 'session', 'project'] as const) {
    test(`${source} failure is redacted and retry mounts the chat`, async ({ page }) => {
      await seedE2e(page, undefined, { startupFailureSource: source });
      await page.goto('/');
      const error = page.getByTestId('startup-error');
      await expect(error).toBeVisible({ timeout: 30_000 });
      await expect(error).toContainText(`${source} startup failed`);
      await expect(error).toContainText('[REDACTED:api-key]');
      await expect(error).not.toContainText(RAW_SECRET);
      await page.screenshot({ path: `${SHOTS}/startup-${source}-failed.png`, fullPage: true });
      await page.getByTestId('startup-retry').click();
      await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
      await expect(page.getByTestId('startup-error')).toHaveCount(0);
      await page.screenshot({ path: `${SHOTS}/startup-${source}-recovered.png`, fullPage: true });
    });
  }

  test('normal startup remains inert when no failure source is configured', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    await expect(page.getByTestId('startup-error')).toHaveCount(0);
  });
});
