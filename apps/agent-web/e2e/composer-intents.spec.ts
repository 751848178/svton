import { expect, test, type Page } from '@playwright/test';
import {
  appReady,
  enqueueResponses,
  enqueueResponsesForPrompt,
  lastAssistant,
  responses,
  seedE2e,
  send,
} from './helpers';

const SHOTS = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i06-composer-intents/screenshots';
const HELP_PROMPT = '请帮我了解你可以做什么，有哪些能力和工具';

test.describe('typed composer intents', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);
  });

  test('click and keyboard slash paths are one-shot; unsupported actions are visible', async ({ page }) => {
    await enqueueResponsesForPrompt(page, HELP_PROMPT, [responses.text('click help done')]);
    await page.getByTestId('chat-input').fill('/he');
    await page.getByRole('option', { name: /\/help/ }).click();
    await expect(lastAssistant(page)).toContainText('click help done', { timeout: 20_000 });

    await enqueueResponsesForPrompt(page, HELP_PROMPT, [responses.text('keyboard help done')]);
    await page.getByTestId('chat-input').fill('/he');
    await page.getByTestId('chat-input').press('Enter');
    await expect(lastAssistant(page)).toContainText('keyboard help done', { timeout: 20_000 });
    await expect(page.getByTestId('message-user').filter({ hasText: HELP_PROMPT })).toHaveCount(2);

    const beforeUnsupported = await page.getByTestId('message-user').count();
    await page.getByTestId('chat-input').fill('/ag');
    await page.getByRole('option', { name: /\/agent/ }).click();
    await expect(page.getByTestId('composer-status')).toContainText('尚未提供 Agent 定义切换');
    await expect(page.getByTestId('chat-input')).toHaveValue('/ag');
    expect(await page.getByTestId('message-user').count()).toBe(beforeUnsupported);

    const actionPrompt = 'show unsupported assistant action';
    await enqueueResponsesForPrompt(page, actionPrompt, [responses.text('[Deploy](action:deploy)')]);
    await send(page, actionPrompt);
    await expect(lastAssistant(page).getByRole('button', { name: 'Deploy' })).toBeDisabled({ timeout: 20_000 });
    await expect(lastAssistant(page)).toContainText('未在当前客户端注册');
    await page.screenshot({ path: `${SHOTS}/composer-commands-1280x800.png`, fullPage: true });
  });

  test('busy send preserves the exact draft until stop', async ({ page }) => {
    await send(page, 'keep this turn running');
    await expect(page.getByTestId('stop-button')).toBeVisible({ timeout: 20_000 });
    const composer = page.getByTestId('chat-input');
    await composer.fill('draft must survive');
    await composer.press('Enter');
    await expect(composer).toHaveValue('draft must survive');
    await expect(page.getByTestId('composer-status')).toContainText('草稿和附件已保留');
    await page.getByTestId('stop-button').click();
    await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 20_000 });
  });

  test('file selection never sends, remains removable, and sends structured metadata only', async ({ page }) => {
    await attachTextFile(page, 'same.ts', 'const privateSource = 42;');
    expect(await page.getByTestId('message-user').count()).toBe(0);
    await expect(page.getByLabel('草稿附件')).toContainText('same.ts');
    await expect(page.getByLabel('草稿附件')).toContainText('本地文件');
    await expect(page.getByLabel('草稿附件')).not.toContainText('browser-file://');
    await page.getByRole('button', { name: '移除附件 same.ts' }).click();
    await expect(page.getByLabel('草稿附件')).toHaveCount(0);

    await attachTextFile(page, 'same.ts', 'const privateSource = 42;');
    await enqueueResponses(page, [responses.text('structured file received')]);
    await page.getByTestId('chat-input').fill('review attached file');
    await page.getByTestId('send-button').click();
    await expect(lastAssistant(page)).toContainText('structured file received', { timeout: 20_000 });
    const sent = page.getByTestId('message-user').last();
    await expect(sent).toContainText('review attached file');
    await expect(sent).toContainText('same.ts');
    await expect(sent).toContainText('本地文件');
    await expect(sent).not.toContainText('browser-file://');
    await expect(sent).not.toContainText('privateSource');

    await enqueueResponses(page, [responses.text('structured mention received')]);
    await page.getByTestId('chat-input').fill('@');
    await page.getByRole('option').first().click();
    const mentionPath = await page.getByLabel('草稿附件').locator('[data-attachment-path]').first().getAttribute('data-attachment-path');
    expect(mentionPath).toBeTruthy();
    await page.getByTestId('send-button').click();
    await expect(lastAssistant(page)).toContainText('structured mention received', { timeout: 20_000 });
    await expect(page.getByTestId('message-user').last()).toContainText(mentionPath!);
    await page.screenshot({ path: `${SHOTS}/composer-attachments-1280x800.png`, fullPage: true });
  });
});

test('390x844 composer keeps attachment controls touch-sized', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedE2e(page, undefined, { memoryDisabled: true });
  await appReady(page);
  await attachTextFile(page, 'mobile.txt', 'mobile evidence');
  const add = page.getByRole('button', { name: '添加附件' });
  const remove = page.getByRole('button', { name: '移除附件 mobile.txt' });
  expect((await add.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await remove.boundingBox())?.height).toBeGreaterThanOrEqual(36);
  await page.screenshot({ path: `${SHOTS}/composer-attachments-390x844.png`, fullPage: true });
});

async function attachTextFile(page: Page, name: string, text: string): Promise<void> {
  await page.getByRole('button', { name: '添加附件' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: '引用文件' }).click();
  await (await chooser).setFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
}
