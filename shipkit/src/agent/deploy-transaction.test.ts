// Regression tests for the deploy transaction (F02/F03/F04/F05) — docker/healthcheck mocked via module mocks.

import test from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

type Mode = 'ok' | 'up-fail' | 'health-fail';
let MODE: Mode = 'ok';

mock.module('./docker.js', {
  namedExports: {
    imageExists: async () => false,
    pullAuthCtx: async () => null,
    compose: async (o: { appDir: string; app: string; args: string[] }) => {
      if (MODE !== 'up-fail' || !o.args.includes('up')) return;
      const y = await readFile(path.join(o.appDir, 'compose.yaml'), 'utf8');
      if (y.includes('bad-image')) throw new Error('simulated compose up failure');
    },
    composePort: async () => null,
  },
});

mock.module('./healthcheck.js', {
  namedExports: {
    waitHealthy: async (o: { url: string }) => ({
      healthy: !(MODE === 'health-fail' && o.url.includes(':9999')),
      skipped: false,
      attempts: 1,
    }),
  },
});

const { runDeploy, DeployFailure } = await import('./handlers-deploy.js');
const { validateSpec } = await import('../shared/spec-schema.js');

const log = () => {};
const SPEC_OK = () => validateSpec({ name: 'a', ports: ['3000:3000'], healthcheck: { path: '/', hostPort: 3000 } });
const SPEC_BAD = () => validateSpec({ name: 'a', ports: ['9999:99'], healthcheck: { path: '/', hostPort: 9999 } });

async function root(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'ship-deploy-'));
}

test('deploy failure recovers the FULL previous snapshot — image and env (F02)', async () => {
  MODE = 'health-fail';
  const appsRoot = await root();
  const ok = await runDeploy(appsRoot, { app: 'a', imageRef: 'reg/a:good:1', spec: SPEC_OK(), envFileContent: 'KEY=v1\n' }, log);
  assert.equal(ok.verification, 'passed');
  await assert.rejects(
    () => runDeploy(appsRoot, { app: 'a', imageRef: 'reg/a:bad-image:2', spec: SPEC_BAD(), envFileContent: 'KEY=v2\n' }, log),
    (e: unknown) => {
      const r = (e as { recovery: { succeeded: boolean; target: string } }).recovery;
      assert.ok(e instanceof DeployFailure);
      assert.equal(r.succeeded, true);
      assert.equal(r.target, 'reg/a:good:1');
      return true;
    },
  );
  const appDir = path.join(appsRoot, 'a');
  const compose = await readFile(path.join(appDir, 'compose.yaml'), 'utf8');
  assert.match(compose, /reg\/a:good:1/);
  const env = await readFile(path.join(appDir, 'runtime.env'), 'utf8');
  assert.equal(env, 'KEY=v1\n');
});

test('compose-up failure (before healthcheck) also recovers the previous release (F03)', async () => {
  MODE = 'up-fail';
  const appsRoot = await root();
  await runDeploy(appsRoot, { app: 'a', imageRef: 'reg/a:good:1', spec: SPEC_OK(), envFileContent: 'K=1\n' }, log);
  await assert.rejects(
    () => runDeploy(appsRoot, { app: 'a', imageRef: 'reg/a:bad-image:2', spec: SPEC_BAD() }, log),
    (e: unknown) => (e as { recovery: { succeeded: boolean } }).recovery.succeeded === true,
  );
  const compose = await readFile(path.join(appsRoot, 'a', 'compose.yaml'), 'utf8');
  assert.match(compose, /reg\/a:good:1/);
});

test('first-deploy failure reports recovery attempted without a target (F04)', async () => {
  MODE = 'health-fail';
  const appsRoot = await root();
  await assert.rejects(
    () => runDeploy(appsRoot, { app: 'a', imageRef: 'reg/a:bad-image:1', spec: SPEC_BAD() }, log),
    (e: unknown) => {
      const r = (e as { recovery: { attempted: boolean; succeeded: boolean; target: string | null } }).recovery;
      assert.equal(r.attempted, true);
      assert.equal(r.succeeded, false);
      assert.equal(r.target, null);
      return true;
    },
  );
});

test('concurrent deploys of one app serialize without state corruption (F05)', async () => {
  MODE = 'ok';
  const appsRoot = await root();
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, (_, i) =>
      runDeploy(appsRoot, { app: 'a', imageRef: `reg/a:ok:${i}`, spec: SPEC_OK() }, log),
    ),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5);
  const compose = await readFile(path.join(appsRoot, 'a', 'compose.yaml'), 'utf8');
  assert.match(compose, /reg\/a:ok:\d/);
});

test('successful deploy records releaseId and previousReleaseId', async () => {
  MODE = 'ok';
  const appsRoot = await root();
  const first = await runDeploy(appsRoot, { app: 'a', imageRef: 'reg/a:1', spec: SPEC_OK() }, log);
  const second = await runDeploy(appsRoot, { app: 'a', imageRef: 'reg/a:2', spec: SPEC_OK() }, log);
  assert.equal(first.previousReleaseId, null);
  assert.equal(second.previousReleaseId, first.releaseId);
});
