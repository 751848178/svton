import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import type { TencentCvmConfig } from '../shared/types.js';
import { stateFileFor, writeState } from '../providers/builder-state.js';
import { archiveForCleanup } from './cleanup-task.js';
import type { ExecutionEvent, ExecutionPlan, RemoteJobRef } from './contracts.js';

test('cleanup archives task builder jobs through complete cursors and refuses unsafe destruction boundaries', async () => {
  const fixture = await cleanupFixture();
  try {
    const events: ExecutionEvent[] = [];
    const hooks = { executionId: 'cleanup-test', emit: async (event: ExecutionEvent) => { events.push(event); }, isCancellationRequested: async () => false };
    const result = await archiveForCleanup(fixture.input, [], hooks, fixture.plan, 'instance-test');
    assert.equal(result.archivedJobs, 1);
    assert.equal(result.leaseRef, 'instance-test');
    const messages = events.filter((event) => event.type === 'log').map((event) => event.message).join('');
    assert(messages.includes('build line [redacted]'));
    assert(!messages.includes('fixture-builder-secret'));
    const remote = events.filter((event) => event.remoteJob).at(-1)?.remoteJob;
    assert.equal(remote?.logOffset, fixture.logBytes);
    assert.equal(remote?.eventOffset, 1);
    assert.equal(remote?.status, 'succeeded');
    assert.equal(fixture.runtimeReads(), 0);

    fixture.mode.status = 'running';
    await assert.rejects(archiveForCleanup(fixture.input, [], hooks, fixture.plan, 'instance-test'), /still active/);
    fixture.mode.status = 'succeeded';
    fixture.mode.complete = false;
    await assert.rejects(archiveForCleanup(fixture.input, [], hooks, fixture.plan, 'instance-test'), /not flushed|incomplete|complete/i);
    fixture.mode.complete = true;
    const pendingRef = { jobId: 'job-build', agentRole: 'builder', urlRef: 'http://127.0.0.1:9', stageKey: 'build', status: 'running' } satisfies RemoteJobRef;
    await assert.rejects(archiveForCleanup(fixture.input, [pendingRef], hooks, fixture.plan, 'instance-test'), /endpoint no longer matches/);
    await assert.rejects(archiveForCleanup(fixture.input, [], hooks, fixture.plan, 'different-instance'), /ownership changed/);
    const changedPlan = { ...fixture.plan, detail: { ...fixture.plan.detail, configDigest: 'wrong-digest' } };
    await assert.rejects(archiveForCleanup(fixture.input, [], hooks, changedPlan, 'instance-test'), /Configuration reference changed/);
    await assert.rejects(archiveForCleanup(fixture.input, [], { ...hooks, emit: async () => { throw new Error('durable archive failed'); } }, fixture.plan, 'instance-test'), /durable archive failed/);
    await assert.rejects(archiveForCleanup(fixture.input, [], { ...hooks, executionId: undefined }, fixture.plan, 'instance-test'), /durable task execution ID/);
  } finally { await fixture.dispose(); }
});

async function cleanupFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'shipkit-cleanup-'));
  const previousStateDir = process.env.SHIPKIT_STATE_DIR;
  const previousSecret = process.env.TENCENTCLOUD_SECRET_ID;
  process.env.SHIPKIT_STATE_DIR = path.join(root, 'private-state');
  process.env.TENCENTCLOUD_SECRET_ID = 'isolated-secret-id';
  const mode = { status: 'succeeded', complete: true };
  let runtimeReads = 0;
  const text = 'build line fixture-builder-secret\n';
  const logBytes = Buffer.byteLength(text);
  const agent = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    const url = new URL(request.url ?? '/', 'http://fixture');
    const job = { id: 'job-build', type: 'build', status: mode.status, operationId: 'cleanup-test:build:api', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), cancellable: true };
    if (url.pathname === '/api/jobs') response.end(JSON.stringify({ jobs: [job] }));
    else if (url.pathname === '/api/jobs/job-build') response.end(JSON.stringify(job));
    else if (url.pathname.endsWith('/log')) {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      response.end(JSON.stringify({ text: Buffer.from(text).subarray(offset).toString(), nextOffset: logBytes, totalBytes: logBytes, complete: mode.complete }));
    } else if (url.pathname.endsWith('/events')) {
      const after = Number(url.searchParams.get('after') ?? 0);
      response.end(JSON.stringify({ events: after < 1 ? [{ seq: 1, ts: new Date().toISOString(), phase: 'complete', event: 'succeeded' }] : [], nextSeq: Math.max(after, 1), complete: true }));
    } else { runtimeReads++; response.statusCode = 404; response.end('{}'); }
  });
  await new Promise<void>((resolve) => agent.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(agent.address() as { port: number }).port}`;
  const project = path.join(root, 'project');
  await mkdir(project);
  await writeFile(path.join(project, 'ship.yaml'), 'schemaVersion: 2\nname: cleanup-fixture\nservices:\n  api: {}\n');
  const configPath = path.join(root, 'private-config.yaml');
  const cfg: TencentCvmConfig = { region: 'ap-test', zone: 'ap-test-1', instanceType: 'S5.SMALL1', imageId: 'img-test', vpcId: 'vpc-test', subnetId: 'subnet-test', securityGroupIds: ['sg-test'], advertiseHost: '127.0.0.1', maxLifetimeMinutes: 180 };
  await writeFile(configPath, `builder:\n  mode: dynamic\n  dynamic:\n    provider: tencent\n    tencent:\n${Object.entries(cfg).map(([key, value]) => `      ${key}: ${JSON.stringify(value)}`).join('\n')}\nruntime:\n  targets:\n    isolated:\n      url: http://127.0.0.1:1\n      token: fixture-runtime-secret\n`, { mode: 0o600 });
  await writeState(stateFileFor(cfg, process.env.TENCENTCLOUD_SECRET_ID), {
    instanceId: 'instance-test', region: cfg.region, url, token: 'fixture-builder-secret', status: 'ready',
    createdAt: new Date().toISOString(), expireAt: new Date(Date.now() + 3600_000).toISOString(),
  });
  const plan: ExecutionPlan = { kind: 'release', selection: ['api'], baseReleaseId: null, sourceMode: 'directory', keepEnv: false, keepBuilder: true,
    fingerprint: 'test-fingerprint', expiresAt: new Date(Date.now() + 60_000).toISOString(), detail: {
      targetKey: 'isolated', projectIdentity: 'local:cleanup-test', configDigest: createHash('sha256').update(await readFile(configPath)).digest('hex'),
    } };
  return { mode, input: { rootPath: project, configPath, targetKey: 'isolated' }, plan, logBytes, runtimeReads: () => runtimeReads,
    dispose: async () => {
      await new Promise<void>((resolve) => agent.close(() => resolve()));
      if (previousStateDir === undefined) delete process.env.SHIPKIT_STATE_DIR; else process.env.SHIPKIT_STATE_DIR = previousStateDir;
      if (previousSecret === undefined) delete process.env.TENCENTCLOUD_SECRET_ID; else process.env.TENCENTCLOUD_SECRET_ID = previousSecret;
      await rm(root, { recursive: true, force: true });
    } };
}
