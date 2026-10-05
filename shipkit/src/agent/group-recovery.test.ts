// R01/R02/R03 regressions: recovery re-verifies identity and ownership before
// ANY post-failure action, first-deploy removal never downs a foreign project,
// and a restored-but-unhealthy service is never reported as recovered.

import test from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const realExec = await import('../shared/exec.js');
const FX = {
  containers: [] as Array<{ id: string; name: string; project?: string; dir?: string }>,
  compose: [] as Array<{ project: string; args: string[]; composeImage?: string }>,
  failUpFor: null as null | string,
  onPull: null as null | (() => Promise<void> | void),
  onUpFail: null as null | (() => Promise<void> | void),
  onDown: null as null | (() => Promise<void> | void),
};
mock.module('../shared/exec.js', {
  namedExports: {
    ...realExec,
    exec: async (cmd: string, args: string[], opts?: unknown) => {
      if (cmd !== 'docker') return realExec.exec(cmd, args, opts as never);
      const ok = (stdout = '') => ({ code: 0, stdout, stderr: '', truncated: false, timedOut: false });
      const fail = (stderr: string) => ({ code: 1, stdout: '', stderr, truncated: false, timedOut: false });
      if (args[0] === 'pull') { if (FX.onPull) await FX.onPull(); return ok(); }
      if (args[0] === 'image' && args[1] === 'inspect') return fail('none');
      if (args[0] === 'compose') {
        const project = args[args.indexOf('-p') + 1] ?? '';
        let composeImage: string | undefined;
        if (args.includes('up')) {
          const dir = String((opts as { cwd?: string } | undefined)?.cwd ?? '');
          const f = path.join(dir, 'compose.yaml');
          composeImage = existsSync(f) ? await import('node:fs/promises').then((fs) => fs.readFile(f, 'utf8')).then((t) => /image: "([^"]+)"/.exec(t)?.[1]).catch(() => undefined) : undefined;
          if (composeImage && FX.failUpFor && composeImage === FX.failUpFor) {
            if (FX.onUpFail) await FX.onUpFail(); // a squatter lands DURING the failing up window
            return fail('up failed (injected)');
          }
        }
        if (args.includes('down') && FX.onDown) await FX.onDown();
        FX.compose.push({ project, args, composeImage });
        return ok('');
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

// healthcheck seam: the REAL waitHealthy polls a URL — control it per test
const FXH = { healthy: true, urls: [] as string[] };
mock.module('./healthcheck.js', {
  namedExports: {
    waitHealthy: async (o: { url: string }) => {
      FXH.urls.push(o.url);
      return FXH.healthy ? { healthy: true, skipped: false, attempts: 1 } : { healthy: false, skipped: false, attempts: 1, lastError: 'injected unhealthy' };
    },
  },
});

const { runGroupDeploy, GroupDeployFailure } = await import('./handlers-group-deploy.js');
const { GroupStore } = await import('./group-store.js');

const log = (..._l: unknown[]) => undefined;
const digest = (s: string) => `reg/ns/${s}@sha256:${s.repeat(64).slice(0, 64)}`;
const SPEC: import('../shared/spec-v2.js').ProjectSpec = {
  schemaVersion: 2,
  name: 'twgg',
  services: { backend: {}, admin: { healthcheck: { path: '/healthz', hostPort: 9, timeoutSeconds: 1 } } },
};
const req = (changed: Record<string, { imageRef: string }>, project = 'proj-x', env = 'prod') => ({
  schemaVersion: 2 as const, app: 'twgg', project, env, spec: SPEC, changed,
});
async function root() {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-grecovery-'));
  return { appsRoot: path.join(dir, 'apps'), cleanup: () => rm(dir, { recursive: true, force: true }) };
}
const ups = () => FX.compose.filter((c) => c.args.includes('up'));
const downs = () => FX.compose.filter((c) => c.args.includes('down'));
const catchFailure = (p: Promise<unknown>) => p.then(() => { throw new Error('expected failure'); }, (e: unknown) => e as InstanceType<typeof GroupDeployFailure>);

test.beforeEach(() => { FX.containers = []; FX.compose = []; FX.failUpFor = null; FX.onPull = null; FX.onUpFail = null; FX.onDown = null; FXH.healthy = true; FXH.urls = []; });

test('R01: first-deploy up failure NEVER downs a foreign same-named project — ownership re-verified, recovery honestly failed', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  // the up itself fails AND a foreign actor squats the project name during
  // that failing window — recovery's down must re-verify ownership and refuse
  FX.failUpFor = digest('b1');
  FX.onUpFail = () => {
    FX.containers = [{ id: 'fx1', name: 'ship_twgg_backend-backend-1', project: 'ship_twgg_backend', dir: '/srv/attacker' }];
  };
  const err = await catchFailure(runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), log));
  assert.ok(err instanceof GroupDeployFailure, String(err));
  assert.equal(downs().length, 0, 'no compose down ever ran — the foreign project was not touched');
  assert.match(err.message, /ship_twgg_backend.*up -d failed/, 'our own backend up ran and failed (injected) before recovery refused');
  assert.equal(err.recovery.succeeded, false, 'recovery is NOT reported as successful');
  assert.match(err.message, /FAILED.*inspect the machine/i, `honest failure text: ${err.message}`);
});

test('R02: binding switched to another project during the pull window — every switch and the recovery refuse, nothing mutated', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), log);
  const binding = path.join(appsRoot, 'twgg', 'project.json');
  const original = JSON.parse(await (await import('node:fs/promises')).readFile(binding, 'utf8')) as { project: string };
  FX.onPull = async () => {
    // re-point the binding at another project mid-pull (awaited before the pull returns)
    const fs = await import('node:fs/promises');
    await fs.writeFile(binding, `${JSON.stringify({ ...original, project: 'proj-other', env: 'staging' })}\n`);
  };
  FX.compose = [];
  const err = await catchFailure(runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b2') }, admin: { imageRef: digest('a2') } }), log));
  assert.ok(err instanceof GroupDeployFailure, String(err));
  assert.equal(ups().length, 0, 'no up ran after the binding changed');
  assert.equal(downs().length, 0, 'recovery refused too — identity no longer verifiable');
  assert.equal(err.recovery.succeeded, false);
  // the committed combination is untouched
  const store = new GroupStore(appsRoot);
  const state = await store.loadState('twgg');
  const cur = await store.loadRelease('twgg', state.current ?? '');
  assert.equal(cur.services.admin?.imageRef, digest('a1'));
});

