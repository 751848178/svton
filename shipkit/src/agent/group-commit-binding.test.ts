import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const realExec = await import('../shared/exec.js');
const realBinding = await import('./project-binding.js');
const realFs = await import('node:fs/promises');
const fx = { actions: [] as string[], afterHealth: null as null | (() => Promise<void>), afterLoadRelease: null as null | (() => Promise<void>), afterTempWrite: null as null | (() => Promise<void>), tempFile: '', repairOnRefusal: false };
mock.module('node:fs/promises', { namedExports: { ...realFs, writeFile: async (...args: Parameters<typeof realFs.writeFile>) => {
  await realFs.writeFile(...args);
  if (fx.afterTempWrite && path.basename(String(args[0])).startsWith('state.json.') && String(args[0]).endsWith('.tmp')) {
    fx.tempFile = String(args[0]);
    const hook = fx.afterTempWrite;
    fx.afterTempWrite = null;
    await hook();
  }
} } });
mock.module('../shared/exec.js', { namedExports: { ...realExec, exec: async (cmd: string, args: string[], opts?: unknown) => {
  if (cmd !== 'docker') return realExec.exec(cmd, args, opts as never);
  const result = { code: 0, stdout: '', stderr: '', truncated: false, timedOut: false };
  if (args[0] === 'image' && args[1] === 'inspect') return { ...result, code: 1 };
  if (args[0] === 'compose' && (args.includes('up') || args.includes('down'))) fx.actions.push(args.includes('up') ? 'up' : 'down');
  return result;
} } });
mock.module('./healthcheck.js', { namedExports: { waitHealthy: async () => {
  await fx.afterHealth?.();
  return { healthy: true, attempts: 1 };
} } });
mock.module('./registry-creds.js', { namedExports: { resolvePullCreds: async () => null } });
mock.module('./project-binding.js', { namedExports: { ...realBinding, assertProjectBinding: async (...args: Parameters<typeof realBinding.assertProjectBinding>) => {
  try { return await realBinding.assertProjectBinding(...args); }
  catch (e) {
    // The refusal already happened: a manual repair before the caller catches
    // it must not turn the same failed transaction into an automatic restore.
    if (fx.repairOnRefusal) {
      fx.repairOnRefusal = false;
      writeFileSync(path.join(args[0], 'project.json'), JSON.stringify(args[1]));
    }
    throw e;
  }
} } });

const { runGroupDeploy, GroupDeployFailure } = await import('./handlers-group-deploy.js');
const { runGroupRollback } = await import('./handlers-group-rollback.js');
const { GroupStore } = await import('./group-store.js');
const realLoadRelease = GroupStore.prototype.loadRelease;
GroupStore.prototype.loadRelease = async function (...args: Parameters<typeof realLoadRelease>) {
  const release = await realLoadRelease.apply(this, args);
  const hook = fx.afterLoadRelease;
  fx.afterLoadRelease = null;
  await hook?.();
  return release;
};
const { recoveryExitCode } = await import('../cli/job-report.js');
const identity = { app: 'sample', project: 'project-a', env: 'prod' };
const spec = { schemaVersion: 2 as const, name: 'sample', services: { api: { healthcheck: { path: '/health', hostPort: 18081 } }, web: {} } };
const ref = (v: string) => `reg/ns/api@sha256:${createHash('sha256').update(v).digest('hex')}`;
const req = (changed: Record<string, { imageRef: string }>) => ({ ...identity, schemaVersion: 2 as const, spec, changed });
const log = () => {};
test.beforeEach(() => { fx.actions = []; fx.afterHealth = null; fx.afterLoadRelease = null; fx.afterTempWrite = null; fx.tempFile = ''; fx.repairOnRefusal = false; });

for (const mode of ['deploy', 'rollback'] as const) {
  for (const change of ['foreign', 'missing', 'corrupt', 'repaired-refusal', 'commit-read-window', 'temp-write-window'] as const) {
    test(`${mode} refuses a ${change} binding after health without committing or recovering containers`, async (t) => {
      const dir = await mkdtemp(path.join(tmpdir(), 'ship-commit-binding-'));
      t.after(() => rm(dir, { recursive: true, force: true }));
      const appsRoot = path.join(dir, 'apps');
      const store = new GroupStore(appsRoot);
      await runGroupDeploy(appsRoot, req({ api: { imageRef: ref('api1') }, web: { imageRef: ref('web1') } }), log);
      if (mode === 'rollback') await runGroupDeploy(appsRoot, req({ api: { imageRef: ref('api2') } }), log);
      const stateFile = path.join(store.appDir(identity.app), 'state.json');
      const stateBefore = await readFile(stateFile, 'utf8');
      const binding = path.join(store.appDir(identity.app), 'project.json');
      const unrelatedTemp = `${stateFile}.another-operation.tmp`;
      if (change === 'temp-write-window') await writeFile(unrelatedTemp, 'preserve another operation');
      fx.actions = [];
      fx.afterHealth = async () => {
        if (change === 'commit-read-window') {
          fx.afterLoadRelease = () => writeFile(binding, JSON.stringify({ ...identity, project: 'other-project', env: 'staging' }));
          return;
        }
        if (change === 'temp-write-window') {
          fx.afterTempWrite = () => writeFile(binding, JSON.stringify({ ...identity, project: 'other-project', env: 'staging' }));
          return;
        }
        if (change === 'missing') await rm(binding);
        else await writeFile(binding, change === 'corrupt' ? '{broken' : JSON.stringify({ ...identity, project: 'other-project', env: 'staging' }));
        if (change === 'repaired-refusal') fx.repairOnRefusal = true;
      };
      const operation = mode === 'deploy'
        ? runGroupDeploy(appsRoot, req({ api: { imageRef: ref('api2') } }), log)
        : runGroupRollback(appsRoot, identity, log);
      const error = await operation.catch((e: unknown) => e);
      assert.ok(error instanceof GroupDeployFailure, 'changed identity must never be reported as successful');
      assert.equal(error.recovery.succeeded, false);
      assert.equal(error.recovery.verification, 'failed');
      assert.deepEqual(error.recovery.cleaned, []);
      assert.deepEqual(error.recovery.pending, ['api']);
      assert.equal(recoveryExitCode('deploy', error.recovery), 6);
      assert.deepEqual(fx.actions, ['up'], 'only the already-finished switch ran; no unsafe restore/down followed');
      assert.equal(await readFile(stateFile, 'utf8'), stateBefore, 'current/history remain at the committed release');
      if (change === 'temp-write-window') {
        assert.ok(fx.tempFile, 'the real atomic temp-write seam was reached');
        assert.equal(existsSync(fx.tempFile), false, 'refusal cleans only this write\'s unique temp file');
        assert.equal(await readFile(unrelatedTemp, 'utf8'), 'preserve another operation');
      }
    });
  }
}
