// R01/R02/R03 regressions: recovery re-verifies identity and ownership before
// ANY post-failure action, first-deploy removal never downs a foreign project,
// and a restored-but-unhealthy service is never reported as recovered.

import test from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Job, JobEvent } from '../shared/job-protocol.js';

const realExec = await import('../shared/exec.js');
const FX = {
  containers: [] as Array<{ id: string; name: string; project?: string; dir?: string }>,
  compose: [] as Array<{ project: string; args: string[]; composeImage?: string }>,
  failUpFor: null as null | string,
  onPull: null as null | (() => Promise<void> | void),
  onUpFail: null as null | (() => Promise<void> | void),
  onDown: null as null | (() => Promise<void> | void),
  onOwnership: null as null | (() => Promise<void> | void),
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
        if (FX.onOwnership) await FX.onOwnership();
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

const { runGroupDeploy, GroupDeployFailure, describeRecovery } = await import('./handlers-group-deploy.js');
const { GroupStore } = await import('./group-store.js');
const { recoverServices } = await import('./group-recovery.js');
const { JobStore } = await import('./jobs.js');
const { recoveryExitCode } = await import('../cli/job-report.js');
const { jobControl } = await import('./job-control.js');
const { runGroupRollback } = await import('./handlers-group-rollback.js');

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

test.beforeEach(() => { FX.containers = []; FX.compose = []; FX.failUpFor = null; FX.onPull = null; FX.onUpFail = null; FX.onDown = null; FX.onOwnership = null; FXH.healthy = true; FXH.urls = []; });

for (const operation of ['deploy', 'rollback'] as const) {
  for (const healthy of [true, false]) {
    test(`${operation} reports each actual probe outcome before commit or failure recovery`, async (t) => {
      const { appsRoot, cleanup } = await root(); t.after(cleanup);
      if (operation === 'rollback') {
        await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') } }), log);
        await runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b2') }, admin: { imageRef: digest('a2') } }), log);
      }
      FXH.healthy = healthy;
      const events: Array<Omit<JobEvent, 'seq' | 'ts'>> = [];
      const job: Job = { id: 'probe-test', type: operation === 'deploy' ? 'group-deploy' : 'group-rollback', status: 'running', createdAt: '', updatedAt: '' };
      const control = jobControl(job, (event) => events.push(event));
      const running = operation === 'deploy'
        ? runGroupDeploy(appsRoot, req({ backend: { imageRef: digest('b3') }, admin: { imageRef: digest('a3') } }), log, control)
        : runGroupRollback(appsRoot, { app: 'twgg', project: 'proj-x', env: 'prod' }, log, control);
      if (healthy) assert.equal((await running).verification, 'skipped');
      else await assert.rejects(running, GroupDeployFailure);
      assert.deepEqual(events.filter((event) => event.event === 'probe').map((event) => [event.service, event.detail]), [
        ['backend', 'skipped'], ['admin', healthy ? 'succeeded' : 'failed'],
      ]);
      const lastProbe = events.reduce((last, event, index) => event.event === 'probe' ? index : last, -1);
      const boundary = events.findIndex((event) => event.phase === (healthy ? 'commit' : 'recover'));
      assert.ok(lastProbe < boundary, 'outcomes precede commit/recovery transitions');
    });
  }
}

async function bindingFor(appsRoot: string) {
  const groupDir = path.join(appsRoot, 'twgg');
  await mkdir(groupDir, { recursive: true });
  const identity = { app: 'twgg', project: 'proj-x', env: 'prod' };
  const file = path.join(groupDir, 'project.json');
  await writeFile(file, JSON.stringify(identity));
  return { identity, file };
}

for (const change of ['foreign', 'missing', 'corrupt'] as const) {
  test(`S02: ${change} binding during ownership inspection refuses the first-deploy down`, async (t) => {
    const { appsRoot, cleanup } = await root();
    t.after(cleanup);
    const { identity, file } = await bindingFor(appsRoot);
    FX.onOwnership = async () => {
      if (change === 'missing') await rm(file);
      else await writeFile(file, change === 'corrupt' ? '{broken' : JSON.stringify({ ...identity, project: 'other' }));
    };
    const outcome = await recoverServices({ appsRoot, group: 'twgg', identity, previousCombination: null, changedSoFar: ['backend'], log });
    assert.equal(downs().length, 0, 'ownership inspection is an async window; binding must be checked again before down');
    assert.equal(outcome.succeeded, false);
    assert.deepEqual(outcome.pending, ['backend']);
  });
}

test('S02: a binding refusal latches the stop even if the original binding is restored later', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  const { identity, file } = await bindingFor(appsRoot);
  FX.onDown = async () => { await writeFile(file, JSON.stringify({ ...identity, project: 'other' })); };
  const outcome = await recoverServices({
    appsRoot, group: 'twgg', identity, previousCombination: null, changedSoFar: ['backend', 'admin', 'mobile'],
    log: (line) => { if (line.includes('STOPPED before admin')) writeFileSync(file, JSON.stringify(identity)); },
  });
  assert.deepEqual(downs().map((d) => d.project), ['ship_twgg_backend']);
  assert.deepEqual(outcome.cleaned, ['backend']);
  assert.deepEqual(outcome.pending, ['admin', 'mobile']);
  assert.equal(outcome.succeeded, false);
});

