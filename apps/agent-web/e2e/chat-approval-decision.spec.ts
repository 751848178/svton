import { expect, test } from '@playwright/test';
import {
  appReady,
  enqueueResponses,
  enqueueResponsesForPrompt,
  lastAssistant,
  responses,
  seedE2e,
  send,
} from './helpers';
import {
  browserPlatformPersistenceText,
} from './checkpoint-helpers';
import {
  approvalArguments,
  createReadySession,
  openApproval,
  secretArguments,
  waitForTimelinePersistence,
} from './chat-approval-decision.helpers';

const SHOTS = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i03-approval/client-ui/screenshots';
const I04_SHOTS = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i04-runtime-registry/screenshots';

test.describe('agent-web typed approval decisions', () => {
  test('accepts once under double click and persists no raw secrets', async ({ page }) => {
    await openApproval(page, 'accept approval', 'accept completed', secretArguments());
    const dialog = page.getByRole('alertdialog', { name: 'Approve this tool?' });
    await expect(page.locator('body')).not.toContainText('raw-api-key-e2e');
    await expect(page.locator('body')).not.toContainText('raw-password-e2e');
    await dialog.getByRole('button', { name: 'Allow once' }).evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
    await expect(dialog).toHaveCount(0);
    await expect(lastAssistant(page)).toContainText('accept completed', { timeout: 20_000 });
    await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('stop-button')).toHaveCount(0);
    await expect(page.getByTestId('approval-decision-history')).toHaveCount(1);
    await expect(page.getByTestId('approval-decision-history')).toHaveAttribute('data-status', 'completed');
    await waitForTimelinePersistence(page);
    const persistence = await browserPlatformPersistenceText(page);
    expect(persistence).not.toContain('raw-api-key-e2e');
    expect(persistence).not.toContain('raw-password-e2e');
    await page.screenshot({ path: `${SHOTS}/01-accept-double-secret-safe.png`, fullPage: true });
  });

  test('declines without rendering failed approval semantics', async ({ page }) => {
    await openApproval(page, 'decline approval', 'decline completed');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Decline' }).click();
    await expect(lastAssistant(page)).toContainText('decline completed', { timeout: 20_000 });
    const history = page.getByTestId('approval-decision-history');
    await expect(history).toHaveAttribute('data-status', 'declined');
    await expect(page.getByTestId(/timeline-tool-/)).toHaveAttribute('data-timeline-status', 'declined');
    await expect(lastAssistant(page).getByRole('alert')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/02-declined-history.png`, fullPage: true });
  });

  test('maps Escape to cancel once', async ({ page }) => {
    await openApproval(page, 'escape approval', 'escape completed');
    const dialog = page.getByRole('alertdialog');
    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    const allow = dialog.getByRole('button', { name: 'Allow once' });
    await expect(cancel).toBeFocused();
    await expect(page.getByTestId('chat-pane-content')).not.toHaveAttribute('aria-hidden');
    await expect.poll(() => page.getByTestId('chat-input').evaluate((input) => {
      const root = Array.from(document.body.children).find((child) => child.contains(input));
      return Boolean((root as HTMLElement & { inert?: boolean } | undefined)?.inert);
    })).toBe(true);
    await page.keyboard.press('Shift+Tab');
    await expect(allow).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(lastAssistant(page)).toContainText('escape completed', { timeout: 20_000 });
    await expect(page.getByTestId('approval-decision-history')).toHaveAttribute('data-status', 'cancelled');
    await expect.poll(() => page.getByTestId('chat-input').evaluate((input) => {
      const root = Array.from(document.body.children).find((child) => child.contains(input));
      return Boolean((root as HTMLElement & { inert?: boolean } | undefined)?.inert);
    })).toBe(false);
    await expect(page.getByTestId('chat-input')).toBeFocused();
    await page.screenshot({ path: `${SHOTS}/03-escape-cancelled.png`, fullPage: true });
  });

  test('accept for session skips the same scope but not another session', async ({ page }) => {
    await openApproval(page, 'grant memory scope', 'scope granted');
    await page.getByRole('button', { name: 'Allow for session' }).click();
    await expect(lastAssistant(page)).toContainText('scope granted', { timeout: 20_000 });

    await enqueueResponses(page, [
      responses.toolCall('e2e_approval', approvalArguments('same-session-memory')),
      responses.text('same session skipped approval'),
    ]);
    await send(page, 'reuse memory scope');
    await expect(lastAssistant(page)).toContainText('same session skipped approval', { timeout: 20_000 });
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    const sessionCount = await page.getByTestId('session-item').count();
    await page.getByRole('button', { name: 'New conversation' }).click();
    await expect(page.getByTestId('session-item')).toHaveCount(sessionCount + 1);
    await expect(page.getByTestId('chat-input')).toBeEnabled();
    await expect(lastAssistant(page)).toHaveCount(0);
    await enqueueResponses(page, [
      responses.toolCall('e2e_approval', approvalArguments('other-session-memory')),
      responses.text('other session settled'),
    ]);
    await send(page, 'new session needs memory scope');
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS}/04-session-scope-isolated.png`, fullPage: true });
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(lastAssistant(page)).toContainText('other session settled', { timeout: 20_000 });
  });

  test('reload terminalizes pending approval and never ghost-replays it', async ({ page }) => {
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);
    await enqueueResponses(page, [responses.toolCall('e2e_approval', secretArguments())]);
    await send(page, 'reload pending approval');
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 20_000 });
    await waitForTimelinePersistence(page);
    await page.screenshot({ path: `${SHOTS}/05-before-pending-reload.png`, fullPage: true });
    await page.reload();
    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByTestId('approval-decision-history')).toHaveAttribute('data-status', 'interrupted');
    const persistence = await browserPlatformPersistenceText(page);
    expect(persistence).not.toContain('raw-api-key-e2e');
    expect(persistence).not.toContain('raw-password-e2e');
    await page.screenshot({ path: `${SHOTS}/06-reload-interrupted-no-ghost.png`, fullPage: true });
  });

  test('B runs independently while A waits, then A restores its exact request', async ({ page }) => {
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);
    await createReadySession(page, 'prepare approval A', 'Session A ready.');
    const sessionA = page.getByTestId('session-item').filter({ hasText: 'prepare approval A' });
    const readySessionCount = await page.getByTestId('session-item').count();
    await page.getByRole('button', { name: 'New conversation' }).click();
    await expect(page.getByTestId('session-item')).toHaveCount(readySessionCount + 1);
    await expect(page.getByTestId('chat-input')).toBeEnabled();
    await createReadySession(page, 'prepare approval B', 'Session B ready.');
    const sessionB = page.getByTestId('session-item').filter({ hasText: 'prepare approval B' });

    await sessionA.click();
    await send(page, 'approval owned by A');
    await expect(page.getByTestId('stop-button')).toBeVisible({ timeout: 20_000 });
    await sessionB.click();
    await enqueueResponsesForPrompt(page, 'approval owned by A', [
      responses.toolCall('e2e_approval', approvalArguments('session-a-owned-memory')),
      responses.text('A approval completed'),
    ]);
    await expect(sessionA.getByRole('status')).toHaveAttribute(
      'data-phase',
      'waitingOnApproval',
      { timeout: 20_000 },
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(lastAssistant(page)).toContainText('Session B ready.');
    await expect(page.getByTestId('chat-input')).toBeEnabled();
    await enqueueResponsesForPrompt(page, 'B concurrent approval turn', [
      responses.text('B completed while A waited'),
    ]);
    await send(page, 'B concurrent approval turn');
    await expect(lastAssistant(page)).toContainText('B completed while A waited', { timeout: 20_000 });
    await expect(page.getByTestId('send-button')).toBeVisible();
    await page.screenshot({ path: `${I04_SHOTS}/decision-b-complete-a-waiting.png`, fullPage: true });

    await sessionA.click();
    const approvalDialog = page.getByRole('alertdialog');
    await expect(approvalDialog).toBeVisible();
    await expect(approvalDialog).toContainText('session-a-owned-memory');
    await expect.poll(() => sessionB.evaluate((element) => {
      let current: Element | null = element;
      while (current) {
        if (current instanceof HTMLElement && current.inert) return true;
        current = current.parentElement;
      }
      return false;
    })).toBe(true);
    expect(await approvalDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
    await approvalDialog.getByRole('button', { name: 'Allow once' }).click();
    await expect(lastAssistant(page)).toContainText('A approval completed', { timeout: 20_000 });
    await expect(page.getByTestId('approval-decision-history')).toHaveCount(1);
    await expect(page.getByTestId('approval-decision-history')).toHaveAttribute('data-status', 'completed');
    await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('stop-button')).toHaveCount(0);
    await enqueueResponsesForPrompt(page, 'continue returned session A', [
      responses.text('A second send completed'),
    ]);
    await send(page, 'continue returned session A');
    await expect(lastAssistant(page)).toContainText('A second send completed', { timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS}/08-session-a-restored-composer.png`, fullPage: true });
  });
});
