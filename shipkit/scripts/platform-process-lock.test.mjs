import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { acquireProcessLock } from './platform-process-lock.mjs';

test('platform and offline maintenance are mutually exclusive and release preserves replacement lease', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'shipkit-lock-'));
  const file = path.join(root, '.ops.lock');
  try {
    const release = await acquireProcessLock(root);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).purpose, 'platform');
    await assert.rejects(acquireProcessLock(root), /正在运行或维护/);
    release();
    await writeFile(file, JSON.stringify({ pid: process.pid, purpose: 'backup' }), { flag: 'wx' });
    await assert.rejects(acquireProcessLock(root), /正在运行或维护/);
    await unlink(file);
    const releaseOld = await acquireProcessLock(root);
    // Hold the unlinked inode open so it cannot be reused for the replacement.
    const { open } = await import('node:fs/promises');
    const held = await open(file, 'r');
    await unlink(file);
    await writeFile(file, 'replacement', { flag: 'wx' });
    releaseOld();
    assert.equal(await readFile(file, 'utf8'), 'replacement');
    await held.close();
  } finally { await rm(root, { recursive: true, force: true }); }
});
