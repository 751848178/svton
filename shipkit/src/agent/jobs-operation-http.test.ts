// Real local HTTP transport; all Docker mutations are deliberately refused by this isolated fixture.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const realExec = await import('../shared/exec.js');
mock.module('../shared/exec.js', { namedExports: {
  ...realExec,
  exec: async (cmd: string, args: string[], options?: unknown) => {
    if (cmd !== 'docker') return realExec.exec(cmd, args, options as never);
    if (args[0] !== 'version') throw new Error('Docker mutation refused by isolated operation test');
    return { code: 0, stdout: '28.3.0', stderr: '', truncated: false, timedOut: false };
  },
} });
const { startAgent } = await import('./server.js');
const { SecurityStore } = await import('./security.js');
test('HTTP operation acceptance is idempotent across concurrent requests, lost response, restart and role-filtered discovery', async (t) => {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-operation-http-'));
  let agent = await startAgent({ role: 'both', token: 'isolated-master', host: '127.0.0.1', port: 0, workRoot });
  t.after(async () => { await agent.close(); await rm(workRoot, { recursive: true, force: true }); });
  const post = async (endpoint: string, body: unknown) => {
    const response = await fetch(`${agent.url}${endpoint}`, { method: 'POST', headers: { authorization: 'Bearer isolated-master', 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as { jobId?: string } };
  };
  const requests = [
    ['/api/build', { operationId: 'http-task:build:api', source: { type: 'tarball', id: '11111111-1111-1111-1111-111111111111' }, spec: { name: 'api' }, privatePayload: 'never-return-private' }],
    ['/api/push', { operationId: 'http-task:push:api', name: 'api', tag: 'isolated', registry: 'example.invalid' }],
    ['/api/deploy-group', { operationId: 'http-task:deploy:group', schemaVersion: 2, app: 'operation-group', project: 'isolated', env: 'local', spec: { schemaVersion: 2, name: 'operation-group', services: { api: {} } }, changed: { api: { imageRef: `reg/api@sha256:${'a'.repeat(64)}` } }, baseReleaseId: null }],
    ['/api/rollback-group', { operationId: 'http-task:rollback:group', app: 'operation-group', project: 'isolated', env: 'local' }],
  ] as const;
  const concurrent = await Promise.all(Array.from({ length: 16 }, () => post(requests[0][0], requests[0][1])));
  assert.ok(concurrent.every((response) => response.status === 202));
  assert.equal(new Set(concurrent.map((response) => response.body.jobId)).size, 1);
  for (const [endpoint, body] of requests) {
    const original = await post(endpoint, body);
    const retry = await post(endpoint, body);
    assert.equal(original.status, 202); assert.equal(retry.status, 202); assert.equal(retry.body.jobId, original.body.jobId);
    assert.equal((await post(endpoint, { ...body, payloadChanged: true })).status, 409);
  }
  const query = async (token = 'isolated-master') => (await (await fetch(`${agent.url}/api/jobs?operationPrefix=http-task%3A`, { headers: { authorization: `Bearer ${token}` } })).json()) as { jobs: { id: string; type: string; requestHash: string }[] };
  const before = await query(); assert.equal(before.jobs.length, 4);
  assert.equal(JSON.stringify(before).includes('never-return-private'), false);
  assert.ok(before.jobs.every((job) => /^[a-f0-9]{64}$/.test(job.requestHash)));
  const security = new SecurityStore(path.join(workRoot, 'security.json')); await security.load();
  const code = await security.createCode('builder', 1);
  const credential = await security.exchange(code.code, 'operation-controller');
  assert.ok(credential?.token);
  assert.deepEqual((await query(credential!.token)).jobs.map((job) => job.type).sort(), ['build', 'push']);
  await agent.close();
  agent = await startAgent({ role: 'both', token: 'isolated-master', host: '127.0.0.1', port: 0, workRoot });
  const discovered = await query(); assert.deepEqual(discovered.jobs.map((job) => job.id).sort(), before.jobs.map((job) => job.id).sort());
  // The controller discarded the first response; operation identity finds/reuses the same accepted work after restart.
  assert.equal((await post(requests[0][0], requests[0][1])).body.jobId, concurrent[0]?.body.jobId);
});
