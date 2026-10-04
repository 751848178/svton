// Ownership regressions for deploy/rollback (2026-10-04): a same-named
// compose project or container that does NOT belong to the current
// deployment (another environment on this machine, a same-named app in a
// different repo, or an external actor) must be REFUSED before ANY
// modification; `up` never carries --remove-orphans (we clean only what is
// verifiably ours — and here, nothing at all). The docker CLI is faked at
// the exec seam: ps/inspect return canned states, compose invocations are
// recorded; no syscall result that the real docker did not "produce" is
// fabricated beyond those canned listings.

import test from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const realExec = await import('../shared/exec.js');
const FX = {
  /** machine-wide container census the fake docker reports */
  containers: [] as Array<{ id: string; name: string; project?: string; dir?: string }>,
  compose: [] as string[][], // recorded compose argvs
  fault: '' as string,
  composeEnv: undefined as Record<string, string> | undefined,
};
mock.module('../shared/exec.js', {
  namedExports: {
    ...realExec,
    exec: async (cmd: string, args: string[], opts?: unknown) => {
      if (cmd !== 'docker') return realExec.exec(cmd, args, opts as never);
      const ok = (stdout: string) => ({ code: 0, stdout, stderr: '', truncated: false, timedOut: false });
      if (args[0] === 'compose') {
        FX.compose.push(args); FX.composeEnv = (opts as { env?: Record<string, string> })?.env; return ok('');
      }
      if (FX.fault === `${args[0]}-error`) return { ...ok(''), code: 1 };
      if (FX.fault === `${args[0]}-truncated`) return { ...ok(''), truncated: true };
      if (FX.fault === `${args[0]}-timedOut`) return { ...ok(''), timedOut: true };
      if (FX.fault === 'inspect-empty' && args[0] === 'inspect') return ok('');
      if (args[0] === 'ps' && args.includes('--filter')) {
        const project = args.find((a) => a.startsWith('label=com.docker.compose.project='))?.split('=')[2];
        return ok(FX.containers.filter((c) => c.project === project).map((c) => c.id).join('\n') + (FX.containers.some((c) => c.project === project) ? '\n' : ''));
      }
      if (args[0] === 'ps') return ok(FX.containers.map((c) => `${c.id}\t${c.name}`).join('\n') + (FX.containers.length ? '\n' : ''));
      if (args[0] === 'inspect') {
        const ids = args.slice(args.indexOf('--format') + 2);
        return ok(FX.containers.filter((c) => ids.includes(c.id)).map((c) => `/${c.name}\t${c.project ?? ''}\t${c.dir ?? ''}`).join('\n') + '\n');
      }
      if (args.join(' ').startsWith('image inspect')) return { code: 1, stdout: '', stderr: 'no such image', truncated: false, timedOut: false };
      if (args[0] === 'version') return ok('24.0');
      return ok('');
    },
  },
});

const { runDeploy, runRollback } = await import('./handlers-deploy.js');
const { validateSpec } = await import('../shared/spec-schema.js');

const log = () => {};
const SPEC = () => validateSpec({ name: 'web', ports: ['3000:3000'] });
const reset = () => { FX.containers = []; FX.compose = []; FX.fault = ''; FX.composeEnv = undefined; };
/** pretend the app's project container exists, owned by `dir` (null = a
 *  same-named squatter with no compose label at all) */
const containerOwnedBy = (app: string, dir: string | null): void => {
  FX.containers = [{ id: 'c1', name: `ship-${app}-${app}-1`, ...(dir === null ? {} : { project: `ship-${app}`, dir }) }];
};
const ups = () => FX.compose.filter((a) => a.includes('up'));

test('same-named EXTERNAL compose project: deploy refuses before ANY modification', async () => {
  reset();
  const appsRoot = await mkdtemp(path.join(tmpdir(), 'ship-own-a-'));
  containerOwnedBy('web', '/srv/elsewhere/apps/web'); // someone else's deployment
  await assert.rejects(
    () => runDeploy(appsRoot, { app: 'web', project: 'proj-web-x', env: 'test', imageRef: 'reg/web:1', spec: SPEC() }, log),
    (e: Error) => /拒绝执行[\s\S]*属于其他部署[\s\S]*\/srv\/elsewhere\/apps\/web/.test(e.message),
  );
  assert.equal(FX.compose.length, 0, 'no docker compose command ran (no pull, no up, no stop, no rm)');
  await assert.rejects(
    () => readFile(path.join(appsRoot, 'web', 'state.json')),
    (e: NodeJS.ErrnoException) => e.code === 'ENOENT',
    'no deployment state was written either — refusal happened before any modification',
  );
});

test('name SQUATTER without our project label: refused as an unowned same-named container', async () => {
  reset();
  const appsRoot = await mkdtemp(path.join(tmpdir(), 'ship-own-b-'));
  containerOwnedBy('web', null); // occupies ship-web-web-1, no compose label at all
  await assert.rejects(
    () => runDeploy(appsRoot, { app: 'web', project: 'proj-web-x', env: 'test', imageRef: 'reg/web:1', spec: SPEC() }, log),
    (e: Error) => /拒绝执行[\s\S]*未知/.test(e.message),
  );
  assert.equal(FX.compose.length, 0, 'nothing was modified');
});

