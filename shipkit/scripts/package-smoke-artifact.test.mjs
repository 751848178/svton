import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertInstalledArtifact } from './package-smoke-artifact.mjs';

for (const kind of ['current', 'stale', 'missing', 'empty']) {
  test(`installed artifact identity gate handles ${kind} contents`, async (t) => {
    const root = await mkdtemp(path.join(tmpdir(), 'ship-package-identity-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const repo = path.join(root, 'repo'); const installed = path.join(root, 'installed');
    for (const dir of [repo, installed]) await mkdir(path.join(dir, 'dist', 'agent'), { recursive: true });
    if (kind !== 'empty') await writeFile(path.join(repo, 'dist', 'agent', 'module.js'), 'current fix');
    if (kind !== 'missing' && kind !== 'empty') await writeFile(path.join(installed, 'dist', 'agent', 'module.js'), kind === 'current' ? 'current fix' : 'old same-version code');
    if (kind === 'current') assert.equal(await assertInstalledArtifact(repo, installed), 1);
    else await assert.rejects(() => assertInstalledArtifact(repo, installed), kind === 'stale' ? /differs/ : kind === 'missing' ? { code: 'ENOENT' } : /no compiled files/);
  });
}
