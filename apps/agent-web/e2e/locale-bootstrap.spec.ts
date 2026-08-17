import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { seedE2e } from './helpers';

const results: Array<Record<string, unknown>> = [];
const evidenceRoot = process.env.SVTON_LOCALE_EVIDENCE_ROOT;
const sourceFiles = [
  'packages/ui/src/i18n/resolve-locale.ts',
  'packages/ui/src/i18n/LocaleProvider.tsx',
  'apps/agent-web/src/app/layout.tsx',
  'apps/agent-web/src/lib/locale/web-locale-host.ts',
];

test.describe.configure({ mode: 'serial' });

test('keeps 24 opposite-language server requests isolated', async ({ baseURL }) => {
  const captures = await Promise.all(Array.from({ length: 24 }, async (_, index) => {
    const locale = index % 2 === 0 ? 'zh' : 'en';
    const response = await fetch(baseURL!, {
      headers: { 'accept-language': locale === 'zh' ? 'zh-CN' : 'en-US' },
    });
    const html = await response.text();
    const htmlLang = html.match(/<html[^>]*lang="([^"]+)/)?.[1];
    const providerLocale = html.match(/locale\\":\\"(zh|en)/)?.[1];
    expect(response.status).toBe(200);
    expect(htmlLang).toBe(locale === 'zh' ? 'zh-CN' : 'en');
    expect(providerLocale).toBe(locale);
    return {
      index,
      requestedLocale: locale,
      htmlLang,
      providerLocale,
      responseHash: createHash('sha256').update(html).digest('hex'),
    };
  }));
  results.push({ scenario: 'parallel-server-requests', captures });
});

test('hydrates en and zh with matching visible copy and no runtime errors', async ({ browser, baseURL }) => {
  for (const locale of ['en', 'zh'] as const) {
    const context = await browser.newContext({
      locale: locale === 'zh' ? 'zh-CN' : 'en-US',
      extraHTTPHeaders: { 'accept-language': locale === 'zh' ? 'zh-CN' : 'en-US' },
    });
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await seedE2e(page);
    await page.goto(new URL('/e2e/accessibility', baseURL).href);
    await expect(page.getByTestId('accessibility-fixture')).toBeVisible({ timeout: 30_000 });
    const translatedActivity = page.locator('[data-svton-shimmer-label]');
    await expect(page.locator('html')).toHaveAttribute('lang', locale === 'zh' ? 'zh-CN' : 'en');
    await expect(translatedActivity).toHaveText(locale === 'zh' ? '思考中...' : 'Thinking...');
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    results.push({
      scenario: `hydration-${locale}`,
      documentLang: await page.locator('html').getAttribute('lang'),
      visibleTranslation: await translatedActivity.textContent(),
      consoleErrors,
      pageErrors,
    });
    await context.close();
  }
});

test.afterAll(() => {
  if (!evidenceRoot) return;
  const repositoryRoot = resolve(process.cwd(), '../..');
  const sourceHash = createHash('sha256');
  for (const file of sourceFiles) sourceHash.update(file).update(readFileSync(resolve(repositoryRoot, file)));
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(resolve(evidenceRoot, 'evidence.json'), JSON.stringify({
    runId: process.env.SVTON_LOCALE_EVIDENCE_RUN_ID,
    root: evidenceRoot,
    workers: 1,
    retries: 0,
    serverCommand: process.env.SVTON_E2E_SERVER_COMMAND,
    sourceFiles,
    sourceHashRecipe: 'SHA-256 of each UTF-8 relative path followed by exact file bytes, in sourceFiles order',
    sourceHash: sourceHash.digest('hex'),
    results,
  }, null, 2));
});
