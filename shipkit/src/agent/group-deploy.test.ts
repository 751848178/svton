// v2 group deploy core (MS-03/MS-04): the REAL handler over a REAL filesystem
// with docker faked only at the exec seam. Load-bearing assertions: pull-ALL-
// before-switch ordering, unselected services never touched, in-lock merge of
// concurrent partial releases, recovery of exactly the changed services, and
// zero mutations on every refusal path.

import test from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const realExec = await import('../shared/exec.js');
const FX = {
  containers: [] as Array<{ id: string; name: string; project?: string; dir?: string }>,
  networks: [] as string[],
  volumes: [] as string[],
  pulls: [] as string[],
  compose: [] as Array<{ project: string; args: string[]; composeImage?: string }>,
  failPull: null as null | RegExp,
  /** make `up` fail when the service dir's compose.yaml contains this image ref */
  failUpFor: null as null | string,
  /** called on every docker pull — lets a test flip ownership DURING the pull window */
  onPull: null as null | (() => void),
};
mock.module('../shared/exec.js', {
  namedExports: {
    ...realExec,
    exec: async (cmd: string, args: string[], opts?: unknown) => {
      if (cmd !== 'docker') return realExec.exec(cmd, args, opts as never);
      const ok = (stdout = '') => ({ code: 0, stdout, stderr: '', truncated: false, timedOut: false });
      const fail = (stderr: string) => ({ code: 1, stdout: '', stderr, truncated: false, timedOut: false });
      if (args[0] === 'pull') {
        const ref = args[1] ?? '';
        FX.pulls.push(ref);
        FX.onPull?.();
        if (FX.failPull?.test(ref)) return fail(`pull failed for ${ref}`);
        return ok();
      }
      if (args[0] === 'network' && args[1] === 'inspect') return FX.networks.includes(args[2] ?? '') ? ok() : fail('no such network');
      if (args[0] === 'volume' && args[1] === 'inspect') return FX.volumes.includes(args[2] ?? '') ? ok() : fail('no such volume');
      if (args[0] === 'image' && args[1] === 'inspect') return fail('no such image locally — force a real pull');
      if (args[0] === 'compose') {
        const project = args[args.indexOf('-p') + 1] ?? '';
        let composeImage: string | undefined;
        if (args.includes('up')) {
          const dir = String((opts as { cwd?: string } | undefined)?.cwd ?? '');
          const composeFile = path.join(dir, 'compose.yaml');
          composeImage = existsSync(composeFile) ? await readFile(composeFile, 'utf8').then((t) => /image: "([^"]+)"/.exec(t)?.[1]).catch(() => undefined) : undefined;
          if (composeImage && FX.failUpFor && composeImage.includes(FX.failUpFor)) return fail('up failed (injected)');
        }
        FX.compose.push({ project, args, composeImage });
        return ok();
      }
      if (args[0] === 'ps' && args.includes('--filter')) {
        const project = args.find((a) => a.startsWith('label=com.docker.compose.project='))?.split('=')[2];
        return ok(FX.containers.filter((c) => c.project === project).map((c) => c.id).join('\n') + '\n');
      }
      if (args[0] === 'ps') return ok(FX.containers.map((c) => `${c.id}\t${c.name}`).join('\n') + '\n');
      if (args[0] === 'inspect') {
        const ids = args.slice(args.indexOf('--format') + 2);
        return ok(FX.containers.filter((c) => ids.includes(c.id)).map((c) => `/${c.name}\t${c.project ?? ''}\t${c.dir ?? ''}`).join('\n') + '\n');
      }
      if (args[0] === 'version') return ok('24.0');
      return ok('');
    },
  },
});

const { runGroupDeploy, GroupDeployFailure } = await import('./handlers-group-deploy.js');
const { GroupStore } = await import('./group-store.js');

const log = (..._lines: unknown[]) => undefined;
const digest = (s: string) => `reg/ns/${s}@sha256:${s.repeat(64).slice(0, 64)}`;