test('R03: a restored service that is STILL unhealthy reports recovery FAILED, not succeeded', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), log);
  FX.compose = [];
  FXH.healthy = false; // every probe fails: deploy health AND recovery re-check
  const err = await catchFailure(runGroupDeploy(appsRoot, req({ admin: { imageRef: digest('a2') } }), log));
  assert.ok(err instanceof GroupDeployFailure, String(err));
  assert.equal(err.recovery.succeeded, false, 'recovery restored the image but the service is unhealthy — not a success');
  assert.match(err.message, /verification failed|UNHEALTHY|FAILED/i, `message reflects reality: ${err.message}`);
  // the restore DID happen (recovery up with the previous image) before being judged unhealthy
  const restored = ups().map((u) => u.composeImage);
  assert.ok(restored.includes(digest('a1')), `admin was restored to a1, saw ${restored.join(',')}`);
});

test('R03: recovery of services WITHOUT probes is reported as verification-skipped, distinct from verified', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  // probe-less spec for both services
  const plain: import('../shared/spec-v2.js').ProjectSpec = { schemaVersion: 2, name: 'twgg', services: { backend: {}, admin: {} } };
  await runGroupDeploy(appsRoot, { ...req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), spec: plain }, log);
  FX.compose = [];
  FXH.healthy = false; // irrelevant: no probes resolvable
  FX.failUpFor = digest('a2'); // the NEW admin up fails → recovery runs
  const err = await catchFailure(runGroupDeploy(appsRoot, { ...req({ admin: { imageRef: digest('a2') } }), spec: plain }, log));
  assert.ok(err instanceof GroupDeployFailure, String(err));
  assert.equal(err.recovery.succeeded, true, 'restore itself succeeded');
  assert.match(err.message, /no probes passed — verification skipped, not verified/, 'skip is explicit, never claimed as verified');
});

