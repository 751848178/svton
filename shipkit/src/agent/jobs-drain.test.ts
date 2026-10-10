import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { JobStore } from './jobs.js';

test('drain retains all accepted running and queued jobs until final journals persist', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'shipkit-jobs-drain-')); t.after(() => rm(root, { recursive: true, force: true }));
  const jobs = new JobStore(root);
  let release!: () => void, releaseLast!: () => void, startedLast!: () => void;
  const first = new Promise<void>(resolve => { release = resolve; });
  const last = new Promise<void>(resolve => { releaseLast = resolve; });
  const started = new Promise<void>(resolve => { startedLast = resolve; });
  const a = await jobs.create('build', async () => { await first; return { ok: true }; });
  const b = await jobs.create('build', async () => { await first; return { ok: true }; });
  const c = await jobs.create('build', async () => { startedLast(); await last; return { ok: true }; });
  let done = false;
  const drained = jobs.drain().then(() => { done = true; });
  try {
    assert.equal(c.status, 'queued'); assert.equal(done, false);
    release(); await started; assert.equal(done, false);
  } finally { release(); releaseLast(); await drained; }
  assert.equal(done, true);
  for (const job of [a, b, c]) {
    assert.equal(job.status, 'succeeded');
    const saved = JSON.parse(await readFile(path.join(root, 'jobs', job.id, 'job.json'), 'utf8')) as { status: string };
    assert.equal(saved.status, 'succeeded');
  }
  await jobs.drain();
});
