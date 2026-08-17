import { expect, test } from '@playwright/test';
import { appReady, seedE2e } from './helpers';
import { captureResponsiveEvidence, installBrowserDiagnostics } from './responsive-evidence.helpers';

test('DPR 2 remains separately labeled and makes no browser zoom claim', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const diagnostics = installBrowserDiagnostics(page);
  await seedE2e(page);
  await appReady(page);
  await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBe(2);
  await captureResponsiveEvidence(page, 'web-390-dpr2', {
    expectedBand: 'compact', zoom: { kind: 'dpr' }, diagnostics,
  });
  await context.close();
});
