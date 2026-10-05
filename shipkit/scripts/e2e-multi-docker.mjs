#!/usr/bin/env node
// Isolated REAL-Docker multi-service e2e (R12 rebuild): full → partial → fault
// recovery → rollback, plus named external volume (data preserved), mixed
// keep-env, new-unselected-service refusal, and verified zero-residue cleanup.
// Registry push/pull is intentionally not exercised (this daemon's registry
// traffic goes through a corporate proxy — see docs/multi-service.md).
// Usage: node scripts/e2e-multi-docker.mjs [--keep]   (docker required)

import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  run, OK, FAIL, must, api, waitJob, healthy, containerSnapshot, spawnShip, startAgent, cleanupAndVerify, resourceTracker, prepareRunBasics,
} from './e2e-multi-docker-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GROUP = `e2eg${Date.now().toString(36).slice(-5)}`;
const API_PORT = 19101 + (Date.now() % 700);
const WEB_PORT = API_PORT + 1;
const NET = `${GROUP}-net`;
const VOL = `${GROUP}-data`;
const keep = process.argv.includes('--keep');
let agentProc = null;
const cleanups = [];
const { beforeImages, beforeDangling } = await prepareRunBasics(run, 'httpd:alpine');
const tracker = resourceTracker(GROUP, beforeImages, beforeDangling);

