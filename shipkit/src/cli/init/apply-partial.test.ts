// R5: a REAL restore failure must be reported as partial. The restore's copyFile
// is made to fail for one file via node:test module mocks — no production code
// is touched. Kept in its own file because mock.module applies to the whole
// test file's module cache.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { InitAnswers } from './plan.js';

function answers(): InitAnswers {
  return {
    name: 'demo-web', dockerfile: 'Dockerfile', ports: ['3000:3000'],
    healthcheckPath: null, healthcheckHostPort: null, envFile: null,
    builderUrl: 'http://127.0.0.1:7410', builderToken: 'builder-secret',
    targetName: 'staging', runtimeUrl: 'http://127.0.0.1:7410', runtimeToken: 'runtime-secret',
    registryUrl: 'registry.example.com', registryNamespace: 'myteam',
  };
}

test('R5d: a genuine restore failure yields rollback=partial naming the file', async (t) => {
  const real = await import('node:fs/promises');
  t.mock.module('node:fs/promises', {
    namedExports: {
      ...real,
      copyFile: (async (src: string, dest: string) => {
        if (String(dest).endsWith('ship.yaml')) throw new Error('EACCES: simulated restore failure');
        return real.copyFile(src, dest);
      }) as typeof real.copyFile,
    },
  });
  const { applyFileWrites, WriteFailedError } = await import('./apply.js');
  const { planFileWrites } = await import('./write.js');

  const dir = await mkdtemp(path.join(tmpdir(), 'ship-partial-'));
  await writeFile(path.join(dir, 'Dockerfile'), 'FROM scratch\n');
  const oldSpec = 'name: demo-web\nbuildArgsPolicy: strict\n';
  await writeFile(path.join(dir, 'ship.yaml'), oldSpec);
  await mkdir(path.join(dir, 'ship.config.yaml')); // second write fails → rollback attempts copyFile

  const err = await applyFileWrites(dir, planFileWrites(dir, answers())).then(() => null, (e: unknown) => e);
  assert.ok(err instanceof WriteFailedError, String(err));
  assert.equal(err.rollback, 'partial', 'a real restore failure must not be reported as verified');
  assert.ok(err.rollbackDetail.includes('ship.yaml'), `the failing file must be named: ${err.rollbackDetail}`);
  assert.ok(err.message.includes('部分成功'), 'the user must be told only part was restored');
  // and the on-disk truth matches the report: ship.yaml still holds the NEW content
  const specNow = await readFile(path.join(dir, 'ship.yaml'), 'utf8');
  assert.notEqual(specNow, oldSpec);
});
