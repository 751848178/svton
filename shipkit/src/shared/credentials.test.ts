import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const realHome = process.env.HOME;

async function isolatedHome(): Promise<string> {
  const home = await mkdtemp(path.join(tmpdir(), 'ship-creds-'));
  process.env.HOME = home;
  return home;
}

test.afterEach(() => {
  process.env.HOME = realHome;
});

test('validateConfig accepts tokenRef XOR token and rejects both/neither', async () => {
  const { validateConfig } = await import('./config.js');
  const base = {
    builder: { mode: 'static', static: { url: 'http://b', token: 't' } },
    runtime: { targets: { s: { url: 'http://r', token: 't' } } },
  };
  assert.equal(validateConfig(base).builder.static?.token, 't');
  const ref = validateConfig({
    builder: { mode: 'static', static: { url: 'http://b', tokenRef: 'builder' } },
    runtime: { targets: { s: { url: 'http://r', tokenRef: 'staging' } } },
  });
  assert.equal(ref.builder.static?.tokenRef, 'builder');
  assert.equal(ref.runtime.targets.s!.tokenRef, 'staging');
  assert.throws(() => validateConfig({
    builder: { mode: 'static', static: { url: 'http://b', token: 't', tokenRef: 'x' } },
    runtime: { targets: { s: { url: 'http://r', token: 't' } } },
  }), /exactly one of token \/ tokenRef/);
  assert.throws(() => validateConfig({
    builder: { mode: 'static', static: { url: 'http://b' } },
    runtime: { targets: { s: { url: 'http://r', token: 't' } } },
  }), /exactly one of token \/ tokenRef/);
});

test('saveCredential → resolveTargetToken round-trip with 0600 file', async () => {
  await isolatedHome();
  const { saveCredential, resolveTargetToken, credentialsFile } = await import('./credentials.js');
  await saveCredential('builder', { url: 'https://builder.example.com', token: 'skt-abc', role: 'builder' });
  const resolved = await resolveTargetToken({ url: 'https://builder.example.com', tokenRef: 'builder' }, 'builder.static');
  assert.deepEqual(resolved, { url: 'https://builder.example.com', token: 'skt-abc', via: 'credential-ref' });
  const { stat } = await import('node:fs/promises');
  assert.equal((await stat(credentialsFile())).mode & 0o777, 0o600);
});

test('resolveTargetToken: missing ref and stale-entry mismatch give actionable errors', async () => {
  await isolatedHome();
  const { resolveTargetToken, saveCredential } = await import('./credentials.js');
  await assert.rejects(
    () => resolveTargetToken({ url: 'https://x', tokenRef: 'nope' }),
    /not found in ~\/\.ship\/credentials\.json .*ship pair/,
  );
  await saveCredential('b', { url: 'https://real-host', token: 't' });
  await assert.rejects(
    () => resolveTargetToken({ url: 'https://other-host', tokenRef: 'b' }),
    /points at https:\/\/real-host.*says https:\/\/other-host.*stale reference/s,
  );
});

test('plaintext token still wins and skips the credential file entirely', async () => {
  const home = await isolatedHome();
  const { resolveTargetToken } = await import('./credentials.js');
  const resolved = await resolveTargetToken({ url: 'http://127.0.0.1:1', token: 'plain' });
  assert.deepEqual(resolved, { url: 'http://127.0.0.1:1', token: 'plain', via: 'plaintext' });
  const { existsSync } = await import('node:fs');
  assert.equal(existsSync(path.join(home, '.ship', 'credentials.json')), false);
});

// ---- M2-07 regressions: safe writes + concurrent read-modify-write + caFile ----

test('M2-07: a pre-existing 0644 credentials.json.tmp never leaks its mode; final file is 0600', async () => {
  await isolatedHome();
  const { saveCredential, credentialsFile } = await import('./credentials.js');
  const { writeFile, mkdir, stat } = await import('node:fs/promises');
  await mkdir(path.join(process.env.HOME!, '.ship'), { recursive: true });
  await writeFile(`${credentialsFile()}.tmp`, 'stale 0644 temp', { mode: 0o644 });
  await saveCredential('builder', { url: 'https://b.example.com', token: 'skt-1', role: 'builder' });
  const mode = (await stat(credentialsFile())).mode & 0o777;
  assert.equal(mode, 0o600, `expected 0600, got ${mode.toString(8)}`);
});

test('M2-07: symlinked credentials target is refused', async () => {
  await isolatedHome();
  const { saveCredential, credentialsFile } = await import('./credentials.js');
  const { writeFile, mkdir, symlink } = await import('node:fs/promises');
  const dir = path.join(process.env.HOME!, '.ship');
  await mkdir(dir, { recursive: true });
  const real = path.join(dir, 'real.json');
  await writeFile(real, '{}');
  await symlink(real, credentialsFile());
  await assert.rejects(() => saveCredential('x', { url: 'https://x', token: 't' }), /符号链接/);
});

test('M2-07: concurrent saves of different names keep every entry (locked read-modify-write)', async () => {
  await isolatedHome();
  const { saveCredential, readCredentials } = await import('./credentials.js');
  await Promise.all(Array.from({ length: 10 }, (_, i) =>
    saveCredential(`cred-${i}`, { url: `https://m${i}.example.com`, token: `skt-${i}` })));
  const all = await readCredentials();
  for (let i = 0; i < 10; i++) assert.ok(all[`cred-${i}`], `cred-${i} must survive the concurrent writes`);
});

test('M2-10: caFile pinned by ship pair travels with the resolved target', async () => {
  await isolatedHome();
  const { saveCredential, resolveTargetToken } = await import('./credentials.js');
  await saveCredential('builder', { url: 'https://b.example.com', token: 'skt-1', role: 'builder', caFile: '/etc/ship/pinned-ca.pem' });
  const resolved = await resolveTargetToken({ url: 'https://b.example.com', tokenRef: 'builder' });
  assert.equal(resolved.caFile, '/etc/ship/pinned-ca.pem');
  const plain = await resolveTargetToken({ url: 'http://127.0.0.1:9', token: 't' });
  assert.equal(plain.caFile, undefined, 'plaintext entries carry no pinned CA');
});

test('M2-08: assertCredentialsStoreWritable rejects a corrupt store before any pairing', async () => {
  await isolatedHome();
  const { assertCredentialsStoreWritable, credentialsFile } = await import('./credentials.js');
  const { writeFile, mkdir } = await import('node:fs/promises');
  await mkdir(path.join(process.env.HOME!, '.ship'), { recursive: true });
  await writeFile(credentialsFile(), '{broken', { mode: 0o600 });
  await assert.rejects(() => assertCredentialsStoreWritable(), /cannot parse/);
});