async function root(): Promise<{ appsRoot: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-gdeploy-'));
  const appsRoot = path.join(dir, 'apps');
  return { appsRoot, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

const SPEC: import('../shared/spec-v2.js').ProjectSpec = {
  schemaVersion: 2,
  name: 'twgg',
  services: {
    backend: { ports: ['8080:8080'] },
    admin: { ports: ['8081:80'], envFile: 'admin.env' },
  },
};

function req(changed: Record<string, { imageRef: string; envFileContent?: string; keepEnv?: boolean }>, project = 'proj-x', env = 'prod') {
  return {
    schemaVersion: 2 as const,
    app: 'twgg',
    project,
    env,
    spec: SPEC,
    changed,
  };
}

const ups = () => FX.compose.filter((c) => c.args.includes('up'));
const upsFor = (project: string) => ups().filter((c) => c.project === project);
const downs = () => FX.compose.filter((c) => c.args.includes('down'));

test.beforeEach(() => {
  FX.containers = []; FX.networks = []; FX.volumes = []; FX.pulls = []; FX.compose = [];
  FX.failPull = null; FX.failUpFor = null; FX.onPull = null;
});

test('first deploy: full combination deploys each service in its own project; partial selection is refused with zero mutations', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  await assert.rejects(
    () => runGroupDeploy(appsRoot, req({ admin: { imageRef: digest('a') } }), log),
    (e: Error) => /first deployment.*missing 'backend'/.test(e.message),
  );
  assert.equal(FX.compose.length, 0, 'nothing ran');
  assert.equal(FX.pulls.length, 0, 'nothing was pulled');

  const r = await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1'), envFileContent: 'A=1\n' } }), log);
  assert.deepEqual(r.changedServices.sort(), ['admin', 'backend']);
  assert.equal(r.previousReleaseId, null);
  assert.equal(upsFor('ship_twgg_backend').length, 1);
  assert.equal(upsFor('ship_twgg_admin').length, 1);
  // private env delivered via the API lands in the service dir, never in the manifest
  assert.equal(await readFile(path.join(appsRoot, 'twgg', 'services', 'admin', 'runtime.env'), 'utf8'), 'A=1\n');
  const manifest = await readFile(path.join(appsRoot, 'twgg', 'releases', r.releaseId, 'manifest.json'), 'utf8');
  assert.ok(!manifest.includes('A=1'), 'manifest has no env content');
  assert.match(await readFile(path.join(appsRoot, 'twgg', 'services', 'admin', 'compose.yaml'), 'utf8'), /env_file:/);
});

test('partial release #2: only the selected service switches; the inherited service keeps image, files and container untouched', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), log);
  const backendCompose = await readFile(path.join(appsRoot, 'twgg', 'services', 'backend', 'compose.yaml'), 'utf8');

  FX.compose = []; FX.pulls = [];
  const r = await runGroupDeploy(appsRoot, req({ admin: { imageRef: digest('a2') } }), log);
  assert.deepEqual(r.changedServices, ['admin']);
  assert.deepEqual(r.inheritedServices, ['backend']);
  assert.equal(ups().length, 1, 'exactly one service switched');
  assert.equal(upsFor('ship_twgg_admin').length, 1);
  assert.equal(upsFor('ship_twgg_backend').length, 0, 'inherited service NEVER restarted');
  assert.deepEqual(FX.pulls, [digest('a2')], 'only the selected image was pulled');
  assert.equal(await readFile(path.join(appsRoot, 'twgg', 'services', 'backend', 'compose.yaml'), 'utf8'), backendCompose, 'inherited compose file untouched byte-for-byte');
  // the committed combination still names the inherited service's old ref
  const store = new GroupStore(appsRoot);
  const state = await store.loadState('twgg');
  const current = await store.loadRelease('twgg', state.current ?? '');
  assert.equal(current.services.backend?.imageRef, digest('b1'));
  assert.equal(current.services.admin?.imageRef, digest('a2'));
  assert.equal(current.parent, r.previousReleaseId);
});

