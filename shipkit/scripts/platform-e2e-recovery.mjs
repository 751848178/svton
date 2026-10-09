import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readFixture, command } from './platform-e2e-fixture.mjs';
import { call, finishTask, until } from './platform-api-client.mjs';

const f = await readFixture();
const route = `/projects/${f.projectId}`;
const net = `${f.runId}-recovery`;
const records = [];
const save = () => writeFile(path.join(f.project, 'ship.yaml'), JSON.stringify(f.spec));
async function release() {
  const p = await call('POST', `${route}/plans`, { kind: 'release', services: ['api'], sourceMode: 'directory' });
  return call('POST', `${route}/tasks`, { planId: p.id });
}
async function jobs(taskId) {
  const page = await fetch(`http://127.0.0.1:19741/api/jobs?operationPrefix=${taskId}:`, { headers: { authorization: `Bearer ${f.token}` } }).then((r) => r.json());
  return page.jobs;
}
async function record(label, fn) {
  await fn(); records.push({ label, passed: true, at: new Date().toISOString() }); console.log(`ok ${label}`);
  await writeFile('/tmp/codex-tool-runs/svton/platform-recovery-evidence.json', JSON.stringify(records, null, 2));
}
await command('docker', ['network', 'create', net], { env: f.env });
f.spec.services.api.networks = [net];
f.spec.services.api.healthcheck = { path: '/', hostPort: 19901, timeoutSeconds: 10 }; await save();
assert.equal((await finishTask((await release()).id)).task.status, 'succeeded');
await record('actual rollback restoration failure remains failed with recovery evidence', async () => {
  delete f.spec.services.api.networks;
  f.spec.services.api.healthcheck = { path: '/missing', hostPort: 19901, timeoutSeconds: 15 }; await save();
  const task = await release();
  await until(async () => (await jobs(task.id)).some((j) => j.type === 'group-deploy' && j.phase === 'verify'), 'faulty deploy verification');
  // The new service no longer uses this owned network; removing it makes the
  // previous snapshot genuinely unrestorable without changing business data.
  await command('docker', ['network', 'rm', net], { env: f.env });
  const result = await finishTask(task.id);
  assert.equal(result.task.status, 'failed'); assert.equal(result.task.recoveryState, 'failed');
  assert.ok(result.events.some((e) => e.type === 'recovery' && e.status === 'failed'));
});
await record('repair release restores healthy service and preserves external volume sentinel', async () => {
  await command('docker', ['network', 'create', net], { env: f.env });
  f.spec.services.api.networks = [net];
  f.spec.services.api.healthcheck = { path: '/', hostPort: 19901, timeoutSeconds: 10 }; await save();
  assert.equal((await finishTask((await release()).id)).task.status, 'succeeded');
  assert.match(await (await fetch('http://127.0.0.1:19901')).text(), /api-v4/);
  const id = await command('docker', ['ps', '-q', '--filter', `label=com.docker.compose.project=ship_${f.runId}_web`], { env: f.env });
  assert.equal(await command('docker', ['exec', id, 'cat', '/usr/local/apache2/htdocs/data/sentinel.txt'], { env: f.env }), 'durable-sentinel');
});
await record('historical snapshot and service range are rejected before task creation', async () => {
  await call('POST', `${route}/plans`, { kind: 'rollback', services: ['api'], changeReleaseId: 'missing-snapshot' }, 409);
  const history = await call('GET', `${route}/history`);
  const selected = history.items.find((i) => i.rollbackAvailable && i.changedServices.length === 1 && i.changedServices[0] === 'api');
  assert.ok(selected);
  await call('POST', `${route}/plans`, { kind: 'rollback', services: ['web'], changeReleaseId: selected.releaseId }, 400);
});
await writeFile('/tmp/codex-tool-runs/svton/platform-fixture.json', JSON.stringify(f), { mode: 0o600 });
