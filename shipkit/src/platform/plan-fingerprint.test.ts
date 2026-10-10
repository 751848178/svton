import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProjectContext } from './project-context.js';

const moduleMock = (mock as unknown as { module(url: URL, options: { namedExports: Record<string, unknown> }): unknown }).module.bind(mock);
const exclusions: string[][] = [];
let cleanups = 0;
moduleMock(new URL('../shared/exec.js', import.meta.url), { namedExports: {
  exec: async () => ({ code: 0, stdout: 'immutable-commit\n', stderr: '' }),
} });
moduleMock(new URL('../cli/source-freeze.js', import.meta.url), { namedExports: {
  normalizeLiteralPath: (value: string) => value,
  freezeSourceDir: async (_root: string, envFiles: string[]) => {
    exclusions.push(envFiles);
    return { contentDigest: 'frozen-source-digest', cleanup: async () => { cleanups++; } };
  },
} });
const { fingerprint } = await import('./plan-fingerprint.js');

async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'shipkit-fingerprint-test-'));
  t.after(() => rm(rootPath, { recursive: true, force: true }));
  const configPath = path.join(rootPath, 'config.yaml');
  await writeFile(configPath, 'test: fixed-config\n');
  await writeFile(path.join(rootPath, 'runtime.env'), 'API_SECRET=original-private-value\n');
  return { rootPath, configPath, config: { source: { ref: 'main' } },
    spec: { schemaVersion: 2, name: 'test-app', services: { api: { envFile: 'runtime.env' } } },
  } as unknown as ProjectContext;
}

test('env bytes participate in validation while an earlier private snapshot remains fixed', async (t) => {
  const context = await fixture(t);
  const before = await fingerprint(context, 'git', false);
  await writeFile(path.join(context.rootPath, 'runtime.env'), 'API_SECRET=changed-private-value\n');
  const after = await fingerprint(context, 'git', false);
  assert.equal(before.envSnapshot['runtime.env'], 'API_SECRET=original-private-value\n');
  assert.equal(after.envSnapshot['runtime.env'], 'API_SECRET=changed-private-value\n');
  assert.notEqual(before.fingerprint, after.fingerprint);
  assert.equal(before.configDigest, after.configDigest);
  assert.equal(before.gitRef, 'immutable-commit');
});

test('keep-env ignores private byte changes and directory freezes exclude declared env files', async (t) => {
  const context = await fixture(t);
  const before = await fingerprint(context, 'directory', true);
  await writeFile(path.join(context.rootPath, 'runtime.env'), 'API_SECRET=changed-private-value\n');
  const after = await fingerprint(context, 'directory', true);
  assert.deepEqual(before.envSnapshot, {});
  assert.deepEqual(after.envSnapshot, {});
  assert.equal(before.fingerprint, after.fingerprint);
  assert.equal(after.sourceDigest, 'frozen-source-digest');
  assert.deepEqual(exclusions, [['runtime.env'], ['runtime.env']]);
  assert.equal(cleanups, 2);
});

test('image repository participates in the source plan fingerprint independently of config and Git SHA', async (t) => {
  const context = await fixture(t);
  const before = await fingerprint(context, 'git', false);
  context.spec.services.api!.imageRepository = 'custom-api';
  const after = await fingerprint(context, 'git', false);
  assert.notEqual(before.fingerprint, after.fingerprint);
  assert.equal(before.configDigest, after.configDigest);
  assert.equal(before.gitRef, after.gitRef);
});
