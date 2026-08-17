import { expect, test } from '@playwright/test';
import {
  appReady,
  enqueuePostTurnResponses,
  enqueueResponsesForPrompt,
  lastAssistant,
  responses,
  seedE2e,
  send,
} from './helpers';
import { activeSessionPersistenceState } from './checkpoint-helpers';

const SHOTS = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i04-authoritative-settlement/screenshots';

test.describe('authoritative terminal settlement and recovery', () => {
  test('two sequential finals each publish Send with zero Stop', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    for (const [prompt, answer] of [
      ['settlement turn one', 'first terminal answer'],
      ['settlement turn two', 'second terminal answer'],
    ] as const) {
      await enqueueResponsesForPrompt(page, prompt, [responses.text(answer)]);
      await send(page, prompt);
      await expect(lastAssistant(page)).toContainText(answer, { timeout: 20_000 });
      await expect(page.getByTestId('send-button')).toBeVisible();
      await expect(page.getByTestId('stop-button')).toHaveCount(0);
    }
    await page.screenshot({ path: `${SHOTS}/sequential-terminal-send.png`, fullPage: true });
  });

  test('reload during held post-turn becomes interrupted and keeps exact visible evidence', async ({ page }) => {
    await seedE2e(page, undefined, {
      memoryDisabled: false,
      postTurnMemoryTimeoutMs: 30_000,
    });
    await appReady(page);
    await enqueueResponsesForPrompt(page, 'checkpoint base turn', [
      responses.text('checkpoint base complete'),
    ]);
    await send(page, 'checkpoint base turn');
    await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 20_000 });

    await enqueueResponsesForPrompt(page, 'newer visible turn', [
      responses.text('newer visible answer before reload'),
    ]);
    await send(page, 'newer visible turn');
    await expect(lastAssistant(page)).toContainText(
      'newer visible answer before reload',
      { timeout: 20_000 },
    );
    await expect(page.getByTestId('stop-button')).toBeVisible();
    await expect.poll(async () => activeSessionPersistenceState(page)).toMatchObject({
      runJournalPhase: 'inProgress',
      storedMessageCount: 4,
    });

    await page.reload();
    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
    await expect(page.getByText('newer visible turn', { exact: true })).toBeVisible();
    await expect(page.getByText('newer visible answer before reload', { exact: true })).toBeVisible();
    await expect(page.getByText('Turn interrupted', { exact: true })).toBeVisible();
    await expect(page.getByTestId('send-button')).toBeVisible();
    await expect(page.getByTestId('stop-button')).toHaveCount(0);
    await expect.poll(async () => activeSessionPersistenceState(page)).toMatchObject({
      runJournalPhase: 'interrupted',
    });
    await page.screenshot({ path: `${SHOTS}/reload-interrupted-evidence.png`, fullPage: true });
  });

  test('scripted hidden post-turn settles promptly without stealing foreground prompts', async ({ page }) => {
    await seedE2e(page, undefined, { memoryDisabled: false });
    await appReady(page);
    await completeTurn(page, 'scripted memory base', 'scripted base answer');
    await enqueueResponsesForPrompt(page, 'scripted memory second', [
      responses.text('scripted second answer'),
    ]);
    await send(page, 'scripted memory second');
    await expect(lastAssistant(page)).toContainText('scripted second answer', { timeout: 20_000 });
    await expect(page.getByTestId('stop-button')).toBeVisible();
    await expect(page.getByTitle('Regenerate')).toHaveCount(0);
    await enqueuePostTurnResponses(page, [responses.text('NOTHING')]);
    await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('stop-button')).toHaveCount(0);
    await expect.poll(async () => activeSessionPersistenceState(page)).toMatchObject({
      checkpointMessageCount: 4,
      runJournalPhase: 'completed',
    });
  });

  test('hung hidden post-turn times out, checkpoints, and returns to Send', async ({ page }) => {
    await seedE2e(page, undefined, {
      memoryDisabled: false,
      postTurnMemoryTimeoutMs: 500,
    });
    await appReady(page);
    await completeTurn(page, 'timeout memory base', 'timeout base answer');
    await enqueueResponsesForPrompt(page, 'timeout memory second', [
      responses.text('timeout second answer'),
    ]);
    await send(page, 'timeout memory second');
    await expect(lastAssistant(page)).toContainText('timeout second answer', { timeout: 20_000 });
    await expect(page.getByTestId('stop-button')).toBeVisible();
    await expect(page.getByTitle('Regenerate')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/finalizing-stop-no-terminal-actions.png`, fullPage: true });
    await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('stop-button')).toHaveCount(0);
    await expect.poll(async () => activeSessionPersistenceState(page)).toMatchObject({
      checkpointMessageCount: 4,
      runJournalPhase: 'completed',
    });
  });

  test('completed reload restores exact idle history', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    for (const [prompt, answer] of [
      ['completed reload one', 'completed answer one'],
      ['completed reload two', 'completed answer two'],
    ] as const) {
      await enqueueResponsesForPrompt(page, prompt, [responses.text(answer)]);
      await send(page, prompt);
      await expect(lastAssistant(page)).toContainText(answer, { timeout: 20_000 });
      await expect(page.getByTestId('send-button')).toBeVisible();
    }
    await page.reload();
    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
    await expect(page.getByTestId('message-user')).toHaveCount(2);
    await expect(page.getByText('completed answer one', { exact: true })).toBeVisible();
    await expect(page.getByText('completed answer two', { exact: true })).toBeVisible();
    await expect(page.getByTestId('send-button')).toBeVisible();
    await expect(page.getByTestId('stop-button')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/completed-reload-idle.png`, fullPage: true });
  });
});

async function completeTurn(page: import('@playwright/test').Page, prompt: string, answer: string) {
  await enqueueResponsesForPrompt(page, prompt, [responses.text(answer)]);
  await send(page, prompt);
  await expect(lastAssistant(page)).toContainText(answer, { timeout: 20_000 });
  await expect(page.getByTestId('send-button')).toBeVisible();
}
