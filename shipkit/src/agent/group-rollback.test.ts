// v2 group rollback (MS-04): default rollback undoes the last release's
// changedServices from the parent combination; explicit --services walks
// history; stale plans refuse; failures recover to the pre-rollback state.

import test from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const realExec = await import('../shared/exec.js');
const FX = {
  compose: [] as Array<{ project: string; args: string[]; composeImage?: string }>,
  /** make `up` fail when the service dir's compose.yaml contains this image ref */
  failUpFor: null as null | string,
};
mock.module('../shared/exec.js', {
  namedExports: {
    ...realExec,
    exec: async (cmd: string, args: string[], opts?: unknown) => {
      if (cmd !== 'docker') return realExec.exec(cmd, args, opts as never);
      const ok = (stdout = '') => ({ code: 0, stdout, stderr: '', truncated: false, timedOut: false });
      if (args[0] === 'pull') return ok();
      if (args[0] === 'compose') {
        const project = args[args.indexOf('-p') + 1] ?? '';
        let composeImage: string | undefined;
        if (args.includes('up')) {
          const dir = String((opts as { cwd?: string } | undefined)?.cwd ?? '');
          const composeFile = path.join(dir, 'compose.yaml');
          composeImage = existsSync(composeFile) ? await import('node:fs/promises').then((fs) => fs.readFile(composeFile, 'utf8')).then((t) => /image: "([^"]+)"/.exec(t)?.[1]).catch(() => undefined) : undefined;
          if (composeImage && FX.failUpFor && composeImage === FX.failUpFor) {
            return { code: 1, stdout: '', stderr: `up failed for ${composeImage} (injected)`, truncated: false, timedOut: false };
          }
        }
        FX.compose.push({ project, args, composeImage });
        return ok();
      }
      if (args[0] === 'ps' || args[0] === 'inspect') return ok('');
      if (args[0] === 'version') return ok('24.0');
      return ok('');
    },
  },
});

const { runGroupDeploy } = await import('./handlers-group-deploy.js');
const { runGroupRollback } = await import('./handlers-group-rollback.js');
const { GroupStore } = await import('./group-store.js');

const log = (..._l: unknown[]) => undefined;
const digest = (s: string) => `reg/ns/${s}@sha256:${s.repeat(64).slice(0, 64)}`;
const SPEC = {
  schemaVersion: 2 as const,
  name: 'twgg',
  services: { backend: {}, admin: {}, mobile: {} },
};

