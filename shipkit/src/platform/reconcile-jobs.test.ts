import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Job } from '../shared/types.js';
import type { ProjectContext } from './project-context.js';
import type { RemoteJobRef } from './contracts.js';
import { discoverJobs } from './reconcile-jobs.js';

function job(id: string, type: Job['type'], operationId: string): Job {
  return { id, type, operationId, status: 'succeeded', createdAt: '', updatedAt: '' };
}

async function agent(jobs: Job[]) {
  const paths: string[] = [];
  const server = createServer((req, res) => {
    paths.push(req.url ?? '');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ jobs }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, paths,
    close: () => new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve())) };
}

function context(runtimeUrl: string, builderUrl = runtimeUrl): ProjectContext {
  return { runtime: { url: runtimeUrl, token: 'test-master' },
    config: { builder: { mode: 'static', static: { url: builderUrl, token: 'test-master' } } } } as ProjectContext;
}

test('both-role Agent discovery preserves runtime deployment role and archived offsets', async (t) => {
  const jobs = [job('deploy-1', 'group-deploy', 'task:deploy:group'), job('rollback-1', 'group-rollback', 'task:deploy:group'),
    job('build-1', 'build', 'task:build:backend'), job('push-1', 'push', 'task:push:backend'),
    job('foreign', 'group-deploy', 'other:deploy:group')];
  const stub = await agent(jobs);
  t.after(stub.close);
  const existing: RemoteJobRef = { jobId: 'deploy-1', agentRole: 'builder', stageKey: 'deploy', urlRef: stub.url, logOffset: 128, eventOffset: 700 };
  const result = await discoverJobs(context(stub.url), [existing], 'task');
  assert.equal(result.refs.length, 4);
  assert.deepEqual(result.refs.map((ref) => [ref.jobId, ref.agentRole, ref.stageKey]), [
    ['deploy-1', 'runtime', 'deploy'], ['rollback-1', 'runtime', 'deploy'], ['build-1', 'builder', 'build'], ['push-1', 'builder', 'push'],
  ]);
  assert.equal(result.refs[0]?.eventOffset, 700);
  assert.equal(result.refs[0]?.logOffset, 128);
  assert.ok(stub.paths.every((p) => p === '/api/jobs?operationPrefix=task%3A'));
});

test('builder services named group retain their identity and use the builder endpoint', async (t) => {
  const jobs = [job('deploy-1', 'group-deploy', 'task:deploy:group'), job('build-1', 'build', 'task:build:group'), job('push-1', 'push', 'task:push:group')];
  const runtime = await agent(jobs);
  const builder = await agent(jobs);
  t.after(runtime.close);
  t.after(builder.close);
  const { refs } = await discoverJobs(context(runtime.url, builder.url), [], 'task');
  assert.deepEqual(refs.map((ref) => [ref.agentRole, ref.serviceKey, ref.urlRef]), [
    ['runtime', undefined, runtime.url], ['builder', 'group', builder.url], ['builder', 'group', builder.url],
  ]);
});

test('job type and operation stage disagreement refuses unsafe reconciliation', async (t) => {
  const stub = await agent([job('conflict', 'group-deploy', 'task:build:backend')]);
  t.after(stub.close);
  await assert.rejects(discoverJobs(context(stub.url), [], 'task'), /inconsistent operation correlation/);
});

test('builder-only cleanup discovery does not depend on runtime connectivity', async (t) => {
  const builder = await agent([job('build-1', 'build', 'task:build:backend')]);
  t.after(builder.close);
  const { refs } = await discoverJobs(context('http://127.0.0.1:1', builder.url), [], 'task', ['builder']);
  assert.deepEqual(refs.map((ref) => [ref.jobId, ref.agentRole, ref.urlRef]), [['build-1', 'builder', builder.url]]);
  assert.equal(builder.paths.length, 1);
});
