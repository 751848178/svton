import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const evidenceRoot = process.env.SVTON_LOCALE_EVIDENCE_ROOT;
const runId = process.env.SVTON_LOCALE_EVIDENCE_RUN_ID;
if (!evidenceRoot || !runId) throw new Error('Desktop locale evidence root and run id are required');
mkdirSync(evidenceRoot, { recursive: true });

const requireFromWeb = createRequire(resolve(repositoryRoot, 'apps/agent-web/package.json'));
const { chromium } = requireFromWeb('@playwright/test');
const serverOutput = [];
const server = spawn('pnpm', ['--filter', '@svton/agent-desktop', 'dev', '--host', 'localhost'], {
  cwd: repositoryRoot,
  env: { ...process.env, NO_COLOR: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (chunk) => serverOutput.push(String(chunk)));
server.stderr.on('data', (chunk) => serverOutput.push(String(chunk)));

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Vite exited early with ${server.exitCode}`);
    try {
      const response = await fetch('http://localhost:1420/?blocks');
      if (response.ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error('Timed out waiting for Desktop Vite server');
}

const sourceFiles = [
  'packages/ui/src/i18n/LocaleProvider.tsx',
  'packages/ui/src/i18n/resolve-locale.ts',
  'apps/agent-desktop/src/main.tsx',
  'apps/agent-desktop/src/lib/locale/desktop-locale-host.ts',
];

try {
  await waitForServer();
  const browser = await chromium.launch();
  const scenarios = [];
  for (const locale of ['en', 'zh']) {
    const requestedHostLanguage = locale === 'zh' ? 'zh-CN' : 'en-US';
    const context = await browser.newContext({ locale: requestedHostLanguage, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('http://localhost:1420/?blocks');
    const completed = locale === 'zh' ? '子代理已完成' : 'Subagent completed';
    const running = locale === 'zh' ? '子代理执行中' : 'Subagent running';
    const completedLabel = page.getByText(completed, { exact: true });
    await completedLabel.waitFor();
    await page.getByText(running, { exact: true }).waitFor();
    const documentLang = await page.locator('html').getAttribute('lang');
    if (documentLang !== (locale === 'zh' ? 'zh-CN' : 'en')) throw new Error(`Unexpected document lang: ${documentLang}`);
    if (consoleErrors.length || pageErrors.length) throw new Error(`Desktop browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`);
    const translatedRegion = completedLabel.locator('xpath=ancestor::section[1]');
    await translatedRegion.scrollIntoViewIfNeeded();
    const screenshotPath = resolve(evidenceRoot, `${locale}.png`);
    await translatedRegion.screenshot({ path: screenshotPath });
    const ariaSnapshot = await translatedRegion.ariaSnapshot();
    scenarios.push({
      requestedHostLanguage,
      resolvedLocale: locale,
      documentLang,
      visibleTranslations: [completed, running],
      consoleErrors,
      pageErrors,
      screenshotPath,
      screenshotHash: createHash('sha256').update(readFileSync(screenshotPath)).digest('hex'),
      ariaSnapshotHash: createHash('sha256').update(ariaSnapshot).digest('hex'),
      ariaSnapshotContainsTranslations: ariaSnapshot.includes(completed) && ariaSnapshot.includes(running),
      screenshotRegion: await translatedRegion.boundingBox(),
      viewport: { width: 1280, height: 900 },
    });
    await context.close();
  }
  await browser.close();
  const sourceHash = createHash('sha256');
  for (const file of sourceFiles) sourceHash.update(file).update(readFileSync(resolve(repositoryRoot, file)));
  writeFileSync(resolve(evidenceRoot, 'evidence.json'), JSON.stringify({
    runId,
    root: evidenceRoot,
    workers: 1,
    retries: 0,
    sourceFiles,
    sourceHashRecipe: 'SHA-256 of each UTF-8 relative path followed by exact file bytes, in sourceFiles order',
    sourceHash: sourceHash.digest('hex'),
    scenarios,
  }, null, 2));
} finally {
  server.kill('SIGTERM');
  writeFileSync(resolve(evidenceRoot, 'vite.log'), serverOutput.join(''));
}
