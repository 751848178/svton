import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readFixture, command, repo } from './platform-e2e-fixture.mjs';
import { call, finishTask, until } from './platform-api-client.mjs';

const f = await readFixture();
const proofPath = '/tmp/codex-tool-runs/svton/platform-restart-evidence.json';
const route = `/projects/${f.projectId}`;
const saveSpec = () => writeFile(path.join(f.project, 'ship.yaml'), JSON.stringify(f.spec));
if (process.argv.includes('--prepare')) {
  f.spec.services.api.healthcheck = { path: '/ready.html', hostPort: 19901, timeoutSeconds: 60 }; await saveSpec();
  const p = await call('POST', `${route}/plans`, { kind: 'release', services: ['api'], sourceMode: 'directory' });
  const task = await call('POST', `${route}/tasks`, { planId: p.id });
  await until(async () => {
    const result = await fetch(`http://127.0.0.1:19741/api/jobs?operationPrefix=${task.id}:`, { headers: { authorization: `Bearer ${f.token}` } }).then((r) => r.json());
    return result.jobs.some((job) => job.type === 'group-deploy' && job.phase === 'verify');
  }, 'runtime verify before controller reboot');
  const runtime = JSON.parse(await readFile(path.join(repo, 'shipkit/.platform/runtime.json'), 'utf8'));
  process.kill(runtime.supervisorPid, 'SIGTERM');
  await until(async () => { try { await fetch('http://127.0.0.1:8770/api/projects'); return false; } catch { return true; } }, 'controller shutdown');
  const { PrismaClient } = await import('../../apps/shipkit-api/generated/client/index.js');
  const db = new PrismaClient({ datasources: { db: { url: `file:${path.join(repo, 'shipkit/.platform/platform.db')}` } } });
  // Simulate the precise response/persistence gap for THIS isolated task only;
  // durable operation intent remains, requiring Agent operation discovery.
  const deleted = await db.remoteJob.deleteMany({ where: { taskId: task.id, agentRole: 'runtime' } });
  await db.$disconnect(); assert.ok(deleted.count > 0);
  await writeFile(proofPath, JSON.stringify({ taskId: task.id, projectId: f.projectId, removedMappings: deleted.count, preparedAt: new Date().toISOString() }, null, 2));
  console.log(`prepared controller restart with active Agent task ${task.id}`);
} else {
  const proof = JSON.parse(await readFile(proofPath, 'utf8'));
  const id = await command('docker', ['ps', '-q', '--filter', `label=com.docker.compose.project=ship_${f.runId}_api`], { env: f.env });
  assert.ok(id);
  await command('docker', ['exec', id, 'sh', '-c', 'printf restart-verified > /usr/local/apache2/htdocs/ready.html'], { env: f.env });
  const result = await finishTask(proof.taskId);
  assert.equal(result.task.status, 'succeeded', result.task.error);
  assert.ok(result.remoteJobs.some((job) => job.stageKey === 'deploy' && job.agentRole === 'runtime' && job.status === 'succeeded'));
  assert.ok(result.remoteJobs.some((job) => job.stageKey === 'build' && job.agentRole === 'builder'));
  const logs = await call('GET', `/tasks/${proof.taskId}/logs?stage=deploy&offset=0`);
  assert.ok(logs.text.length > 0); assert.equal(logs.complete, true);
  assert.match(await (await fetch('http://127.0.0.1:19901/ready.html')).text(), /restart-verified/);
  const taskList = await call('GET', `${route}/tasks`);
  assert.ok(taskList.items.length >= 10);
  Object.assign(proof, { passed: true, labels: ['active Agent survives controller restart', 'missing runtime mapping discovered by operation ID', 'both Agent roles retained correctly', 'terminal logs and prior platform history survive'], verifiedAt: new Date().toISOString() });
  await writeFile(proofPath, JSON.stringify(proof, null, 2));
  f.spec.services.api.healthcheck = { path: '/', hostPort: 19901, timeoutSeconds: 10 }; await saveSpec();
  await writeFile('/tmp/codex-tool-runs/svton/platform-fixture.json', JSON.stringify(f), { mode: 0o600 });
  console.log('ok restart, lost mapping discovery, roles, log archive and platform history');
}
