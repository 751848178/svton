import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EventSink } from './event-sink.js';
import { pipelineLogger } from './pipeline-logger.js';
import { reconcileTask } from './reconcile-task.js';
import { archiveForCleanup } from './cleanup-task.js';
import { retryCleanup } from './execute-task.js';
import type { ExecutionEvent, RemoteJobRef } from './contracts.js';
import type { Job, JobEvent } from '../shared/job-protocol.js';
import type { PrivateProjectSnapshot } from './private-snapshot.js';

test('event schemas preserve controlled refs, probe status and recovery while unknown fields and diagnostics redact', async () => {
  const events: ExecutionEvent[] = [], secrets = ['127.0.0.1', 'sha256', '1', 'a'];
  const sink = new EventSink({ emit: async e => { events.push(e); }, isCancellationRequested: async () => false }, secrets);
  const image = `127.0.0.1:19555/api@sha256:${'a1'.repeat(32)}`;
  const source = { type: 'git', repo: 'https://example.test/team/api1', sha: 'a1'.repeat(20), ref: 'main1' };
  const configRef = { versionId: 'config1', version: '1.0.1', name: 'name1', serviceKey: 'api1' };
  const result = { releaseId: 'release1', previousReleaseId: 'parent1', verification: 'passed', changedServices: ['api1'], changedRefs: { api1: image },
    services: { api1: { imageRef: image, hasEnv: true, source, configRef, unknown: { id: 'a1' } } },
    source, configRef, message: '127.0.0.1 sha256 a1', constructor: 'a1' };
  await sink.emit({ type: 'stage', stageKey: 'deploy', status: 'succeeded', detail: { result, unknown: { jobId: 'a1' } } });
  await sink.emit({ type: 'recovery', status: 'failed', detail: { attempted: true, succeeded: false, target: image, verification: 'failed', detail: 'a1', unknown: { id: 'a1' } } });
  await sink.emit({ type: 'remote-event', stageKey: 'verify', detail: { jobId: 'job1', phase: 'verify', event: 'probe', seq: 1, ts: '2026-10-09', service: 'api1', detail: 'failed', unknown: 'a1' } });
  await sink.emit({ type: 'diagnostic', detail: { id: 'a1', status: 'a1', result: { imageRef: image }, number: 1, flag: false }, message: 'a1' });
  const stored = events[0]!.detail!.result as typeof result;
  assert.equal(stored.releaseId, 'release1'); assert.deepEqual(stored.changedRefs, { api1: image });
  assert.deepEqual(stored.services.api1.source, source); assert.deepEqual(stored.services.api1.configRef, configRef);
  assert.equal(stored.services.api1.imageRef, image); assert.equal(stored.services.api1.hasEnv, true);
  assert.doesNotMatch(stored.message, /127\.0\.0\.1|sha256|a1/); assert.doesNotMatch(stored.constructor as unknown as string, /a1/);
  assert.equal(events[1]!.detail!.target, image); assert.equal(events[1]!.detail!.succeeded, false); assert.equal(events[1]!.detail!.verification, 'failed');
  assert.equal(events[2]!.detail!.detail, 'failed'); assert.equal(events[2]!.detail!.jobId, 'job1'); assert.equal(events[2]!.detail!.seq, 1);
  assert(!JSON.stringify(events[3]!.detail).includes('a1')); assert.equal(typeof events[3]!.detail!.number, 'string');
  assert.notEqual((events[3]!.detail!.result as { imageRef: string }).imageRef, image);
});

