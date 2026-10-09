import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JobStore } from './jobs.js';
import { JobCancelled } from './job-control.js';
import { isTerminalJob } from '../shared/job-protocol.js';
async function root(t: test.TestContext) {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-jobs-control-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { dir, jobs: new JobStore(dir) };
}
async function terminal(jobs: JobStore, id: string) {
  const deadline = Date.now() + 5000;
  while (!isTerminalJob(jobs.get(id)!.status) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 2));
  await jobs.flush(id);
  assert.ok(isTerminalJob(jobs.get(id)!.status));
  return jobs.get(id)!;
}
test('accepted cancellation waits for the safe checkpoint and survives restart', async (t) => {
  const { dir, jobs } = await root(t);
  let release!: () => void;
  let started!: () => void;
  const begun = new Promise<void>((resolve) => { started = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const job = await jobs.create('build', async (ctx) => {
    ctx.phase('build', 'web'); ctx.log('work begins'); started(); await gate;
    ctx.log('Docker command completed'); ctx.checkpoint(); return {};
  }, true);
  await begun;
  await jobs.cancel(job.id, 'user requested');
  assert.equal(jobs.get(job.id)?.status, 'cancel-requested');
  release();
  assert.equal((await terminal(jobs, job.id)).status, 'cancelled');
  const restarted = new JobStore(dir); await restarted.loadPersisted();
  assert.equal(restarted.get(job.id)?.cancellation?.outcome, 'cancelled');
  const page = await restarted.logPage(job.id, 0, 131072);
  assert.match(page.text, /Docker command completed/);
  assert.equal(page.nextOffset, page.totalBytes); assert.equal(page.complete, true);
  const events = await restarted.events(job.id, 0);
  assert.deepEqual(events.events.map((event) => event.event), ['created', 'phase', 'cancel-requested', 'cancelled']);
});
test('commit critical section rejects cancellation and success is durable', async (t) => {
  const { dir, jobs } = await root(t);
  let release!: () => void;
  let started!: () => void;
  const begun = new Promise<void>((resolve) => { started = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const job = await jobs.create('group-deploy', async (ctx) => {
    ctx.enterCommit(); started(); await gate; return { committed: true };
  }, true);
  await begun;
  await assert.rejects(jobs.cancel(job.id), /cannot be cancelled in phase commit/);
  release();
  assert.equal((await terminal(jobs, job.id)).status, 'succeeded');
  assert.equal(JSON.parse(await readFile(path.join(dir, 'jobs', job.id, 'job.json'), 'utf8')).status, 'succeeded');
});
test('cancelled recovery and failed recovery remain distinct terminal outcomes', async (t) => {
  const { jobs } = await root(t);
  const cancelled = await jobs.create('group-deploy', async () => { throw new JobCancelled('restored', { succeeded: true, verification: 'skipped' }); }, true);
  assert.equal((await terminal(jobs, cancelled.id)).status, 'cancelled');
  assert.deepEqual(jobs.get(cancelled.id)?.result, { recovery: { succeeded: true, verification: 'skipped' } });
});
test('full cursor log supports output larger than the old 128 KiB tail', async (t) => {
  const { jobs } = await root(t);
  const payload = '中文 log '.repeat(30000);
  const job = await jobs.create('build', async (ctx) => { ctx.log(payload); return {}; });
  await terminal(jobs, job.id);
  let offset = 0; let text = '';
  for (;;) {
    const page = await jobs.logPage(job.id, offset, 65536);
    text += page.text; offset = page.nextOffset;
    if (offset === page.totalBytes) break;
  }
  assert.equal(text, `${payload}\n`);
});

test('service probe outcomes are durable ordered events after Agent restart', async (t) => {
  const { dir, jobs } = await root(t);
  const job = await jobs.create('group-deploy', async (ctx) => {
    ctx.phase('verify', 'api'); ctx.verified?.('api', 'succeeded');
    ctx.phase('verify', 'web'); ctx.verified?.('web', 'skipped');
    ctx.enterCommit(); return { verification: 'skipped' };
  }, true);
  await terminal(jobs, job.id);
  const restarted = new JobStore(dir); await restarted.loadPersisted();
  const page = await restarted.events(job.id, 0);
  assert.equal(page.complete, true);
  assert.deepEqual(page.events.filter((event) => event.event === 'probe').map((event) => [event.phase, event.service, event.detail]), [
    ['verify', 'api', 'succeeded'], ['verify', 'web', 'skipped'],
  ]);
});
