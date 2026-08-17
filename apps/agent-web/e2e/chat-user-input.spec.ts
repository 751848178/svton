import { expect, test } from '@playwright/test';
import {
  SHOTS,
  appReady,
  enqueueResponses,
  lastAssistant,
  responses,
  seedE2e,
  send,
} from './helpers';
import { activeSessionPersistenceState } from './checkpoint-helpers';

const I03_SHOTS = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i03/browser';

const questions = [
  {
    id: 'token', header: 'Access token', question: 'Enter a temporary token.',
    isOther: false, isSecret: true, options: null,
  },
  {
    id: 'theme', header: 'Theme', question: 'Choose a theme.', isOther: true,
    isSecret: false, options: [{ label: 'Blue', description: 'Use blue.' }],
  },
];

test.describe('agent-web structured user input E2E', () => {
  test('submits atomic answers and reloads without secret or decision replay', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    await enqueueResponses(page, [
      responses.toolCall('request_user_input', { questions }),
      responses.text('Structured answers received; continuing.'),
    ]);
    await send(page, 'ask structured questions');
    const dialog = page.getByRole('dialog', { name: 'Your input is needed' });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByLabel('Access token')).toHaveAttribute('type', 'password');
    await dialog.getByRole('button', { name: 'Submit answers' }).click();
    await expect(dialog.getByRole('alert')).toHaveCount(2);
    await page.screenshot({ path: `${SHOTS}/i02-user-input-invalid.png` });
    await dialog.getByLabel('Access token').fill('browser-secret');
    await dialog.getByRole('radio', { name: /Blue/ }).click();
    await page.screenshot({ path: `${SHOTS}/i02-user-input-pending.png` });
    await dialog.getByRole('button', { name: 'Submit answers' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(lastAssistant(page)).toContainText(
      'Structured answers received; continuing.',
      { timeout: 20_000 },
    );
    await expect(lastAssistant(page)).not.toContainText('browser-secret');
    await expect.poll(async () => (
      await activeSessionPersistenceState(page)
    ).checkpointMessageCount, { timeout: 20_000 }).toBeGreaterThan(0);
    await expect.poll(async () => (
      await activeSessionPersistenceState(page)
    ).storedMessageCount, { timeout: 20_000 }).toBeGreaterThan(1);
    const durable = await activeSessionPersistenceState(page);
    expect(durable.sessionId).not.toBeNull();
    expect(durable.storedTimelineItemCount).toBe(0);

    await page.reload();
    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
    await expect.poll(async () => (
      await activeSessionPersistenceState(page)
    ).sessionId).toBe(durable.sessionId);
    await expect(page.locator('body')).not.toContainText('browser-secret');
    await expect(page.getByRole('dialog', { name: 'Your input is needed' })).toHaveCount(0);
    await expect(page.locator('[data-timeline-tool-name="request_user_input"]')).toHaveCount(0);
    await page.screenshot({ path: `${I03_SHOTS}/05-user-input-secret-reloaded.png`, fullPage: true });
  });

  test('switches sessions and restores the owning request with its public draft', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    await enqueueResponses(page, [responses.text('Session A ready.')]);
    await send(page, 'prepare session A');
    await expect(lastAssistant(page)).toContainText('Session A ready.');
    const sessionA = page.getByTestId('session-item').filter({ hasText: 'prepare session A' });
    await expect(sessionA).toBeVisible();

    await page.getByRole('button', { name: 'New conversation' }).click();
    await enqueueResponses(page, [responses.text('Session B ready.')]);
    await send(page, 'prepare session B');
    await expect(lastAssistant(page)).toContainText('Session B ready.');
    const sessionB = page.getByTestId('session-item').filter({ hasText: 'prepare session B' });
    await expect(sessionB).toBeVisible();

    await sessionA.click();
    await expect(lastAssistant(page)).toContainText('Session A ready.');
    await enqueueResponses(page, [
      responses.toolCall('request_user_input', { questions }),
      responses.text('Switched back and continued.'),
    ]);
    await send(page, 'ask and switch sessions');
    const dialog = page.getByRole('dialog', { name: 'Your input is needed' });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('chat-pane-content')).toHaveJSProperty('inert', true);
    await dialog.getByRole('radio', { name: /Blue/ }).click();

    await sessionB.click();
    await expect(dialog).toHaveCount(0);
    await expect(lastAssistant(page)).toContainText('Session B ready.');
    await expect(sessionB).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(sessionA).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('radio', { name: /Blue/ })).toBeChecked();
    await page.screenshot({ path: `${SHOTS}/i02-session-switch-restored.png` });
    await dialog.getByLabel('Access token').fill('switch-secret');
    await dialog.getByRole('button', { name: 'Submit answers' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(lastAssistant(page)).toContainText('Switched back and continued.');
    await expect(lastAssistant(page)).not.toContainText('switch-secret');
  });

  test('abort interrupts a pending request without an answer', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    await enqueueResponses(page, [responses.toolCall('request_user_input', { questions })]);
    await send(page, 'ask then abort');
    const dialog = page.getByRole('dialog', { name: 'Your input is needed' });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole('button', { name: 'Stop run' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('reload never replays a stale actionable request', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    await enqueueResponses(page, [responses.toolCall('request_user_input', { questions })]);
    await send(page, 'ask then reload');
    const dialog = page.getByRole('dialog', { name: 'Your input is needed' });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
    await expect(dialog).toHaveCount(0);
  });
});
