import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const realExec = await import('../shared/exec.js');
const realAtomic = await import('./atomic.js');
const realBinding = await import('./project-binding.js');
const FX = {
  ups: [] as string[],
  containers: [] as Array<{ id: string; project: string; name: string; dir: string }>,
  afterWrite: null as null | ((file: string) => Promise<void>),
  restoreBindingOnRefusal: false,
};
mock.module('../shared/exec.js', { namedExports: { ...realExec, exec: async (cmd: string, args: string[], opts?: unknown) => {
  if (cmd !== 'docker') return realExec.exec(cmd, args, opts as never);
  const ok = (stdout = '') => ({ code: 0, stdout, stderr: '', truncated: false, timedOut: false });
  if (args[0] === 'ps' && args.includes('--filter')) {
    const project = args.find((a) => a.startsWith('label=com.docker.compose.project='))?.split('=')[2];
    return ok(FX.containers.filter((c) => c.project === project).map((c) => c.id).join('\n'));
  }
  if (args[0] === 'ps') return ok(FX.containers.map((c) => `${c.id}\t${c.name}`).join('\n'));
  if (args[0] === 'inspect') return ok(FX.containers.map((c) => `/${c.name}\t${c.project}\t${c.dir}`).join('\n'));
  if (args[0] === 'compose' && args.includes('up')) FX.ups.push(args[args.indexOf('-p') + 1]!);
  return ok();
} } });
mock.module('./atomic.js', { namedExports: { ...realAtomic, writeFileAtomic: async (...args: Parameters<typeof realAtomic.writeFileAtomic>) => {
  await realAtomic.writeFileAtomic(...args);
  await FX.afterWrite?.(args[0]);
} } });
mock.module('./project-binding.js', { namedExports: { ...realBinding, assertProjectBinding: async (...args: Parameters<typeof realBinding.assertProjectBinding>) => {
  try { await realBinding.assertProjectBinding(...args); }
  catch (e) {
    // A repair lands just after the real check has refused. The refusal must
    // remain observable even though a later read now sees the original owner.
    if (FX.restoreBindingOnRefusal) {
      FX.restoreBindingOnRefusal = false;
      writeFileSync(path.join(args[0], 'project.json'), JSON.stringify(args[1]));
    }
    throw e;
  }
} } });

const { switchService } = await import('./group-activation.js');
const { recoverServices } = await import('./group-recovery.js');
const { COMPOSE_ENV_FILE } = await import('./compose.js');
const identity = { app: 'sample', project: 'p', env: 'prod' };
const entry = { imageRef: `reg/ns/image@sha256:${'a'.repeat(64)}`, spec: {}, hasEnv: false };
test.beforeEach(() => { FX.ups = []; FX.containers = []; FX.afterWrite = null; FX.restoreBindingOnRefusal = false; });

async function fixture(t: import('node:test').TestContext) {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-activation-gate-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const appsRoot = path.join(dir, 'apps');
  const groupDir = path.join(appsRoot, identity.app);
  await mkdir(groupDir, { recursive: true });
  const binding = path.join(groupDir, 'project.json');
  await writeFile(binding, JSON.stringify(identity));
  return { appsRoot, binding };
}

for (const change of ['foreign', 'missing', 'corrupt'] as const) {
  test(`R02: ${change} binding during compose/env writes refuses actual up`, async (t) => {
    const { appsRoot, binding } = await fixture(t);
    FX.afterWrite = async (file) => {
      if (path.basename(file) !== COMPOSE_ENV_FILE) return;
      if (change === 'missing') await rm(binding);
      else await writeFile(binding, change === 'corrupt' ? '{broken' : JSON.stringify({ ...identity, project: 'other' }));
    };
    let recorded = 0;
    await assert.rejects(switchService({ appsRoot, group: 'sample', service: 'api', entry, identity, log: () => {}, onBeforeUp: () => { recorded++; } }));
    assert.deepEqual(FX.ups, []);
    assert.equal(recorded, 0, 'a refused activation must not enter the actually-switched set');
  });
}

test('R01/R02: foreign ownership appearing during compose/env writes refuses actual up', async (t) => {
  const { appsRoot } = await fixture(t);
  FX.afterWrite = async (file) => {
    if (path.basename(file) === COMPOSE_ENV_FILE) {
      FX.containers = [{ id: 'foreign', project: 'ship_sample_api', name: 'ship_sample_api-api-1', dir: '/srv/foreign' }];
    }
  };
  await assert.rejects(switchService({ appsRoot, group: 'sample', service: 'api', entry, identity, log: () => {} }), /属于其他部署/);
  assert.deepEqual(FX.ups, []);
});

test('S02: a switch binding refusal stops later recovery even after the binding has been repaired', async (t) => {
  const { appsRoot, binding } = await fixture(t);
  FX.afterWrite = async (file) => {
    if (path.basename(file) === COMPOSE_ENV_FILE && FX.afterWrite) {
      FX.afterWrite = null;
      await writeFile(binding, JSON.stringify({ ...identity, project: 'other' }));
      FX.restoreBindingOnRefusal = true;
    }
  };
  const outcome = await recoverServices({
    appsRoot, group: 'sample', identity, previousCombination: { api: entry, web: entry },
    changedSoFar: ['api', 'web'], log: () => {},
  });
  assert.equal(outcome.succeeded, false);
  assert.deepEqual(FX.ups, [], 'a typed refusal latches recovery even though a subsequent binding read succeeds');
  assert.deepEqual(outcome.cleaned, []);
  assert.deepEqual(outcome.pending, ['api', 'web']);
});