test('same app name in a DIFFERENT environment/repo on this machine: the second environment is refused, the first untouched', async () => {
  reset();
  const envA = await mkdtemp(path.join(tmpdir(), 'ship-own-c-a-'));
  const envB = await mkdtemp(path.join(tmpdir(), 'ship-own-c-b-'));
  // env A deploys first on a quiet machine — fresh project, no containers yet
  const a1 = await runDeploy(envA, { app: 'web', project: 'proj-web-x', env: 'test', imageRef: 'reg/web:1', spec: SPEC() }, log);
  assert.equal(a1.app, 'web');
  assert.ok(ups().length >= 1, 'env A really deployed');
  assert.ok(ups().every((a) => !a.includes('--remove-orphans')), 'up NEVER carries --remove-orphans');
  // now the machine holds A's container (working_dir = A's appDir)
  const aDir = path.join(envA, 'web');
  containerOwnedBy('web', aDir);
  FX.compose = [];
  // env B (different appsRoot ⇒ different appDir ⇒ different deployment
  // identity) must be refused and must not touch A's container
  await assert.rejects(
    () => runDeploy(envB, { app: 'web', project: 'proj-web-x', env: 'test', imageRef: 'reg/web:9', spec: SPEC() }, log),
    (e: Error) => /属于其他部署/.test(e.message) && e.message.includes(aDir),
  );
  assert.equal(FX.compose.length, 0, 'env B executed no compose command — A is untouched');
  // env B never had 'web' state — its rollback refuses (no previous release,
  // and it must not adopt the foreign project either), still touching nothing
  await assert.rejects(
    () => runRollback(envB, { app: 'web', project: 'proj-web-x', env: 'test' }, log),
    (e: Error) => /no previous release|属于其他部署|没有/.test(e.message),
  );
  assert.equal(FX.compose.length, 0, 'env B rollback executed no compose command');
});

test('the OWNING environment is never refused: redeploy and rollback pass the gate', async () => {
  reset();
  const envA = await mkdtemp(path.join(tmpdir(), 'ship-own-d-'));
  const aDir = path.join(envA, 'web');
  await runDeploy(envA, { app: 'web', project: 'proj-web-x', env: 'test', imageRef: 'reg/web:1', spec: SPEC() }, log);
  containerOwnedBy('web', aDir); // our own container on the machine
  const again = await runDeploy(envA, { app: 'web', project: 'proj-web-x', env: 'test', imageRef: 'reg/web:2', spec: SPEC() }, log);
  assert.equal(again.imageRef, 'reg/web:2', 'same-env redeploy passes the ownership gate');
  assert.ok(ups().every((a) => !a.includes('--remove-orphans')), 'no unconstrained orphan cleanup');
  const rb = await runRollback(envA, { app: 'web', project: 'proj-web-x', env: 'test' }, log);
  assert.equal(rb.imageRef, 'reg/web:1', 'rollback passes the gate and restores the previous release');
});

test('rollback refuses a foreign same-named project before touching it', async () => {
  reset();
  const envA = await mkdtemp(path.join(tmpdir(), 'ship-own-e-'));
  await runDeploy(envA, { app: 'web', project: 'proj-web-x', env: 'test', imageRef: 'reg/web:1', spec: SPEC() }, log);
  await runDeploy(envA, { app: 'web', project: 'proj-web-x', env: 'test', imageRef: 'reg/web:2', spec: SPEC() }, log);
  containerOwnedBy('web', '/srv/other/apps/web'); // someone replaced ownership mid-flight
  FX.compose = [];
  await assert.rejects(
    () => runRollback(envA, { app: 'web', project: 'proj-web-x', env: 'test' }, log),
    (e: Error) => /属于其他部署/.test(e.message),
  );
  assert.equal(FX.compose.length, 0, 'rollback performed no compose mutation');
  const state = JSON.parse(await readFile(path.join(envA, 'web', 'state.json'), 'utf8')) as { current: string };
  assert.ok(state.current, 'rollback state untouched by the refusal');
});

test('failed, timed-out, truncated or incomplete Docker ownership evidence blocks every mutation', async () => {
  const appsRoot = await mkdtemp(path.join(tmpdir(), 'ship-own-incomplete-'));
  for (const fault of ['ps-error', 'ps-truncated', 'ps-timedOut', 'inspect-error', 'inspect-truncated', 'inspect-timedOut', 'inspect-empty']) {
    reset();
    containerOwnedBy('web', path.join(appsRoot, 'web'));
    FX.fault = fault;
    await assert.rejects(() => runDeploy(appsRoot, { app: 'web', project: 'p', env: 'prod', imageRef: 'reg/web:1', spec: SPEC() }, log), /无法核验/);
    assert.equal(FX.compose.length, 0, fault);
  }
});

test('derived name and working directory alone do not authorize a different Compose project', async () => {
  reset();
  const appsRoot = await mkdtemp(path.join(tmpdir(), 'ship-own-label-'));
  FX.containers = [{ id: 'foreign', name: 'ship-web-web-1', project: 'another-project', dir: path.join(appsRoot, 'web') }];
  await assert.rejects(() => runDeploy(appsRoot, { app: 'web', project: 'p', env: 'prod', imageRef: 'reg/web:1', spec: SPEC() }, log), /属于其他部署/);
  assert.equal(FX.compose.length, 0);
});

test('Compose orphan deletion is disabled even when the Agent inherits COMPOSE_REMOVE_ORPHANS=true', async () => {
  reset();
  const appsRoot = await mkdtemp(path.join(tmpdir(), 'ship-own-orphans-'));
  const original = process.env.COMPOSE_REMOVE_ORPHANS;
  process.env.COMPOSE_REMOVE_ORPHANS = 'true';
  try {
    await runDeploy(appsRoot, { app: 'web', project: 'p', env: 'prod', imageRef: 'reg/web:1', spec: SPEC() }, log);
    assert.equal(FX.composeEnv?.COMPOSE_REMOVE_ORPHANS, 'false');
    assert.ok(ups().every((a) => !a.includes('--remove-orphans')));
  } finally {
    if (original === undefined) delete process.env.COMPOSE_REMOVE_ORPHANS;
    else process.env.COMPOSE_REMOVE_ORPHANS = original;
  }
});
