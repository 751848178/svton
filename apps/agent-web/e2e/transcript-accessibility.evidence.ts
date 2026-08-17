import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { source as axeSource } from 'axe-core';
import {
  SYNTHETIC_ANSWER_MARKER,
  SYNTHETIC_COMMAND_MARKER,
  SYNTHETIC_FAILURE_MARKER,
  SYNTHETIC_TOOL_MARKER,
  TRANSCRIPT_FIXTURE_EVENT,
  type TranscriptFixtureStateId,
} from '../src/components/transcript-accessibility-fixture.data';
const ROOT = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i08-responsive/transcript-accessibility';
const RUN_ID = process.env.SVTON_I08_3A_EVIDENCE_RUN_ID ?? `diagnostic-${process.pid}`;
const MARKERS = [SYNTHETIC_FAILURE_MARKER, SYNTHETIC_COMMAND_MARKER, SYNTHETIC_TOOL_MARKER, SYNTHETIC_ANSWER_MARKER];

export interface BrowserErrorHashes {
  console: string[];
  page: string[];
}
export function installErrorHashes(page: Page): BrowserErrorHashes {
  const errors: BrowserErrorHashes = { console: [], page: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(hash(message.text()));
  });
  page.on('pageerror', (error) => errors.page.push(hash(error.message)));
  return errors;
}
export async function dispatchTranscriptState(page: Page, stateId: TranscriptFixtureStateId) {
  await page.evaluate(({ eventName, nextState }) => {
    window.dispatchEvent(new CustomEvent(eventName, { detail: nextState }));
  }, { eventName: TRANSCRIPT_FIXTURE_EVENT, nextState: stateId });
  await expect(page.getByTestId('transcript-accessibility-fixture')).toHaveAttribute('data-state-id', stateId);
}
export async function captureTranscriptEvidence(page: Page, info: TestInfo, name: string, options: {
  errors: BrowserErrorHashes;
  expectedLiveOwners: number;
  actualZoom?: Record<string, unknown>;
  interaction?: Record<string, unknown>;
  expectedTargets?: string[];
  expectedReducedMotion?: 'reduce' | 'no-preference';
}) {
  await settleLayout(page);
  const metrics = await collectMetrics(page);
  const accessibility = await targetedAxe(page);
  const directory = `${ROOT}/${RUN_ID}/${info.project.name}/worker-${info.workerIndex}/retry-${info.retry}`;
  await mkdir(directory, { recursive: true });
  const screenshotPath = `${directory}/${name}.png`;
  const jsonPath = `${directory}/${name}.json`;
  const screenshot = await page.screenshot({ fullPage: false });
  await writeFile(screenshotPath, screenshot, { flag: 'wx' });
  const bitmap = await pngSize(screenshotPath);
  const invariants = {
    stateStable: metrics.stateId !== null,
    oneTranscript: metrics.logCount === 1,
    articleSemantics: metrics.articleCount > 0 && metrics.articleLiveOffCount === metrics.articleCount,
    oneTransitionOwner: metrics.liveOwners.length === options.expectedLiveOwners,
    transitionOwnerIdentity: options.expectedLiveOwners === 0
      ? metrics.liveOwners.length === 0
      : metrics.liveOwners.length === 1 && metrics.liveOwners[0]?.testId === 'chat-status-announcer',
    syntheticPayloadExcluded: metrics.syntheticExclusion.every(Boolean),
    visibleFailurePreserved: metrics.stateId !== 'settle-failed' || metrics.visibleFailureDetail,
    targetCoverage: (options.expectedTargets ?? ['[data-message-actions] button'])
      .every((selector) => metrics.targetRects.some((target) => target.selector === selector)),
    targets44: metrics.targetRects.length > 0
      && metrics.targetRects.every((target) => target.width >= 44 && target.height >= 44),
    motionContract: !options.expectedReducedMotion || (metrics.motion
      ? options.expectedReducedMotion === 'reduce'
        ? durationMs(metrics.motion.duration) <= 0.01 && iterationCount(metrics.motion.iterations) <= 1
        : durationMs(metrics.motion.duration) > 0.01 && iterationCount(metrics.motion.iterations) > 1
      : false),
    documentFitsWidth: metrics.documentScrollWidth <= metrics.documentClientWidth + 1,
    sharedIconsOnly: metrics.nonSharedVisibleSvgCount === 0,
    noVisibleStateGlyphs: metrics.visibleStateGlyphCount === 0,
    noSeriousCriticalAxe: accessibility.length === 0,
    noConsoleErrors: options.errors.console.length === 0,
    noPageErrors: options.errors.page.length === 0,
    bitmapMatchesViewport: near(bitmap.width, metrics.viewport.width * metrics.devicePixelRatio)
      && near(bitmap.height, metrics.viewport.height * metrics.devicePixelRatio),
  };
  const record = {
    schemaVersion: 1, runId: RUN_ID, scenario: name, capturedAt: new Date().toISOString(),
    project: info.project.name, workerIndex: info.workerIndex, retry: info.retry,
    browserVersion: page.context().browser()?.version() ?? 'persistent-chromium',
    markerHashes: MARKERS.map(hash), metrics, accessibility, invariants,
    errors: options.errors, actualZoom: options.actualZoom, interaction: options.interaction,
    bitmap, screenshotPath,
  };
  await writeFile(jsonPath, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  await info.attach(`${name}.json`, { path: jsonPath, contentType: 'application/json' });
  await info.attach(`${name}.png`, { path: screenshotPath, contentType: 'image/png' });
  expect(Object.values(invariants).every(Boolean), `${name} transcript invariants`).toBe(true);
  return record;
}
async function collectMetrics(page: Page) {
  return page.evaluate(async (markers) => {
    const rect = (node: Element | null) => {
      const box = node?.getBoundingClientRect();
      return box ? { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom } : null;
    };
    const visible = (node: Element) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const targetSelectors = [
      '[data-message-actions] button', '[data-testid="code-copy-action"]',
      '.svton-image-result-prompt-btn', '.svton-image-result-download-btn',
      '[data-testid="thinking-toggle"]', '[data-testid="timeline-process"] > button',
    ];
    const targetRects = targetSelectors.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector))
      .map((node) => ({ node, box: node.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0)
      .map(({ box }, index) => ({ selector, index, width: box.width, height: box.height })));
    const announcer = document.querySelector<HTMLElement>('[data-testid="chat-status-announcer"]');
    const liveText = announcer?.textContent ?? '';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(liveText));
    const explicitOwners = Array.from(document.querySelectorAll<HTMLElement>('[aria-live="polite"], [aria-live="assertive"]'));
    const implicitOwners = Array.from(document.querySelectorAll<HTMLElement>('[role="status"], [role="alert"]'))
      .filter((node) => !node.closest('[role="dialog"], [role="alertdialog"]'));
    const liveOwners = [...new Set([...explicitOwners, ...implicitOwners])].map((node) => ({
      testId: node.dataset.testid ?? null, live: node.getAttribute('aria-live'),
      role: node.getAttribute('role'), eventKey: node.dataset.announcementEventKey ?? null,
      sink: node.dataset.announcementSink ?? null,
    }));
    const excluded = markers.map((marker) => !liveText.includes(marker));
    const glyph = /[\u2713\u2717\u25cf\u00d7\u26a0\u2193\u25cb\u25c7\u25be\u25b8\u25b4]|[\u{1F300}-\u{1FAFF}]/u;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let visibleStateGlyphCount = 0;
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (parent && !parent.closest('pre, code, kbd, script, style') && visible(parent) && glyph.test(walker.currentNode.textContent ?? '')) visibleStateGlyphCount += 1;
    }
    const active = document.activeElement as HTMLElement | null;
    const motionNode = document.querySelector<HTMLElement>('[data-svton-shimmer-label], .animate-pulse');
    const motion = motionNode ? getComputedStyle(motionNode) : null;
    return {
      stateId: document.querySelector('[data-testid="transcript-accessibility-fixture"]')?.getAttribute('data-state-id') ?? null,
      viewport: { width: innerWidth, height: innerHeight }, devicePixelRatio,
      visualViewport: visualViewport ? { width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale } : null,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference',
      locale: { document: document.documentElement.lang, browser: navigator.language },
      theme: document.documentElement.dataset.theme ?? 'dark-default',
      logCount: document.querySelectorAll('[role="log"]').length,
      articleCount: document.querySelectorAll('[role="log"] article').length,
      articleLiveOffCount: document.querySelectorAll('[role="log"] article[aria-live="off"]').length,
      liveOwners, announcerTextSha256: Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join(''),
      syntheticExclusion: excluded,
      visibleFailureDetail: Array.from(document.querySelectorAll<HTMLElement>('[data-testid="message-error"]')).some((node) => visible(node) && Boolean(node.textContent?.trim())) || Array.from(document.querySelectorAll<HTMLElement>('[data-timeline-status="failed"]')).some((owner) => Array.from(owner.querySelectorAll<HTMLElement>('[data-testid="command-stderr"], [data-testid="command-exit-code"]')).some((node) => visible(node) && Boolean(node.textContent?.trim()))),
      targetRects, activeElement: active ? { tag: active.tagName, testId: active.dataset.testid ?? null, label: active.getAttribute('aria-label') } : null,
      inertOwnerCount: document.querySelectorAll('[inert]').length,
      transcriptRect: rect(document.querySelector('[role="log"]')),
      documentClientWidth: document.documentElement.clientWidth, documentScrollWidth: document.documentElement.scrollWidth,
      documentScroll: { x: scrollX, y: scrollY, height: document.documentElement.scrollHeight, clientHeight: document.documentElement.clientHeight },
      transcriptScroll: (() => {
        const log = document.querySelector<HTMLElement>('[role="log"]');
        return log ? { top: log.scrollTop, height: log.scrollHeight, clientHeight: log.clientHeight } : null;
      })(),
      nonSharedVisibleSvgCount: Array.from(document.querySelectorAll('svg')).filter((node) => visible(node) && !node.classList.contains('lucide')).length,
      visibleStateGlyphCount,
      motion: motion ? { duration: motion.animationDuration, iterations: motion.animationIterationCount } : null,
    };
  }, MARKERS);
}

