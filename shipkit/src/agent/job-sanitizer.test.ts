import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { JobStore } from './jobs.js';
import { SecretValues } from './log-secrets.js';
import { sanitizeJobEvent } from './job-protocol-sanitizer.js';
import { sanitizeJobResult } from './job-result-sanitizer.js';

async function fixture(t: test.TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), 'ship-job-schema-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, jobs: new JobStore(root) };
}
async function complete(jobs: JobStore, id: string) {
  for (let i = 0; i < 200 && jobs.activeCount(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(jobs.activeCount(), 0); await jobs.flush(id);
}
const imageRef = `example/api1@sha256:${'a1'.repeat(32)}`;
const source = { type: 'git', repo: 'https://example.test/team/api1', sha: 'a1'.repeat(20), ref: 'alpha1' };
const configRef = { versionId: 'config-a1', version: '1.0.1', name: 'name1', serviceKey: 'api1' };

test('short env secrets preserve job/result/event protocol and restart identity while diagnostics and unknown fields redact', async t => {
  const { root, jobs } = await fixture(t);
  const expected = { app: 'app1', releaseId: 'release-a1', previousReleaseId: 'release-b1', changedServices: ['api1'], inheritedServices: ['admin1'],
    changedRefs: { api1: imageRef }, verification: 'passed', source, configRef, configRefs: { api1: configRef },
    services: { api1: { imageRef, hasEnv: true, source, configRef, env: 'a1' } },
    message: 'a1', detail: 'a1', unknown: { id: 'a1', status: 'a1', source: { sha: 'a1' }, number: 1, flag: false } };
  const job = await jobs.create('group-deploy', async ctx => {
    ctx.log.addEnv?.('SHORT=1\nLETTER=a\n');
    ctx.log('a1'); ctx.phase('activate', 'api1');
    ctx.verified?.('api1', 'failed'); ctx.enterCommit();
    return expected;
  }, true, { operationId: 'a1-run', request: { fixture: true } });
  const id = job.id, operationId = job.operationId, requestHash = job.requestHash;
  await complete(jobs, id);
  const current = jobs.get(id)!;
  const result = current.result as typeof expected;
  assert.equal(current.id, id); assert.equal(current.status, 'succeeded'); assert.equal(current.phase, 'commit');
  assert.equal(current.operationId, operationId); assert.equal(current.requestHash, requestHash);
  assert.equal(result.releaseId, expected.releaseId); assert.equal(result.previousReleaseId, expected.previousReleaseId);
  assert.deepEqual(result.changedRefs, expected.changedRefs); assert.deepEqual(result.changedServices, expected.changedServices);
  assert.deepEqual(result.inheritedServices, expected.inheritedServices); assert.equal(result.verification, 'passed');
  assert.deepEqual(result.source, source); assert.deepEqual(result.configRef, configRef); assert.deepEqual(result.configRefs, expected.configRefs);
  assert.equal(result.services.api1.hasEnv, true); assert.deepEqual(result.services.api1.source, source);
  for (const value of [result.message, result.detail, result.services.api1.env]) assert.doesNotMatch(value, /[a1]/);
  assert.deepEqual(result.unknown, { id: '******', status: '******', source: { sha: '******' }, number: '***', flag: 'f***lse' });
  const disk = JSON.parse(await readFile(path.join(root, 'jobs', id, 'job.json'), 'utf8'));
  const durable = JSON.parse(JSON.stringify(current));
  assert.deepEqual(disk, durable);
  assert.equal(await readFile(path.join(root, 'jobs', id, 'log.txt'), 'utf8'), '******\n');
  const events = (await jobs.events(id, 0)).events;
  const probe = events.find(event => event.event === 'probe')!;
  assert.equal(probe.phase, 'verify'); assert.equal(probe.service, 'api1'); assert.equal(probe.detail, 'failed');
  for (const event of events) { assert.ok(event.seq > 0); assert.ok(!event.ts.includes('*')); }
  const restarted = new JobStore(root); await restarted.loadPersisted();
  assert.deepEqual(restarted.get(id), durable);
  assert.deepEqual((await restarted.events(id, 0)).events, events);
  const duplicate = await restarted.create('group-deploy', async () => { throw new Error('must not execute'); }, true,
    { operationId: 'a1-run', request: { fixture: true } });
  assert.equal(duplicate.id, id);
});

test('short secrets redact failure/recovery diagnostics without damaging failed status, image target or recovery flags', async t => {
  const { root, jobs } = await fixture(t);
  const job = await jobs.create('group-rollback', async ctx => {
    ctx.log.addEnv?.('SHORT=1\nLETTER=a\n'); ctx.enterRecovery();
    throw Object.assign(new Error('a1'), { recovery: { attempted: true, succeeded: false, target: imageRef, verification: 'failed',
      cleaned: ['api1'], pending: ['admin1'], probed: 1, probesFailed: 1, probesSkipped: 0, detail: 'a1', unknown: { id: 'a1' } } });
  }, true);
  await complete(jobs, job.id);
  const current = jobs.get(job.id)!;
  const recovery = (current.result as { recovery: Record<string, unknown> }).recovery;
  assert.equal(current.status, 'failed'); assert.equal(current.error, '******');
  assert.equal(recovery.target, imageRef); assert.equal(recovery.verification, 'failed'); assert.equal(recovery.probed, 1);
  assert.equal(recovery.detail, '******'); assert.deepEqual(recovery.cleaned, ['api1']); assert.deepEqual(recovery.unknown, { id: '******' });
  const restarted = new JobStore(root); await restarted.loadPersisted(); assert.deepEqual(restarted.get(job.id), JSON.parse(JSON.stringify(current)));
  const terminal = (await restarted.events(job.id, 0)).events.at(-1)!;
  assert.equal(terminal.event, 'failed'); assert.equal(terminal.phase, 'recover');
});

test('only the typed verify/probe detail status is preserved; other details and unknown metadata-like fields are filtered', () => {
  const secrets = new SecretValues(); secrets.add(['a', '1']);
  for (const status of ['succeeded', 'failed', 'skipped']) {
    const event = { seq: 1, ts: '2026-10-09T01:01:01Z', phase: 'verify' as const, event: 'probe', service: 'api1', detail: status };
    assert.deepEqual(sanitizeJobEvent(event, secrets), event);
  }
  const ordinary = sanitizeJobEvent({ seq: 1, ts: '2026-10-09T01:01:01Z', phase: 'recover', event: 'phase', detail: 'a1' }, secrets);
  assert.equal(ordinary.detail, '******');
  const result = sanitizeJobResult('push', { imageRef, digest: 'sha256:a1', detail: 'a1', unknown: { imageRef: 'a1', source: { sha: 'a1' } } }, secrets) as Record<string, unknown>;
  assert.equal(result.imageRef, imageRef); assert.equal(result.digest, 'sha256:a1'); assert.equal(result.detail, '******');
  assert.deepEqual(result.unknown, { imageRef: '******', source: { sha: '******' } });
  const prototypeName = sanitizeJobResult('push', JSON.parse('{"constructor":{"id":"a1"},"toString":"a1"}'), secrets);
  assert.deepEqual(prototypeName, { constructor: { id: '******' }, toString: '******' });
});
