import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  appReady,
  enqueueResponsesForPrompt,
  responses,
  seedE2e,
  send,
} from './helpers';
import {
  approvalArguments,
  createReadySession,
} from './chat-approval-decision.helpers';

const SHOTS = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i04-background-startup/screenshots';

test.describe('session row activity lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('waiting becomes background completed unread, survives reload, and clears when visible', async ({ page }) => {
    const { sessionA, sessionB } = await createTwoReadySessions(page, 'completed');
    await sessionA.click();
    const prompt = 'A approval completes while B is visible';
    await send(page, prompt);
    await expect(page.getByTestId('stop-button')).toBeVisible({ timeout: 20_000 });
    await sessionB.click();
    await enqueueResponsesForPrompt(page, prompt, [
      responses.toolCall('e2e_approval', approvalArguments('activity-waiting-approval')),
    ]);
    await expectActivity(sessionA, 'waitingOnApproval', false);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByTestId('chat-input')).toBeEnabled();
    await page.screenshot({ path: `${SHOTS}/activity-waiting-on-approval.png`, fullPage: true });

    await sessionA.click();
    const approvalDialog = page.getByRole('alertdialog', { name: 'Approve this tool?' });
    await expect(approvalDialog).toContainText('activity-waiting-approval');
    await approvalDialog.getByRole('button', { name: 'Allow once' }).click();
    await expect(approvalDialog).toHaveCount(0);
    await expect(page.getByTestId('stop-button')).toBeVisible({ timeout: 20_000 });
    await sessionB.click();
    await enqueueResponsesForPrompt(page, prompt, [responses.text('A background completion')]);
    await expectActivity(sessionA, 'completed', true);
    await expect(page.getByTestId('chat-input')).toBeEnabled();
    await page.screenshot({ path: `${SHOTS}/activity-completed-unread.png`, fullPage: true });

    await page.reload();
    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
    await expect(page.getByRole('button', { name: '新对话' })).toBeVisible();
    await expectActivity(sessionA, 'completed', true);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SHOTS}/activity-completed-unread-reload.png`, fullPage: true });

    await sessionA.click();
    await expectNoActivity(sessionA);
    await page.screenshot({ path: `${SHOTS}/activity-completed-read-visible.png`, fullPage: true });
  });

  test('background failure stays unread while B is interactive and clears only when A is visible', async ({ page }) => {
    const { sessionA, sessionB } = await createTwoReadySessions(page, 'failed');
    const prompt = 'A fails while B remains selected';
    await sessionA.click();
    await send(page, prompt);
    await expect(page.getByTestId('stop-button')).toBeVisible({ timeout: 20_000 });
    await sessionB.click();
    await expect(page.getByTestId('chat-input')).toBeEnabled();
    await enqueueResponsesForPrompt(page, prompt, [responses.error()]);
    await expectActivity(sessionA, 'failed', true);
    await expect(page.getByTestId('message-error')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/activity-failed-unread.png`, fullPage: true });

    await sessionA.click();
    await expect(page.getByTestId('message-error')).toBeVisible({ timeout: 20_000 });
    await expectNoActivity(sessionA);
    await page.screenshot({ path: `${SHOTS}/activity-failed-read-visible.png`, fullPage: true });
  });
});

async function createTwoReadySessions(page: Page, suffix: string) {
  await seedE2e(page, undefined, { memoryDisabled: true });
  await appReady(page);
  const promptA = `prepare activity A ${suffix}`;
  const promptB = `prepare activity B ${suffix}`;
  await createReadySession(page, promptA, 'Activity A ready');
  const sessionA = page.getByTestId('session-item').filter({ hasText: promptA });
  await page.getByRole('button', { name: '新对话' }).click();
  await createReadySession(page, promptB, 'Activity B ready');
  const sessionB = page.getByTestId('session-item').filter({ hasText: promptB });
  return { sessionA, sessionB };
}

async function expectActivity(row: Locator, phase: string, unread: boolean) {
  const activity = row.getByRole('status');
  await expect(activity).toHaveAttribute('data-phase', phase, { timeout: 20_000 });
  await expect(activity).toHaveAttribute('data-unread', String(unread));
}

async function expectNoActivity(row: Locator) {
  await expect(row.getByRole('status')).toHaveCount(0, { timeout: 20_000 });
}
