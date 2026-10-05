// Source packaging regression (LEGACY-01, audit case A10): the tar command must
// actually receive its `.` operand, keep the exclusion rules (F06: secrets never
// enter the builder), and round-trip real files in real temp dirs — plus the
// upload path reaching a local HTTP stub, no Docker involved.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { uploadFrozenSource } from './pipeline.js';
import { freezeSourceDir } from './source-freeze.js';
import { startStubAgent } from './init/wizard-fixtures.js';
import type { BuilderHandle } from '../providers/provider.js';
import type { Logger } from '../shared/log.js';
import type { ShipSpec } from '../shared/types.js';

const noopLog: Logger = { info() {}, warn() {}, error() {} };

async function sourceProject(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-pack-'));
  await mkdir(path.join(dir, 'src'), { recursive: true });
  await mkdir(path.join(dir, '.git'), { recursive: true });
  await mkdir(path.join(dir, 'node_modules', 'pkg'), { recursive: true });
  await writeFile(path.join(dir, 'src', 'app.js'), 'console.log("app");\n');
  await writeFile(path.join(dir, 'Dockerfile'), 'FROM node:20-alpine\nCOPY src/app.js /app/app.js\n');
  await writeFile(path.join(dir, '.env'), 'SECRET=1\n');
  await writeFile(path.join(dir, 'deploy.env'), 'TOKEN=2\n');
  await writeFile(path.join(dir, 'server.pem'), '-----BEGIN PRIVATE KEY-----\n');
  await writeFile(path.join(dir, 'ship.config.yaml'), 'builder:\n  static:\n    token: AUDIT_OLD\n');
  await writeFile(path.join(dir, '.git', 'config'), '[core]\n');
  await writeFile(path.join(dir, 'node_modules', 'pkg', 'index.js'), 'module.exports = 1;\n');
  return dir;
}

function tarList(file: string): string[] {
  const r = spawnSync('tar', ['-tzf', file], { encoding: 'utf8' });
  assert.equal(r.status, 0, `tar -tzf failed: ${r.stderr}`);
  return r.stdout.split('\n').filter(Boolean).map((l) => l.replace(/^\.\//, ''));
}

test('A10: packing a source dir includes sources and excludes every secret path', async () => {
  const dir = await sourceProject();
  const outDir = await mkdtemp(path.join(tmpdir(), 'ship-pack-out-'));
  const frozen = await freezeSourceDir(dir, []);
  try {
    const entries = tarList(frozen.tarball);
    assert.ok(entries.includes('src/app.js'), `source missing from archive: ${entries.join(' ')}`);
    assert.ok(entries.includes('Dockerfile'), 'Dockerfile missing from archive');
    for (const banned of ['.env', 'deploy.env', 'server.pem', 'ship.config.yaml', '.git/config', 'node_modules/pkg/index.js']) {
      assert.ok(!entries.includes(banned), `${banned} must never enter the source archive (F06)`);
    }

    const extract = path.join(outDir, 'extracted');
    await mkdir(extract);
    const x = spawnSync('tar', ['-xzf', frozen.tarball, '-C', extract]);
    assert.equal(x.status, 0, `extraction failed: ${x.stderr}`);
    const roundTripped = await readFile(path.join(extract, 'src', 'app.js'), 'utf8');
    assert.equal(roundTripped, 'console.log("app");\n', 'content must round-trip byte-identically');
  } finally {
    await frozen.cleanup();
  }
});

test('A10-upload: the full upload path packs and POSTs the tarball (no "no files or directories specified")', async () => {
  const dir = await sourceProject();
  const stub = await startStubAgent();
  try {
    const handle = { url: stub.url, token: 'AUDIT_UPLOAD' } as unknown as BuilderHandle;
    const frozen = await freezeSourceDir(dir, ['deploy.env']);
    const source = await uploadFrozenSource(handle, frozen, noopLog);
    await frozen.cleanup();
    assert.equal(source.type, 'tarball');
    assert.ok((source as { id?: string }).id, 'upload returned a source id');
    const upload = stub.requests.find((r) => r.path === '/api/sources');
    assert.ok(upload, `upload request missing: ${JSON.stringify(stub.requests.map((r) => r.path))}`);
    assert.equal(upload.auth, 'Bearer AUDIT_UPLOAD');
  } finally {
    await stub.close();
  }
});