test('two partial releases in flight together serialize in the lock and merge without losing either update', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), log);
  FX.compose = [];
  const results = await Promise.all([
    runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b2') } }), log),
    runGroupDeploy(appsRoot, req({ admin: { imageRef: digest('a2') } }), log),
  ]);
  assert.ok(results.every((r) => r.verification === 'passed' || r.verification === 'skipped'));
  const store = new GroupStore(appsRoot);
  const state = await store.loadState('twgg');
  const final = await store.loadRelease('twgg', state.current ?? '');
  assert.equal(final.services.backend?.imageRef, digest('b2'), 'backend update survived the concurrent admin release');
  assert.equal(final.services.admin?.imageRef, digest('a2'), 'admin update survived too');
});

test('ALL changed images pull BEFORE any switch: a second-service pull failure leaves every container untouched', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), log);
  FX.compose = []; FX.pulls = [];
  FX.failPull = /^reg\/ns\/a2@/; // admin's NEW digest fails to pull
  await assert.rejects(
    () => runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b2') }, admin: { imageRef: digest('a2') } }), log),
    /pull failed/,
  );
  assert.deepEqual(ups(), [], 'no switch happened after a pull failure');
  assert.ok(FX.pulls.length >= 1);
  const store = new GroupStore(appsRoot);
  const state = await store.loadState('twgg');
  const current = await store.loadRelease('twgg', state.current ?? '');
  assert.equal(current.services.admin?.imageRef, digest('a1'), 'committed combination unchanged');
});

test('health failure on a changed service recovers exactly the changed services to the previous combination', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  // first deploy WITHOUT healthchecks (admin gets one only in the next release)
  await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), log);
  FX.compose = [];
  const specWithProbe = {
    schemaVersion: 2 as const, name: 'twgg',
    services: {
      backend: { ports: ['8080:8080'] },
      admin: { ports: ['8081:80'], healthcheck: { path: '/healthz', hostPort: 9, timeoutSeconds: 1 } },
    },
  };
  // port 9 with 1s timeout: fetch fails fast → unhealthy
  const err = await runGroupDeploy(appsRoot, { ...req({ backend: { imageRef: digest('b2') }, admin: { imageRef: digest('a2') } }), spec: specWithProbe }, log).then(
    () => { throw new Error('expected failure'); },
    (e: unknown) => e as InstanceType<typeof GroupDeployFailure>,
  );
  assert.ok(err instanceof GroupDeployFailure, `expected GroupDeployFailure, got ${String(err)}`);
  assert.equal(err.recovery.attempted, true);
  assert.equal(err.recovery.succeeded, true, 'recovery restored the previous combination');
  // both changed services were re-activated with their PREVIOUS images
  const recoveredUps = ups().map((u) => u.composeImage);
  assert.ok(recoveredUps.includes(digest('b1')), `backend recovered to b1, saw ${recoveredUps.join(',')}`);
  assert.ok(recoveredUps.includes(digest('a1')), `admin recovered to a1, saw ${recoveredUps.join(',')}`);
  const store = new GroupStore(appsRoot);
  const state = await store.loadState('twgg');
  const current = await store.loadRelease('twgg', state.current ?? '');
  assert.equal(current.services.backend?.imageRef, digest('b1'), 'state still points at the pre-failure combination');
});

test('switch failure mid-way recovers the services switched so far; first-deploy failure removes ONLY the started projects', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  FX.failUpFor = digest('b1'); // fails the up whose compose contains backend's new digest
  const err = await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), log).then(
    () => { throw new Error('expected failure'); },
    (e: unknown) => e as InstanceType<typeof GroupDeployFailure>,
  );
  assert.ok(err instanceof GroupDeployFailure);
  assert.match(err.message, /first deploy: removal/, `first deploy reports its real recovery scope: ${err.message}`);
  assert.equal(downs().length, 1, 'exactly the started project was removed');
  assert.equal(downs()[0]?.project, 'ship_twgg_backend');
  assert.equal(upsFor('ship_twgg_admin').length, 0, 'admin never started after backend failed');
});

