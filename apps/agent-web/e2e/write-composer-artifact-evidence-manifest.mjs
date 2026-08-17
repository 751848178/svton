import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i08-responsive/composer-artifact';
const runId = process.argv[2] || process.env.SVTON_EVIDENCE_RUN_ID;
if (!runId) throw new Error('run id is required');

const expected = [
  'composer-320-attachment-wrapped',
  'composer-390-slash-scroll-resize',
  'composer-768-mention-reflow',
  'composer-1280-long-controls',
  'composer-1440-long-controls',
  'artifact-390-preview-single',
  'artifact-390-dirty-dialog',
  'artifact-768-edit-single-preserved',
  'artifact-1024-wide-measured-single',
  'artifact-1280-split-preserved',
  'artifact-768-collapse-focus-transfer',
  'artifact-1440-split-preserved',
  'artifact-390-discard-opener-restored',
  'artifact-390-close-scroll-exact',
  'actual-zoom-200-composer',
  'actual-zoom-200-artifact-single',
];
const runRoot = join(root, runId);
const evidenceDir = join(runRoot, 'chromium', 'worker-0', 'retry-0');
const files = await readdir(evidenceDir);
const actual = files.filter((file) => file.endsWith('.json')).map((file) => file.slice(0, -5)).sort();
if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
  throw new Error(`scenario mismatch: ${JSON.stringify(actual)}`);
}
const screenshots = [];
for (const scenario of expected) {
  const jsonPath = join(evidenceDir, `${scenario}.json`);
  const pngPath = join(evidenceDir, `${scenario}.png`);
  const record = JSON.parse(await readFile(jsonPath, 'utf8'));
  await access(pngPath);
  const failures = Object.entries(record.invariants).filter(([, accepted]) => !accepted);
  if (failures.length) throw new Error(`${scenario} failed: ${failures.map(([key]) => key).join(', ')}`);
  if (record.runId !== runId || record.workerIndex !== 0 || record.retry !== 0) {
    throw new Error(`${scenario} has incorrect run ownership`);
  }
  if (record.diagnostics.consoleErrors.length || record.diagnostics.pageErrors.length) {
    throw new Error(`${scenario} has browser diagnostics`);
  }
  if (record.metrics.nextDevVisibleSurfaces.length) throw new Error(`${scenario} exposes Next dev UI`);
  if (record.screenshotPath !== pngPath) throw new Error(`${scenario} screenshot path mismatch`);
  if (record.evidenceKind === 'browser-zoom') assertActualZoom(record, scenario);
  screenshots.push({
    scenario, jsonPath, pngPath,
    viewport: record.metrics.viewport,
    devicePixelRatio: record.metrics.devicePixelRatio,
    bitmap: record.bitmap,
    band: record.metrics.artifact.band,
    layout: record.metrics.artifact.layout,
    measuredWidth: record.metrics.artifact.measuredWidth,
    popupPlacement: record.metrics.state.popupPlacement,
    selectedTab: record.metrics.state.selectedTab,
    focusPane: record.metrics.state.focusPane,
    chatScrollFromBottom: record.metrics.state.chatScrollFromBottom,
    artifactScrollTop: record.metrics.state.artifactScrollTop,
    invariantCount: Object.keys(record.invariants).length,
  });
}

const rejectedRoot = join(root, 'rejected');
const rejectedRuns = await readdir(rejectedRoot).catch(() => []);
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  root, runId,
  execution: { project: 'chromium', workers: 1, retries: 0 },
  acceptance: {
    passed: true,
    scenarioCount: screenshots.length,
    allMachineInvariantsPassed: true,
    allBrowserDiagnosticsClean: true,
    originalsInspectedByWorker: false,
  },
  rejectedRuns: rejectedRuns.sort().map((entry) => join(rejectedRoot, entry)),
  screenshots,
};
const manifestPath = join(runRoot, 'manifest.json');
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
console.log(manifestPath);

function assertActualZoom(record, scenario) {
  const extension = record.zoom?.extension;
  if (record.metrics.viewport.width !== 640 || record.metrics.viewport.height !== 450
    || record.bitmap.width !== 1280 || record.bitmap.height !== 900
    || record.metrics.devicePixelRatio !== 2
    || record.zoom?.requested !== 2 || extension?.actualFactor !== 2
    || record.zoom?.cdpCssVisualViewportZoom !== 2) {
    throw new Error(`${scenario} does not prove actual 200 percent browser zoom`);
  }
}
