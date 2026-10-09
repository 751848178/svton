import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ExecutionEvent, ExecutionPlan } from './contracts.js';
import type { ProjectContext } from './project-context.js';
import type { GroupDeployPipelineOptions } from '../cli/pipeline-group-deploy.js';

type BuildOptions = Parameters<typeof import('../cli/pipeline-multi.js').runMultiBuildPipeline>[0];
const moduleMock = (mock as unknown as { module(url: URL, options: { namedExports: Record<string, unknown> }): unknown }).module.bind(mock);
const capabilities = ['jobs-events-v1', 'jobs-log-cursor-v1', 'jobs-cooperative-cancel-v1', 'jobs-operation-v1', 'group-baseline-v1'];
const secret = 'original-private-runtime-value';
const originalEnv = `API_SECRET=${secret}\n`;
let context: ProjectContext;
let mode: 'normal' | 'lost-response' | 'env-race' = 'normal';
let runtimeCapabilities = capabilities;
let buildCalls = 0;
let deployCalls = 0;
let deployedEnv: Record<string, string> | undefined;
const requests: string[] = [];
const unused = () => { throw new Error('Unexpected boundary invocation'); };
class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }

async function api(_url: string, _token: string, method: string, route: string) {
  requests.push(`${method} ${route}`);
  if (route === '/api/status') return { auth: { capabilities: runtimeCapabilities } };
  if (route.includes('/log?')) return { text: '', nextOffset: 0, totalBytes: 0, complete: true };
  if (route.includes('/events?')) return { events: [], nextSeq: 0, complete: true };
  if (method === 'POST' && route === '/api/deploy-group' && mode === 'lost-response') throw new Error('POST response lost after remote acceptance');
  throw new Error(`Unexpected HTTP boundary: ${method} ${route}`);
}

async function runMultiBuildPipeline(o: BuildOptions) {
  buildCalls++;
  await o.logger.stage?.('provision', 'succeeded');
  for (const stage of ['build', 'push'] as const) {
    for (const service of o.selection) {
      await o.logger.operationId?.(stage, service, context.runtime);
      const id = `${stage}-${service}`;
      await o.logger.observeJob?.({ handle: context.runtime, label: `${stage}:${service}`, jobId: id,
        job: { id, type: stage, status: 'succeeded', createdAt: '', updatedAt: '' } });
    }
  }
  if (mode === 'env-race') {
    await writeFile(path.join(context.rootPath, 'runtime.env'), 'API_SECRET=replaced-after-fingerprint\n');
    o.logger.info(`runtime value ${secret}`);
  }
  return { app: 'test-app', services: {}, createdAt: '' };
}

async function runGroupDeployPipeline(o: GroupDeployPipelineOptions) {
  deployCalls++;
  deployedEnv = o.envFiles;
  if (mode === 'lost-response') {
    await o.logger.operationId?.('deploy', undefined, context.runtime);
    await api(context.runtime.url, context.runtime.token, 'POST', '/api/deploy-group');
  }
  return { app: 'test-app', releaseId: 'release-next', previousReleaseId: null,
    changedServices: ['api', 'web'], inheritedServices: [], changedRefs: {}, verification: 'passed', target: 'test' };
}

// Supply every runtime export before importing the executor; no remocking cached ESM modules.
moduleMock(new URL('../shared/http.js', import.meta.url), { namedExports: { api, ApiError, apiUpload: unused, waitForJob: unused, fetchLogTail: unused } });
moduleMock(new URL('../shared/exec.js', import.meta.url), { namedExports: {
  exec: async () => ({ code: 0, stdout: 'immutable-commit\n', stderr: '' }),
} });
moduleMock(new URL('../cli/source-freeze.js', import.meta.url), { namedExports: { normalizeLiteralPath: (value: string) => value, freezeSourceDir: unused } });
moduleMock(new URL('../cli/pipeline-multi.js', import.meta.url), { namedExports: { runMultiBuildPipeline } });
moduleMock(new URL('../cli/pipeline-group-deploy.js', import.meta.url), { namedExports: {
  runGroupDeployPipeline, runGroupRollbackCli: unused, readServiceEnvFiles: unused,
} });
moduleMock(new URL('../cli/release-plan.js', import.meta.url), { namedExports: {
  fetchGroupState: async () => ({ current: null }), sameServiceSpec: unused, buildReleasePlan: unused,
} });
moduleMock(new URL('../providers/registry.js', import.meta.url), { namedExports: { resolveShipkitRoot: unused, createBuilderProvider: unused } });
moduleMock(new URL('./project-context.js', import.meta.url), { namedExports: {
  loadProject: async () => context, privateValues: () => [context.runtime.token], publicUrl: (url: string) => url,
  redactText: (value: string, secrets: string[]) => secrets.reduce((text, item) => text.replaceAll(item, '[redacted]'), value),
} });
const { executeTask } = await import('./execute-task.js');
const { fingerprint } = await import('./plan-fingerprint.js');