test('S04: an unhealthy recovery probe is never counted or described as passed', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  const { identity } = await bindingFor(appsRoot);
  FXH.healthy = false;
  const outcome = await recoverServices({
    appsRoot, group: 'twgg', identity, changedSoFar: ['admin'], log,
    previousCombination: { admin: { imageRef: digest('a1'), spec: SPEC.services.admin!, hasEnv: false } },
  });
  assert.equal(outcome.succeeded, false);
  assert.equal(outcome.verification, 'failed');
  assert.equal(outcome.probed, 0, 'probed count used as passed count in reports must contain only successful probes');
  assert.match(outcome.detail, /0 passed \/ 1 failed/);
});

test('S04: an unresolved declared probe remains skipped without claiming the declaration is absent', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  const { identity } = await bindingFor(appsRoot);
  const outcome = await recoverServices({
    appsRoot, group: 'twgg', identity, changedSoFar: ['backend', 'admin'], log,
    previousCombination: {
      backend: { imageRef: digest('b1'), spec: SPEC.services.admin!, hasEnv: false },
      admin: { imageRef: digest('a1'), spec: { ports: ['8080'], healthcheck: { path: '/healthz' } }, hasEnv: false },
    },
  });
  assert.equal(outcome.succeeded, true);
  assert.equal(outcome.verification, 'skipped');
  assert.equal(outcome.probed, 1);
  assert.equal(outcome.probesSkipped, 1);
  assert.match(describeRecovery(outcome, 2), /1 service\(s\) skipped \(not verified\)/);
  assert.doesNotMatch(describeRecovery(outcome, 2), /no probe declared|re-verified healthy/);
});

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
  assert.deepEqual(err.recovery.pending, ['backend'], 'failed ownership leaves the service pending, not silently absent from the scope');
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
  assert.equal(err.recovery.verification, 'failed');
  assert.equal(err.recovery.probed, 0);
  assert.equal(err.recovery.probesFailed, 1);
  assert.equal(recoveryExitCode('deploy', err.recovery), 6);
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
  assert.equal(err.recovery.verification, 'skipped');
  assert.equal(err.recovery.probesSkipped, 1);
  assert.equal(recoveryExitCode('deploy', err.recovery), 5, 'restore succeeds while verification explicitly remains partial');
  assert.match(err.message, /verification PARTIAL — 1 probe\(s\) passed, 1 service\(s\) skipped/, `summary keeps the skipped service visible: ${err.message}`);
  assert.ok(!/re-verified healthy/.test(err.message), 'never claims overall re-verified with a probe-less service in the mix');
  // The actual JobStore transport persists Error.recovery into job.result.
  // Verify its JSON survives a restart instead of testing only an Error field.
  const workRoot = path.join(path.dirname(appsRoot), 'work');
  const jobs = new JobStore(workRoot);
  const job = await jobs.create('deploy', async () => { throw err; });
  const deadline = Date.now() + 2000;
  while (jobs.activeCount() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 5));
  assert.equal(jobs.activeCount(), 0, 'failed job is persisted within the test deadline');
  const restarted = new JobStore(workRoot);
  await restarted.loadPersisted();
  const saved = restarted.get(job.id);
  assert.equal(saved?.status, 'failed');
  assert.deepEqual(saved?.result, { recovery: err.recovery }, 'API JSON preserves the partial verification and exact recovery scope');
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
  assert.equal(err.recovery.verification, 'failed');
  assert.equal(err.recovery.probesFailed, 1);
  const store = new GroupStore(appsRoot);
  const state = await store.loadState('twgg');
  const cur = await store.loadRelease('twgg', state.current ?? '');
  assert.equal(cur.services.admin?.imageRef, digest('a2'), 'rollback did not commit');
});
