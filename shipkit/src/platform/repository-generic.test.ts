import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import path from 'node:path';
import { tmpdir } from 'node:os';

const fs = await import('node:fs/promises');
const processes = await import('node:child_process');
const authModule = await import('../shared/git-auth.js');
const policyModule = await import('../shared/git-policy.js');
type Scenario = 'normal' | 'auth' | 'rename' | 'short-disk' | 'entries' | 'stdout' | 'stderr' | 'timeout' | 'running-disk';
let scenario: Scenario = 'normal', cache = '', entryTree = '', calls = 0;
const authDirectories: string[] = [], signals: string[] = [];
const streams: PassThrough[] = [];
const sha = 'a'.repeat(40);

mock.module('node:fs/promises', { namedExports: { ...fs, stat: async (file: string) => {
  if (scenario === 'rename' && path.basename(file) === 'vanishing.pack') await fs.rm(file, { force: true });
  return fs.stat(file);
} } });
mock.module('../shared/git-auth.js', { namedExports: { createGitAuth: async (token?: string) => {
  if (scenario === 'auth') throw new Error('fixture authentication creation failed');
  const auth = await authModule.createGitAuth(token);
  authDirectories.push(path.dirname(auth.env.GIT_ASKPASS!));
  return auth;
} } });
mock.module('../shared/git-policy.js', { namedExports: { ...policyModule,
  resolveGitAddresses: async () => [{ address: '203.0.113.10', family: 4 }],
} });
mock.module('node:child_process', { namedExports: { ...processes, spawn: (_command: string, args: string[]) => {
  calls++;
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(),
    kill: (signal: string) => { signals.push(signal); return true; } });
  streams.push(child.stdout, child.stderr);
  queueMicrotask(() => { void (async () => {
    if (args.includes('init')) {
      cache = args.at(-1)!;
      if (scenario === 'rename') {
        await fs.mkdir(path.join(cache, 'objects', 'pack'), { recursive: true });
        await fs.writeFile(path.join(cache, 'objects', 'pack', 'vanishing.pack'), 'temporary pack');
      }
      if (scenario === 'short-disk' || scenario === 'running-disk') await fs.writeFile(path.join(cache, 'pack'), Buffer.alloc(2048));
      if (scenario === 'entries') await fs.rename(entryTree, path.join(cache, 'entries'));
      if (scenario === 'stdout' || scenario === 'stderr') {
        child[scenario].write(Buffer.alloc(1024 * 1024 + 1)); return;
      }
      if (scenario === 'timeout' || scenario === 'running-disk') return;
    }
    const output = args.includes('rev-parse') ? sha : args.includes('ls-tree') ? `100644 blob ${sha}\tship.yaml`
      : args.includes('show') ? 'schemaVersion: 2\nname: fixture\nservices:\n  api: {}\n' : '';
    child.stdout.end(output); child.stderr.end(); child.emit('close', 0);
  })().catch(error => child.emit('error', error)); });
  return child;
} } });
const { repositoryDescriptor } = await import('./repository-metadata.js');
const { resolveGenericSource } = await import('./repository-generic.js');
const descriptor = repositoryDescriptor({ repoUrl: 'https://git.example.test/team/repo.git', ref: { kind: 'branch', value: 'main' }, specPath: 'ship.yaml', provider: 'generic' },
  { allowedHosts: ['git.example.test'] });

test.beforeEach(() => { scenario = 'normal'; cache = ''; entryTree = ''; calls = 0; authDirectories.length = 0; signals.length = 0; streams.length = 0; });
async function fixture(t: test.TestContext) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'ship-generic-limit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const options = { temporaryRoot: root, token: 'fake-read-only-token', timeoutMs: 2000, maxBytes: 1024 };
  return { root, options };
}
async function assertClean(root: string) {
  assert.deepEqual(await fs.readdir(root), []);
  for (const directory of authDirectories) await assert.rejects(() => fs.stat(directory), { code: 'ENOENT' });
}

test('authentication creation failure still removes the temporary repository directory', async t => {
  const { root, options } = await fixture(t); scenario = 'auth';
  await assert.rejects(() => resolveGenericSource(descriptor, options), /authentication creation failed/);
  assert.equal(calls, 0); await assertClean(root);
});

test('pack files disappearing during traversal are ignored while a real filesystem snapshot resolves', async t => {
  const { root, options } = await fixture(t); scenario = 'rename';
  const snapshot = await resolveGenericSource(descriptor, options);
  assert.equal(snapshot.commit, sha); assert.equal(snapshot.appName, 'fixture');
  assert.equal(calls, 6); await assertClean(root);
});

test('a fast command cannot bypass the disk byte limit before the first monitor tick', async t => {
  const { root, options } = await fixture(t); scenario = 'short-disk';
  await assert.rejects(() => resolveGenericSource(descriptor, options), /cache exceeded its byte limit/);
  assert.equal(calls, 1, 'do not begin the next command after oversized init'); await assertClean(root);
});

test('entry count is checked after fast commands, including zero-byte files', async t => {
  const { root, options } = await fixture(t);
  entryTree = path.join(root, 'entry-tree'); await fs.mkdir(entryTree);
  for (let start = 0; start < 10001; start += 500) {
    await Promise.all(Array.from({ length: Math.min(500, 10001 - start) }, (_, offset) => fs.writeFile(path.join(entryTree, `${start + offset}`), '')));
  }
  scenario = 'entries';
  await assert.rejects(() => resolveGenericSource(descriptor, options), /too many entries/);
  assert.equal(calls, 1); await assertClean(root);
});

for (const failure of ['stdout', 'stderr', 'timeout', 'running-disk'] as const) {
  test(`${failure} limit sends TERM then KILL and settles even when the child never closes`, async t => {
    const { root, options } = await fixture(t); scenario = failure;
    const started = Date.now();
    await assert.rejects(() => resolveGenericSource(descriptor, { ...options, timeoutMs: failure === 'timeout' ? 20 : 2000 }),
      failure === 'timeout' ? /timed out/ : failure === 'running-disk' ? /cache exceeded/ : /Git output exceeded/);
    assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
    assert.ok(Date.now() - started < 1500, 'resource refusal must have a bounded completion');
    assert.ok(streams.every(stream => stream.destroyed)); await assertClean(root);
  });
}
