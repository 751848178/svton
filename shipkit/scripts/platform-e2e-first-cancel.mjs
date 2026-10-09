import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readFixture, command } from './platform-e2e-fixture.mjs';
import { call, finishTask, until } from './platform-api-client.mjs';

const f = await readFixture();
const app = `${f.runId}-first`;
const evidencePath = '/tmp/codex-tool-runs/svton/platform-first-cancel-evidence.json';
const evidence = { app, startedAt: new Date().toISOString(), checks: [], status: 'running' };
const persist = () => writeFile(evidencePath, JSON.stringify(evidence, null, 2), { mode: 0o600 });
const docker = (args) => command('docker', args, { env: f.env });
const ids = (name, all = false) => docker(['ps', ...(all ? ['-a'] : []), '-q', '--filter', `label=com.docker.compose.project=ship_${name}`]);
const config = JSON.parse(await readFile(f.configPath, 'utf8'));
const runtime = config.runtime.targets.local;
async function agent(route) {
  const response = await fetch(`${runtime.url}${route}`, { headers: { authorization: `Bearer ${runtime.token}` } });
  assert.ok(response.ok, `Agent request failed with ${response.status}`);
  return response.json();
}
async function check(label, run) {
  await run(); evidence.checks.push({ label, passed: true, at: new Date().toISOString() });
  await persist(); console.log(`ok ${label}`);
}
async function main() {
  const root = await mkdtemp(path.join(tmpdir(), 'shipkit-first-cancel-'));
  const project = path.join(root, 'project');
  await mkdir(project);
  for (const service of ['api', 'web']) {
    await mkdir(path.join(project, service));
    await writeFile(path.join(project, service, 'Dockerfile'), 'FROM httpd:alpine\nCOPY index.html /usr/local/apache2/htdocs/index.html\n');
    await writeFile(path.join(project, service, 'index.html'), `${service}-first ${app}\n`);
  }
  const configPath = path.join(project, 'ship.config.json');
  await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
  await copyFile(path.join(f.project, 'runtime.env'), path.join(project, 'runtime.env'));
  await chmod(path.join(project, 'runtime.env'), 0o600);
  const spec = structuredClone(f.spec);
  spec.name = app;
  spec.services.api.ports = ['19903:80'];
  spec.services.api.networks = [f.net];
  spec.services.api.healthcheck = { path: '/missing', hostPort: 19903, timeoutSeconds: 30 };
  spec.services.web.ports = ['19904:80'];
  spec.services.web.networks = [f.net];
  spec.services.web.volumes = [`${f.volume}:/usr/local/apache2/htdocs/data:ro`];
  spec.services.web.healthcheck = { path: '/', hostPort: 19904, timeoutSeconds: 10 };
  await writeFile(path.join(project, 'ship.yaml'), JSON.stringify(spec));
  await writeFile(path.join(project, '.gitignore'), 'ship.config.json\nruntime.env\n');
  await command('git', ['init', '-b', 'main'], { cwd: project });
  await command('git', ['add', 'api', 'web', 'ship.yaml', '.gitignore'], { cwd: project });
  await command('git', ['-c', 'user.name=Shipkit Isolated Test', '-c', 'user.email=shipkit-test@localhost', 'commit', '-m', 'isolated first cancellation fixture'], { cwd: project });
  evidence.projectRoot = project;
  const mainWeb = await ids(`${f.runId}_web`);
  assert.match(mainWeb, /^[0-9a-f]+$/, 'Existing main web container must be uniquely identifiable');
  const sentinel = () => docker(['exec', mainWeb, 'cat', '/usr/local/apache2/htdocs/data/sentinel.txt']);
  await check('independent first deployment starts empty and external sentinel exists', async () => {
    assert.equal(await sentinel(), 'durable-sentinel');
    assert.equal(await ids(`${app}_api`, true), ''); assert.equal(await ids(`${app}_web`, true), '');
  });
  const registered = await call('POST', '/projects', { name: '首次取消验收', rootPath: project, configPath,
    serverName: '本机隔离 Agent', services: [
      { serviceKey: 'api', displayName: '首次取消 API', entryUrl: 'http://127.0.0.1:19903' },
      { serviceKey: 'web', displayName: '首次取消网站', entryUrl: 'http://127.0.0.1:19904' },
    ] });
  evidence.projectId = registered.id;
  const route = `/projects/${registered.id}`;
  const initial = await call('GET', `${route}/status`);
  assert.equal(initial.live.runtime.currentReleaseId, null);
  const stateRoute = `/api/group-state?${new URLSearchParams({ app, project: initial.live.projectIdentity, env: initial.live.targetKey })}`;
  assert.equal((await agent(stateRoute)).current, null);
  const plan = await call('POST', `${route}/plans`, { kind: 'release', services: ['api', 'web'], sourceMode: 'directory' });
  assert.equal(plan.baseReleaseId, null);
  const task = await call('POST', `${route}/tasks`, { planId: plan.id });
  evidence.taskId = task.id; await persist();
  const jobs = async () => (await agent(`/api/jobs?operationPrefix=${encodeURIComponent(`${task.id}:`)}`)).jobs;
  const verifying = await until(async () => (await jobs()).find((job) => job.type === 'group-deploy' && job.phase === 'verify' && job.status === 'running'), 'first deployment verification');
  evidence.agentJobId = verifying.id;
  evidence.verifyObservedAt = new Date().toISOString();
  await check('runtime verification starts with both first-deployment containers active', async () => {
    assert.ok(await ids(`${app}_api`)); assert.ok(await ids(`${app}_web`));
    assert.match(await (await fetch('http://127.0.0.1:19904')).text(), /web-first/);
    assert.equal((await (await fetch('http://127.0.0.1:19904/data/sentinel.txt')).text()).trim(), 'durable-sentinel');
  });
  await call('POST', `/tasks/${task.id}/cancel`, {});
  evidence.cancelRequestedAt = new Date().toISOString(); await persist();
  const detail = await finishTask(task.id);
  const remote = (await jobs()).find((job) => job.id === verifying.id);
  await check('API and Agent acknowledge cooperative cancellation with first-deployment recovery', async () => {
    assert.equal(detail.task.status, 'cancelled', detail.task.error);
    assert.equal(detail.task.recoveryState, 'succeeded');
    assert.equal(remote.status, 'cancelled'); assert.equal(remote.cancellation?.outcome, 'cancelled');
    assert.equal(remote.result?.recovery?.attempted, true); assert.equal(remote.result.recovery.succeeded, true);
    assert.equal(remote.result.recovery.target, null);
    assert.deepEqual([...remote.result.recovery.cleaned].sort(), ['api', 'web']);
    assert.deepEqual(remote.result.recovery.pending, []);
    const logs = await call('GET', `/tasks/${task.id}/logs?stage=deploy`);
    assert.match(logs.text, /no previous release for api/); assert.match(logs.text, /no previous release for web/);
    evidence.outcome = { taskStatus: detail.task.status, recoveryState: detail.task.recoveryState,
      agentStatus: remote.status, cancellationOutcome: remote.cancellation.outcome, recovery: remote.result.recovery };
    evidence.noPreviousRemovalLogged = ['api', 'web'];
  });
  await check('cancelled first deployment leaves no current release or group containers', async () => {
    const state = await agent(stateRoute);
    assert.equal(state.current, null);
    assert.equal((await call('GET', `${route}/status`)).live.runtime.currentReleaseId, null);
    const containers = { api: await ids(`${app}_api`, true), web: await ids(`${app}_web`, true) };
    assert.deepEqual(containers, { api: '', web: '' });
    evidence.currentReleaseId = state.current; evidence.remainingGroupContainers = containers;
  });
  await check('external network, volume and existing durable sentinel survive cancellation', async () => {
    await docker(['network', 'inspect', f.net]); await docker(['volume', 'inspect', f.volume]);
    assert.equal(await sentinel(), 'durable-sentinel');
    evidence.externalData = { network: f.net, volume: f.volume, sentinel: 'durable-sentinel', firstDeploymentMount: 'read-only' };
  });
  evidence.status = 'passed'; evidence.finishedAt = new Date().toISOString(); await persist();
  console.log(`evidence ${evidencePath}`);
}
try { await main(); }
catch (error) {
  evidence.status = 'failed';
  evidence.error = String(error.message).replaceAll(f.token, '[redacted]').replaceAll(runtime.token, '[redacted]');
  await persist(); console.error(evidence.error); process.exitCode = 1;
}
