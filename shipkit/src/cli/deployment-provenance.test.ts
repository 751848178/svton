// Exercise real build/deploy/release orchestration. Only the external builder,
// HTTP transport and credential/cache storage are replaced; no cloud or Docker.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { LastBuildRecord, ShipConfig } from '../shared/types.js';

const config: ShipConfig = {
  source: { repo: 'https://source.example/team/configured.git' },
  builder: { mode: 'static', static: { url: 'http://builder', token: 't' } },
  registry: { url: 'reg.example', namespace: 'team' },
  runtime: { targets: { prod: { url: 'http://runtime', token: 't' } } },
};
let compatible: unknown = ['deploy', 'rollback', 'deployment-identity-v1', 'deployment-env-preserve-v1'];
let machineRole = 'runtime';
let ensured = 0;
let uploaded = 0;
const requests: Array<{ method: string; route: string; body: any }> = [];
const cache = new Map<string, LastBuildRecord>();
const logger = { info() {}, warn() {}, error() {} };
const key = (app: string, project: string) => `${app}\0${project}`;
mock.module('../shared/config.js', { namedExports: { loadConfig: () => config } });
mock.module('../shared/spec-load.js', { namedExports: { loadSpecAt: () => ({ name: 'web' }) } });
mock.module('../shared/git.js', { namedExports: { gitRemote: async () => null, gitHeadSha: async () => 'HEAD' } });
mock.module('../shared/credentials.js', { namedExports: { resolveTargetToken: async (t: unknown) => t } });
mock.module('../providers/tencent-client.js', { namedExports: { sweepExpiredBuilders: async () => {} } });
mock.module('../providers/registry.js', { namedExports: { createBuilderProvider: async () => ({
  ensure: async () => { ensured++; return config.builder.static; }, release: async () => {},
}) } });
mock.module('./local-state.js', { namedExports: {
  saveLastBuild: async (v: LastBuildRecord) => { cache.set(key(v.app, v.project!), v); },
  readLastBuild: async (app: string, project: string) => cache.get(key(app, project)) ?? null,
} });
mock.module('../shared/http.js', { namedExports: {
  api: async (_url: string, _token: string, method: string, route: string, body: unknown) => {
    requests.push({ method, route, body });
    if (route === '/api/status') return { role: machineRole, auth: { capabilities: compatible } };
    return { jobId: route.slice('/api/'.length) };
  },
  apiUpload: async (_url: string, _token: string, bytes: Buffer) => { assert.ok(bytes.length > 0); uploaded++; return { id: 'source-id' }; },
  fetchLogTail: async () => '',
  waitForJob: async () => ({ status: 'succeeded', result: {} }),
} });
mock.module('./job-report.js', { namedExports: {
  waitAndReport: async (_h: unknown, _id: string, kind: string) => {
    if (kind === 'build') return { result: { tag: 'test-tag' } };
    if (kind === 'push') return { result: { imageRef: 'reg.example/team/web:test', digest: `sha256:${'a'.repeat(64)}` } };
    const body = requests.filter((r) => r.route === '/api/deploy').at(-1)!.body;
    return { result: { app: body.app, imageRef: body.imageRef } };
  },
} });
const { runBuildPipeline, runDeployPipeline } = await import('./pipeline.js');
const { cmdRelease } = await import('./cmd-release.js');
const { cmdRollback } = await import('./cmd-rollback.js');
const { cmdDeploy } = await import('./cmd-deploy.js');
const { resolveProjectId } = await import('./project-id.js');