async function main() {
  await must('docker version --format {{.Server.Version}}', 'docker daemon reachable');
  const daemonArch = (await run('docker version --format {{.Server.Arch}}')).stdout.trim();
  const platform = daemonArch === 'amd64' ? 'linux/amd64' : 'linux/arm64';
  OK(`daemon arch ${daemonArch} → services declare ${platform}`);
  await must(`docker network create ${NET}`, 'external network'); tracker.addNetwork(NET);
  await must(`docker volume create ${VOL}`, 'external named volume'); tracker.addVolume(VOL);
  const volCreated = (await run(`docker volume inspect ${VOL} --format {{.CreatedAt}}`)).stdout.trim();

  const workRoot = await mkdtemp(path.join(tmpdir(), `${GROUP}-work-`));
  const home = await mkdtemp(path.join(tmpdir(), `${GROUP}-home-`));
  const proj = await mkdtemp(path.join(tmpdir(), `${GROUP}-proj-`));
  cleanups.push(workRoot, home, proj);

  for (const svc of ['api', 'web']) {
    await mkdir(path.join(proj, svc), { recursive: true });
    await writeFile(path.join(proj, svc, 'Dockerfile'),
      'FROM httpd:alpine AS dev\nWORKDIR /usr/local/apache2/htdocs\nCOPY index.html .\n' +
      'FROM httpd:alpine AS prod\nWORKDIR /usr/local/apache2/htdocs\nCOPY index.html .\nCOPY marker.txt .\nEXPOSE 80\n');
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
    envFile: api.env
    healthcheck: { path: /, hostPort: ${API_PORT}, timeoutSeconds: 30 }
  web:
    dockerfile: web/Dockerfile
    context: web
    target: prod
    platform: ${platform}
    ports: ["${WEB_PORT}:80"]
    networks: ["${NET}"]
    volumes: ["${VOL}:/usr/local/apache2/htdocs/vol"]
    healthcheck: { path: /, hostPort: ${WEB_PORT}, timeoutSeconds: 30 }
`;
  await writeFile(path.join(proj, 'ship.yaml'), specYaml);
  await writeFile(path.join(proj, 'api.env'), 'API_SECRET=e2e\n');
  const cfg = path.join(proj, 'ship.config.json');
  const writeCfg = (url) => writeFile(cfg, JSON.stringify({
    builder: { mode: 'static', static: { url, token: 't' } },
    runtime: { targets: { local: { url, token: 't' } } },
  }));

  const { agent, url } = await startAgent(ROOT, workRoot);
  agentProc = agent;
  await writeCfg(url);
  OK(`agent up at ${url}`);
  const { resolveProjectId } = await import(`${ROOT}/dist/cli/project-id.js`);
  const project = await resolveProjectId(proj);
  const yaml = await import(`${ROOT}/node_modules/js-yaml/index.js`);
  const baseSpec = yaml.load(specYaml);

  const ship = spawnShip(ROOT, home, proj);
  const deploy = async (services, mark, opts = {}) => {
    const spec = opts.spec ?? baseSpec;
    const tgz = path.join(proj, '..', `${GROUP}-src.tgz`);
    await run(`tar czf ${tgz} -C ${proj} --exclude ship.config.json .`, { timeout: 60_000 });
    const up = await fetch(`${url}/api/sources`, { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/gzip' }, body: await readFile(tgz) });
    if (up.status !== 201) throw new Error(`source upload → ${up.status}`);
    const { id } = await up.json();
    const changed = {};
    for (const svc of services) {
      const started = await api(url, 'POST', '/api/build', { source: { type: 'tarball', id }, spec: { name: svc, dockerfile: `${svc}/Dockerfile`, context: svc, target: 'prod', platform } });
      const result = await waitJob(url, started.jobId, `build ${svc} ${mark}`);
      if (result.arch !== platform) FAIL(`build ${svc}: arch ${result.arch} ≠ ${platform}`);
      const digest = (await run(`docker image inspect ${result.localImage} --format {{.Id}}`)).stdout.trim();
      tracker.addImage(result.localImage);
      const envName = spec.services[svc]?.envFile;
      const envFileContent = !opts.keepEnv && envName ? await readFile(path.join(proj, envName), 'utf8') : undefined;
      changed[svc] = {
        imageRef: `${result.localImage}@${digest}`, tag: result.tag, digest,
        source: { type: 'tarball', contentDigest: `sha256:${createHash('sha256').update(`${svc}:${mark}`).digest('hex')}` },
        ...(opts.keepEnv ? { keepEnv: true } : {}),
        ...(envFileContent ? { envFileContent } : {}),
      };
    }
    const dep = await api(url, 'POST', '/api/deploy-group', { schemaVersion: 2, app: GROUP, project, env: 'local', spec, changed });
    return { changed, result: await waitJob(url, dep.jobId, `deploy ${mark}`) };
  };

  // R0: invalid selection refuses before any build; plan is read-only
  const bad = await ship(['release', '--config', cfg, '--services', 'nope', '--json']);
  if (bad.code === 2 && /unknown service/.test(bad.stderr + bad.stdout)) OK('R0 unknown service refused (exit 2) before any build'); else FAIL(`R0 refusal: exit ${bad.code}`);
  const plan = await ship(['release', '--config', cfg, '--plan', '--json']);
  if (plan.code === 0 && JSON.parse(plan.stdout).plan?.firstDeployment === true) OK('R0 --plan --json read-only'); else FAIL('R0 plan failed');

  // R1: full release (target/arch verified; web on external net+volume; api env private)
  const r1 = await deploy(['api', 'web'], 'full');
  if (r1.result.changedServices.length === 2) OK('R1 full release deployed BOTH services'); else FAIL('R1 changed set wrong');
  await healthy(API_PORT, /^hello from api PROD\n$/);
  await healthy(WEB_PORT, /^hello from web PROD\n$/);
  const snap = await containerSnapshot(GROUP);
  if (!snap.api || !snap.web) { FAIL(`R1 containers missing: ${JSON.stringify(snap)}`); return; }
  const webNets = (await run(`docker inspect --format '{{json .NetworkSettings.Networks}}' ${snap.web.id}`)).stdout;
  if (webNets.includes(NET)) OK('R1 web joined the external network'); else FAIL('R1 web not on external network');
  if ((await readFile(path.join(workRoot, 'apps', GROUP, 'services', 'api', 'runtime.env'), 'utf8')).includes('API_SECRET=e2e')) OK('R1 api env private'); else FAIL('R1 api runtime.env missing');
  await must(`docker exec ${snap.web.id} sh -c "echo volume-data-1 > /usr/local/apache2/htdocs/vol/keep.txt"`, 'R1 seed volume data');

  // R2: partial — only api; web container/volume untouched
  await writeFile(path.join(proj, 'api', 'index.html'), 'hello from api PROD v2\n');
  const r2 = await deploy(['api'], 'partial');
  if (r2.result.changedServices.length === 1 && r2.result.inheritedServices[0] === 'web') OK('R2 partial changed ONLY api'); else FAIL('R2 partial payload wrong');
  const snap2 = await containerSnapshot(GROUP);
  if (snap2.web?.id === snap.web.id && snap2.web?.started === snap.web.started) OK(`R2 web untouched (ID+StartedAt ${snap.web.started})`); else FAIL('R2 web restarted');
  if (snap2.api?.id !== snap.api.id) OK('R2 api recreated'); else FAIL('R2 api not recreated');
  await healthy(API_PORT, /^hello from api PROD v2\n$/);
  const volKept = (await run(`docker exec ${snap2.web.id} cat /usr/local/apache2/htdocs/vol/keep.txt`)).stdout.trim();
  if (volKept === 'volume-data-1') OK('R2 named volume data preserved'); else FAIL(`R2 volume data lost: ${volKept}`);
  const volCreated2 = (await run(`docker volume inspect ${VOL} --format {{.CreatedAt}}`)).stdout.trim();
  if (volCreated2 === volCreated) OK('R2 volume NOT recreated (same CreatedAt)'); else FAIL('R2 volume was recreated');

  // R3: fault recovery — api v3 with a BROKEN probe; the deploy fails and api recovers to v2
  await writeFile(path.join(proj, 'api', 'index.html'), 'hello from api PROD v3\n');
  const brokenSpec = structuredClone(baseSpec);
  brokenSpec.services.api.healthcheck = { path: '/no-such-page', hostPort: API_PORT, timeoutSeconds: 3 };
  const r3 = await deploy(['api'], 'broken', { spec: brokenSpec }).then((r) => ({ ok: r }), (e) => ({ failed: String(e.message) }));
  if (!r3.failed) FAIL('R3 broken-probe deploy unexpectedly succeeded');
  else OK(`R3 broken-probe deploy failed as designed (${r3.failed.slice(0, 90)})`);
  const snap3 = await containerSnapshot(GROUP);
  if (snap3.web?.id === snap.web.id) OK('R3 web untouched during failed deploy'); else FAIL('R3 web restarted during failed deploy');
  await healthy(API_PORT, /^hello from api PROD v2\n$/);
  OK('R3 api recovered to v2 content');

  // R4: rollback via the real CLI undoes the LAST release's changed service
  const r4 = await ship(['rollback', GROUP, '--config', cfg, '--to', 'local', '--json']);
  if (r4.code !== 0) { FAIL(`R4 rollback exit ${r4.code}: ${(r4.stderr || '').slice(-200)}`); return; }
  if (JSON.parse(r4.stdout).changedServices.join() === 'api') OK('R4 rollback undid exactly api'); else FAIL('R4 rollback payload wrong');
  if ((await containerSnapshot(GROUP)).web?.id === snap.web.id) OK('R4 web still untouched'); else FAIL('R4 web restarted');
  await healthy(API_PORT, /^hello from api PROD\n$/);

  // R5: mixed keep-env full release — envful api inherits, envless web stays envless
  const r5 = await deploy(['api', 'web'], 'keepenv', { keepEnv: true });
  if (r5.result.changedServices.length === 2) OK('R5 keep-env full release ok'); else FAIL('R5 failed');
  if ((await readFile(path.join(workRoot, 'apps', GROUP, 'services', 'api', 'runtime.env'), 'utf8')).includes('API_SECRET=e2e')) OK('R5 envful api kept its env'); else FAIL('R5 api env lost');
  const webEnvPath = path.join(workRoot, 'apps', GROUP, 'services', 'web', 'runtime.env');
  if (!existsSync(webEnvPath)) OK('R5 envless web stayed envless'); else FAIL('R5 web unexpectedly has an env');

  // R6: new-but-unselected service refused by the real CLI BEFORE any build
  await writeFile(path.join(proj, 'ship.yaml'), `${specYaml}  extra:\n    dockerfile: web/Dockerfile\n    context: web\n    target: prod\n`);
  const r6 = await ship(['release', '--config', cfg, '--services', 'api', '--json']);
  if (r6.code === 2 && /neither selected nor present/.test(r6.stderr + r6.stdout)) OK('R6 new-unselected service refused before build'); else FAIL(`R6: exit ${r6.code}`);

  console.log(process.exitCode ? 'E2E FAILED' : 'E2E PASSED');
}

main().catch((e) => { FAIL(String(e)); }).finally(async () => {
  await cleanupAndVerify(tracker, keep, cleanups);
  agentProc?.kill('SIGTERM');
  process.exit(process.exitCode ?? 0);
});
