import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';

const root = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i08-responsive/transcript-accessibility';
const runId = process.argv[2];
if (!runId) throw new Error('Usage: node write-transcript-accessibility-manifest.mjs <run-id>');
const runRoot = join(root, runId);
const expected = new Set([
  'compact-320', 'compact-390', 'medium-768', 'wide-1440',
  'running-no-preference', 'terminal-completed', 'running-reduced-motion',
  'terminal-failed', 'terminal-interrupted', 'terminal-cancelled',
  'session-switch-stale-silent', 'actual-browser-zoom-200',
]);
const forbidden = [
  'SYNTHETIC_FAILURE_DETAIL_I083A', 'SYNTHETIC_COMMAND_I083A',
  'synthetic_fixture_runner', 'SYNTHETIC_ANSWER_I083A',
];

const files = await walk(runRoot);
const jsonFiles = files.filter((path) => path.endsWith('.json')
  && basename(path) !== 'inspection-attestation.json' && basename(path) !== 'manifest.json');
const records = [];
for (const path of jsonFiles) {
  const bytes = await readFile(path);
  const text = bytes.toString('utf8');
  if (forbidden.some((marker) => text.includes(marker))) throw new Error(`Raw synthetic payload leaked into ${path}`);
  const record = JSON.parse(text);
  if (!expected.has(record.scenario)) continue;
  if (record.retry !== 0 || record.workerIndex !== 0) throw new Error(`Non-canonical worker/retry in ${path}`);
  if (!Object.values(record.invariants).every(Boolean)) throw new Error(`Invariant failed in ${path}`);
  if (record.scenario === 'terminal-failed' && record.invariants.visibleFailurePreserved !== true) {
    throw new Error(`Terminal failure detail was not preserved in ${path}`);
  }
  const screenshot = record.screenshotPath;
  const screenshotBytes = await readFile(screenshot);
  records.push({
    scenario: record.scenario,
    evidence: relative(runRoot, path),
    evidenceSha256: sha(bytes),
    screenshot: relative(runRoot, screenshot),
    screenshotSha256: sha(screenshotBytes),
    bitmap: record.bitmap,
    stateId: record.metrics.stateId,
    viewport: record.metrics.viewport,
    reducedMotion: record.metrics.reducedMotion,
    actualZoom: record.actualZoom ?? null,
    eventKeys: record.metrics.liveOwners.map((owner) => owner.eventKey).filter(Boolean),
  });
}

const observed = new Set(records.map((record) => record.scenario));
const missing = [...expected].filter((scenario) => !observed.has(scenario));
if (missing.length > 0 || records.length !== expected.size) throw new Error(`Scenario mismatch: missing=${missing.join(',')}`);
const inspectionPath = join(runRoot, 'inspection-attestation.json');
const inspectionBytes = await readFile(inspectionPath);
const inspection = JSON.parse(inspectionBytes.toString('utf8'));
const inspected = new Set(inspection.screenshots?.map((entry) => entry.path));
const uninspected = records.map((record) => record.screenshot).filter((path) => !inspected.has(path));
if (uninspected.length > 0) throw new Error(`Screenshots lack original-resolution inspection: ${uninspected.join(',')}`);

const manifest = {
  schemaVersion: 1, runId, generatedAt: new Date().toISOString(),
  canonical: { project: 'chromium', workerIndex: 0, retry: 0, retriesConfigured: 0 },
  scenarioCount: records.length,
  allInvariantsPassed: true,
  rawSyntheticPayloadExcluded: true,
  inspectionAttestation: relative(runRoot, inspectionPath),
  inspectionSha256: sha(inspectionBytes),
  records: records.sort((a, b) => a.scenario.localeCompare(b.scenario)),
};
const manifestPath = join(runRoot, 'manifest.json');
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${manifestPath}\n`);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return paths.flat();
}

function sha(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