async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'shipkit-executor-test-'));
  t.after(() => rm(rootPath, { recursive: true, force: true }));
  const configPath = path.join(rootPath, 'config.yaml');
  await writeFile(configPath, 'test: immutable-config\n');
  await writeFile(path.join(rootPath, 'runtime.env'), originalEnv);
  context = { rootPath, configPath, targetKey: 'test', identity: 'isolated-project',
    runtime: { url: 'http://controlled-agent.invalid', token: 'private-agent-token' },
    config: { source: { ref: 'main' }, runtime: { targets: { test: {} } } },
    spec: { schemaVersion: 2, name: 'test-app', services: { api: { envFile: 'runtime.env' }, web: {} } },
  } as unknown as ProjectContext;
  mode = 'normal'; runtimeCapabilities = capabilities; buildCalls = 0; deployCalls = 0; deployedEnv = undefined; requests.length = 0;
  const frozen = await fingerprint(context, 'git', false);
  const plan: ExecutionPlan = { kind: 'release', selection: ['api', 'web'], baseReleaseId: null,
    sourceMode: 'git', keepEnv: false, keepBuilder: false, fingerprint: frozen.fingerprint,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    detail: { gitRef: frozen.gitRef, configDigest: frozen.configDigest, targetKey: 'test', projectIdentity: context.identity } };
  const events: ExecutionEvent[] = [];
  const execute = () => executeTask({ rootPath, configPath }, plan, { executionId: 'task-test',
    emit: async (event) => { events.push(event); }, isCancellationRequested: async () => false });
  return { plan, events, execute };
}

test('terminal build/push cannot clear a deploy intent whose POST response is lost', async (t) => {
  const fx = await fixture(t); mode = 'lost-response';
  const outcome = await fx.execute();
  assert.equal(buildCalls, 1); assert.equal(deployCalls, 1);
  for (const stage of ['build', 'push']) for (const service of fx.plan.selection) {
    assert.equal(fx.events.filter((event) => event.remoteJob?.stageKey === stage && event.serviceKey === service).at(-1)?.remoteJob?.status, 'succeeded');
  }
  assert.ok(fx.events.some((event) => event.type === 'remote-intent' && event.stageKey === 'deploy'));
  assert.equal(fx.events.some((event) => event.remoteJob?.stageKey === 'deploy'), false);
  assert.ok(requests.includes('POST /api/deploy-group'));
  assert.equal(outcome.status, 'interrupted');
  assert.deepEqual(outcome.output, { safeToReleaseGate: false });
});

test('deploy consumes the validated private env snapshot despite a later file mutation', async (t) => {
  const fx = await fixture(t); mode = 'env-race';
  const outcome = await fx.execute();
  assert.equal(outcome.status, 'succeeded');
  assert.equal(deployedEnv?.api, originalEnv);
  assert.equal(deployedEnv?.web, undefined);
  assert.equal(JSON.stringify(fx.events).includes(secret), false);
  assert.equal(JSON.stringify(outcome).includes(secret), false);
  assert.ok(fx.events.some((event) => event.message?.includes('[redacted]')));
});

test('stale plans and missing runtime safety capabilities stop before provisioning', async (t) => {
  for (const reason of ['expired', 'changed-inputs', 'missing-capability'] as const) {
    await t.test(reason, async (sub) => {
      const fx = await fixture(sub);
      if (reason === 'expired') fx.plan.expiresAt = new Date(Date.now() - 1_000).toISOString();
      if (reason === 'changed-inputs') await writeFile(path.join(context.rootPath, 'runtime.env'), 'API_SECRET=changed-before-execution\n');
      if (reason === 'missing-capability') runtimeCapabilities = capabilities.filter((cap) => cap !== 'jobs-operation-v1');
      const outcome = await fx.execute();
      assert.equal(outcome.status, 'failed');
      assert.match(outcome.error ?? '', reason === 'expired' ? /Plan expired/ : reason === 'changed-inputs' ? /inputs changed/ : /lacks platform safety protocol/);
      assert.equal(buildCalls, 0); assert.equal(deployCalls, 0);
      assert.equal(fx.events.some((event) => event.stageKey === 'provision' || event.type === 'remote-intent'), false);
      assert.equal(requests.some((request) => request.startsWith('POST ')), false);
    });
  }
});
