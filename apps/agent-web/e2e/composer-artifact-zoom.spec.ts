import { expect, test, type Page } from '@playwright/test';
import { launchActualZoomPage } from './actual-browser-zoom.helpers';
import { captureComposerArtifactEvidence } from './composer-artifact-evidence.helpers';
import { appReady, enqueueResponses, lastAssistant, responses, seedE2e, send } from './helpers';
import { installBrowserDiagnostics } from './responsive-evidence.helpers';

const ARTIFACT_RESPONSE = "```js\nconsole.log('actual zoom artifact')\n```";

test('actual 200 percent browser zoom keeps composer and artifact in measured single-pane contracts', async ({}, testInfo) => {
  const zoom = await launchActualZoomPage(testInfo.outputPath('composer-artifact-zoom-profile'));
  try {
    const page = zoom.page;
    const diagnostics = installBrowserDiagnostics(page);
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);
    expect(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
      .toEqual({ width: 1280, height: 900 });
    const command = await zoom.setZoom();
    expect(command).toMatchObject({
      ok: true, requestedFactor: 2, actualFactor: 2,
      settings: { mode: 'automatic', scope: 'per-tab' },
    });
    await expect.poll(() => page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
      .toEqual({ width: 640, height: 450 });
    const cdpZoom = await zoom.readCdpZoom();
    expect(cdpZoom).toBe(2);
    await expect.poll(() => page.evaluate(() => visualViewport?.scale)).toBe(1);
    const evidence = {
      kind: 'browser-zoom' as const, requested: 2, extension: command,
      cdpCssVisualViewportZoom: cdpZoom,
    };

    await attachTextFile(page, 'actual-zoom.txt', 'actual zoom attachment');
    await page.getByTestId('chat-input').fill('/he');
    await expect(page.getByRole('listbox')).toBeVisible();
    await waitForLayout(page, 'medium', 'chat');
    await captureComposerArtifactEvidence(page, 'actual-zoom-200-composer', {
      expectedBand: 'medium', expectedLayout: 'chat', diagnostics, zoom: evidence,
      knownRectSelectors: ['[data-testid="composer-surface"]', '[role="listbox"]'],
      expectedState: { composerValue: '/he', attachmentCount: 1, popupVisible: true },
    });

    await page.getByTestId('chat-input').fill('');
    await enqueueResponses(page, [responses.text(ARTIFACT_RESPONSE)]);
    await send(page, 'open artifact at actual zoom');
    const opener = lastAssistant(page).getByRole('button', { name: 'Open content panel: js', exact: true });
    await expect(opener).toBeVisible({ timeout: 20_000 });
    await opener.click();
    await waitForLayout(page, 'medium', 'artifact');
    await captureComposerArtifactEvidence(page, 'actual-zoom-200-artifact-single', {
      expectedBand: 'medium', expectedLayout: 'artifact', diagnostics, zoom: evidence,
      knownRectSelectors: ['[data-artifact-heading]', '[aria-label="返回对话并关闭内容面板"]'],
      expectedState: { selectedTab: '预览', focusPane: 'artifact', popupVisible: false },
    });
  } finally {
    await zoom.cleanup();
  }
});

async function waitForLayout(page: Page, band: string, layout: string) {
  const host = page.locator('[data-responsive-artifact-host]');
  await expect(host).toHaveAttribute('data-artifact-band', band);
  await expect(host).toHaveAttribute('data-artifact-layout', layout);
  if (layout !== 'chat') await expect(page.locator('[data-artifact-heading]')).toHaveCount(1);
}

async function attachTextFile(page: Page, name: string, text: string) {
  await page.getByRole('button', { name: '添加附件' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: '引用文件' }).click();
  await (await chooser).setFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
}
