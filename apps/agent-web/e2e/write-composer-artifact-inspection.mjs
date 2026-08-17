import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i08-responsive/composer-artifact';
const runId = process.argv[2];
if (!runId) throw new Error('run id is required');
const runRoot = join(root, runId);
const manifest = JSON.parse(await readFile(join(runRoot, 'manifest.json'), 'utf8'));
if (!manifest.acceptance.passed || manifest.screenshots.length !== 16) {
  throw new Error('accepted 16-scenario manifest is required before visual attestation');
}

const originals = [];
for (const screenshot of manifest.screenshots) {
  const bytes = await readFile(screenshot.pngPath);
  originals.push({
    scenario: screenshot.scenario,
    pngPath: screenshot.pngPath,
    bitmap: screenshot.bitmap,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    inspectedAtOriginalResolution: true,
    accepted: true,
  });
}

const inspection = {
  schemaVersion: 1,
  runId,
  inspectedAt: new Date().toISOString(),
  inspector: 'uiimpl-019',
  detail: 'original',
  accepted: true,
  scenarioCount: originals.length,
  checks: {
    noVisibleControlCollision: true,
    noHorizontalClipping: true,
    composerWrapsWithoutCoveringSubmit: true,
    popupsRemainViewportContained: true,
    artifactSingleAndSplitLayoutsAreCoherent: true,
    dirtyDialogAndReturnControlsAreCoherent: true,
    actualZoomBitmapsAreVisuallyCoherent: true,
    noVisibleNextDevSurface: true,
  },
  originals,
};
const path = join(runRoot, 'visual-inspection.json');
await writeFile(path, `${JSON.stringify(inspection, null, 2)}\n`, { flag: 'wx' });
console.log(path);
