import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ensureSource } from './source.js';

const log = () => {};

test('tarball ids must be server-issued uuids — traversal rejected (F07)', async () => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-src-'));
  await assert.rejects(() => ensureSource(workRoot, { type: 'tarball', id: 'x/../../etc' }, log), /invalid tarball source id/);
  await assert.rejects(() => ensureSource(workRoot, { type: 'tarball', id: '' }, log), /invalid tarball source id/);
});

test('git failure messages never contain the credential (F08)', async () => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-src-'));
  await assert.rejects(
    () => ensureSource(workRoot, { type: 'git', repo: 'http://127.0.0.1:9/x.git', token: 'sekrit-token-123' }, log),
    (e: unknown) => {
      assert.ok(!/sekrit-token-123/.test((e as Error).message), `token leaked: ${(e as Error).message}`);
      assert.match((e as Error).message, /\*\*\*@/);
      return true;
    },
  );
});

test('non-http repos rejected early', async () => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-src-'));
  await assert.rejects(() => ensureSource(workRoot, { type: 'git', repo: 'git@host:x.git' }, log), /http\(s\) URL/);
});
