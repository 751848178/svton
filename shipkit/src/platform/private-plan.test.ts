import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import type { PrivateProjectSnapshot } from './private-snapshot.js';
import type { ProjectInput, ExecutionPlan, ExecutionEvent } from './contracts.js';
import type { GroupStateView } from '../shared/group-protocol.js';
import type { ServiceSpec } from '../shared/spec-v2.js';
import { serializeRuntimeEnv } from '../shared/runtime-env.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const sha = 'b'.repeat(40), digest = 'a'.repeat(64), ref = { versionId: 'config-version-fixed', version: '1.0.0', serviceKey: 'api' };
const value = 'private-configuration-fixture-value', url = 'http://127.0.0.1:17411';
let state: GroupStateView, builds = 0, repositoryReads = 0, configCapability = true, deploys: Array<Record<string, unknown>> = [], rollbacks: Array<Record<string, unknown>> = [], routes: string[] = [];
const moduleMock = (mock as unknown as { module(url: URL, options: { namedExports: Record<string, unknown> }): unknown }).module.bind(mock);
const unused = () => { throw new Error('Unexpected boundary invocation'); };
moduleMock(new URL('../shared/http.js', import.meta.url), { namedExports: { ApiError: class extends Error {}, apiUpload: unused, waitForJob: unused, fetchLogTail: unused,
  api: async (_url: string, _token: string, _method: string, route: string) => {
    routes.push(route);
    if (route.startsWith('/api/group-state')) return state;
    if (route.startsWith('/api/group-history')) return { app: state.app, current: state.current, items: state.current ? [{ releaseId: 'historical-change', parentReleaseId: 'historical-parent', changedServices: ['api'], services: {}, createdAt: new Date().toISOString(), rollbackAvailable: true, targetSnapshotId: 'historical-parent' }] : [] };
    if (route === '/api/status') return { auth: { capabilities: ['jobs-events-v1', 'jobs-log-cursor-v1', 'jobs-cooperative-cancel-v1', 'jobs-operation-v1', 'group-baseline-v1', ...(configCapability ? ['group-config-ref-v1'] : [])] } };
    throw new Error('Unexpected network boundary');
  },
} });
moduleMock(new URL('./repository-source.js', import.meta.url), { namedExports: { resolveRepositorySource: async () => { repositoryReads++; throw new Error('Repository must not be contacted for Runtime-only operations'); } } });
moduleMock(new URL('../cli/pipeline-multi.js', import.meta.url), { namedExports: { runMultiBuildPipeline: async () => { builds++; throw new Error('Builder must not be contacted'); } } });
moduleMock(new URL('../cli/pipeline-group-deploy.js', import.meta.url), { namedExports: { readServiceEnvFiles: unused,
  runGroupRollbackCli: async (options: Record<string, unknown>) => { rollbacks.push(options); return { app: state.app, releaseId: 'rollback-new', previousReleaseId: state.current }; },
  runGroupDeployPipeline: async (options: Record<string, unknown>) => {
    deploys.push(options); return { app: 'fixed-app', releaseId: 'release-new', previousReleaseId: 'release-current', changedServices: ['api'], inheritedServices: ['web'], changedRefs: {}, verification: 'passed', target: 'prod' };
  },
} });
const { preparePlan, fetchHistory } = await import('./prepare-plan.js');
const { executeTask } = await import('./execute-task.js');
const { loadProject } = await import('./project-context.js');
const { snapshotFingerprint } = await import('./private-fingerprint.js');
const { reconcileTask } = await import('./reconcile-task.js');

