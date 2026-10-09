import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { SecretStore } from './secret-store.js';

test('secret envelopes authenticate scope, rotate keys, and fail closed without safe key material', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'shipkit-key-test-'));
  const original = process.env.SHIPKIT_SECRET_KEY_FILE;
  const filename = path.join(directory, 'keys.json');
  process.env.SHIPKIT_SECRET_KEY_FILE = filename;
  const firstKey = randomBytes(32).toString('base64');
  const ring = (activeKeyId: string, keys: Record<string, string>) => JSON.stringify({ version: 1, activeKeyId, keys });
  const store = new SecretStore(), value = { privateValue: 'synthetic-isolated-secret', publicValue: '$#\" empty' };
  const scope = { kind: 'draft', projectId: 'p', targetKey: 'prod', objectId: 'd', revision: 1 };
  try {
    assert.throws(() => store.seal(value, scope), /主密钥不可用/);
    await writeFile(filename, ring('first', { first: firstKey }), { mode: 0o600 });
    const sealed = store.seal(value, scope);
    assert(!sealed.includes(value.privateValue));
    assert.notEqual(sealed, store.seal(value, scope));
    assert.deepEqual(store.open(sealed, scope), value);
    assert.deepEqual(store.open(store.seal({ ...value, omitted: undefined }, scope), scope), value);
    assert.deepEqual(store.open(sealed, { revision: 1, objectId: 'd', targetKey: 'prod', projectId: 'p', kind: 'draft' }), value);
    assert.throws(() => store.open(sealed, { ...scope, projectId: 'other' }), /密文无法验证/);
    assert.throws(() => store.open(sealed, { ...scope, revision: 2 }), /密文无法验证/);
    const envelope = JSON.parse(sealed) as { data: string };
    const bytes = Buffer.from(envelope.data, 'base64'); bytes[0] = bytes[0]! ^ 1; envelope.data = bytes.toString('base64');
    assert.throws(() => store.open(JSON.stringify(envelope), scope), /密文无法验证/);
    assert.equal(store.fingerprint(value, scope), store.fingerprint({ publicValue: value.publicValue, privateValue: value.privateValue }, scope));
    assert.notEqual(store.fingerprint(value, scope), store.fingerprint(value, { ...scope, targetKey: 'test' }));
    await writeFile(filename, ring('second', { first: firstKey, second: randomBytes(32).toString('base64') }));
    assert.deepEqual(store.open(sealed, scope), value);
    assert.equal(JSON.parse(store.seal(value, scope)).keyId, 'second');
    await writeFile(filename, ring('second', { second: randomBytes(32).toString('base64') }));
    assert.throws(() => store.open(sealed, scope), /密文无法验证/);
    await chmod(filename, 0o644);
    assert.throws(() => store.fingerprint(value, scope), /主密钥不可用/);
    await chmod(filename, 0o600);
    await symlink(filename, path.join(directory, 'link.json')); process.env.SHIPKIT_SECRET_KEY_FILE = path.join(directory, 'link.json');
    assert.throws(() => store.seal(value, scope), /主密钥不可用/);
    process.env.SHIPKIT_SECRET_KEY_FILE = filename;
    await rm(filename);
    assert.throws(() => store.open(sealed, scope), /主密钥不可用/);
  } finally {
    if (original === undefined) delete process.env.SHIPKIT_SECRET_KEY_FILE; else process.env.SHIPKIT_SECRET_KEY_FILE = original;
    await rm(directory, { recursive: true, force: true });
  }
});
