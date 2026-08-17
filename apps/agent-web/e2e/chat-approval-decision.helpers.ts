import { expect, type Page } from '@playwright/test';
import {
  appReady,
  enqueueResponsesForPrompt,
  lastAssistant,
  responses,
  seedE2e,
  send,
} from './helpers';
import { activeSessionPersistenceState } from './checkpoint-helpers';

export async function openApproval(
  page: Page,
  prompt: string,
  completion: string,
  args: Record<string, unknown> = approvalArguments('safe approval'),
) {
  await seedE2e(page, undefined, { memoryDisabled: true });
  await appReady(page);
  await openApprovalFromReadyPage(page, prompt, completion, args);
}

export async function openApprovalFromReadyPage(
  page: Page,
  prompt: string,
  completion: string,
  args: Record<string, unknown> = approvalArguments('safe approval'),
) {
  await enqueueResponsesForPrompt(page, prompt, [
    responses.toolCall('e2e_approval', args),
    responses.text(completion),
  ]);
  await send(page, prompt);
  await expect(page.getByRole('alertdialog', { name: 'Approve this tool?' }))
    .toBeVisible({ timeout: 20_000 });
}

export async function createReadySession(page: Page, prompt: string, completion: string) {
  await enqueueResponsesForPrompt(page, prompt, [responses.text(completion)]);
  await send(page, prompt);
  await expect(lastAssistant(page)).toContainText(completion, { timeout: 20_000 });
}

export function secretArguments() {
  return {
    ...approvalArguments('safe secret approval'),
    apiKey: 'raw-api-key-e2e',
    password: 'raw-password-e2e',
  };
}

export function approvalArguments(command: string) {
  return { command, stdout: 'safe fixture output' };
}

export async function waitForTimelinePersistence(page: Page) {
  await expect.poll(async () => (
    await activeSessionPersistenceState(page)
  ).storedTimelineItemCount, { timeout: 20_000 }).toBeGreaterThan(0);
}