async function targetedAxe(page: Page) {
  if (!await page.evaluate(() => Boolean((window as unknown as { axe?: unknown }).axe))) await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (root: Element, options: unknown) => Promise<{ violations: Array<{ id: string; impact: string | null; nodes: unknown[] }> }> } }).axe;
    const root = document.querySelector('[data-testid="transcript-accessibility-fixture"]');
    if (!root) throw new Error('Transcript fixture missing');
    const result = await axe.run(root, { resultTypes: ['violations'] });
    return result.violations.filter((entry) => entry.impact === 'serious' || entry.impact === 'critical')
      .map((entry) => ({ id: entry.id, impact: entry.impact, nodeCount: entry.nodes.length }));
  });
}

async function pngSize(path: string) {
  const bytes = await readFile(path);
  if (bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error('Evidence screenshot is not PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function near(actual: number, expected: number) { return Math.abs(actual - expected) <= 1; }
function durationMs(value: string) {
  return Math.max(...value.split(',').map((part) => {
    const parsed = Number.parseFloat(part);
    return part.trim().endsWith('ms') ? parsed : parsed * 1000;
  }));
}
function iterationCount(value: string) {
  return Math.max(...value.split(',').map((part) => part.trim() === 'infinite'
    ? Number.POSITIVE_INFINITY : Number.parseFloat(part)));
}
async function settleLayout(page: Page) {
  await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
export const transcriptEvidenceRoot = ROOT;
