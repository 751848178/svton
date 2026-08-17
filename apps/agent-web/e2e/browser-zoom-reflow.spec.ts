import { expect, test } from '@playwright/test';
import { launchActualZoomPage } from './actual-browser-zoom.helpers';
import { appReady, enqueueResponses, lastAssistant, responses, seedE2e, send } from './helpers';
import { captureResponsiveEvidence, installBrowserDiagnostics } from './responsive-evidence.helpers';

test('actual 200 percent per-tab browser zoom preserves populated frame and Settings', async ({}, testInfo) => {
  const zoom = await launchActualZoomPage(testInfo.outputPath('browser-zoom-profile'));
  try {
    const diagnostics = installBrowserDiagnostics(zoom.page);
    await seedE2e(zoom.page);
    await appReady(zoom.page);
    await enqueueResponses(zoom.page, [responses.text('Actual zoom evidence response')]);
    await send(zoom.page, 'Populate actual browser zoom evidence');
    await expect(lastAssistant(zoom.page)).toContainText('Actual zoom evidence response');
    const baseline = await zoom.page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    expect(baseline).toEqual({ width: 1280, height: 900 });
    await captureResponsiveEvidence(zoom.page, 'web-browser-zoom-baseline-populated', { expectedBand: 'wide', diagnostics });

    const command = await zoom.setZoom();
    expect(command).toMatchObject({
      ok: true, requestedFactor: 2, actualFactor: 2,
      settings: { mode: 'automatic', scope: 'per-tab' },
    });
    expect(command.tabId).toEqual(expect.any(Number));
    expect(command.observedUrl?.startsWith('http://localhost:3210/')).toBe(true);
    await expect.poll(() => zoom.page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
      .toEqual({ width: 640, height: 450 });
    const cdpZoom = await zoom.readCdpZoom();
    expect(cdpZoom).toBe(2);
    await expect.poll(() => zoom.page.evaluate(() => visualViewport?.scale)).toBe(1);
    const evidence = { kind: 'browser-zoom' as const, requested: 2, extension: command, cdpCssVisualViewportZoom: cdpZoom };
    await captureResponsiveEvidence(zoom.page, 'web-actual-browser-zoom-200-frame', {
      expectedBand: 'medium', zoom: evidence,
      knownRectSelectors: ['[aria-label="打开对话导航"]', '[data-testid="send-button"]'],
      diagnostics,
    });

    await zoom.page.getByRole('button', { name: '打开对话导航' }).click();
    await zoom.page.getByRole('dialog', { name: 'Svton', exact: true })
      .getByRole('button', { name: '设置', exact: true }).click();
    await expect(zoom.page.getByTestId('settings-shell')).toBeVisible();
    await expect(zoom.page.getByRole('combobox', { name: '设置类别' })).toHaveCount(1);
    await expect(zoom.page.locator('[data-responsive-frame-toolbar]')).toHaveCount(0);
    await captureResponsiveEvidence(zoom.page, 'web-actual-browser-zoom-200-settings', {
      expectedBand: 'medium', zoom: evidence,
      knownRectSelectors: ['select[aria-label="设置类别"]'],
      diagnostics,
    });
  } finally {
    await zoom.cleanup();
  }
});
