import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

declare const chrome: {
  tabs: {
    query(options: Record<string, never>): Promise<Array<{ id?: number; url?: string }>>;
    setZoomSettings(tabId: number, settings: { mode: 'automatic'; scope: 'per-tab' }): Promise<void>;
    setZoom(tabId: number, factor: number): Promise<void>;
    getZoom(tabId: number): Promise<number>;
    getZoomSettings(tabId: number): Promise<{ mode: string; scope: string; defaultZoomFactor?: number }>;
  };
};

export interface ZoomCommandResult {
  ok: boolean;
  error?: string;
  tabId?: number;
  observedUrl?: string;
  requestedFactor?: number;
  actualFactor?: number;
  settings?: { mode: string; scope: string; defaultZoomFactor?: number };
}

export async function launchActualZoomPage(userDataDir: string) {
  const extensionPath = resolve(process.cwd(), 'e2e/fixtures/zoom-extension');
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    baseURL: 'http://localhost:3210',
    viewport: { width: 1280, height: 900 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const worker = context.serviceWorkers().find((candidate) => candidate.url().startsWith('chrome-extension://'))
    ?? await context.waitForEvent('serviceworker', { predicate: (candidate) => candidate.url().startsWith('chrome-extension://') });
  const page = context.pages()[0] ?? await context.newPage();
  const setZoom = async () => worker.evaluate(async ({ urlPrefix, factor }): Promise<ZoomCommandResult> => {
    if (urlPrefix !== 'http://localhost:3210/' || factor !== 2) {
      return { ok: false, error: 'Rejected browser zoom command' };
    }
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((candidate) => candidate.url?.startsWith(urlPrefix));
    if (tab?.id === undefined || !tab.url?.startsWith(urlPrefix)) {
      return { ok: false, error: 'Svton app tab was not found' };
    }
    await chrome.tabs.setZoomSettings(tab.id, { mode: 'automatic', scope: 'per-tab' });
    await chrome.tabs.setZoom(tab.id, factor);
    return {
      ok: true, requestedFactor: factor, tabId: tab.id, observedUrl: tab.url,
      actualFactor: await chrome.tabs.getZoom(tab.id),
      settings: await chrome.tabs.getZoomSettings(tab.id),
    };
  }, { urlPrefix: 'http://localhost:3210/', factor: 2 });
  const readCdpZoom = async () => {
    const session = await context.newCDPSession(page);
    const metrics = await session.send('Page.getLayoutMetrics');
    await session.detach();
    return metrics.cssVisualViewport.zoom;
  };
  const cleanup = async () => {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  };
  return { page, setZoom, readCdpZoom, cleanup };
}
