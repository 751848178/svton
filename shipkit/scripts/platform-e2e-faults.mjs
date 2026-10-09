import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readFixture, command } from './platform-e2e-fixture.mjs';
import { call, finishTask, until } from './platform-api-client.mjs';

const f = await readFixture();
const projectRoute = `/projects/${f.projectId}`;
const evidence = [];
const saveSpec = () => writeFile(path.join(f.project, 'ship.yaml'), JSON.stringify(f.spec));
const plan = (services = ['api']) => call('POST', `${projectRoute}/plans`, { kind: 'release', services, sourceMode: 'directory' });
const start = (p) => call('POST', `${projectRoute}/tasks`, { planId: p.id });
const state = () => call('GET', `${projectRoute}/status`);
const agentJobs = async (taskId) => {
  const page = await fetch(`http://127.0.0.1:19741/api/jobs?operationPrefix=${taskId}:`, { headers: { authorization: `Bearer ${f.token}` } }).then((r) => r.json());
  return page.jobs;
};
async function record(label, fn) {
  await fn(); evidence.push({ label, passed: true, at: new Date().toISOString() }); console.log(`ok ${label}`);
  await writeFile('/tmp/codex-tool-runs/svton/platform-fault-evidence.json', JSON.stringify(evidence, null, 2));
}
await record('concurrent task rejected and later stale plan performs no remote work', async () => {
  const first = await plan(); const stale = await plan();
  const task = await start(first);
  await call('POST', `${projectRoute}/tasks`, { planId: stale.id }, 409);
  assert.equal((await finishTask(task.id)).task.status, 'succeeded');
  const staleTask = await start(stale); const outcome = await finishTask(staleTask.id);
  assert.equal(outcome.task.status, 'failed'); assert.equal(outcome.remoteJobs.length, 0);
});
await record('source mutation invalidates plan before builder work', async () => {
  const p = await plan(); await writeFile(path.join(f.project, 'api/index.html'), `api-v4 ${f.runId}\n`);
  const task = await start(p); const outcome = await finishTask(task.id);
  assert.equal(outcome.task.status, 'failed'); assert.equal(outcome.remoteJobs.length, 0);
});
await record('build cancellation is acknowledged remotely without changing runtime', async () => {
  const base = (await state()).live.runtime.currentReleaseId;
  await writeFile(path.join(f.project, 'api/Dockerfile'), `FROM httpd:alpine\nRUN sleep 8\nCOPY index.html /usr/local/apache2/htdocs/index.html\n`);
  const task = await start(await plan());
  await until(async () => (await agentJobs(task.id)).some((job) => job.type === 'build' && job.status === 'running'), 'running build');
  await call('POST', `/tasks/${task.id}/cancel`, {});
  const outcome = await finishTask(task.id); assert.equal(outcome.task.status, 'cancelled', outcome.task.error);
  assert.equal((await state()).live.runtime.currentReleaseId, base);
  assert.ok((await agentJobs(task.id)).some((job) => job.status === 'cancelled'));
  await writeFile(path.join(f.project, 'api/Dockerfile'), 'FROM httpd:alpine\nCOPY index.html /usr/local/apache2/htdocs/index.html\n');
});
await record('failed health restores previous version and records real recovery', async () => {
  f.spec.services.api.healthcheck = { path: '/missing', hostPort: 19901, timeoutSeconds: 3 }; await saveSpec();
  const task = await start(await plan()); const outcome = await finishTask(task.id);
  assert.equal(outcome.task.status, 'failed'); assert.equal(outcome.task.recoveryState, 'succeeded');
  assert.match(await (await fetch('http://127.0.0.1:19901')).text(), /api-v3/);
});
await record('runtime cancellation during probes restores committed baseline', async () => {
  f.spec.services.api.healthcheck.timeoutSeconds = 30; await saveSpec();
  const base = (await state()).live.runtime.currentReleaseId;
  const task = await start(await plan());
  await until(async () => (await agentJobs(task.id)).some((job) => job.type === 'group-deploy' && job.phase === 'verify'), 'runtime verification');
  await call('POST', `/tasks/${task.id}/cancel`, {});
  const outcome = await finishTask(task.id); assert.equal(outcome.task.status, 'cancelled'); assert.equal(outcome.task.recoveryState, 'succeeded');
  assert.equal((await state()).live.runtime.currentReleaseId, base);
});
await record('skipped probes remain explicit and external volume data survives', async () => {
  delete f.spec.services.api.healthcheck; await saveSpec();
  const task = await start(await plan()); const outcome = await finishTask(task.id);
  assert.equal(outcome.task.status, 'succeeded');
  assert.ok(outcome.stages.some((s) => s.stageKey === 'verify' && s.status === 'skipped'));
  const id = await command('docker', ['ps', '-q', '--filter', `label=com.docker.compose.project=ship_${f.runId}_web`], { env: f.env });
  await command('docker', ['exec', id, 'sh', '-c', 'printf durable-sentinel > /usr/local/apache2/htdocs/data/sentinel.txt'], { env: f.env });
  const text = await command('docker', ['exec', id, 'cat', '/usr/local/apache2/htdocs/data/sentinel.txt'], { env: f.env });
  assert.equal(text, 'durable-sentinel');
});
f.spec.services.api.healthcheck = { path: '/', hostPort: 19901, timeoutSeconds: 10 }; await saveSpec();
await writeFile('/tmp/codex-tool-runs/svton/platform-fixture.json', JSON.stringify(f), { mode: 0o600 });
console.log('fault evidence /tmp/codex-tool-runs/svton/platform-fault-evidence.json');
