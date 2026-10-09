import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JobStore } from './jobs.js';
import { lifecycleRoutes } from './routes-lifecycle.js';
import type { RouteCtx, RouteDeps } from './route-types.js';
const execute = promisify(execFile);
async function root(t: test.TestContext) {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-job-operation-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { dir, jobs: new JobStore(dir) };
}
async function settle(jobs: JobStore) {
  const deadline = Date.now() + 5000;
  while (jobs.activeCount() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 2));
  assert.equal(jobs.activeCount(), 0);
}
test('same operation concurrent requests enqueue once and canonical payload conflicts return 409', async (t) => {
  const { dir, jobs } = await root(t);
  let runs = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const request = { operationId: 'task-a:deploy:group', changed: { api: { imageRef: 'digest', envFileContent: 'private-secret' } } };
  const results = await Promise.all(Array.from({ length: 24 }, () => jobs.create('group-deploy', async () => { runs++; await gate; return {}; }, true, { operationId: request.operationId, request })));
  assert.equal(new Set(results.map((job) => job.id)).size, 1);
  const job = results[0]!;
  assert.equal((await jobs.create('group-deploy', async () => { runs++; }, true, { operationId: request.operationId, request: { changed: { api: { envFileContent: 'private-secret', imageRef: 'digest' } }, operationId: request.operationId } })).id, job.id);
  await assert.rejects(jobs.create('group-deploy', async () => {}, true, { operationId: request.operationId, request: { ...request, changed: { api: { imageRef: 'different' } } } }), (error: unknown) => {
    assert.equal((error as { status: number }).status, 409);
    assert.equal(String(error).includes('private-secret'), false);
    return true;
  });
  await assert.rejects(jobs.create('build', async () => {}, true, { operationId: request.operationId, request }), /different request payload or job type/);
  const persisted = await readFile(path.join(dir, 'jobs', job.id, 'job.json'), 'utf8');
  assert.equal(persisted.includes('private-secret'), false);
  assert.match(job.requestHash!, /^[a-f0-9]{64}$/);
  release(); await settle(jobs); assert.equal(runs, 1);
});
test('lost acceptance response plus abrupt process exit is recoverable by operationPrefix and retry never reexecutes', async (t) => {
  const { dir } = await root(t);
  const module = new URL('./jobs.js', import.meta.url).href;
  const metadata = { operationId: 'task-crash:deploy:group', request: { spec: { name: 'isolated' }, envFileContent: 'private-secret' } };
  // This child deliberately never exposes the accepted jobId to its controller.
  await execute(process.execPath, ['--input-type=module', '-e', `
    const { JobStore } = await import(${JSON.stringify(module)});
    await new JobStore(${JSON.stringify(dir)}).create('group-deploy', async () => new Promise(() => {}), true, ${JSON.stringify(metadata)});
    process.exit(0);
  `]);
  const restarted = new JobStore(dir); await restarted.loadPersisted();
  const recovered = restarted.list('task-crash:', 'runtime');
  assert.equal(recovered.length, 1); assert.equal(recovered[0]?.status, 'failed');
  assert.match(recovered[0]?.error ?? '', /agent restarted/);
  let reruns = 0;
  const retried = await restarted.create('group-deploy', async () => { reruns++; }, true, metadata);
  assert.equal(retried.id, recovered[0]?.id); assert.equal(reruns, 0);
  assert.equal(JSON.stringify(recovered).includes('private-secret'), false);
  assert.deepEqual(restarted.list('other-task:', 'runtime'), []);
});
test('operation list filters by authenticated role before returning matching jobs', async (t) => {
  const { jobs } = await root(t);
  const build = await jobs.create('build', async () => {}, false, { operationId: 'task-list:build:api', request: { name: 'api' } });
  const deploy = await jobs.create('group-deploy', async () => {}, false, { operationId: 'task-list:deploy:group', request: { app: 'isolated' } });
  await settle(jobs);
  const deps = { jobs, role: 'both' } as RouteDeps;
  const list = lifecycleRoutes(deps).find((route) => route.re.test('/api/jobs'))!;
  const ctx = { req: undefined as never, params: [], query: new URLSearchParams({ operationPrefix: 'task-list:' }), auth: { role: 'builder' } } as RouteCtx;
  assert.deepEqual(((await list.handler(ctx)).body as { jobs: { id: string }[] }).jobs.map((job) => job.id), [build.id]);
  ctx.auth = { role: 'runtime' };
  assert.deepEqual(((await list.handler(ctx)).body as { jobs: { id: string }[] }).jobs.map((job) => job.id), [deploy.id]);
  ctx.query.set('operationPrefix', '../unsafe');
  await assert.rejects(list.handler(ctx), /invalid operationPrefix/);
});
test('metadata is optional but malformed operation IDs are refused before job creation', async (t) => {
  const { jobs } = await root(t);
  await assert.rejects(jobs.create('build', async () => {}, false, { operationId: 'bad id', request: {} }), /operationId must/);
  await assert.rejects(jobs.create('build', async () => {}, false, { operationId: 'valid-id' }), /requires a request payload/);
  assert.equal(jobs.list().length, 0);
  const ordinary = await jobs.create('build', async () => {});
  assert.equal(ordinary.operationId, undefined); await settle(jobs);
});
