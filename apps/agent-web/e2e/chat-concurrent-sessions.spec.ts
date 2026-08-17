import { expect, test, type Page } from '@playwright/test';
import {
  appReady,
  enqueueResponsesForPrompt,
  lastAssistant,
  responses,
  seedE2e,
  send,
} from './helpers';
import { createReadySession } from './chat-approval-decision.helpers';

const SHOTS = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i04-runtime-registry/screenshots';

test.describe('addressed concurrent session product path', () => {
  test('B completes while A is held and A alone can be stopped', async ({ page }) => {
    const { sessionA, sessionB } = await createTwoReadySessions(page, 'stop');
    await sessionA.click();
    await send(page, 'A held for independent stop');
    await expect(page.getByTestId('stop-button')).toBeVisible({ timeout: 20_000 });

    await sessionB.click();
    await expect(page.getByTestId('chat-input')).toBeEnabled();
    await enqueueResponsesForPrompt(page, 'B completes concurrently', [
      responses.text('B independent completion'),
    ]);
    await send(page, 'B completes concurrently');
    await expect(lastAssistant(page)).toContainText('B independent completion', { timeout: 20_000 });
    await expect(page.getByTestId('send-button')).toBeVisible();

    await sessionA.click();
    await expect(page.getByTestId('stop-button')).toBeVisible();
    await page.getByTestId('stop-button').click();
    await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS}/ab-independent-stop.png`, fullPage: true });
  });

  test('background A failure does not replace selected B Stop state', async ({ page }) => {
    const { sessionA, sessionB } = await createTwoReadySessions(page, 'failure');
    await sessionA.click();
    await send(page, 'A fails in background');
    await expect(page.getByTestId('stop-button')).toBeVisible({ timeout: 20_000 });
    await sessionB.click();
    await send(page, 'B remains held');
    await expect(page.getByTestId('stop-button')).toBeVisible({ timeout: 20_000 });

    await enqueueResponsesForPrompt(page, 'A fails in background', [responses.error()]);
    await sessionA.click();
    const failure = page.getByTestId('timeline-error');
    await expect(failure).toBeVisible({ timeout: 20_000 });
    await expect(failure).toContainText('Provider stream failed (simulated)');
    await expect(page.getByTestId('send-button')).toBeVisible();
    await sessionB.click();
    await expect(page.getByTestId('stop-button')).toBeVisible();
    await expect(page.getByTestId('timeline-error')).toHaveCount(0);
    await expect(page.getByTestId('message-error')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/background-a-failed-b-still-stop.png`, fullPage: true });
    await page.getByTestId('stop-button').click();
    await expect(page.getByTestId('send-button')).toBeVisible();
  });

  test('deleting held background A leaves B runnable with no ghost session', async ({ page }) => {
    const { sessionA, sessionB } = await createTwoReadySessions(page, 'delete');
    await sessionA.click();
    await send(page, 'A deleted while held');
    await expect(page.getByTestId('stop-button')).toBeVisible({ timeout: 20_000 });
    await sessionB.click();
    await expect(page.getByTestId('chat-input')).toBeEnabled();

    const rowA = sessionA.locator('..');
    await rowA.getByRole('button', { name: /^管理 / }).click();
    await page.getByRole('menuitem', { name: '永久删除' }).click();
    await expect(page.getByRole('alertdialog', { name: /永久删除/ })).toBeVisible();
    await page.getByRole('button', { name: '永久删除' }).click();
    await expect(sessionA).toHaveCount(0);
    await expect(sessionB).toBeVisible();
    await enqueueResponsesForPrompt(page, 'B after deleting A', [
      responses.text('B survived A deletion'),
    ]);
    await send(page, 'B after deleting A');
    await expect(lastAssistant(page)).toContainText('B survived A deletion', { timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS}/delete-held-a-b-survives.png`, fullPage: true });
  });
});

async function createTwoReadySessions(page: Page, suffix: string) {
  await seedE2e(page, undefined, { memoryDisabled: true });
  await appReady(page);
  const promptA = `prepare concurrent A ${suffix}`;
  const promptB = `prepare concurrent B ${suffix}`;
  await createReadySession(page, promptA, 'Concurrent A ready');
  const sessionA = page.getByTestId('session-item').filter({ hasText: promptA });
  await page.getByRole('button', { name: '新对话' }).click();
  await createReadySession(page, promptB, 'Concurrent B ready');
  const sessionB = page.getByTestId('session-item').filter({ hasText: promptB });
  return { sessionA, sessionB };
}
