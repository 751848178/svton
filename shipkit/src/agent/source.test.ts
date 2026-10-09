import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ensureSource } from './source.js';

const log = () => {};
async function root(t: test.TestContext) {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-src-'));
  t.after(() => rm(workRoot, { recursive: true, force: true }));
  return workRoot;
}
test('tarball ids must be server-issued UUIDs; traversal refuses', async t => {
  const workRoot = await root(t);
  await assert.rejects(() => ensureSource(workRoot, { type: 'tarball', id: 'x/../../etc' }, log), /invalid tarball source id/);
});
test('Git rejects unsafe URL, unapproved hosts and ref operators before network', async t => {
  const workRoot = await root(t);
  for (const repo of ['http://github.com/a/b', 'https://user:secret@github.com/a/b', 'git@host:x.git', 'https://evil.test/repo', 'https://github.com/a/b?token=secret']) {
    await assert.rejects(() => ensureSource(workRoot, { type: 'git', repo }, log), /HTTPS|host|invalid/i);
  }
  for (const ref of ['-c', 'HEAD~1', 'branch..main', 'main:secret', 'HEAD@{1}']) {
    await assert.rejects(() => ensureSource(workRoot, { type: 'git', repo: 'https://github.com/a/b', ref }, log), /ref must/);
  }
});