test('declared external networks/volumes/binds are verified before anything pulls; a missing network refuses with zero mutations', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  const bindDir = await mkdtemp(path.join(tmpdir(), 'ship-bind-'));
  const spec = {
    schemaVersion: 2 as const, name: 'twgg',
    services: { backend: { networks: ['twgg-net'], volumes: ['twgg-data:/var/lib/data', `${bindDir}:/data:ro`] }, admin: {} },
  };
  FX.networks = []; FX.volumes = [];
  await assert.rejects(
    () => runGroupDeploy(appsRoot, { ...req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), spec }, log),
    /external network 'twgg-net' does not exist/,
  );
  assert.equal(FX.compose.length, 0);
  assert.equal(FX.pulls.length, 0);
  // with everything present the deploy renders networks/volumes into compose
  FX.networks = ['twgg-net']; FX.volumes = ['twgg-data'];
  const r = await runGroupDeploy(appsRoot, { ...req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), spec }, log);
  const composeText = await readFile(path.join(appsRoot, 'twgg', 'services', 'backend', 'compose.yaml'), 'utf8');
  assert.match(composeText, /name: "twgg-net"\s*\n\s*external: true/);
  assert.match(composeText, /twgg-data:\/var\/lib\/data/);
  assert.match(composeText, new RegExp(`${bindDir}:/data:ro`));
  void r;
});

test('refusals with zero mutations: foreign same-named project, v1 evidence, cross-project, env identity, dropped service, diverged inherited spec', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  // foreign container squatting the derived name of a service project
  FX.containers = [{ id: 'fx1', name: 'ship_twgg_admin-admin-1', project: 'ship_twgg_admin', dir: '/srv/other' }];
  await assert.rejects(() => runGroupDeploy(appsRoot, req({ admin: { imageRef: digest('a1') } }), log), /属于其他部署/);
  assert.equal(FX.compose.length, 0);
  FX.containers = [];

  // v1 evidence under the same group name
  await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), log);
  const groupDir = path.join(appsRoot, 'twgg');
  const backup = await readFile(path.join(groupDir, 'group.json'), 'utf8');
  await rm(path.join(groupDir, 'group.json'));
  const stateBackup = await readFile(path.join(groupDir, 'state.json'), 'utf8');
  await writeFile(path.join(groupDir, 'state.json'), JSON.stringify({ current: null, previous: null, history: [] }));
  FX.compose = [];
  await assert.rejects(() => runGroupDeploy(appsRoot, req({ admin: { imageRef: digest('a2') } }), log), /v1 单服务部署痕迹/);
  assert.equal(FX.compose.length, 0);
  await writeFile(path.join(groupDir, 'group.json'), backup);
  await writeFile(path.join(groupDir, 'state.json'), stateBackup);

  // a DIFFERENT project cannot deploy to the bound group
  FX.compose = [];
  await assert.rejects(() => runGroupDeploy(appsRoot, req({ admin: { imageRef: digest('a2') } }, 'proj-other'), log), /已绑定到其他项目/);
  // a different ENV on the same agent is refused too
  await assert.rejects(() => runGroupDeploy(appsRoot, req({ admin: { imageRef: digest('a2') } }, 'proj-x', 'staging'), log), /环境/);
  assert.equal(FX.compose.length, 0, 'all identity refusals mutated nothing');

  // dropped service: runtime has backend+admin; the new spec drops admin
  const dropped = { schemaVersion: 2 as const, name: 'twgg', services: { backend: {} } };
  await assert.rejects(
    () => runGroupDeploy(appsRoot, { ...req({ backend: { imageRef: digest('b2') } }), spec: dropped }, log),
    /'admin'.*absent from the new spec.*explicit migration/,
  );
  // diverged spec on an inherited service refuses
  const diverged = { schemaVersion: 2 as const, name: 'twgg', services: { backend: { ports: ['9999:8080'] }, admin: {} } };
  await assert.rejects(
    () => runGroupDeploy(appsRoot, { ...req({ admin: { imageRef: digest('a2') } }), spec: diverged }, log),
    /changes the spec of service 'backend'.*include it in --services/,
  );
  assert.equal(FX.compose.length, 0);
});

