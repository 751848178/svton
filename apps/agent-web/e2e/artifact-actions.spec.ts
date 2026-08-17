import { expect, test, type Page } from '@playwright/test';
import { appReady, enqueueResponses, lastAssistant, responses, seedE2e, send } from './helpers';

const SHOTS = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i06-artifacts/screenshots';
const response = "```js\nconsole.log('original')\n```";

async function openCodeArtifact(page: Page) {
  await enqueueResponses(page, [responses.text(response)]);
  await send(page, 'generate an artifact preview');
  const assistant = lastAssistant(page);
  await expect(assistant.getByText("console.log('original')")).toBeVisible({ timeout: 20_000 });
  const opener = assistant.getByRole('button', { name: 'Open content panel: js', exact: true });
  await opener.click();
  const panel = page.getByRole('region', { name: '内容面板' });
  await expect(panel).toBeVisible();
  return { opener, panel };
}

test.describe('artifact actions real-browser contract', () => {
  test('desktop edits, previews, exports, saves, and closes the current draft', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);
    const { panel } = await openCodeArtifact(page);
    expect((await panel.boundingBox())?.width).toBeGreaterThan(450);
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await panel.getByRole('tab', { name: '编辑' }).click();
    const editor = panel.getByRole('textbox');
    await editor.fill("console.log('edited desktop draft')");
    await expect(panel.getByRole('button', { name: '保存草稿' })).toBeEnabled();
    await panel.getByRole('tab', { name: '预览' }).click();
    await expect(panel.getByTitle('Code preview')).toHaveAttribute('srcdoc', /edited desktop draft/);
    await panel.getByRole('tab', { name: '编辑' }).click();

    const downloadPromise = page.waitForEvent('download');
    await panel.getByRole('button', { name: '另存为' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('js-line-1.js');
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString('utf8')).toBe("console.log('edited desktop draft')");

    await panel.getByRole('button', { name: '保存草稿' }).click();
    await expect(panel.getByText('已保存到当前会话', { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: '保存草稿' })).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}/desktop-artifact-saved-1280x800.png` });
    await panel
      .getByRole('button', { name: '关闭内容面板', exact: true })
      .click();
    await expect(panel).toHaveCount(0);
  });

  test('mobile uses a full-width panel, traps dirty confirmation, and restores opener focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);
    const { opener, panel } = await openCodeArtifact(page);
    expect((await panel.boundingBox())?.width).toBeGreaterThan(320);
    await expect(page.getByTestId('chat-input')).toBeHidden();
    await panel.getByRole('tab', { name: '编辑' }).click();
    await panel.getByRole('textbox').fill("console.log('edited mobile draft')");
    await panel.getByRole('tab', { name: '预览' }).click();
    await expect(panel.getByTitle('Code preview')).toHaveAttribute('srcdoc', /edited mobile draft/);
    await page.screenshot({ path: `${SHOTS}/mobile-artifact-preview-390x844.png` });

    const close = panel.getByRole('button', {
      name: '返回对话并关闭内容面板',
      exact: true,
    });
    await close.click();
    const dialog = page.getByRole('alertdialog', { name: '放弃未保存更改？' });
    await expect(dialog).toBeVisible();
    const cancel = dialog.getByRole('button', { name: '继续编辑' });
    const discard = dialog.getByRole('button', { name: '放弃更改' });
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(discard).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();
    await page.screenshot({ path: `${SHOTS}/mobile-artifact-dirty-dialog-390x844.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(close).toBeFocused();

    await close.click();
    await dialog.getByRole('button', { name: '放弃更改' }).click();
    await expect(panel).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect(page.getByTestId('chat-input')).toBeVisible();
  });

  test('reference targets preserve locations and expose Web capability failures and dismissible status', async ({ page }) => {
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);
    const localPath = '/workspace/packages/a/same-name.ts';
    await enqueueResponses(page, [
      responses.toolCall('file_read', { path: localPath, offset: 42, content: 'line 42' }),
      responses.text('Reference ready.'),
    ]);
    await send(page, 'produce a local reference artifact');
    const localAssistant = lastAssistant(page);
    await expect(localAssistant).toContainText('Reference ready.', { timeout: 20_000 });
    await localAssistant.getByRole('button', { name: /^Processed\b/ }).click();
    await localAssistant.getByTitle(localPath).click();
    let panel = page.getByRole('region', { name: '内容面板' });
    await expect(panel).toContainText(`${localPath}:42`);
    await expect(panel.getByRole('button', { name: '在主机中打开' })).toBeDisabled();
    await expect(panel).toContainText('Web 主机不能直接打开本地路径');
    await panel
      .getByRole('button', {
        name: /^(返回对话并关闭内容面板|关闭内容面板)$/,
      })
      .click();
    const status = page.locator('[data-artifact-host-status]');
    await expect(status).toContainText('已关闭内容面板');
    await status.getByRole('button', { name: '关闭提示' }).click();
    await expect(status).toHaveCount(0);
    await expect(page.getByTestId('chat-input')).toBeVisible();

    await enqueueResponses(page, [
      responses.toolCall('file_read', { path: 'https://example.test/source.ts', offset: 7 }),
      responses.text('URL reference ready.'),
    ]);
    await send(page, 'produce a URL reference artifact');
    const urlAssistant = lastAssistant(page);
    await expect(urlAssistant).toContainText('URL reference ready.', { timeout: 20_000 });
    await urlAssistant.getByRole('button', { name: /^Processed\b/ }).click();
    await urlAssistant.getByTitle('https://example.test/source.ts').click();
    panel = page.getByRole('region', { name: '内容面板' });
    await expect(panel).toContainText('https://example.test/source.ts:7');
    await page.evaluate(() => { window.open = () => null; });
    await panel.getByRole('button', { name: '在主机中打开' }).click();
    await expect(panel).toContainText('浏览器阻止了新窗口');
    await page.screenshot({ path: `${SHOTS}/web-reference-capability-failure-1280x800.png` });
  });
});
