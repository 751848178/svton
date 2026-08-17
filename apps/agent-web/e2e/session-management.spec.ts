import { expect, test, type Locator, type Page } from '@playwright/test';
import { appReady, enqueueResponsesForPrompt, responses, seedE2e, send } from './helpers';
import { createReadySession } from './chat-approval-decision.helpers';

const SHOTS = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i05-conversation-management/screenshots';

test.describe('durable conversation management', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);
  });

  test('renames, pins, searches, archives, restores selection, and permanently deletes', async ({ page }) => {
    const promptA = 'Alpha unique content marker';
    const promptB = 'Beta recent conversation';
    await createReadySession(page, promptA, 'Alpha completed');
    await page.getByRole('button', { name: 'New conversation' }).click();
    await createReadySession(page, promptB, 'Beta completed');

    await runMenu(row(page, promptA), 'Rename');
    const rename = page.getByRole('textbox', { name: 'Conversation title' });
    await rename.fill('Pinned Alpha');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(row(page, 'Pinned Alpha')).toBeVisible();
    await runMenu(row(page, 'Pinned Alpha'), 'Pin');
    await expect(page.getByTestId('session-item').first()).toContainText('Pinned Alpha');

    const titleSearch = page.getByRole('searchbox', { name: 'Search conversation titles' });
    await titleSearch.fill('Pinned Alpha');
    await expect(row(page, 'Pinned Alpha')).toBeVisible();
    await expect(row(page, promptB)).toHaveCount(0);
    await titleSearch.fill('');
    await page.getByRole('checkbox', { name: 'Search message content (svton extension)' }).check();
    await titleSearch.fill('unique content marker');
    await expect(row(page, 'Pinned Alpha')).toContainText('Message content (svton extension)');
    await titleSearch.fill('');
    await page.getByRole('checkbox', { name: 'Search message content (svton extension)' }).uncheck();

    await runMenu(row(page, promptB), 'Archive');
    await expect(row(page, promptB)).toHaveCount(0);
    await scopeButton(page, 'Archived').click();
    await expect(row(page, promptB)).toBeDisabled();
    await expect(row(page, promptB)).toContainText('Unarchive to open');
    await runMenu(row(page, promptB), 'Unarchive');
    await scopeButton(page, 'Conversations').click();
    await expect(row(page, promptB)).toBeVisible();

    await row(page, 'Pinned Alpha').click();
    await page.reload();
    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
    await expect(page.getByTestId('message-user').filter({ hasText: promptA })).toBeVisible();
    await runMenu(row(page, promptB), 'Delete permanently');
    await expect(page.getByRole('alertdialog', { name: /Delete .* permanently/ })).toBeVisible();
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(row(page, promptB)).toHaveCount(0);
    await page.reload();
    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
    await expect(row(page, promptB)).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/web-management-desktop.png`, fullPage: true });
  });

  test('stops and archives the exact active running conversation', async ({ page }) => {
    await createReadySession(page, 'Fallback conversation', 'Fallback ready');
    const fallback = row(page, 'Fallback conversation');
    await page.getByRole('button', { name: 'New conversation' }).click();
    const runningPrompt = 'Active approval to stop and archive';
    await send(page, runningPrompt);
    await expect(page.getByTestId('stop-button')).toBeVisible({ timeout: 20_000 });
    const running = row(page, runningPrompt);
    await fallback.click();
    await enqueueResponsesForPrompt(page, runningPrompt, [
      responses.toolCall('e2e_approval', { command: 'hold active run' }),
    ]);
    await expect(running.getByRole('status')).toHaveAttribute(
      'data-phase',
      'waitingOnApproval',
      { timeout: 20_000 },
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByTestId('chat-input')).toBeEnabled();
    await manageButton(running).click();
    await expect(page.getByRole('menuitem', { name: 'Archive', exact: true })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Stop and archive' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Approve this tool?' })).toHaveCount(0);
    await expect(running).toHaveCount(0);
    await expect(page.getByTestId('message-user').filter({ hasText: 'Fallback conversation' }))
      .toBeVisible();
    await scopeButton(page, 'Archived').click();
    const archived = row(page, runningPrompt);
    await expect(archived).toBeDisabled();
    await runMenu(archived, 'Unarchive');
    await scopeButton(page, 'Conversations').click();
    await row(page, runningPrompt).click();
    await expect(page.getByTestId('approval-decision-history'))
      .toHaveAttribute('data-status', 'interrupted');
    await expect(page.locator('[data-testid^="timeline-tool-"]'))
      .toHaveAttribute('data-timeline-status', 'interrupted');
    await runMenu(row(page, runningPrompt), 'Archive');
    await scopeButton(page, 'Archived').click();
    await expect(row(page, runningPrompt)).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}/web-stop-and-archive.png`, fullPage: true });
  });
});

test('390x844 mobile drawer exposes touch-sized conversation management', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedE2e(page, undefined, { memoryDisabled: true });
  await appReady(page);
  await createReadySession(page, 'Mobile managed conversation', 'Mobile ready');
  await page.getByRole('button', { name: 'Open conversation navigation' }).click();
  const managed = row(page, 'Mobile managed conversation');
  const button = manageButton(managed);
  await expect(button).toBeVisible();
  expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(36);
  await button.click();
  await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/web-management-mobile-390x844.png`, fullPage: true });
});

function row(page: Page, text: string): Locator {
  return page.getByTestId('session-item').filter({ hasText: text });
}

function manageButton(session: Locator): Locator {
  return session.locator('..').getByRole('button', { name: /^Manage / });
}

function scopeButton(page: Page, name: 'Conversations' | 'Archived'): Locator {
  return page.getByTestId('session-search-controls').getByRole('button', { name });
}

async function runMenu(session: Locator, command: string): Promise<void> {
  await manageButton(session).click();
  await session.page().getByRole('menuitem', { name: command, exact: true }).click();
}
