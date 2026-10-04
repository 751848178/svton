import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const readFaults = new Map<string, string>();
let upCalls = 0;
mock.module('node:fs/promises', { namedExports: {
  ...fs,
  readFile: async (file: string, ...args: unknown[]) => {
    const code = readFaults.get(file);
    if (code) throw Object.assign(new Error(`fixture ${code}`), { code });
    return (fs.readFile as Function)(file, ...args);
  },
} });
mock.module('./docker.js', { namedExports: {
  imageExists: async () => false,
  pullAuthCtx: async () => null,
  assertComposeOwnership: async () => false,
  composePort: async () => null,
  compose: async (o: { args: string[] }) => { if (o.args.includes('up')) upCalls++; },
} });
const { runDeploy, runRollback } = await import('./handlers-deploy.js');
const { ReleaseStore } = await import('./release.js');
const owner = { app: 'web', project: 'example/team/web', env: 'prod' };
const req = { ...owner, imageRef: 'reg/web:1', spec: { name: 'web' } };
const log = () => {};
async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'ship-env-safety-'));
  t.after(async () => { readFaults.clear(); await fs.rm(root, { recursive: true, force: true }); });
  const store = new ReleaseStore(root);
  const appDir = store.appDir('web');
  return { root, store, appDir, runtimeEnv: path.join(appDir, 'runtime.env') };
}

test('keep-env preserves the committed environment in runtime and the new rollback snapshot', async (t) => {
  const { root, store, runtimeEnv } = await fixture(t);
  await runDeploy(root, { ...req, envFileContent: 'SECRET=old\n' }, log);
  const kept = await runDeploy(root, { ...req, imageRef: 'reg/web:2', ...{ keepEnv: true } }, log);
  assert.equal(await fs.readFile(runtimeEnv, 'utf8'), 'SECRET=old\n');
  assert.equal((await store.loadRelease('web', kept.releaseId)).env, 'SECRET=old\n');
  assert.equal((await fs.stat(runtimeEnv)).mode & 0o777, 0o600);
  await runDeploy(root, { ...req, imageRef: 'reg/web:3', envFileContent: '', ...{ keepEnv: true } }, log);
  assert.equal(await fs.readFile(runtimeEnv, 'utf8'), '\n', 'an explicit empty environment overrides keep-env');
  await runRollback(root, owner, log);
  assert.equal(await fs.readFile(runtimeEnv, 'utf8'), 'SECRET=old\n', 'rollback restores the environment copied into v2');
});

test('a deployment without keep-env still removes an obsolete environment deliberately', async (t) => {
  const { root, runtimeEnv } = await fixture(t);
  await runDeploy(root, { ...req, envFileContent: 'OLD=1\n' }, log);
  await runDeploy(root, { ...req, imageRef: 'reg/web:2' }, log);
  await assert.rejects(() => fs.readFile(runtimeEnv), { code: 'ENOENT' });
});

test('keep-env refuses first deploy or a lost current-state pointer; it never guesses an empty environment', async (t) => {
  const { root, appDir, runtimeEnv } = await fixture(t);
  upCalls = 0;
  await assert.rejects(() => runDeploy(root, { ...req, keepEnv: true }, log), /requires a current successful release/);
  assert.equal(upCalls, 0);
  await runDeploy(root, { ...req, envFileContent: 'SECRET=old\n' }, log);
  await fs.rm(path.join(appDir, 'state.json'));
  upCalls = 0;
  await assert.rejects(() => runDeploy(root, { ...req, keepEnv: true }, log), /requires a current successful release/);
  assert.equal(upCalls, 0);
  assert.equal(await fs.readFile(runtimeEnv, 'utf8'), 'SECRET=old\n');
});

test('unreadable environment snapshots refuse rollback without up or runtime/state changes', async (t) => {
  const { root, appDir, runtimeEnv } = await fixture(t);
  const first = await runDeploy(root, { ...req, envFileContent: 'SECRET=old\n' }, log);
  await runDeploy(root, { ...req, imageRef: 'reg/web:2', envFileContent: 'SECRET=current\n' }, log);
  const stateFile = path.join(appDir, 'state.json');
  const state = await fs.readFile(stateFile, 'utf8');
  for (const code of ['EACCES', 'EIO']) {
    readFaults.set(path.join(appDir, 'releases', first.releaseId, 'env'), code);
    upCalls = 0;
    await assert.rejects(() => runRollback(root, owner, log), /environment snapshot/);
    assert.equal(upCalls, 0);
    assert.equal(await fs.readFile(stateFile, 'utf8'), state);
    assert.equal(await fs.readFile(runtimeEnv, 'utf8'), 'SECRET=current\n');
  }
});

