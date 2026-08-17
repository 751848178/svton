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
import { E2E_TIMELINE_SKILL_TRIGGER } from '../src/lib/e2e-constants';

const SHOTS = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i03/browser';

test.describe('I03 normalized execution timeline', () => {
  test('real producer streams updates, completes, restores Send, and reloads unchanged', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    await enqueueResponses(page, [
      responses.toolCall('e2e_command', {
        command: 'printf success', stdout: 'success stdout', stderr: '', exitCode: 0,
      }),
      responses.text('command handled'),
    ]);
    await send(page, 'run successful fixture');
    await expect(lastAssistant(page).getByTestId('timeline-progress-update'))
      .toContainText('fixture update', { timeout: 20_000 });
    const command = lastAssistant(page).locator('[data-testid^="timeline-command-"]');
    await expect(command).toHaveAttribute('data-timeline-status', 'completed', { timeout: 20_000 });
    await expect(command.getByTestId('command-stdout')).toHaveText('success stdout');
    await expect(page.getByTestId('send-button')).toBeVisible();
    await expect.poll(async () => (
      await activeSessionPersistenceState(page)
    ).checkpointMessageCount, { timeout: 20_000 })
      .toBeGreaterThan(0);
    await expect.poll(async () => (
      await activeSessionPersistenceState(page)
    ).storedTimelineItemCount, { timeout: 20_000 })
      .toBeGreaterThan(0);
    await expect(command.getByRole('button', { name: 'Open terminal' })).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}/01-success.png`, fullPage: true });

    await page.reload();
    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
    const restored = page.locator('[data-testid^="timeline-command-"]').last();
    await expect(restored).toHaveAttribute('data-timeline-status', 'completed', { timeout: 20_000 });
    await expect(restored.getByTestId('command-stdout')).toHaveText('success stdout');
    await page.screenshot({ path: `${SHOTS}/02-success-reloaded.png`, fullPage: true });
  });

  test('failed command reloads secret-safe and retries the owning user prompt', async ({ page }) => {
    const secrets = [
      'e2e-password-secret', 'e2e-access-secret',
      'e2e-cli-secret', 'e2e-progress-secret',
    ];
    await seedE2e(page);
    await appReady(page);
    await enqueueResponses(page, [
      responses.toolCall('e2e_command', {
        command: 'exit 7 --token e2e-cli-secret',
        stdout: '', stderr: 'fatal stderr', exitCode: 7,
        progressText: 'token=e2e-progress-secret',
        password: 'e2e-password-secret', accessToken: 'e2e-access-secret',
      }),
      responses.text('failure observed'),
    ]);
    await send(page, 'run failing fixture');
    const command = lastAssistant(page).locator('[data-testid^="timeline-command-"]');
    await expect(command).toHaveAttribute('data-timeline-status', 'failed', { timeout: 20_000 });
    await expect(command.getByTestId('command-stderr')).toHaveText('fatal stderr');
    await expect(command.getByTestId('command-exit-code')).toHaveText('Exit code: 7');
    await expect(lastAssistant(page).getByTestId('timeline-process')).toHaveCount(0);
    await expect(page.getByTestId('send-button')).toBeVisible();
    await expect.poll(async () => (
      await activeSessionPersistenceState(page)
    ).checkpointMessageCount, { timeout: 20_000 })
      .toBeGreaterThan(0);
    await expect.poll(async () => (
      await activeSessionPersistenceState(page)
    ).storedTimelineItemCount, { timeout: 20_000 })
      .toBeGreaterThan(0);
    for (const secret of secrets) {
      await expect(page.locator('body')).not.toContainText(secret);
      expect((await activeSessionPersistenceState(page)).storedTimelineText).not.toContain(secret);
    }
    await page.screenshot({ path: `${SHOTS}/03-exit-7.png`, fullPage: true });
    await page.reload();
    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
    const restored = page.locator('[data-testid^="timeline-command-"]').last();
    await expect(restored).toHaveAttribute('data-timeline-status', 'failed', { timeout: 20_000 });
    await expect(restored.getByTestId('command-stderr')).toHaveText('fatal stderr');
    await page.screenshot({ path: `${SHOTS}/03-exit-7-reloaded.png`, fullPage: true });

    await enqueueResponses(page, [
      responses.toolCall('e2e_command', {
        command: 'printf retry-success', stdout: 'retry stdout', stderr: '', exitCode: 0,
      }),
      responses.text('retry handled'),
    ]);
    await restored.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByTestId('message-user')).toHaveCount(1, { timeout: 20_000 });
    await expect(page.getByTestId('message-user')).toContainText('run failing fixture');
    const retried = page.locator('[data-testid^="timeline-command-"]').last();
    await expect(retried).toHaveAttribute('data-timeline-status', 'completed', { timeout: 20_000 });
    await expect(retried.getByTestId('command-stdout')).toHaveText('retry stdout');
    await expect(page.getByTestId('send-button')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/07-retry-succeeded.png`, fullPage: true });
  });

  test('provider failure is an always-visible outcome without expansion', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    await enqueueResponses(page, [responses.error()]);
    await send(page, 'trigger provider failure');
    await expect(lastAssistant(page).getByTestId('timeline-error'))
      .toContainText('Provider stream failed (simulated)', { timeout: 20_000 });
    await expect(lastAssistant(page).getByTestId('timeline-process')).toHaveCount(0);
    await expect(page.getByTestId('send-button')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/04-provider-error.png`, fullPage: true });
  });

  test('installed skill context stays model-only and cannot shift reload ownership', async ({ page }) => {
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);
    await enqueueResponses(page, [
      responses.toolCall('e2e_command', {
        command: 'exit 7', stdout: '', stderr: 'skill fatal stderr', exitCode: 7,
      }),
      responses.text('skill failure observed'),
    ]);
    const prompt = `${E2E_TIMELINE_SKILL_TRIGGER} run failing fixture`;
    await send(page, prompt);
    const command = lastAssistant(page).locator('[data-testid^="timeline-command-"]');
    await expect(command).toHaveAttribute('data-timeline-status', 'failed', { timeout: 20_000 });
    await expect.poll(async () => (
      await activeSessionPersistenceState(page)
    ).storedTimelineItemCount, { timeout: 20_000 }).toBe(1);

    await page.reload();
    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
    await expect(page.getByTestId('message-user')).toHaveCount(1, { timeout: 20_000 });
    await expect(page.getByTestId('message-user')).toContainText(prompt);
    await expect(page.locator('body')).not.toContainText('[Skill Context Activated]');
    const restored = page.locator('[data-testid^="timeline-command-"]').last();
    await expect(restored).toHaveAttribute('data-timeline-status', 'failed');
    await expect(restored.getByTestId('command-stderr')).toHaveText('skill fatal stderr');
    await expect(restored.getByTestId('command-exit-code')).toHaveText('Exit code: 7');
    await expect(restored.getByTestId('command-duration')).toHaveText(/\d+(?:ms|\.\d+s)/);
    await page.screenshot({ path: `${SHOTS}/08-installed-skill-reloaded.png`, fullPage: true });
  });

  test('two canonical turns reload without cross-attaching outcomes', async ({ page }) => {
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);
    await enqueueResponses(page, [
      responses.toolCall('e2e_command', {
        command: 'printf one', stdout: 'turn one', stderr: '', exitCode: 0,
      }),
      responses.text('first handled'),
    ]);
    await send(page, 'run first fixture');
    const commands = page.locator('[data-testid^="timeline-command-"]');
    await expect(commands).toHaveCount(1, { timeout: 20_000 });
    await expect(commands.first()).toHaveAttribute('data-timeline-status', 'completed');

    await enqueueResponses(page, [
      responses.toolCall('e2e_command', {
        command: 'exit 7', stdout: '', stderr: 'turn two failed', exitCode: 7,
      }),
      responses.text('second handled'),
    ]);
    await send(page, 'run second fixture');
    await expect(commands).toHaveCount(2, { timeout: 20_000 });
    await expect(commands.nth(1)).toHaveAttribute('data-timeline-status', 'failed');
    await expect.poll(async () => (
      await activeSessionPersistenceState(page)
    ).checkpointMessageCount, { timeout: 20_000 }).toBeGreaterThan(4);
    await expect.poll(async () => (
      await activeSessionPersistenceState(page)
    ).storedTimelineItemCount, { timeout: 20_000 }).toBe(2);

    await page.reload();
    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
    await expect(commands).toHaveCount(2, { timeout: 20_000 });
    await expect(commands.first().getByTestId('command-stdout')).toHaveText('turn one');
    await expect(commands.nth(1).getByTestId('command-stderr')).toHaveText('turn two failed');
    await page.screenshot({ path: `${SHOTS}/06-two-turn-reloaded.png`, fullPage: true });
  });
});
