import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import type { ExecutionPlan } from './contracts.js';
import type { ProjectContext } from './project-context.js';
import type { TencentCvmConfig } from '../shared/types.js';
import type { withBuilderLease } from '../cli/builder-lease.js';

const moduleMock = (mock as unknown as {
  module(url: URL, options: { namedExports: Record<string, unknown> }): unknown;
}).module.bind(mock);
const minute = 60_000;
const selection = ['backend', 'admin', 'mobile'];
const admitted = 'simulated RunInstances boundary: no cloud instance created';
const capabilities = ['jobs-events-v1', 'jobs-log-cursor-v1',
  'jobs-cooperative-cancel-v1', 'jobs-operation-v1', 'group-baseline-v1'];
let context: ProjectContext;
let budgetMs = 0;
let runRequests: Array<{ ActionTimer: { ActionTime: string } }> = [];
let deployCalls = 0;
const unused = () => { throw new Error('Unexpected external boundary'); };
class ApiError extends Error {}

moduleMock(new URL('../shared/http.js', import.meta.url), { namedExports: {
  api: async (_url: string, _token: string, method: string, route: string) => {
    assert.equal(method, 'GET'); assert.equal(route, '/api/status');
    return { auth: { capabilities } };
  }, ApiError, apiUpload: unused, waitForJob: unused, fetchLogTail: unused,
} });
moduleMock(new URL('../providers/tencent-client.js', import.meta.url), { namedExports: {
  mkCvmClient: async () => ({ RunInstances: async (request: typeof runRequests[number]) => {
    runRequests.push(request);
    // Stop before an instance ID exists; no provider compensation or real SDK runs.
    throw new Error(admitted);
  } }), agentHealthy: unused, requireCreds: unused, authedBuilderStatus: unused,
} });
moduleMock(new URL('../cli/project-id.js', import.meta.url), { namedExports: {
  resolveProjectId: async () => 'twgg-fixture',
} });
moduleMock(new URL('../cli/builder-lease.js', import.meta.url), { namedExports: {
  withBuilderLease: async (options: Parameters<typeof withBuilderLease>[0]) => {
    budgetMs = options.taskBudgetMs;
    const { provisionBuilder } = await import('../providers/tencent-provision.js');
    await provisionBuilder({
      file: '/unused-builder-state', creds: { secretId: 'fake-id', secretKey: 'fake-key' },
      log: () => {}, taskBudgetMs: options.taskBudgetMs,
      signal: new AbortController().signal,
      cfg: options.config.builder.dynamic!.tencent!,
      distDir: '/unused-dist', bootstrapDir: '/unused-bootstrap', keepMinutes: 0,
      agentUrl: () => 'http://builder.invalid',
    });
    throw new Error('Fake RunInstances must prevent any downstream work');
  },
} });
moduleMock(new URL('../cli/pipeline-group-deploy.js', import.meta.url), { namedExports: {
  runGroupDeployPipeline: async () => { deployCalls++; throw new Error('Unexpected deploy'); },
  runGroupRollbackCli: unused, readServiceEnvFiles: unused,
} });
moduleMock(new URL('../cli/release-plan.js', import.meta.url), { namedExports: {
  fetchGroupState: async () => ({ current: null }), sameServiceSpec: unused, buildReleasePlan: unused,
} });
moduleMock(new URL('../providers/registry.js', import.meta.url), { namedExports: {
  resolveShipkitRoot: unused, createBuilderProvider: unused,
} });
moduleMock(new URL('./project-context.js', import.meta.url), { namedExports: {
  loadProject: async () => context, privateValues: () => [],
  publicUrl: (value: string) => value, redactText: (value: string) => value,
} });
moduleMock(new URL('./plan-fingerprint.js', import.meta.url), { namedExports: {
  fingerprint: async () => ({ fingerprint: 'immutable-fingerprint', envSnapshot: {} }),
} });
const { executeTask } = await import('./execute-task.js');

async function execute(maxLifetimeMinutes: number) {
  const tencent: TencentCvmConfig = {
    region: 'ap-guangzhou', zone: 'ap-guangzhou-6', instanceType: 'SA9.2XLARGE16',
    imageId: 'fake-image', vpcId: 'fake-vpc', subnetId: 'fake-subnet', securityGroupIds: ['fake-sg'],
    maxLifetimeMinutes, installUrl: 'https://installer.invalid/fake',
  };
  context = {
    rootPath: '/unused-project', configPath: '/unused-config', targetKey: 'prod', identity: 'twgg-fixture',
    runtime: { url: 'http://runtime.invalid', token: 'fake-runtime-token' },
    config: {
      builder: { mode: 'dynamic', dynamic: { provider: 'tencent', keepMinutes: 0, tencent } },
      registry: { url: 'registry.invalid', namespace: 'fixture' },
      runtime: { targets: { prod: { url: 'http://runtime.invalid', token: 'fake-runtime-token' } } },
    },
    spec: { schemaVersion: 2, name: 'twgg', services: Object.fromEntries(selection.map((key) => [key, {
      dockerfile: 'Dockerfile', context: '.', target: `${key}-prod`, platform: 'linux/amd64',
    }])) },
  } as unknown as ProjectContext;
  const plan: ExecutionPlan = {
    kind: 'release', selection, baseReleaseId: null, sourceMode: 'git',
    keepEnv: false, keepBuilder: false, fingerprint: 'immutable-fingerprint',
    expiresAt: new Date(Date.now() + minute).toISOString(),
    detail: { targetKey: 'prod', projectIdentity: 'twgg-fixture' },
  };
  budgetMs = 0; runRequests = []; deployCalls = 0;
  return executeTask({ rootPath: context.rootPath, configPath: context.configPath }, plan, {
    emit: async () => {}, isCancellationRequested: async () => false,
  });
}

test('three-service platform build fits a 180-minute safe cloud deadline before RunInstances', async () => {
  const started = Date.now();
  const outcome = await execute(180);
  assert.equal(budgetMs, 135 * minute);
  assert.equal(runRequests.length, 1, 'real provider admission must accept 135 task + 38 provisioning minutes');
  assert.equal(outcome.error, admitted);
  const expires = Date.parse(runRequests[0]!.ActionTimer.ActionTime);
  assert.ok(expires >= started + 180 * minute - 1000);
  assert.ok(expires <= Date.now() + 180 * minute);
  assert.equal(deployCalls, 0, 'no deployment may follow a failed RunInstances boundary');
});

test('three-service platform build still refuses a cloud deadline below its full task and provisioning budget', async () => {
  const outcome = await execute(172);
  assert.equal(budgetMs, 135 * minute);
  assert.equal(runRequests.length, 0, 'insufficient lifetime must reject before any cloud create call');
  assert.equal(outcome.status, 'failed');
  assert.match(outcome.error!, /maxLifetimeMinutes=172 cannot cover the task budget 135min \+ provisioning 38min/);
  assert.equal(deployCalls, 0);
});
