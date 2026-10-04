import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import * as atomic from './atomic.js';

let failCommit = false;
let failGc = false;
let failRecovery = false;
const ups: string[] = [];
mock.module('node:fs/promises', { namedExports: {
  ...fs,
  rm: async (file: string, ...args: unknown[]) => {
    if (failGc && /\/releases\/[^/]+$/.test(String(file))) throw Object.assign(new Error('fixture cleanup EACCES'), { code: 'EACCES' });
    return (fs.rm as Function)(file, ...args);
  },
} });
mock.module('./atomic.js', { namedExports: {
  writeFileAtomic: async (file: string, data: string, mode?: number) => {
    if (failCommit && file.endsWith('/state.json')) throw Object.assign(new Error('fixture commit EIO'), { code: 'EIO' });
    return atomic.writeFileAtomic(file, data, mode);
  },
} });
mock.module('./docker.js', { namedExports: {
  imageExists: async () => false,
  pullAuthCtx: async () => null,
  assertComposeOwnership: async () => false,
  composePort: async () => null,
  compose: async (o: { appDir: string; args: string[] }) => {
    if (!o.args.includes('up')) return;
    const content = await fs.readFile(path.join(o.appDir, 'compose.yaml'), 'utf8');
    ups.push(content);
    if (failRecovery && content.includes('web:v1')) throw new Error('fixture recovery up failure');
  },
} });
const { runDeploy, runRollback } = await import('./handlers-deploy.js');
const { ReleaseStore } = await import('./release.js');
const owner = { app: 'web', project: 'example/team/web', env: 'prod' };
const request = (version: number) => ({ ...owner, imageRef: `reg.example/web:v${version}`, spec: { name: 'web' }, envFileContent: `CONFIG=v${version}\n` });

async function fixture(t: { after(fn: () => Promise<void>): void }) {
  failCommit = false; failGc = false; failRecovery = false; ups.length = 0;
  const root = await fs.mkdtemp('/tmp/ship-commit-safety-');
  t.after(async () => { failCommit = false; failGc = false; failRecovery = false; await fs.rm(root, { recursive: true, force: true }); });
  const appDir = path.join(root, 'web');
  const messages: string[] = [];
  return { root, appDir, messages, log: (message: string) => { messages.push(message); }, store: new ReleaseStore(root) };
}

test('deploy commit failure restores the full running snapshot and preserves the uncommitted state', async (t) => {
  const { root, appDir, log } = await fixture(t);
  await runDeploy(root, request(1), log);
  const before = await fs.readFile(path.join(appDir, 'state.json'), 'utf8');
  failCommit = true;
  await assert.rejects(() => runDeploy(root, request(2), log), (e: unknown) => {
    assert.deepEqual((e as { recovery: unknown }).recovery, { attempted: true, succeeded: true, target: 'reg.example/web:v1' });
    assert.match((e as Error).message, /commit.*EIO/);
    return true;
  });
  assert.equal(ups.length, 3);
  assert.match(ups.at(-1)!, /web:v1/);
  assert.equal(await fs.readFile(path.join(appDir, 'state.json'), 'utf8'), before);
  assert.equal(await fs.readFile(path.join(appDir, 'runtime.env'), 'utf8'), 'CONFIG=v1\n');
});

test('rollback commit failure restores the current release instead of leaving an uncommitted rollback running', async (t) => {
  const { root, appDir, log } = await fixture(t);
  await runDeploy(root, request(1), log);
  await runDeploy(root, request(2), log);
  const before = await fs.readFile(path.join(appDir, 'state.json'), 'utf8');
  failCommit = true;
  await assert.rejects(() => runRollback(root, owner, log), (e: unknown) => {
    assert.deepEqual((e as { recovery: unknown }).recovery, { attempted: true, succeeded: true, target: 'reg.example/web:v2' });
    return true;
  });
  assert.equal(ups.length, 4);
  assert.match(ups.at(-1)!, /web:v2/);
  assert.equal(await fs.readFile(path.join(appDir, 'state.json'), 'utf8'), before);
  assert.equal(await fs.readFile(path.join(appDir, 'runtime.env'), 'utf8'), 'CONFIG=v2\n');
});

test('snapshot GC failure after commit is a warning and never reverses the committed activation', async (t) => {
  const { root, appDir, log, messages, store } = await fixture(t);
  for (let version = 1; version <= 12; version++) await runDeploy(root, request(version), log);
  failGc = true;
  const result = await runDeploy(root, request(13), log);
  assert.equal((await store.loadState('web')).current, result.releaseId);
  assert.equal(ups.length, 13);
  assert.match(ups.at(-1)!, /web:v13/);
  assert.equal(await fs.readFile(path.join(appDir, 'runtime.env'), 'utf8'), 'CONFIG=v13\n');
  assert.ok(messages.some((message) => /cleanup.*EACCES/.test(message)));
});

test('first deployment commit failure reports that no previous snapshot can be recovered', async (t) => {
  const { root, log, store } = await fixture(t);
  failCommit = true;
  await assert.rejects(() => runDeploy(root, request(1), log), (e: unknown) => {
    assert.deepEqual((e as { recovery: unknown }).recovery, { attempted: true, succeeded: false, target: null });
    return true;
  });
  assert.equal((await store.loadState('web')).current, null);
  assert.equal(ups.length, 1);
});

test('failed recovery after a commit error is reported truthfully without advancing state', async (t) => {
  const { root, log, store } = await fixture(t);
  const first = await runDeploy(root, request(1), log);
  failCommit = true; failRecovery = true;
  await assert.rejects(() => runDeploy(root, request(2), log), (e: unknown) => {
    assert.deepEqual((e as { recovery: unknown }).recovery, { attempted: true, succeeded: false, target: 'reg.example/web:v1' });
    return true;
  });
  assert.equal((await store.loadState('web')).current, first.releaseId);
  assert.equal(ups.length, 3);
});
