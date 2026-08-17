import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { collectComposerArtifactMetrics } from './composer-artifact-evidence.metrics';
import type { ComposerArtifactCaptureOptions } from './composer-artifact-evidence.types';

const ROOT = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i08-responsive/composer-artifact';
const FALLBACK_RUN_ID = `diagnostic-${process.pid}`;

export async function captureComposerArtifactEvidence(
  page: Page,
  name: string,
  options: ComposerArtifactCaptureOptions,
) {
  await page.waitForTimeout(150);
  const metrics = await collectComposerArtifactMetrics(page);
  const smallTargets = metrics.primaryTargets.filter((target) => target.width < 44 || target.height < 44);
  const occludedTargets = metrics.primaryTargets.filter((target) => !target.hitTestPassed);
  const crossingRects = Object.entries(metrics.criticalRects).flatMap(([key, value]) => (
    value && (value.x < -1 || value.right > metrics.viewport.width + 1) ? [key] : []
  ));
  const popupRect = metrics.criticalRects.popup;
  const controlsRect = metrics.criticalRects.composerControls;
  const submitRect = metrics.criticalRects.composerSubmit;
  const controlsSubmitOverlap = Boolean(controlsRect && submitRect
    && Math.min(controlsRect.right, submitRect.right) - Math.max(controlsRect.x, submitRect.x) > 1
    && Math.min(controlsRect.bottom, submitRect.bottom) - Math.max(controlsRect.y, submitRect.y) > 1);
  const unownedHorizontalOverflow = Object.entries(metrics.overflowOwners).flatMap(([key, owner]) => (
    owner && owner.scrollWidth > owner.clientWidth + 1
      && !['auto', 'scroll', 'hidden', 'clip'].includes(owner.overflowX) ? [key] : []
  ));
  const expected = options.expectedState ?? {};
  const preservedState = Object.entries(expected).every(([key, value]) => (
    metrics.state[key as keyof typeof metrics.state] === value
  ));
  const paneContract = matchesPaneContract(metrics.artifact, options.expectedLayout);
  const closeSemantics = matchesCloseSemantics(metrics.artifact.closeControls, options.expectedLayout);
  const requiredRectsPresent = options.expectedLayout === 'chat'
    ? Boolean(metrics.criticalRects.composer?.width)
    : Boolean(metrics.criticalRects.artifactPanel?.width && metrics.criticalRects.artifactHeading?.width)
      && (options.expectedLayout !== 'split' || Boolean(metrics.criticalRects.composer?.width));
  const measuredLayout = options.expectedLayout !== 'split'
    || (metrics.artifact.band === 'wide' && metrics.artifact.measuredWidth >= 941);
  const invariants: Record<string, boolean> = {
    expectedBand: metrics.frameBand === options.expectedBand
      && metrics.artifact.band === options.expectedBand,
    expectedLayout: metrics.artifact.layout === options.expectedLayout,
    measuredLayout,
    paneContract,
    requiredRectsPresent,
    singleCloseSemantics: closeSemantics,
    preservedState,
    emptyTranscriptStartsAtTop: metrics.messageCount > 0 || metrics.state.chatScrollTop === 0,
    documentFitsWidth: metrics.documentScrollWidth <= metrics.documentClientWidth + 1,
    primaryTargets44: smallTargets.length === 0,
    primaryTargetsHitTest: occludedTargets.length === 0,
    composerGroupsDoNotOverlap: !controlsSubmitOverlap,
    criticalRectsContained: crossingRects.length === 0,
    popupVerticallyContained: !popupRect
      || (popupRect.y >= -1 && popupRect.bottom <= metrics.viewport.height + 1),
    horizontalOverflowOwned: unownedHorizontalOverflow.length === 0,
    bitmapCoverage: true,
    knownRectBitmapScale: true,
    noDevIndicator: metrics.nextDevVisibleSurfaces.length === 0,
    noConsoleErrors: options.diagnostics.consoleErrors.length === 0,
    noPageErrors: options.diagnostics.pageErrors.length === 0,
  };
  const info = test.info();
  const runId = process.env.SVTON_EVIDENCE_RUN_ID || FALLBACK_RUN_ID;
  const runDir = `${ROOT}/${runId}/${info.project.name}/worker-${info.workerIndex}/retry-${info.retry}`;
  await mkdir(runDir, { recursive: true });
  const jsonPath = `${runDir}/${name}.json`;
  const screenshotPath = `${runDir}/${name}.png`;
  const screenshot = await page.screenshot();
  await writeFile(screenshotPath, screenshot, { flag: 'wx' });
  const bitmap = await readPngSize(screenshotPath);
  invariants.bitmapCoverage = withinOne(bitmap.width, metrics.viewport.width * metrics.devicePixelRatio)
    && withinOne(bitmap.height, metrics.viewport.height * metrics.devicePixelRatio);
  const knownRects = await projectKnownRects(
    page,
    options.knownRectSelectors ?? [],
    bitmap,
    metrics.viewport,
  );
  if (options.zoom?.kind === 'browser-zoom') {
    invariants.knownRectBitmapScale = knownRects.length > 0 && knownRects.every((knownRect) => (
      withinOne(knownRect.bitmapSpan.width, knownRect.css.width * metrics.devicePixelRatio)
      && withinOne(knownRect.bitmapSpan.height, knownRect.css.height * metrics.devicePixelRatio)
      && knownRect.bitmapSpan.x >= 0 && knownRect.bitmapSpan.y >= 0
      && knownRect.bitmapSpan.x + knownRect.bitmapSpan.width <= bitmap.width + 1
      && knownRect.bitmapSpan.y + knownRect.bitmapSpan.height <= bitmap.height + 1
    ));
  }
  const record = {
    schemaVersion: 1, runId, scenario: name, capturedAt: new Date().toISOString(),
    project: info.project.name, workerIndex: info.workerIndex, retry: info.retry,
    browserVersion: page.context().browser()?.version() ?? 'persistent-chromium',
    evidenceKind: options.zoom?.kind ?? 'responsive', zoom: options.zoom,
    expected: { band: options.expectedBand, layout: options.expectedLayout, state: expected },
    metrics, invariants, diagnostics: options.diagnostics,
    smallTargets, occludedTargets, crossingRects, unownedHorizontalOverflow,
    bitmap, knownRects, screenshotPath,
  };
  await writeFile(jsonPath, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  await info.attach(`${name}.json`, { path: jsonPath, contentType: 'application/json' });
  await info.attach(`${name}.png`, { path: screenshotPath, contentType: 'image/png' });
  for (const [invariant, accepted] of Object.entries(invariants)) {
    expect(accepted, `${name}: ${invariant}`).toBe(true);
  }
  return record;
}

export const composerArtifactEvidenceRoot = ROOT;

function matchesPaneContract(
  artifact: Awaited<ReturnType<typeof collectComposerArtifactMetrics>>['artifact'],
  layout: ComposerArtifactCaptureOptions['expectedLayout'],
) {
  const chat = artifact.chatPane;
  const content = artifact.contentPane;
  if (layout === 'chat') {
    return chat.visible && !chat.ariaHidden && !chat.inert
      && !content.visible && content.ariaHidden && content.inert;
  }
  if (layout === 'artifact') {
    return !chat.visible && chat.ariaHidden && chat.inert
      && content.visible && !content.ariaHidden && !content.inert;
  }
  return chat.visible && !chat.ariaHidden && !chat.inert
    && content.visible && !content.ariaHidden && !content.inert;
}

function matchesCloseSemantics(labels: string[], layout: ComposerArtifactCaptureOptions['expectedLayout']) {
  if (layout === 'chat') return labels.length === 0;
  const expected = layout === 'artifact' ? '返回对话并关闭内容面板' : '关闭内容面板';
  return labels.length === 1 && labels[0] === expected;
}

async function projectKnownRects(
  page: Page,
  selectors: string[],
  bitmap: { width: number; height: number },
  viewport: { width: number; height: number },
) {
  const boxes = await page.evaluate((requested) => requested.map((selector) => {
    const box = document.querySelector(selector)?.getBoundingClientRect();
    return box && box.width > 0 && box.height > 0 ? {
      x: box.x, y: box.y, width: box.width, height: box.height,
    } : null;
  }), selectors);
  return selectors.map((selector, index) => {
    const box = boxes[index];
    if (!box) throw new Error(`${selector} is not visible for bitmap projection`);
    const scaleX = bitmap.width / viewport.width;
    const scaleY = bitmap.height / viewport.height;
    return {
      selector, css: box,
      bitmapSpan: {
        x: box.x * scaleX, y: box.y * scaleY,
        width: box.width * scaleX, height: box.height * scaleY,
      },
    };
  });
}

async function readPngSize(path: string) {
  const bytes = await readFile(path);
  if (bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function withinOne(actual: number, expected: number) {
  return Math.abs(actual - expected) <= 1;
}
