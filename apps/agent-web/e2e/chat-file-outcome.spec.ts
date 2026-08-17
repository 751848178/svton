import { expect, test } from '@playwright/test';
import {
  appReady,
  enqueueResponses,
  lastAssistant,
  responses,
  seedE2e,
  send,
} from './helpers';
import { activeSessionPersistenceState } from './checkpoint-helpers';

const SHOTS = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i03-file-diff/browser';
const PATH = '/workspace/src/file-outcome.ts';
const DIFF = '@@ -1 +1 @@\n-old value\n+new value';

test.describe('I03.3 typed file outcome lane', () => {
  test('shows, acts on, and reloads a file outcome without final assistant text', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);
    await enqueueResponses(page, [
      responses.toolCall('file_edit', { path: PATH, diff: DIFF }),
      responses.text(''),
    ]);
    await send(page, 'apply deterministic file outcome fixture');

    const pending = lastAssistant(page).getByTestId('timeline-file-outcome');
    await expect(pending).toHaveAttribute('data-file-status', 'running', { timeout: 20_000 });
    await expect(pending).toContainText(PATH);
    await page.screenshot({ path: `${SHOTS}/01-file-pending.png`, fullPage: true });

    const terminal = lastAssistant(page).getByTestId('timeline-file-outcome');
    await expect(terminal).toHaveAttribute('data-file-status', 'completed', { timeout: 20_000 });
    await expect(terminal).toContainText('File change completed');
    await expect(terminal).toContainText(PATH);
    await expect(lastAssistant(page).getByTestId('timeline-file-outcome')).toHaveCount(1);
    await expect(lastAssistant(page).locator('[data-testid^="timeline-tool-"]')).toHaveCount(0);

    const disclosure = terminal.getByRole('button', { name: 'Show details' });
    await expect(terminal.getByRole('button', { name: /details/i })).toHaveCount(1);
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    const regionId = await disclosure.getAttribute('aria-controls');
    expect(regionId).toBeTruthy();
    await disclosure.press('Enter');
    await expect(terminal.locator(`button[aria-controls="${regionId}"]`))
      .toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`#${regionId}`)).toContainText('new value');

    await terminal.getByRole('button', { name: 'Copy path' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(PATH);
    await terminal.getByRole('button', { name: 'Copy diff' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(DIFF);

    const open = terminal.getByRole('button', { name: 'Open path' });
    await expect(open).toBeDisabled();
    await expect(open).toHaveAttribute('title', 'Opening paths is unavailable in this host');
    await expect(terminal.getByRole('status')).toHaveText('Open unavailable in this host');
    await expect(lastAssistant(page)).not.toContainText('file outcome handled');
    await page.screenshot({ path: `${SHOTS}/02-file-terminal.png`, fullPage: true });

    await expect.poll(async () => (
      await activeSessionPersistenceState(page)
    ).storedTimelineText, { timeout: 20_000 }).toContain(PATH);
    await expect.poll(async () => (
      await activeSessionPersistenceState(page)
    ).storedTimelineText, { timeout: 20_000 }).toContain('old value');

    await page.reload();
    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
    const restored = page.getByTestId('timeline-file-outcome').last();
    await expect(restored).toHaveAttribute('data-file-status', 'completed', { timeout: 20_000 });
    await expect(restored).toContainText(PATH);
    await expect(page.getByTestId('timeline-file-outcome')).toHaveCount(1);
    await expect(restored.getByRole('button', { name: /details/i })).toHaveCount(1);
    await expect(restored.getByRole('status')).toHaveText('Open unavailable in this host');
    await page.screenshot({ path: `${SHOTS}/03-file-reloaded.png`, fullPage: true });
  });
});