test('keepEnv inherits the committed env of a changed service; missing committed env refuses', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1'), envFileContent: 'A=1\n' } }), log);
  FX.compose = [];
  const r = await runGroupDeploy(appsRoot, req({ admin: { imageRef: digest('a2'), keepEnv: true } }), log);
  assert.deepEqual(r.changedServices, ['admin']);
  assert.equal(await readFile(path.join(appsRoot, 'twgg', 'services', 'admin', 'runtime.env'), 'utf8'), 'A=1\n', 'committed env carried over');
  const store = new GroupStore(appsRoot);
  const state = await store.loadState('twgg');
  const cur = await store.loadRelease('twgg', state.current ?? '');
  assert.equal(cur.services.admin?.env, 'A=1\n');
  // backend never had an env → keepEnv for backend refuses
  await assert.rejects(
    () => runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b2'), keepEnv: true } }), log),
    /keepEnv for 'backend' requires a committed env/,
  );
});

test('a v1 deploy into a v2-claimed name refuses (layouts never mix)', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), log);
  const { runDeploy } = await import('./handlers-deploy.js');
  await assert.rejects(
    () => runDeploy(appsRoot, {
      app: 'twgg', project: 'proj-x', env: 'prod', imageRef: 'reg/ns/x:1',
      spec: { name: 'twgg' },
    }, log),
    /v2 多服务发布组/,
  );
});

test('ownership taken over DURING the pull window: the switch refuses, recovery restores only OUR switched service and never adopts the foreign one', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), log);
  const servicesDir = path.join(appsRoot, 'twgg', 'services');
  FX.onPull = () => {
    FX.containers = [{ id: 'fx9', name: 'ship_twgg_admin-admin-1', project: 'ship_twgg_admin', dir: '/srv/attacker' }];
  };
  FX.compose = [];
  const err = await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b2') }, admin: { imageRef: digest('a2') } }), log).then(
    () => { throw new Error('expected failure'); },
    (e: unknown) => e as InstanceType<typeof GroupDeployFailure>,
  );
  assert.ok(err instanceof GroupDeployFailure, String(err));
  // backend (already switched) was recovered; the foreign admin project was NEVER up'd or down'd
  const adminUps = upsFor('ship_twgg_admin');
  assert.equal(adminUps.length, 0, 'no up ever ran against the foreign admin project');
  const adminDowns = downs().filter((d) => d.project === 'ship_twgg_admin');
  assert.equal(adminDowns.length, 0, 'no down either — foreign resources untouched');
  const recovered = ups().map((u) => u.composeImage);
  assert.ok(recovered.includes(digest('b1')), `our backend was recovered, saw ${recovered.join(',')}`);
  const store = new GroupStore(appsRoot);
  const state = await store.loadState('twgg');
  const cur = await store.loadRelease('twgg', state.current ?? '');
  assert.equal(cur.services.backend?.imageRef, digest('b1'));
  assert.equal(cur.services.admin?.imageRef, digest('a1'));
  void servicesDir;
});

test('state commit failure after successful activation recovers the changed services', async (t) => {
  const { appsRoot, cleanup } = await root();
  await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), log);
  // make the group dir read-only: snapshot writes go to releases/ (writable),
  // but shift's atomic state write needs a temp file IN the group dir → the
  // commit fails AFTER activation, which must trigger recovery
  const groupDir = path.join(appsRoot, 'twgg');
  const { chmod } = await import('node:fs/promises');
  await chmod(groupDir, 0o555);
  t.after(async () => {
    await chmod(groupDir, 0o755).catch(() => {});
    await cleanup();
  });
  FX.compose = [];
  const err = await runGroupDeploy(appsRoot, req({ admin: { imageRef: digest('a2') } }), log).then(
    () => { throw new Error('expected failure'); },
    (e: unknown) => e as InstanceType<typeof GroupDeployFailure>,
  );
  assert.ok(err instanceof GroupDeployFailure, String(err));
  assert.match(err.message, /state commit failed/);
  assert.equal(err.recovery.attempted, true);
  assert.equal(err.recovery.succeeded, true, 'changed service recovered to the previous combination');
  const recovered = ups().map((u) => u.composeImage);
  assert.ok(recovered.includes(digest('a1')), `admin recovered to a1, saw ${recovered.join(',')}`);
  // the committed state still names the previous release
  const store = new GroupStore(appsRoot);
  const state = await store.loadState('twgg');
  const cur = await store.loadRelease('twgg', state.current ?? '');
  assert.equal(cur.services.admin?.imageRef, digest('a1'));
});
