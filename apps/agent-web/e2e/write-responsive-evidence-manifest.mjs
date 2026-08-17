import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i08-responsive/frame-settings';
const EXPECTED = [
  'web-320-empty-sidebar-closed',
  'web-320-empty-sidebar-open',
  'web-390-populated-sidebar-closed',
  'web-390-populated-sidebar-menu',
  'web-768-populated-sidebar-closed',
  'web-1280-populated-persistent-sidebar',
  'web-1440-populated-persistent-sidebar',
  'web-settings-320-general',
  'web-settings-390-providers',
  'web-settings-768-permissions',
  'web-settings-1440-long-mcp',
  'web-settings-1440-long-mcp-bottom',
  'web-390-dpr2',
  'web-browser-zoom-baseline-populated',
  'web-actual-browser-zoom-200-frame',
  'web-actual-browser-zoom-200-settings',
].sort();

async function filesUnder(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(path));
    else result.push(path);
  }
  return result;
}

const runId = process.env.SVTON_EVIDENCE_RUN_ID;
if (!runId) throw new Error('SVTON_EVIDENCE_RUN_ID is required');
const command = process.env.SVTON_EVIDENCE_COMMAND;
if (!command) throw new Error('SVTON_EVIDENCE_COMMAND is required');
const deterministicConfig = command.includes('--workers=1') && command.includes('--retries=0');
const runRoot = join(ROOT, runId);
const files = await filesUnder(runRoot);
const records = [];
for (const path of files.filter((file) => file.endsWith('.json'))) {
  const record = JSON.parse(await readFile(path, 'utf8'));
  if (record.scenario) records.push({ path, record });
}
const names = records.map(({ record }) => record.scenario).sort();
const missing = EXPECTED.filter((name) => !names.includes(name));
const unexpected = names.filter((name) => !EXPECTED.includes(name));
const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
const failedInvariants = records.filter(({ record }) =>
  Object.values(record.invariants ?? {}).some((value) => value !== true));
const artifacts = [];
for (const { path, record } of records) {
  const screenshot = record.screenshotPath;
  const [jsonBytes, pngBytes] = await Promise.all([readFile(path), readFile(screenshot)]);
  artifacts.push({
    scenario: record.scenario,
    json: relative(runRoot, path),
    screenshot: relative(runRoot, screenshot),
    jsonSha256: createHash('sha256').update(jsonBytes).digest('hex'),
    screenshotSha256: createHash('sha256').update(pngBytes).digest('hex'),
  });
}
const complete = missing.length === 0 && unexpected.length === 0
  && duplicates.length === 0 && failedInvariants.length === 0
  && names.length === EXPECTED.length && deterministicConfig;
const manifest = {
  schemaVersion: 1,
  runId,
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  command,
  deterministicConfig: { workers: 1, retries: 0, validated: deterministicConfig },
  startedAt: records.map(({ record }) => record.capturedAt).sort()[0],
  endedAt: new Date().toISOString(),
  status: complete ? 'passed' : 'incomplete',
  complete,
  expectedScenarios: EXPECTED,
  capturedScenarios: names,
  missing,
  unexpected,
  duplicates,
  failedInvariantScenarios: failedInvariants.map(({ record }) => record.scenario),
  browserVersions: [...new Set(records.map(({ record }) => record.browserVersion))],
  artifacts,
};
const manifestPath = join(runRoot, 'manifest.json');
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
if (!complete) {
  process.stderr.write(`${JSON.stringify(manifest, null, 2)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${manifestPath}\n`);
}
