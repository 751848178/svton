import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readRegistryCreds, writeRegistryCreds, resolvePushCreds, resolvePullCreds } from './registry-creds.js';
import { classifyDockerFailure } from './handlers-verify.js';

async function freshRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'ship-regcreds-'));
}

test('write → read round-trip; file is 0600 and kind-scoped', async () => {
  const root = await freshRoot();
  await writeRegistryCreds(root, 'push', { user: 'pu', password: 'pp' });
  assert.equal(await readRegistryCreds(root, 'pull'), null, 'pull slot untouched');
  assert.deepEqual(await readRegistryCreds(root, 'push'), { user: 'pu', password: 'pp' });
  const file = path.join(root, 'registry-creds.json');
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  await writeRegistryCreds(root, 'pull', { user: 'lu', password: 'lp' });
  const raw = JSON.parse(await readFile(file, 'utf8'));
  assert.deepEqual(Object.keys(raw).sort(), ['pull', 'push']);
});

test('resolution: env bootstrap outranks the distributed file; null = anonymous', async () => {
  const root = await freshRoot();
  await writeRegistryCreds(root, 'push', { user: 'file-user', password: 'file-pass' });
  const realPush = process.env.SHIP_PUSH_USER;
  const realPushPw = process.env.SHIP_PUSH_PASSWORD;
  delete process.env.SHIP_PUSH_USER;
  delete process.env.SHIP_PUSH_PASSWORD;
  try {
    assert.deepEqual(await resolvePushCreds(root), { user: 'file-user', password: 'file-pass' });
    process.env.SHIP_PUSH_USER = 'env-user';
    process.env.SHIP_PUSH_PASSWORD = 'env-pass';
    assert.deepEqual(await resolvePushCreds(root), { user: 'env-user', password: 'env-pass' });
    assert.equal(await resolvePullCreds(root), null, 'unconfigured pull = anonymous, not an error');
  } finally {
    if (realPush === undefined) delete process.env.SHIP_PUSH_USER; else process.env.SHIP_PUSH_USER = realPush;
    if (realPushPw === undefined) delete process.env.SHIP_PUSH_PASSWORD; else process.env.SHIP_PUSH_PASSWORD = realPushPw;
  }
});

test('corrupt creds file degrades to anonymous instead of blocking deploys', async () => {
  const root = await freshRoot();
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path.join(root, 'registry-creds.json'), '{broken');
  assert.equal(await readRegistryCreds(root, 'push'), null);
});

test('docker failure classification names the actual permission problem', () => {
  assert.match(classifyDockerFailure('Error response from daemon: unauthorized: authentication required'), /认证失败/);
  assert.match(classifyDockerFailure('denied: requested access to the resource is denied'), /权限不足/);
  assert.match(classifyDockerFailure('dial tcp: lookup reg.example.com: no such host'), /网络\/DNS/);
  assert.match(classifyDockerFailure('x509: certificate signed by unknown authority'), /TLS/);
  assert.match(classifyDockerFailure('manifest unknown'), /对象不存在/);
  assert.match(classifyDockerFailure('something odd'), /docker 报错/);
});

// ---- M2-07 regressions ----

test('M2-07: a pre-existing 0644 registry-creds.json.tmp never leaks its mode', async () => {
  const root = await freshRoot();
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path.join(root, 'registry-creds.json.tmp'), 'stale', { mode: 0o644 });
  await writeRegistryCreds(root, 'push', { user: 'u', password: 'p' });
  const mode = (await stat(path.join(root, 'registry-creds.json'))).mode & 0o777;
  assert.equal(mode, 0o600, `expected 0600, got ${mode.toString(8)}`);
});

test('M2-07: concurrent push/pull writes keep both kinds (locked read-modify-write)', async () => {
  const root = await freshRoot();
  await Promise.all(Array.from({ length: 8 }, (_, i) =>
    writeRegistryCreds(root, i % 2 === 0 ? 'push' : 'pull', { user: `u${i}`, password: `p${i}` })));
  const raw = JSON.parse(await readFile(path.join(root, 'registry-creds.json'), 'utf8')) as Record<string, { user: string }>;
  assert.ok(raw.push && raw.pull, 'both kinds survive');
  assert.equal((await stat(path.join(root, 'registry-creds.json'))).mode & 0o777, 0o600);
});