function fixture() {
  state = { schemaVersion: 2, app: 'fixed-app', current: 'release-current', services: {
    api: { imageRef: `registry.invalid/api@sha256:${digest}`, hasEnv: true, spec: { dockerfile: 'apps/api/Dockerfile', ports: ['9010:80'] }, source: { type: 'git', repo: 'https://github.com/owner/repo', sha }, configRef: ref },
    web: { imageRef: `registry.invalid/web@sha256:${digest}`, hasEnv: false, spec: { dockerfile: 'apps/web/Dockerfile' }, source: { type: 'git', repo: 'https://github.com/owner/repo', sha: 'c'.repeat(40) } },
  } };
  builds = 0; repositoryReads = 0; configCapability = true; deploys = []; rollbacks = []; routes = [];
  const snapshot: PrivateProjectSnapshot = { config: { builder: { mode: 'static', static: { url, token: 'old-builder-private-token' } },
    runtime: { targets: { prod: { url, token: 'old-runtime-private-token' } } } },
    spec: { schemaVersion: 2, name: 'fixed-app', services: { api: { dockerfile: 'new-unpublished/Dockerfile' }, web: {} } },
    runtime: { url, token: 'old-runtime-private-token', via: 'plaintext' }, identity: 'github.com/owner/repo', targetKey: 'prod',
    rootPath: '/repository/does-not-exist', configPath: '/profile/does-not-exist', envFiles: {}, redactionValues: [], configDigest: 'frozen-connection-digest' };
  const input: ProjectInput = { repository: { repoUrl: 'https://github.com/owner/repo', ref: { kind: 'branch', value: 'unavailable' }, specPath: 'missing/ship.yaml' },
    appName: 'fixed-app', targetKey: 'prod', privateSnapshot: snapshot };
  return { input, snapshot };
}
test('private project snapshot avoids every repository, local directory and mutable credential reference', async () => {
  const fx = fixture(), c = await loadProject(fx.input);
  assert.equal(c.runtime.token, 'old-runtime-private-token'); assert.equal(c.rootPath, '/repository/does-not-exist'); assert.equal(routes.length, 0);
  await assert.rejects(loadProject({ ...fx.input, appName: 'different-app' }), /appName/);
  await assert.rejects(loadProject({ ...fx.input, targetKey: 'different-target' }), /different project/);
});
test('configuration-only planning uses Runtime definitions and per-service provenance, final callback sees private version inputs', async () => {
  const fx = fixture(); let captured: PrivateProjectSnapshot | undefined;
  const plan = await preparePlan(fx.input, { kind: 'config-only', services: ['api'], configMode: 'version', configVersionId: ref.versionId }, {
    runtimeConfiguration: { envFiles: { api: serializeRuntimeEnv({ PRIVATE: value }) }, configRefs: { api: ref }, redactionValues: [value], fingerprint: 'private-hmac' },
    onPrivateSnapshot: async snapshot => { captured = structuredClone(snapshot); },
  });
  assert(captured); assert.equal(captured.spec.services.api?.dockerfile, 'apps/api/Dockerfile');
  assert.equal(captured.executionKind, 'config-only');
  assert.equal(captured.currentServices?.web?.source?.sha, 'c'.repeat(40)); assert.equal(captured.configRefs?.api?.versionId, ref.versionId);
  assert(captured.envFiles.api?.includes(value)); assert(!JSON.stringify(plan).includes(value)); assert(!JSON.stringify(plan).includes('old-runtime-private-token'));
  assert.equal(plan.detail.currentConfigRefs?.api?.versionId, ref.versionId); assert.equal(plan.detail.currentSources?.web?.sha, 'c'.repeat(40));
  assert.equal(plan.frozenConfig?.bindings.api?.mode, 'version'); assert.equal(plan.fingerprint, snapshotFingerprint(captured, plan.sourceMode, plan.keepEnv, plan.configMode));
  const events: ExecutionEvent[] = [];
  const result = await executeTask({ ...fx.input, privateSnapshot: captured }, plan, { executionId: 'config-task', isCancellationRequested: async () => false, emit: async event => { events.push(event); } });
  assert.equal(result.status, 'succeeded'); assert.equal(builds, 0); assert.equal(deploys.length, 1);
  assert.deepEqual(events.filter(e => e.status === 'skipped').map(e => e.stageKey), ['provision', 'build', 'push', 'cleanup']);
  const manifest = deploys[0]!.manifest as { services: Record<string, { imageRef: string; source: { sha: string } }> };
  assert.deepEqual(Object.keys(manifest.services), ['api']); assert.equal(manifest.services.api?.imageRef, state.services.api?.imageRef); assert.equal(manifest.services.api?.source.sha, sha);
  assert(routes.every(route => route.startsWith('/api/') && !route.includes('/api/build')));
});
test('explicit noEnv remains distinct from an empty environment, and baseline/digest failures block deployment', async () => {
  const fx = fixture(); let captured: PrivateProjectSnapshot | undefined;
  const plan = await preparePlan(fx.input, { kind: 'config-only', services: ['api'], configMode: 'version' }, {
    runtimeConfiguration: { envFiles: {}, noEnvServices: ['api'], configRefs: { api: ref }, fingerprint: 'fixed-hmac' }, onPrivateSnapshot: async s => { captured = structuredClone(s); },
  });
  assert(captured); assert.deepEqual(captured.envFiles, {}); assert.deepEqual(captured.noEnvServices, ['api']);
  state.current = 'changed-after-plan';
  const result = await executeTask({ ...fx.input, privateSnapshot: captured }, plan, { isCancellationRequested: async () => false, emit: async () => {} });
  assert.equal(result.status, 'failed'); assert.equal(deploys.length, 0); assert.equal(builds, 0);
  state.services.api!.imageRef = 'registry.invalid/api:mutable';
  await assert.rejects(preparePlan(fx.input, { kind: 'config-only', services: ['api'], configMode: 'inherit' }), /digest/);
  state.current = null; await assert.rejects(preparePlan(fx.input, { kind: 'config-only', services: ['api'], configMode: 'inherit' }), /committed deployment/);
});
test('secret/noEnv changes alter private fingerprint and restart observation never fetches the source', async () => {
  const fx = fixture(), before = snapshotFingerprint(fx.snapshot, 'git', false, 'version');
  fx.snapshot.envFiles.api = serializeRuntimeEnv({ SECRET: value });
  assert.notEqual(snapshotFingerprint(fx.snapshot, 'git', false, 'version'), before);
  fx.snapshot.noEnvServices = ['api']; assert.notEqual(snapshotFingerprint(fx.snapshot, 'git', false, 'version'), before);
  const result = await reconcileTask(fx.input, [], { isCancellationRequested: async () => false, emit: async () => {} });
  assert.equal(result.status, 'interrupted'); assert.equal(result.cleanupState, 'static'); assert.equal(routes.length, 0);
});
test('private repository rollback and history need neither repository credentials nor an existing local checkout', async () => {
  const fx = fixture(), directory = await mkdtemp(path.join(tmpdir(), 'ship-rollback-profile-'));
  try {
    const configPath = path.join(directory, 'ship.config.json');
    await writeFile(configPath, JSON.stringify({ builder: { mode: 'static', static: { url: 'https://builder.invalid', tokenRef: 'nonexistent-never-read' } }, runtime: { targets: { prod: { url, token: 'old-runtime-private-token' } } } }));
    const input: ProjectInput = { ...fx.input, privateSnapshot: undefined, configPath, rootPath: '/repository/does-not-exist' };
    let saved: PrivateProjectSnapshot | undefined;
    const plan = await preparePlan(input, { kind: 'rollback', services: ['api'], changeReleaseId: 'historical-change' }, { onPrivateSnapshot: async snapshot => { saved = structuredClone(snapshot); } });
    assert(saved); assert.equal(saved.spec.services.api?.dockerfile, 'apps/api/Dockerfile'); assert.equal(saved.currentServices?.web?.source?.sha, 'c'.repeat(40));
    assert.equal(saved.executionKind, 'rollback');
    assert.equal(plan.detail.history?.targetSnapshotId, 'historical-parent'); assert.equal(repositoryReads, 0); assert.equal(builds, 0);
    await assert.rejects(preparePlan(input, { kind: 'rollback', services: ['web'], changeReleaseId: 'historical-change' }), /outside/);
    state.current = null; state.services = {};
    assert.deepEqual((await fetchHistory(input)).items, []); assert.equal(repositoryReads, 0);
    await assert.rejects(preparePlan(input, { kind: 'rollback', services: ['api'], changeReleaseId: 'missing-change' }), /Historical snapshot is unavailable/);
    fixture(); await rm(configPath);
    const result = await executeTask({ ...input, privateSnapshot: saved }, plan, { isCancellationRequested: async () => false, emit: async () => {} });
    assert.equal(result.status, 'succeeded'); assert.equal(builds, 0); assert.equal(repositoryReads, 0);
    assert.equal(rollbacks[0]?.targetReleaseId, 'historical-change'); assert.deepEqual(rollbacks[0]?.services, ['api']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
for (const gate of ['version', 'configRef', 'noEnv'] as const) test(`${gate} refuses an old Runtime before any Builder acquisition, build or push`, async () => {
  const fx = fixture(); let saved: PrivateProjectSnapshot | undefined;
  fx.snapshot.spec.services.web = structuredClone(state.services.web!.spec) as ServiceSpec;
  const plan = await preparePlan(fx.input, { kind: 'release', services: ['api'], configMode: gate === 'version' ? 'version' : 'files' }, {
    runtimeConfiguration: { envFiles: gate === 'noEnv' ? {} : { api: serializeRuntimeEnv({ FIXTURE: value }) }, configRefs: gate === 'noEnv' ? {} : { api: ref }, noEnvServices: gate === 'noEnv' ? ['api'] : [] },
    onPrivateSnapshot: async snapshot => { saved = structuredClone(snapshot); },
  });
  configCapability = false;
  const outcome = await executeTask({ ...fx.input, privateSnapshot: saved }, plan, { isCancellationRequested: async () => false, emit: async () => {} });
  assert.equal(outcome.status, 'failed'); assert.match(outcome.error ?? '', /group-config-ref-v1/);
  assert.equal(builds, 0); assert.equal(deploys.length, 0); assert(!routes.some(route => route.startsWith('/api/build') || route.startsWith('/api/push')));
});