test('S02: binding re-pointed between first-deploy cleanups STOPS the second down and reports the exact scope', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  const binding = path.join(appsRoot, 'twgg', 'project.json');
  let downCount = 0;
  // first-deploy both services switch, then health fails; during the FIRST
  // cleanup down the binding is re-pointed at another project/environment
  FXH.healthy = false;
  FX.onDown = async () => {
    downCount++;
    if (downCount === 1) {
      const fs = await import('node:fs/promises');
      await fs.writeFile(binding, `${JSON.stringify({ app: 'twgg', project: 'proj-other', env: 'staging' })}\n`);
    }
  };
  // services: backend (first in map order) + admin(probe) — first deploy, up fails via probe
  const err = await catchFailure(runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), log));
  assert.ok(err instanceof GroupDeployFailure, String(err));
  const downProjects = downs().map((d) => d.project);
  assert.equal(downProjects.length, 1, `exactly ONE down ran, then recovery stopped: ${downProjects.join(',')}`);
  assert.equal(downProjects[0], 'ship_twgg_backend');
  assert.equal(err.recovery.succeeded, false, 'recovery is not reported successful');
  assert.match(err.message, /abandoned=\[admin\]|STOPPED before admin|binding re-check/, `scope reported honestly: ${err.message}`);
});

test('S04: mixed probes never report overall re-verified — one probed + one probe-less is PARTIAL(skipped)', async (t) => {
  const { appsRoot, cleanup } = await root();
  await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), log);
  // fail the STATE COMMIT after both services switched: recovery restores both;
  // backend (probe-less) skips, admin's probe passes → summary must be PARTIAL
  const groupDir = path.join(appsRoot, 'twgg');
  const { chmod } = await import('node:fs/promises');
  await chmod(groupDir, 0o555);
  t.after(async () => { await chmod(groupDir, 0o755).catch(() => {}); await cleanup(); });
  FX.compose = [];
  FXH.healthy = true;
  const err = await catchFailure(runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b2') }, admin: { imageRef: digest('a2') } }), log));
  assert.ok(err instanceof GroupDeployFailure, String(err));
  assert.match(err.message, /state commit failed/, `injected at commit time: ${err.message}`);
  assert.equal(err.recovery.succeeded, true, 'restore actions + the one declared probe all fine');
  assert.match(err.message, /verification PARTIAL — 1 probe\(s\) passed, 1 service\(s\) have no probe declared/, `summary keeps the skipped service visible: ${err.message}`);
  assert.ok(!/re-verified healthy/.test(err.message), 'never claims overall re-verified with a probe-less service in the mix');
});

test('R03 (rollback): a rollback failure whose recovery re-check fails is not reported successful', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  // backend carries the probe here: it gets switched by the rollback, then its
  // recovery restore is re-probed and found still-unhealthy
  const spec: import('../shared/spec-v2.js').ProjectSpec = {
    schemaVersion: 2, name: 'twgg',
    services: { backend: { healthcheck: { path: '/healthz', hostPort: 9, timeoutSeconds: 1 } }, admin: {} },
  };
  await runGroupDeploy(appsRoot, { ...req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), spec }, log);
  await runGroupDeploy(appsRoot, { ...req({ backend: { imageRef: digest('b2') }, admin: { imageRef: digest('a2') } }), spec }, log);
  FX.compose = [];
  // rollback restores backend→b1 (ok) then admin→a1 whose up FAILS; recovery
  // restores backend→b2 and its re-probe fails (probes globally unhealthy)
  FX.failUpFor = digest('a1');
  FXH.healthy = false;
  const { runGroupRollback } = await import('./handlers-group-rollback.js');
  const err = await catchFailure(runGroupRollback(appsRoot, { app: 'twgg', project: 'proj-x', env: 'prod' }, log));
  assert.ok(err instanceof GroupDeployFailure, String(err));
  assert.equal(err.recovery.succeeded, false, 'recovery re-check failed (backend restored but still unhealthy) — honest failure');
  const store = new GroupStore(appsRoot);
  const state = await store.loadState('twgg');
  const cur = await store.loadRelease('twgg', state.current ?? '');
  assert.equal(cur.services.admin?.imageRef, digest('a2'), 'rollback did not commit');
});
