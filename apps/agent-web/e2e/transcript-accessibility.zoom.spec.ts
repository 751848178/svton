import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launchActualZoomPage } from './actual-browser-zoom.helpers';
import { seedE2e } from './helpers';
import {
  captureTranscriptEvidence,
  dispatchTranscriptState,
  installErrorHashes,
} from './transcript-accessibility.evidence';

test('I08.3a transcript reflows under actual Chromium 200% browser zoom', async ({}, info) => {
  const userDataDir = await mkdtemp(join(tmpdir(), 'svton-i083a-zoom-'));
  const zoom = await launchActualZoomPage(userDataDir);
  try {
    const errors = installErrorHashes(zoom.page);
    await seedE2e(zoom.page, undefined, { memoryDisabled: true });
    await zoom.page.goto('/e2e/transcript-accessibility');
    await zoom.page.getByTestId('transcript-accessibility-fixture').waitFor();
    const extension = await zoom.setZoom();
    expect(extension.ok).toBe(true);
    expect(extension.actualFactor).toBe(2);
    expect(extension.settings).toMatchObject({ mode: 'automatic', scope: 'per-tab' });
    await expect.poll(() => zoom.page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
      .toEqual({ width: 640, height: 450 });
    const cdpCssVisualViewportZoom = await zoom.readCdpZoom();
    expect(cdpCssVisualViewportZoom).toBe(2);
    await expect.poll(() => zoom.page.evaluate(() => visualViewport?.scale ?? null)).toBe(1);
    await dispatchTranscriptState(zoom.page, 'start-completed');
    await expect(zoom.page.getByTestId('chat-status-announcer'))
      .toHaveAttribute('data-announcement-sink', 'polite');
    await captureTranscriptEvidence(zoom.page, info, 'actual-browser-zoom-200', {
      errors,
      expectedLiveOwners: 1,
      expectedReducedMotion: 'no-preference',
      actualZoom: { requested: 2, extension, cdpCssVisualViewportZoom },
    });
  } finally {
    await zoom.cleanup();
  }
});
