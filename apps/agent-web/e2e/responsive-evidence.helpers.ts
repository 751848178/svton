import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const ROOT = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i08-responsive/frame-settings';
const FALLBACK_RUN_ID = `diagnostic-${process.pid}`;

export interface ZoomEvidence {
  kind: 'browser-zoom' | 'dpr';
  requested?: number;
  extension?: unknown;
  cdpCssVisualViewportZoom?: number;
}

export interface BrowserDiagnostics {
  consoleErrors: string[];
  pageErrors: string[];
}

export function installBrowserDiagnostics(page: Page): BrowserDiagnostics {
  const diagnostics: BrowserDiagnostics = { consoleErrors: [], pageErrors: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
  return diagnostics;
}

export async function captureResponsiveEvidence(page: Page, name: string, options: {
  expectedBand: 'compact' | 'medium' | 'wide';
  zoom?: ZoomEvidence;
  knownRectSelectors?: string[];
  diagnostics: BrowserDiagnostics;
}) {
  await page.waitForTimeout(150);
  const metrics = await page.evaluate(() => {
    const nextDevVisibleSurfaces: Array<{ tag: string; role: string | null; label: string | null; text: string; width: number; height: number }> = [];
    const scanNextDevTree = (root: Document | ShadowRoot | Element) => {
      for (const node of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
        if (node.shadowRoot) scanNextDevTree(node.shadowRoot);
        if (!node.matches('button, [role="dialog"], [role="alertdialog"]')) continue;
        const box = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        if (box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') {
          nextDevVisibleSurfaces.push({
            tag: node.tagName,
            role: node.getAttribute('role'),
            label: node.getAttribute('aria-label'),
            text: (node.textContent || '').trim().slice(0, 120),
            width: box.width,
            height: box.height,
          });
        }
      }
    };
    const nextDevPortals = Array.from(document.querySelectorAll('nextjs-portal'));
    nextDevPortals.forEach((portal) => { if (portal.shadowRoot) scanNextDevTree(portal.shadowRoot); });
    const targetSizes = Array.from(document.querySelectorAll<HTMLElement>('button, select, input'))
      .filter((node) => node.getBoundingClientRect().width > 0)
      .map((node) => {
        const raw = node.getBoundingClientRect();
        const label = node.matches('input[type="checkbox"], input[type="radio"]')
          ? node.closest('label') : null;
        const effective = label?.getBoundingClientRect() ?? raw;
        return {
          name: node.getAttribute('aria-label') || label?.textContent?.trim() || node.textContent?.trim() || node.tagName,
          width: effective.width, height: effective.height,
          rawWidth: raw.width, rawHeight: raw.height,
          effectiveOwner: label ? 'label' : 'control',
        };
      });
    const rect = (node: Element | null) => {
      const box = node?.getBoundingClientRect();
      return box ? { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom } : null;
    };
    const criticalRects = {
      frame: rect(document.querySelector('[data-testid="responsive-agent-frame"]')),
      frameToolbar: rect(document.querySelector('[data-responsive-frame-toolbar]')),
      frameContent: rect(document.querySelector('[data-responsive-frame-content]')),
      sidebar: rect(document.querySelector('[data-sidebar-content]')),
      settingsShell: rect(document.querySelector('[data-testid="settings-shell"]')),
      settingsMain: rect(document.querySelector('[data-testid="settings-shell"] main')),
      composer: rect(document.querySelector('[data-testid="chat-input"]')?.parentElement?.parentElement ?? null),
      chatInput: rect(document.querySelector('[data-testid="chat-input"]')),
      userMessage: rect(document.querySelector('[data-testid="message-user"]')),
      userBubble: rect(document.querySelector('[data-testid="message-user"]')?.firstElementChild ?? null),
      assistantMessage: rect(document.querySelector('[data-testid="message-assistant"]')),
      transcript: rect(document.querySelector('[data-testid="message-assistant"]')?.parentElement ?? null),
      sessionMenu: rect(document.querySelector('[role="menu"]')),
    };
    const overflow = (node: HTMLElement | null) => node ? ({
      clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
      clientHeight: node.clientHeight, scrollHeight: node.scrollHeight,
      overflowX: getComputedStyle(node).overflowX, overflowY: getComputedStyle(node).overflowY,
    }) : null;
    const overflowOwners = {
      documentElement: overflow(document.documentElement),
      frame: overflow(document.querySelector('[data-testid="responsive-agent-frame"]')),
      frameContent: overflow(document.querySelector('[data-responsive-frame-content]')),
      sidebar: overflow(document.querySelector('[data-sidebar-content]')),
      settingsShell: overflow(document.querySelector('[data-testid="settings-shell"]')),
      settingsMain: overflow(document.querySelector('[data-testid="settings-shell"] main')),
    };
    return {
      viewport: { width: innerWidth, height: innerHeight }, devicePixelRatio,
      locale: { document: document.documentElement.lang, browser: navigator.language },
      environment: { userAgent: navigator.userAgent, platform: navigator.platform },
      visualViewport: visualViewport ? { width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale, offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop } : null,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientHeight: document.documentElement.clientHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      frameBand: document.querySelector('[data-responsive-band]')?.getAttribute('data-responsive-band'),
      persistentSidebars: document.querySelectorAll('[data-responsive-sidebar="persistent"]').length,
      drawerSidebars: document.querySelectorAll('[data-responsive-sidebar="drawer"]').length,
      frameToolbars: document.querySelectorAll('[data-responsive-frame-toolbar]').length,
      settingsShells: document.querySelectorAll('[data-testid="settings-shell"]').length,
      settingsSelects: document.querySelectorAll('select[aria-label="设置类别"]').length,
      settingsNavs: document.querySelectorAll('nav[aria-label="设置类别"]').length,
      mcpServerRows: Array.from(document.querySelectorAll('p')).filter((node) => node.textContent?.startsWith('evidence-server-')).length,
      nextDevPortalCount: nextDevPortals.length,
      nextDevVisibleSurfaces,
      activePages: Array.from(document.querySelectorAll('[aria-current="page"]')).map((node) => node.textContent?.trim()),
      criticalRects, targetSizes, overflowOwners,
    };
  });
  const compactTargets = metrics.frameBand !== 'wide'
    ? metrics.targetSizes.filter((target) => target.width < 44 || target.height < 44) : [];
  const crossingRects = Object.entries(metrics.criticalRects)
    .filter(([, rect]) => rect && (rect.x < -1 || rect.right > metrics.viewport.width + 1))
    .map(([key]) => key);
  const unownedHorizontalOverflow = Object.entries(metrics.overflowOwners)
    .filter(([, owner]) => owner && owner.scrollWidth > owner.clientWidth + 1
      && !['auto', 'scroll', 'hidden', 'clip'].includes(owner.overflowX))
    .map(([key]) => key);
  const invariants = {
    expectedBand: metrics.frameBand === options.expectedBand,
    documentFitsWidth: metrics.documentScrollWidth <= metrics.documentClientWidth,
    compactTargets44: compactTargets.length === 0,
    criticalRectsContained: crossingRects.length === 0,
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
  const browserZoom = options.zoom?.kind === 'browser-zoom';
  await page.screenshot({ path: screenshotPath, fullPage: !browserZoom });
  const bitmap = await readPngSize(screenshotPath);
  const knownRects: Array<{
    selector: string;
    css: { x: number; y: number; width: number; height: number };
    bitmapSpan: { x: number; y: number; width: number; height: number };
  }> = [];
  for (const selector of browserZoom ? options.knownRectSelectors ?? [] : []) {
    const locator = page.locator(selector).first();
    const box = await locator.boundingBox();
    if (!box) throw new Error(`${name} known rect is not visible`);
    const scaleX = bitmap.width / metrics.viewport.width;
    const scaleY = bitmap.height / metrics.viewport.height;
    knownRects.push({
      selector,
      css: { x: box.x, y: box.y, width: box.width, height: box.height },
      bitmapSpan: { x: box.x * scaleX, y: box.y * scaleY, width: box.width * scaleX, height: box.height * scaleY },
    });
  }
  if (browserZoom) {
    invariants.bitmapCoverage = withinOne(bitmap.width, metrics.viewport.width * metrics.devicePixelRatio)
      && withinOne(bitmap.height, metrics.viewport.height * metrics.devicePixelRatio);
    invariants.knownRectBitmapScale = knownRects.length > 0 && knownRects.every((knownRect) =>
      withinOne(knownRect.bitmapSpan.width, knownRect.css.width * metrics.devicePixelRatio)
      && withinOne(knownRect.bitmapSpan.height, knownRect.css.height * metrics.devicePixelRatio)
      && knownRect.bitmapSpan.x >= 0 && knownRect.bitmapSpan.y >= 0
      && knownRect.bitmapSpan.x + knownRect.bitmapSpan.width <= bitmap.width + 1
      && knownRect.bitmapSpan.y + knownRect.bitmapSpan.height <= bitmap.height + 1);
  }
  const record = {
    schemaVersion: 1, runId, scenario: name, capturedAt: new Date().toISOString(),
    project: info.project.name, workerIndex: info.workerIndex, retry: info.retry,
    browserVersion: page.context().browser()?.version() ?? 'persistent-chromium',
    evidenceKind: options.zoom?.kind ?? 'responsive', zoom: options.zoom,
    metrics, invariants, diagnostics: options.diagnostics,
    compactTargets, crossingRects, unownedHorizontalOverflow,
    bitmap, knownRects, screenshotPath,
  };
  await writeFile(jsonPath, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  await info.attach(`${name}.json`, { path: jsonPath, contentType: 'application/json' });
  await info.attach(`${name}.png`, { path: screenshotPath, contentType: 'image/png' });
  expect(invariants, `${name} responsive invariants`).toEqual({
    expectedBand: true, documentFitsWidth: true, compactTargets44: true,
    criticalRectsContained: true, horizontalOverflowOwned: true,
    bitmapCoverage: true, knownRectBitmapScale: true,
    noDevIndicator: true,
    noConsoleErrors: true, noPageErrors: true,
  });
  return record;
}

export const responsiveEvidenceRoot = ROOT;

async function readPngSize(path: string) {
  const bytes = await readFile(path);
  if (bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function withinOne(actual: number, expected: number) {
  return Math.abs(actual - expected) <= 1;
}
