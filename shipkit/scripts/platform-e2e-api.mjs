import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readFixture } from './platform-e2e-fixture.mjs';
import { apiRoot, call, finishTask } from './platform-api-client.mjs';

const fixture = await readFixture();
const evidence = [];
async function record(label, fn) {
  await fn(); evidence.push({ label, passed: true, at: new Date().toISOString() }); console.log(`ok ${label}`);
}
const existing = (await call('GET', '/projects')).items.find((p) => p.id === fixture.projectId || p.rootPath === fixture.project);
const project = existing ?? await call('POST', '/projects', { name: 'Shipkit 隔离验收项目', rootPath: fixture.project, configPath: fixture.configPath, serverName: '本机隔离 Agent',
  services: [{ serviceKey: 'api', displayName: '测试 API', entryUrl: 'http://127.0.0.1:19901' }, { serviceKey: 'web', displayName: '测试网站', entryUrl: 'http://127.0.0.1:19902' }] });
fixture.projectId = project.id;
await writeFile('/tmp/codex-tool-runs/svton/platform-fixture.json', JSON.stringify(fixture), { mode: 0o600 });
const release = async (services) => {
  const plan = await call('POST', `/projects/${project.id}/plans`, { kind: 'release', services, sourceMode: 'directory' });
  const task = await call('POST', `/projects/${project.id}/tasks`, { planId: plan.id });
  const detail = await finishTask(task.id);
  assert.equal(detail.task.status, 'succeeded', detail.task.error);
  return detail;
};
let first, partial, repeated;
await record('registration reads real Git, config and Agent facts', async () => {
  const status = await call('GET', `/projects/${project.id}/status`);
  assert.equal(status.live.runtime.check.ok, true); assert.equal(status.live.source.branch, 'main');
  assert.equal(status.live.services.length, 2); assert.equal(JSON.stringify(status).includes(fixture.token), false);
});
await record('first deployment requires all services', async () => {
  const response = await fetch(`${apiRoot}/projects/${project.id}/plans`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-shipkit-local': '1' }, body: JSON.stringify({ kind: 'release', services: ['api'] }) });
  assert.ok([400, 409].includes(response.status));
});
await record('full build, registry push, deploy, health and archive succeed', async () => {
  first = await release(['api', 'web']); assert.equal(first.task.cleanupState, 'static');
  for (const stage of ['build', 'push', 'deploy']) {
    const logs = await call('GET', `/tasks/${first.task.id}/logs?stage=${stage}`);
    assert.ok(logs.text.length > 0, `${stage} logs missing`);
  }
  assert.match(await (await fetch('http://127.0.0.1:19901')).text(), /api-v1/);
});
await record('partial release inherits unselected service', async () => {
  await writeFile(path.join(fixture.project, 'api/index.html'), `api-v2 ${fixture.runId}\n`);
  partial = await release(['api']); assert.match(await (await fetch('http://127.0.0.1:19901')).text(), /api-v2/);
  assert.match(await (await fetch('http://127.0.0.1:19902')).text(), /web-v1/);
});
await record('repeated explicit release creates a distinct durable round', async () => {
  await writeFile(path.join(fixture.project, 'api/index.html'), `api-v3 ${fixture.runId}\n`);
  repeated = await release(['api']); assert.notEqual(repeated.task.id, partial.task.id);
});
await record('historical service rollback restores selected change parent', async () => {
  const history = await call('GET', `/projects/${project.id}/history`);
  assert.ok(history.items.find((h) => h.releaseId === partial.task.remoteReleaseId)?.rollbackAvailable);
  const plan = await call('POST', `/projects/${project.id}/plans`, { kind: 'rollback', services: ['api'], changeReleaseId: partial.task.remoteReleaseId });
  const task = await call('POST', `/projects/${project.id}/tasks`, { planId: plan.id });
  const detail = await finishTask(task.id); assert.equal(detail.task.status, 'succeeded', detail.task.error);
  assert.match(await (await fetch('http://127.0.0.1:19901')).text(), /api-v1/);
});
await record('durable history includes every round and selected service logs', async () => {
  const tasks = await call('GET', `/projects/${project.id}/tasks`); assert.ok(tasks.items.length >= 4);
  const logs = await call('GET', `/tasks/${first.task.id}/logs?stage=build&service=api`); assert.ok(logs.text.length > 0);
  const detail = await call('GET', `/tasks/${first.task.id}`); assert.equal(detail.task.remoteReleaseId, first.task.remoteReleaseId);
});
await writeFile('/tmp/codex-tool-runs/svton/platform-api-evidence.json', JSON.stringify({ projectId: project.id, firstTaskId: first?.task.id, partialTaskId: partial?.task.id, evidence }, null, 2));
console.log(`evidence /tmp/codex-tool-runs/svton/platform-api-evidence.json`);
