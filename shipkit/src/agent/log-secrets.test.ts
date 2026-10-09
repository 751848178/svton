import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JobStore } from './jobs.js';
import { serializeRuntimeEnv } from '../shared/runtime-env.js';

test('journal logs, events, failure and recovery data redact all old/new arbitrary-key env values before persistence', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'ship-secret-journal-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const jobs = new JobStore(root);
  const old = 'fake-old:/+value', fresh = 'fake-new$${literal}', parent = 'fake-parent-password', token = 'fake-git-token';
  const job = await jobs.create('group-deploy', async ctx => {
    ctx.log.addEnv?.(`ANY_KEY="${old}"\n`);
    ctx.log.addEnv?.(serializeRuntimeEnv({ ORDINARY_NAME: fresh }));
    ctx.log.addEnv?.(`OLD_PARENT=${parent}\n`);
    ctx.log.addSecrets?.([token]);
    ctx.log([old, encodeURIComponent(old), fresh, parent, token].join(' '));
    ctx.enterRecovery();
    throw Object.assign(new Error(`${fresh} ${old} ${parent}`), { recovery: { attempted: true, succeeded: false, detail: `${old} ${fresh} ${parent}` } });
  }, true);
  for (let i = 0; i < 100 && jobs.activeCount(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  await jobs.flush(job.id);
  assert.equal(jobs.get(job.id)!.status, 'failed');
  assert.doesNotMatch(JSON.stringify(jobs.get(job.id)), /fake-old|fake-new|fake-parent|fake-git/);
  for (const file of ['job.json', 'log.txt', 'events.jsonl']) {
    const contents = await readFile(path.join(root, 'jobs', job.id, file), 'utf8');
    assert.doesNotMatch(contents, /fake-old|fake-new|fake-parent|fake-git/);
  }
});