test('build cache and one-shot release follow the uploaded source, not an unused source.repo', async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'ship-provenance-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const fromDir = path.join(cwd, 'actual source');
  await mkdir(fromDir);
  await writeFile(path.join(fromDir, 'app.js'), 'actual source');
  const project = await resolveProjectId(fromDir);
  const build = await runBuildPipeline({ config, cwd, fromDir: 'actual source', logger, timeoutMs: 1000 });
  assert.equal(build.project, project);
  assert.equal(cache.get(key('web', project))?.imageRef, build.imageRef);
  assert.equal(cache.has(key('web', 'source.example/team/configured')), false);
  await assert.rejects(() => runDeployPipeline({ config, cwd, logger, timeoutMs: 1000 }), /no imageRef/);
  requests.length = 0;
  assert.equal(await cmdRelease(['--from-dir', fromDir, '--to', 'prod', '--json']), 0);
  const payload = requests.find((r) => r.route === '/api/deploy')!.body;
  assert.equal(payload.project, project);
  assert.equal(payload.env, 'prod');
  assert.equal(payload.imageRef, build.imageRef);
  assert.equal(uploaded, 2);
  assert.equal(await cmdDeploy(['--from-dir', fromDir, '--to', 'prod', '--json']), 0);
  assert.equal(requests.filter((r) => r.route === '/api/deploy').at(-1)!.body.project, project);
  assert.equal(requests.filter((r) => r.route === '/api/deploy').at(-1)!.body.imageRef, build.imageRef);
  assert.equal(await cmdRollback(['web', '--from-dir', fromDir, '--to', 'prod', '--json']), 0);
  assert.equal(requests.filter((r) => r.route === '/api/rollback').at(-1)!.body.project, project);
  const git = await runBuildPipeline({ config, cwd, logger, timeoutMs: 1000 });
  assert.equal(git.project, 'source.example/team/configured');
  assert.equal(requests.filter((r) => r.route === '/api/build').at(-1)!.body.source.repo, config.source!.repo);
});

test('old or malformed Agent capability responses block release before builder creation, deploy and rollback', async () => {
  for (const capabilities of [undefined, [], ['deploy', 'rollback'], 'deployment-identity-v1', ['deployment-identity-v1']]) {
    compatible = capabilities;
    // A runtime credential alone cannot turn a builder-only machine into a runtime.
    machineRole = Array.isArray(capabilities) && capabilities.includes('deployment-identity-v1') ? 'builder' : 'runtime';
    ensured = 0;
    requests.length = 0;
    await assert.rejects(() => cmdRelease(['--to', 'prod', '--json']), /请升级 ship-agent/);
    await assert.rejects(() => runDeployPipeline({ config, cwd: process.cwd(), imageRef: 'reg.example/team/web:x', logger, timeoutMs: 1000 }), /请升级 ship-agent/);
    await assert.rejects(() => cmdRollback(['web', '--to', 'prod']), /请升级 ship-agent/);
    assert.equal(ensured, 0);
    assert.ok(requests.every((r) => r.method === 'GET' && r.route === '/api/status'));
  }
});

test('keep-env is transmitted only without an explicit env file, and older Agents refuse it before a build', async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'ship-keep-env-cli-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  machineRole = 'runtime';
  compatible = ['deployment-identity-v1', 'deployment-env-preserve-v1'];
  requests.length = 0;
  await runDeployPipeline({ config, cwd, imageRef: 'reg/web:1', logger, keepEnv: true, timeoutMs: 1000 });
  assert.equal(requests.filter((r) => r.route === '/api/deploy').at(-1)!.body.keepEnv, true);
  const envFile = path.join(cwd, 'override.env');
  await writeFile(envFile, 'OVERRIDE=1\n');
  await runDeployPipeline({ config, cwd, imageRef: 'reg/web:2', logger, keepEnv: true, envFile, timeoutMs: 1000 });
  const body = requests.filter((r) => r.route === '/api/deploy').at(-1)!.body;
  assert.equal(body.keepEnv, false);
  assert.equal(body.envFileContent, 'OVERRIDE=1\n');
  compatible = ['deployment-identity-v1'];
  ensured = 0;
  requests.length = 0;
  await assert.rejects(() => cmdRelease(['--keep-env', '--to', 'prod']), /不支持安全保留环境变量/);
  await assert.rejects(() => runDeployPipeline({ config, cwd, imageRef: 'reg/web:3', logger, keepEnv: true, timeoutMs: 1000 }), /不支持安全保留环境变量/);
  assert.equal(ensured, 0);
  assert.ok(requests.every((r) => r.method === 'GET'));
});