test('durable intent and job refs survive JSON reload and real HTTP restart reconciliation despite env overlap', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ship-task-restart-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const ledger = path.join(directory, 'events.json'), events: ExecutionEvent[] = [], taskId = 'sha256-task1';
  const imageRef = `example/api@sha256:${'a1'.repeat(32)}`;
  const result = { app: 'app1', releaseId: 'release1', previousReleaseId: 'parent1', changedServices: ['api1'], inheritedServices: [], changedRefs: { api1: imageRef }, verification: 'passed' };
  const job: Job = { id: 'job1', type: 'group-deploy', operationId: `${taskId}:deploy:group`, status: 'succeeded', createdAt: '', updatedAt: '', result };
  const journal: JobEvent[] = [{ seq: 1, ts: '2026-10-09', phase: 'verify', event: 'probe', service: 'api1', detail: 'succeeded' }];
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json'); const route = req.url ?? '';
    if (route.startsWith('/api/jobs?')) res.end(JSON.stringify({ jobs: [job] }));
    else if (route.includes('/log?')) res.end(JSON.stringify({ text: '', nextOffset: 0, totalBytes: 0, complete: true }));
    else if (route.includes('/events?')) { const after = Number(new URL(route, 'http://localhost').searchParams.get('after') ?? 0); res.end(JSON.stringify({ events: journal.filter(e => e.seq > after), nextSeq: 1, complete: true })); }
    else if (route === '/api/jobs/job1') res.end(JSON.stringify(job));
    else { res.statusCode = 404; res.end('{}'); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`, handle = { url, token: 'fixture-runtime-token' };
  const hooks = { executionId: taskId, isCancellationRequested: async () => false,
    emit: async (event: ExecutionEvent) => { events.push(event); await writeFile(ledger, JSON.stringify(events)); } };
  const log = pipelineLogger(new EventSink(hooks, ['127.0.0.1', 'sha256']), hooks);
  assert.equal(await log.operationId?.('deploy', undefined, handle), job.operationId);
  await log.observeJob?.({ handle, jobId: job.id, label: 'deploy', job, final: true });
  const stored = JSON.parse(await readFile(ledger, 'utf8')) as ExecutionEvent[];
  assert.equal(stored.find(e => e.type === 'remote-intent')!.detail!.operationId, job.operationId);
  assert.equal(stored.find(e => e.type === 'remote-intent')!.detail!.urlRef, url);
  const refs = [...new Map(stored.filter(e => e.remoteJob).map(e => [e.remoteJob!.jobId, e.remoteJob!])).values()] as RemoteJobRef[];
  assert.equal(refs[0]!.urlRef, url); assert.equal(refs[0]!.status, 'succeeded');
  const snapshot: PrivateProjectSnapshot = { executionKind: 'config-only', config: { builder: { mode: 'static', static: { url: 'http://127.0.0.1:1', token: 'unused-offline-builder-token' } }, runtime: { targets: { prod: handle } } },
    runtime: { ...handle, via: 'plaintext' }, targetKey: 'prod', identity: 'fixture-project', spec: { schemaVersion: 2, name: 'app1', services: { api1: {} } },
    envFiles: {}, redactionValues: ['127.0.0.1', 'sha256'] };
  const outcome = await reconcileTask({ privateSnapshot: snapshot }, JSON.parse(JSON.stringify(refs)), hooks);
  assert.equal(outcome.status, 'succeeded'); assert.equal(outcome.remoteReleaseId, 'release1'); assert.equal(outcome.cleanupState, 'not-needed');
  for (const executionKind of ['config-only', 'rollback'] as const) {
    job.type = executionKind === 'rollback' ? 'group-rollback' : 'group-deploy';
    snapshot.executionKind = executionKind;
    assert.equal((await reconcileTask({ privateSnapshot: snapshot }, [], hooks)).status, 'succeeded');
    const legacy = structuredClone(snapshot); delete legacy.executionKind;
    const input = { privateSnapshot: legacy, executionKind };
    assert.equal((await reconcileTask(input, [], hooks)).status, 'succeeded');
    assert.deepEqual(await archiveForCleanup(input, [], hooks), { archivedJobs: 0 });
    assert.deepEqual(await retryCleanup(input), { cleanupState: 'not-needed' });
  }
  await assert.rejects(reconcileTask({ privateSnapshot: snapshot, executionKind: 'release' }, [], hooks), /different task kind/);
  const stage = stored.find(e => e.type === 'stage' && e.stageKey === 'deploy' && e.status === 'succeeded')!;
  assert.equal((stage.detail!.result as typeof result).changedRefs.api1, imageRef);
});