async function root(): Promise<{ appsRoot: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-grollback-'));
  const appsRoot = path.join(dir, 'apps');
  return { appsRoot, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

async function deploySeq(appsRoot: string, steps: Array<Record<string, { imageRef: string }>>): Promise<void> {
  for (const step of steps) {
    await runGroupDeploy(appsRoot, { schemaVersion: 2, app: 'twgg', project: 'p', env: 'prod', spec: SPEC, changed: step }, log);
  }
}

const ups = () => FX.compose.filter((c) => c.args.includes('up'));
const upsFor = (project: string) => ups().filter((c) => c.project === project);

test.beforeEach(() => { FX.compose = []; FX.failUpFor = null; });

test('default rollback restores the LAST release\'s changedServices from the parent; unselected services stay untouched', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  await deploySeq(appsRoot, [
    { backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') }, mobile: { imageRef: digest('m1') } },
    { admin: { imageRef: digest('a2') } }, // only admin changed in the last release
  ]);
  FX.compose = [];
  const r = await runGroupRollback(appsRoot, { app: 'twgg', project: 'p', env: 'prod' }, log);
  assert.deepEqual(r.changedServices, ['admin'], 'only the last release\'s changed set is undone');
  assert.equal(ups().length, 1, 'exactly one service switched');
  assert.ok(upsFor('ship_twgg_admin').length === 1);
  assert.equal(upsFor('ship_twgg_backend').length + upsFor('ship_twgg_mobile').length, 0, 'unchanged services never restarted');
  // admin is back at a1
  const store = new GroupStore(appsRoot);
  const state = await store.loadState('twgg');
  const cur = await store.loadRelease('twgg', state.current ?? '');
  assert.equal(cur.services.admin?.imageRef, digest('a1'));
  assert.equal(cur.services.backend?.imageRef, digest('b1'));
  assert.equal(state.history[0]?.event, 'rollback', 'rollback is a NEW history record, original history kept');
});

test('explicit --services walks the history for the newest covering release', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  await deploySeq(appsRoot, [
    { backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') }, mobile: { imageRef: digest('m1') } },
    { backend: { imageRef: digest('b2') }, admin: { imageRef: digest('a2') } },
    { mobile: { imageRef: digest('m2') } },
  ]);
  FX.compose = [];
  // backend+admin were last released TOGETHER in release 2 → restore to release 1 values
  const r = await runGroupRollback(appsRoot, { app: 'twgg', project: 'p', env: 'prod', services: ['backend', 'admin'] }, log);
  assert.deepEqual([...r.changedServices].sort(), ['admin', 'backend']);
  const store = new GroupStore(appsRoot);
  const state = await store.loadState('twgg');
  const cur = await store.loadRelease('twgg', state.current ?? '');
  assert.equal(cur.services.backend?.imageRef, digest('b1'));
  assert.equal(cur.services.admin?.imageRef, digest('a1'));
  assert.equal(cur.services.mobile?.imageRef, digest('m2'), 'mobile keeps its newer release');
  // a set never released together refuses instead of guessing
  await assert.rejects(
    () => runGroupRollback(appsRoot, { app: 'twgg', project: 'p', env: 'prod', services: ['admin', 'mobile'] }, log),
    /no history snapshot contains ALL of \[admin, mobile\]/,
  );
});

test('a stale rollback plan (baseReleaseId ≠ current) is rejected before touching anything', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  await deploySeq(appsRoot, [
    { backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') }, mobile: { imageRef: digest('m1') } },
    { admin: { imageRef: digest('a2') } },
  ]);
  FX.compose = [];
  const store = new GroupStore(appsRoot);
  const state = await store.loadState('twgg');
  await assert.rejects(
    () => runGroupRollback(appsRoot, { app: 'twgg', project: 'p', env: 'prod', baseReleaseId: 'stale-id' }, log),
    /stale.*planned against release 'stale-id' but current is '.+'/,
  );
  assert.equal(FX.compose.length, 0);
  // matching base works
  const r = await runGroupRollback(appsRoot, { app: 'twgg', project: 'p', env: 'prod', baseReleaseId: state.current ?? '' }, log);
  assert.deepEqual(r.changedServices, ['admin']);
});

test('first deployment has nothing to roll back to; cross-project/env rollback refuses', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  await deploySeq(appsRoot, [{ backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') }, mobile: { imageRef: digest('m1') } }]);
  FX.compose = [];
  await assert.rejects(
    () => runGroupRollback(appsRoot, { app: 'twgg', project: 'p', env: 'prod' }, log),
    /first deployment — no previous combination/,
  );
  await assert.rejects(
    () => runGroupRollback(appsRoot, { app: 'twgg', project: 'other', env: 'prod' }, log),
    /已绑定到其他项目/,
  );
  await assert.rejects(
    () => runGroupRollback(appsRoot, { app: 'twgg', project: 'p', env: 'staging' }, log),
    /环境/,
  );
  assert.equal(FX.compose.length, 0);
});

test('rollback activation failure recovers the services switched so far to the pre-rollback combination', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  await deploySeq(appsRoot, [
    { backend: { imageRef: digest('b1') }, admin: { imageRef: digest('a1') }, mobile: { imageRef: digest('m1') } },
    { backend: { imageRef: digest('b2') }, admin: { imageRef: digest('a2') } },
  ]);
  // the rollback restores backend→b1 then admin→a1; fail the admin `up` only
  FX.failUpFor = digest('a1');
  FX.compose = [];
  const err = await runGroupRollback(appsRoot, { app: 'twgg', project: 'p', env: 'prod' }, log).then(
    () => { throw new Error('expected failure'); },
    (e: unknown) => e as Error & { recovery?: { succeeded: boolean; attempted: boolean } },
  );
  assert.match(err.message, /rollback of \[backend, admin\] failed/);
  assert.equal(err.recovery?.attempted, true);
  assert.equal(err.recovery?.succeeded, true, 'backend (switched before the failure) is restored to the pre-rollback combination');
  // recovery re-upped backend with the PRE-rollback image b2
  const backendImages = upsFor('ship_twgg_backend').map((u) => u.composeImage);
  assert.ok(backendImages.includes(digest('b1')) && backendImages.includes(digest('b2')), `backend rolled forward then recovered, saw ${backendImages.join(',')}`);
  const store = new GroupStore(appsRoot);
  const state = await store.loadState('twgg');
  const cur = await store.loadRelease('twgg', state.current ?? '');
  assert.equal(cur.services.admin?.imageRef, digest('a2'), 'state unchanged — rollback did not commit');
});
