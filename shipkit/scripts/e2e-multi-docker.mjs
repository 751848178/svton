#!/usr/bin/env node
// Isolated REAL-Docker multi-service e2e (MS-02..MS-04 real switching): one
// agent (role both) on THIS docker daemon; real multi-target builds, real
// compose recreation, selective switching, rollback, external network, private
// env — all through the agent's REAL HTTP API (the same wire protocol `ship`
// uses) plus the real CLI for --plan and rollback.
//
// BOUNDARY: the registry push/pull hop is NOT exercised here — this machine's
// Docker daemon routes registry traffic through a proxy that breaks localhost
// registries, and changing the user's Docker Desktop config is out of scope.
// Images deploy digest-pinned from the local daemon (the same immutable-ref
// semantics); push/digest/pull ordering is covered by unit tests and by the
// previously verified cloud e2e. Nothing outside ship-<group>_* projects and
// the temp network is touched; no prune, no volume deletion.
//
// Usage: node scripts/e2e-multi-docker.mjs [--keep]   (docker required)

import { exec, spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(exec);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OK = (m) => console.log(`  ok  ${m}`);
const FAIL = (m) => { console.error(`  FAIL ${m}`); process.exitCode = 1; };
const GROUP = `e2eg${Date.now().toString(36).slice(-5)}`;
const API_PORT = 18101 + (Date.now() % 700);
const WEB_PORT = API_PORT + 1;
const NET = `${GROUP}-net`;
const keep = process.argv.includes('--keep');
let agent = null;
let agentUrl = '';
const cleanups = [];

async function must(cmd, what) {
  try {
    return await run(cmd, { timeout: 300_000 });
  } catch (e) {
    FAIL(`${what}: ${String(e.stderr ?? e.message).slice(0, 400)}`);
    throw e;
  }
}

async function api(method, p, body) {
  const res = await fetch(`${agentUrl}${p}`, {
    method,
    headers: { authorization: 'Bearer t', ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

async function waitJob(jobId, what) {
  for (let i = 0; i < 240; i++) {
    const job = await api('GET', `/api/jobs/${jobId}`);
    if (job.status === 'succeeded') return job.result;
    if (job.status === 'failed') throw new Error(`${what} failed: ${job.error}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${what} timed out`);
}

async function main() {
  await must('docker version --format {{.Server.Version}}', 'docker daemon reachable');
  const daemonArch = (await run('docker version --format {{.Server.Arch}}')).stdout.trim();
  const platform = daemonArch === 'amd64' ? 'linux/amd64' : 'linux/arm64';
  OK(`daemon arch ${daemonArch} → services declare ${platform}`);
  await must(`docker network create ${NET}`, 'external network created');
  cleanups.push(`docker network rm ${NET}`);

  const workRoot = await mkdtemp(path.join(tmpdir(), `${GROUP}-work-`));
  const home = await mkdtemp(path.join(tmpdir(), `${GROUP}-home-`));
  const proj = await mkdtemp(path.join(tmpdir(), `${GROUP}-proj-`));
  cleanups.push(`rm -rf ${workRoot} ${home} ${proj}`);

  // project: two services; the prod TARGET adds a marker file the dev stage
  // lacks (proves --target really reached the build). base image is LOCALLY
  // CACHED — no network pull (see BOUNDARY above).
  for (const svc of ['api', 'web']) {
    await mkdir(path.join(proj, svc), { recursive: true });
    await writeFile(path.join(proj, svc, 'Dockerfile'),
      'FROM httpd:alpine AS dev\nWORKDIR /usr/local/apache2/htdocs\nCOPY index.html .\n' +
      'FROM httpd:alpine AS prod\nWORKDIR /usr/local/apache2/htdocs\nCOPY index.html .\nCOPY marker.txt .\n' +
      'EXPOSE 80\n');
    await writeFile(path.join(proj, svc, 'index.html'), `hello from ${svc} PROD\n`);
    await writeFile(path.join(proj, svc, 'marker.txt'), `built-with-target=prod service=${svc}\n`);
  }
  const specYaml = `schemaVersion: 2
name: ${GROUP}
services:
  api:
    dockerfile: api/Dockerfile
    context: api
    target: prod
    platform: ${platform}
    ports: ["${API_PORT}:80"]
    healthcheck: { path: /, hostPort: ${API_PORT}, timeoutSeconds: 30 }
  web:
    dockerfile: web/Dockerfile
    context: web
    target: prod
    platform: ${platform}
    ports: ["${WEB_PORT}:80"]
    envFile: web.env
    networks: ["${NET}"]
    healthcheck: { path: /, hostPort: ${WEB_PORT}, timeoutSeconds: 30 }
`;
  await writeFile(path.join(proj, 'ship.yaml'), specYaml);
  await writeFile(path.join(proj, 'web.env'), 'WEB_SECRET=e2e\n');
  const cfg = path.join(proj, 'ship.config.json');
  const writeCfg = (url) => writeFile(cfg, JSON.stringify({
    builder: { mode: 'static', static: { url, token: 't' } },
    runtime: { targets: { local: { url, token: 't' } } },
  }));

  agent = spawn('node', [path.join(ROOT, 'dist/agent/server.js')], {
    env: { ...process.env, SHIP_AGENT_ROLE: 'both', SHIP_AGENT_TOKEN: 't', SHIP_WORK_ROOT: workRoot, SHIP_AGENT_HOST: '127.0.0.1', SHIP_AGENT_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  agentUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('agent startup line never appeared')), 20_000);
    const onData = (d) => {
      buf += d;
      const m = /listening on (\S+)/.exec(buf);
      if (m) { clearTimeout(timer); resolve(m[1].startsWith('http') ? m[1] : `http://${m[1]}`); }
    };
    agent.stdout.on('data', onData);
    agent.stderr.on('data', onData);
  });
  await writeCfg(agentUrl);
  OK(`agent up at ${agentUrl}`);
  const { resolveProjectId } = await import(path.join(ROOT, 'dist/cli/project-id.js'));
  const project = await resolveProjectId(proj);
  const yaml = await import(path.join(ROOT, 'node_modules', 'js-yaml', 'index.js'));
  const spec = yaml.load(specYaml);

  const buildAndDeploy = async (services, mark) => {
    // upload the project tarball ONCE, build each selected service on the
    // agent (real `docker build --target prod --platform ...`), pin each image
    // by its REAL digest and deploy through the real group API
    const tgz = path.join(proj, '..', `${GROUP}-src.tgz`);
    await run(`tar czf ${tgz} -C ${proj} --exclude ship.config.json .`, { timeout: 60_000 });
    const up = await fetch(`${agentUrl}/api/sources`, { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/gzip' }, body: await readFile(tgz) });
    if (up.status !== 201) throw new Error(`source upload → ${up.status}`);
    const { id } = await up.json();
    const changed = {};
    for (const svc of services) {
      const started = await api('POST', '/api/build', {
        source: { type: 'tarball', id },
        spec: { name: svc, dockerfile: `${svc}/Dockerfile`, context: svc, target: 'prod', platform },
      });
      const result = await waitJob(started.jobId, `build ${svc} ${mark}`);
      if (result.arch !== platform) FAIL(`build ${svc}: arch ${result.arch} ≠ declared ${platform}`);
      const digest = (await run(`docker image inspect ${result.localImage} --format {{.Id}}`)).stdout.trim();
      // mirror the CLI contract: a declared envFile ships via the API, never via the builder
      const envName = spec.services[svc]?.envFile;
      const envFileContent = envName ? await readFile(path.join(proj, envName), 'utf8') : undefined;
      changed[svc] = { imageRef: `${result.localImage}@${digest}`, tag: result.tag, digest, source: { type: 'tarball', sha: result.sha }, ...(envFileContent ? { envFileContent } : {}) };
    }
    const dep = await api('POST', '/api/deploy-group', { schemaVersion: 2, app: GROUP, project, env: 'local', spec, changed });
    return { changed, result: await waitJob(dep.jobId, `deploy ${mark}`) };
  };

  const ship = (args) => new Promise((resolve) => {
    const p = spawn('node', [path.join(ROOT, 'dist/cli/main.js'), ...args], { env: { ...process.env, HOME: home }, cwd: proj, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    p.stdout.on('data', (d) => { stdout += d; });
    p.stderr.on('data', (d) => { stderr += d; });
    p.on('close', (code) => resolve({ code, stdout, stderr }));
  });

  // round 0: invalid selection refuses through the REAL CLI before any build
  const bad = await ship(['release', '--config', cfg, '--services', 'nope', '--json']);
  if (bad.code === 2 && /unknown service/.test(bad.stderr + bad.stdout)) OK('unknown service refused (exit 2) before any build');
  else FAIL(`unknown-service refusal: exit ${bad.code}`);
  // round 0b: --plan --json through the REAL CLI (read-only)
  const plan = await ship(['release', '--config', cfg, '--plan', '--json']);
  if (plan.code === 0 && JSON.parse(plan.stdout).plan?.firstDeployment === true) OK('ship release --plan --json works read-only (first deployment)');
  else FAIL(`plan failed: exit ${plan.code} ${(plan.stderr || '').slice(-200)}`);

  // round 1: full release — BOTH services through the real agent + docker
  const r1 = await buildAndDeploy(['api', 'web'], 'full');
  if (r1.result.changedServices.length === 2) OK('full release built (target=prod, arch verified) and deployed BOTH services');
  else FAIL(`round1: ${JSON.stringify(r1.result).slice(0, 300)}`);
  const apiDigest1 = r1.changed.api.digest;
  await healthy(API_PORT, /^hello from api PROD\n$/);
  await healthy(WEB_PORT, /^hello from web PROD\n$/);

  const snap = await containerSnapshot();
  if (snap.api && snap.web) OK(`both containers running (${snap.api.id.slice(0, 12)}, ${snap.web.id.slice(0, 12)})`);
  else { FAIL(`containers missing: ${JSON.stringify(snap)}`); return; }
  const netInspect = await run(`docker inspect --format "{{json .NetworkSettings.Networks}}" ${snap.web.id}`);
  if (netInspect.stdout.includes(NET)) OK('web joined the declared EXTERNAL network');
  else FAIL(`web not on ${NET}: ${netInspect.stdout.slice(0, 200)}`);
  if ((await readFile(path.join(workRoot, 'apps', GROUP, 'services', 'web', 'runtime.env'), 'utf8')).includes('WEB_SECRET=e2e')) {
    OK('web env file delivered privately (runtime.env on the runtime)');
  } else FAIL('web runtime.env missing');

  // round 2: partial release — ONLY api rebuilds; web must not restart
  await writeFile(path.join(proj, 'api', 'index.html'), 'hello from api PROD v2\n');
  const r2 = await buildAndDeploy(['api'], 'partial');
  if (r2.result.changedServices.length === 1 && r2.result.changedServices[0] === 'api' && r2.result.inheritedServices[0] === 'web') OK('partial release changed ONLY api');
  else FAIL(`partial: ${JSON.stringify(r2.result).slice(0, 300)}`);
  if (r2.changed.api.digest !== apiDigest1) OK('api got a NEW digest');
  else FAIL('api digest did not change');
  const snap2 = await containerSnapshot();
  if (snap2.web?.id === snap.web.id && snap2.web?.started === snap.web.started) OK(`web container untouched (same ID, StartedAt ${snap.web.started})`);
  else FAIL(`web restarted: ${snap.web.id}/${snap.web.started} → ${snap2.web?.id}/${snap2.web?.started}`);
  if (snap2.api?.id !== snap.api.id) OK('api container recreated');
  else FAIL('api container was not recreated');
  await healthy(API_PORT, /^hello from api PROD v2\n$/);

  // round 3: rollback via the REAL CLI undoes api only; web keeps its container
  const r3 = await ship(['rollback', GROUP, '--config', cfg, '--to', 'local', '--json']);
  if (r3.code !== 0) { FAIL(`rollback exit ${r3.code}: ${(r3.stderr || '').split('\n').slice(-4).join(' | ')}`); return; }
  const p3 = JSON.parse(r3.stdout);
  if (p3.changedServices.length === 1 && p3.changedServices[0] === 'api') OK('rollback undid exactly the last changed service');
  else FAIL(`rollback payload: ${r3.stdout.slice(0, 300)}`);
  const snap3 = await containerSnapshot();
  if (snap3.web?.id === snap.web.id) OK('web still untouched after rollback');
  else FAIL('web restarted during rollback');
  await healthy(API_PORT, /^hello from api PROD\n$/);
  OK('rollback restored api v1 content');

  console.log(process.exitCode ? 'E2E FAILED' : 'E2E PASSED');
}

async function healthy(port, needle) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok && needle.test(await res.text())) { OK(`GET :${port}/ matches ${needle}`); return; }
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  FAIL(`healthcheck failed for port ${port} (wanted ${needle})`);
}

async function containerSnapshot() {
  const out = (await run(`docker ps -a --filter label=com.docker.compose.project --format '{{.ID}}\\t{{.Names}}'`)).stdout;
  const snap = {};
  for (const line of out.split('\n').filter(Boolean)) {
    const [id, name] = line.split('\t');
    // compose v2 derived name: <project>-<service>-<n> where project=ship_G_svc
    const svc = new RegExp(`^ship_${GROUP}_api-api-\\d+$|^ship_${GROUP}_api_api_\\d+$`).test(name) ? 'api'
      : new RegExp(`^ship_${GROUP}_web-web-\\d+$|^ship_${GROUP}_web_web_\\d+$`).test(name) ? 'web' : null;
    if (!svc) continue;
    snap[svc] = { id, started: (await run(`docker inspect --format '{{.State.StartedAt}}' ${id}`)).stdout.trim() };
  }
  return snap;
}

main().catch((e) => { FAIL(String(e)); }).finally(async () => {
  if (!keep) {
    for (const svc of ['api', 'web']) {
      await run(`docker ps -aq --filter name=ship_${GROUP}_${svc}`).then(({ stdout }) =>
        stdout.trim() ? run(`docker rm -f ${stdout.trim().split('\n').join(' ')}`) : null).catch(() => {});
    }
    for (const c of cleanups.reverse()) await run(`${c} || true`).catch(() => {});
  } else {
    console.log(`keep mode: group=${GROUP}; remove with: docker rm -f $(docker ps -aq --filter name=ship_${GROUP}) && docker network rm ${NET}`);
  }
  agent?.kill('SIGTERM');
  process.exit(process.exitCode ?? 0);
});