test('a missing committed environment snapshot is an error, not an empty environment', async (t) => {
  const { root, store, appDir, runtimeEnv } = await fixture(t);
  const first = await runDeploy(root, { ...req, envFileContent: 'SECRET=old\n' }, log);
  await fs.rm(path.join(appDir, 'releases', first.releaseId, 'env'));
  upCalls = 0;
  await assert.rejects(() => store.loadRelease('web', first.releaseId), /environment snapshot/);
  await assert.rejects(() => runDeploy(root, { ...req, imageRef: 'reg/web:2', ...{ keepEnv: true } }, log), /environment snapshot/);
  assert.equal(upCalls, 0);
  assert.equal(await fs.readFile(runtimeEnv, 'utf8'), 'SECRET=old\n');
});

test('legacy snapshots without a presence marker never guess that a missing env file was intentionally absent', async (t) => {
  const { root, store, appDir } = await fixture(t);
  const first = await runDeploy(root, { ...req, envFileContent: 'SECRET=legacy\n' }, log);
  const dir = path.join(appDir, 'releases', first.releaseId);
  const metaFile = path.join(dir, 'meta.json');
  const meta = JSON.parse(await fs.readFile(metaFile, 'utf8'));
  delete meta.hasEnv;
  await fs.writeFile(metaFile, JSON.stringify(meta));
  assert.equal((await store.loadRelease('web', first.releaseId)).env, 'SECRET=legacy\n');
  await fs.rm(path.join(dir, 'env'));
  await assert.rejects(() => store.loadRelease('web', first.releaseId), /environment snapshot/);
  // An operator can declare an intentionally env-free old snapshot only
  // after checking the original deployment records, never automatically.
  await fs.writeFile(metaFile, JSON.stringify({ ...meta, hasEnv: false }));
  assert.equal((await store.loadRelease('web', first.releaseId)).env, undefined);
});

test('valid JSON with an invalid release-state shape refuses before activation and preserves bytes', async (t) => {
  const { root, appDir } = await fixture(t);
  await runDeploy(root, req, log);
  const stateFile = path.join(appDir, 'state.json');
  for (const invalid of [null, [], {}, { current: 12, previous: null, history: [] }, { current: null, previous: null, history: 'bad' }, { current: null, previous: null, history: [null] }]) {
    const content = JSON.stringify(invalid);
    await fs.writeFile(stateFile, content);
    upCalls = 0;
    await assert.rejects(() => runDeploy(root, { ...req, imageRef: 'reg/web:2' }, log), /state.json.*corrupt/);
    assert.equal(upCalls, 0);
    assert.equal(await fs.readFile(stateFile, 'utf8'), content);
  }
});

test('invalid snapshot metadata and unreadable current env refuse a new deploy before changing the running app', async (t) => {
  const { root, appDir, runtimeEnv } = await fixture(t);
  const first = await runDeploy(root, { ...req, envFileContent: 'SECRET=old\n' }, log);
  const dir = path.join(appDir, 'releases', first.releaseId);
  const metaFile = path.join(dir, 'meta.json');
  const original = JSON.parse(await fs.readFile(metaFile, 'utf8'));
  const stateFile = path.join(appDir, 'state.json');
  const state = await fs.readFile(stateFile, 'utf8');
  for (const invalid of [null, [], { ...original, id: 'other-release' }, { ...original, hasEnv: 'true' }]) {
    await fs.writeFile(metaFile, JSON.stringify(invalid));
    upCalls = 0;
    await assert.rejects(() => runDeploy(root, { ...req, imageRef: 'reg/web:2', envFileContent: 'SECRET=new\n' }, log), /metadata.*corrupt/);
    assert.equal(upCalls, 0);
    assert.equal(await fs.readFile(stateFile, 'utf8'), state);
    assert.equal(await fs.readFile(runtimeEnv, 'utf8'), 'SECRET=old\n');
  }
  await fs.writeFile(metaFile, JSON.stringify(original));
  readFaults.set(path.join(dir, 'env'), 'EIO');
  await assert.rejects(() => runDeploy(root, { ...req, imageRef: 'reg/web:2', envFileContent: 'SECRET=new\n' }, log), /environment snapshot/);
  assert.equal(upCalls, 0, 'deploy refuses before up when its recovery snapshot is unavailable');
});
