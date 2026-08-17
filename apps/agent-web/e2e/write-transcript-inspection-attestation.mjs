import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';

const root = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i08-responsive/transcript-accessibility';
const [runId, reviewPath] = process.argv.slice(2);
if (!runId || !reviewPath) {
  throw new Error('Usage: node write-transcript-inspection-attestation.mjs <run-id> <manual-review.json>');
}
const runRoot = join(root, runId);
const reviews = JSON.parse(await readFile(reviewPath, 'utf8'));
if (!Array.isArray(reviews) || reviews.length === 0) throw new Error('Manual reviews must be a non-empty array');
const screenshots = (await walk(runRoot)).filter((path) => path.endsWith('.png'));
const accepted = [];
for (const path of screenshots) {
  const relativePath = relative(runRoot, path);
  const review = reviews.find((entry) => entry.path === relativePath);
  if (!review || review.verdict !== 'accepted' || review.detail !== 'original') {
    throw new Error(`Missing accepted original-resolution review for ${relativePath}`);
  }
  const bytes = await readFile(path);
  if (bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${relativePath} is not PNG`);
  const size = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (review.width !== size.width || review.height !== size.height) {
    throw new Error(`Reviewed dimensions do not match ${relativePath}`);
  }
  accepted.push({
    path: relativePath,
    detail: 'original',
    verdict: 'accepted',
    width: size.width,
    height: size.height,
    inspectedAt: review.inspectedAt,
    note: review.note,
  });
}
if (accepted.length !== reviews.length) throw new Error('Manual review contains unknown screenshots');
const output = {
  schemaVersion: 1, runId, generatedAt: new Date().toISOString(),
  method: 'manual original-resolution visual inspection',
  screenshotCount: accepted.length,
  screenshots: accepted.sort((a, b) => a.path.localeCompare(b.path)),
};
const outputPath = join(runRoot, 'inspection-attestation.json');
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${outputPath}\n`);

async function walk(directory) {
  await stat(directory);
  const entries = await readdir(directory, { withFileTypes: true });
  const values = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : basename(path) === 'inspection-attestation.json' ? [] : [path];
  }));
  return values.flat();
}
