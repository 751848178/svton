import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { evidenceRoot } from './shared-web-locale.manifest';

export type EvidenceAssertions = Record<
  'dom' | 'focus' | 'keyboard' | 'status' | 'live' | 'error' | 'ax',
  string[]
>;

export interface BrowserDiagnostics {
  consoleErrors: string[];
  pageErrors: string[];
}

export interface EvidenceRecord {
  locale: 'en' | 'zh';
  scenario: string;
  screenshot: { path: string; sha256: string };
  accessibility: { path: string; sha256: string; assertedMembership: string[] };
  environment: Record<string, unknown>;
  assertions: EvidenceAssertions;
  diagnostics: BrowserDiagnostics;
  observations?: Record<string, unknown>;
}

export function installDiagnostics(page: Page): BrowserDiagnostics {
  const diagnostics: BrowserDiagnostics = { consoleErrors: [], pageErrors: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
  return diagnostics;
}

export async function captureEvidence(
  page: Page,
  locale: 'en' | 'zh',
  scenario: string,
  assertions: EvidenceAssertions,
  diagnostics: BrowserDiagnostics,
  observations?: Record<string, unknown>,
): Promise<EvidenceRecord> {
  const screenshotPath = resolve(evidenceRoot, `${locale}-${scenario}.png`);
  const screenshot = await page.screenshot({ path: screenshotPath, fullPage: true });
  const axSnapshot = await page.locator('body').ariaSnapshot();
  for (const member of assertions.ax) {
    if (!axSnapshot.includes(member)) {
      throw new Error(`AX snapshot for ${locale}/${scenario} lacks asserted member: ${member}`);
    }
  }
  const axPath = resolve(evidenceRoot, `${locale}-${scenario}.ax.txt`);
  writeFileSync(axPath, axSnapshot);
  const environment = await page.evaluate(() => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    colorSchemeDark: matchMedia('(prefers-color-scheme: dark)').matches,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    navigatorLanguage: navigator.language,
    documentLanguage: document.documentElement.lang,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    activeElement: document.activeElement?.getAttribute('aria-label')
      ?? document.activeElement?.textContent?.trim().slice(0, 120)
      ?? document.activeElement?.tagName,
  }));
  if (assertions.dom.includes('no horizontal overflow') && environment.horizontalOverflow) {
    throw new Error(`${locale}/${scenario} has horizontal overflow`);
  }
  return {
    locale,
    scenario,
    screenshot: { path: screenshotPath, sha256: sha256(screenshot) },
    accessibility: {
      path: axPath,
      sha256: sha256(axSnapshot),
      assertedMembership: assertions.ax,
    },
    environment,
    assertions,
    diagnostics: {
      consoleErrors: [...diagnostics.consoleErrors],
      pageErrors: [...diagnostics.pageErrors],
    },
    ...(observations ? { observations } : {}),
  };
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
