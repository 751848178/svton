// Provision-flow regression tests (RA03/RA04/RA07) with a fully faked cloud client.
// The fake closes over `fake`; tencent-client.js is module-mocked before tencent.js is imported.

import test from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ActionTimerView } from './tencent-lifecycle.js';
import type { BuilderState } from './builder-state.js';
import { validateConfig } from '../shared/config.js';
import type { Instance } from 'tencentcloud-sdk-nodejs-cvm/tencentcloud/services/cvm/v20170312/cvm_models.js';

interface FakeCalls {
  runInstances: unknown[];
  terminate: string[][];
  timerQueries: number;
}

const fake: {
  calls: FakeCalls;
  ip: string;
  /** 'auto' echoes the ActionTime actually passed to RunInstances; otherwise an explicit view or a thrown Error */
  timerView: 'auto' | ActionTimerView | Error;
  instances: Array<Pick<Instance, 'InstanceId' | 'InstanceState' | 'PublicIpAddresses'>>;
  retainAfterTerminate: boolean;
  badDescribe: 'missing' | 'invalid' | 'throws' | null;
  terminateError: Error | null;
  onTimerQuery: (() => void) | null;
  runError: Error | null;
  onRunCreated: (() => void) | null;
} = {
  calls: { runInstances: [], terminate: [], timerQueries: 0 },
  ip: '43.139.1.2',
  timerView: 'auto',
  instances: [{ InstanceState: 'RUNNING', PublicIpAddresses: ['43.139.1.2'] }],
  retainAfterTerminate: false,
  badDescribe: null,
  terminateError: null,
  onTimerQuery: null,
  runError: null,
  onRunCreated: null,
};

mock.module('./tencent-client.js', {
  namedExports: {
    requireCreds: () => ({ secretId: 'sid', secretKey: 'skey' }),
    mkCvmClient: async () => ({
      RunInstances: async (req: unknown) => {
        fake.calls.runInstances.push(req);
        if (fake.runError) throw fake.runError;
        fake.onRunCreated?.();
        return { InstanceIdSet: ['ins-NEW'] };
      },
      DescribeInstances: async (req: { InstanceIds: string[] }) => {
        if (fake.badDescribe === 'throws') throw new Error('mock DescribeInstances failed');
        if (fake.badDescribe === 'missing') return {};
        if (fake.badDescribe === 'invalid') return { InstanceSet: { length: 1, 0: { InstanceState: 'TERMINATED' } } };
        const released = fake.calls.terminate.some(ids => ids.some(id => req.InstanceIds.includes(id)));
        return { InstanceSet: released && !fake.retainAfterTerminate ? [] : fake.instances };
      },
      TerminateInstances: async (req: { InstanceIds: string[] }) => {
        fake.calls.terminate.push(req.InstanceIds);
        if (fake.terminateError) throw fake.terminateError;
        return {};
      },
      DescribeInstancesActionTimer: async () => {
        fake.calls.timerQueries++;
        fake.onTimerQuery?.();
        if (fake.timerView instanceof Error) throw fake.timerView;
        if (fake.timerView === 'auto') {
          const last = fake.calls.runInstances.at(-1) as { ActionTimer?: { ActionTime?: string } } | undefined;
          const at = last?.ActionTimer?.ActionTime ?? new Date().toISOString();
          // official SDK response shape: ActionTimers + Status
          return { ActionTimers: [{ InstanceId: 'ins-NEW', TimerAction: 'TerminateInstances', ActionTime: at, Status: 'UNDO' }] };
        }
        return fake.timerView;
      },
    }),
    agentHealthy: async () => true,
    authedBuilderStatus: async () => ({ kind: 'tencent', active: true }),
  },
});

const { TencentBuilderProvider } = await import('./tencent.js');
const { provisionBuilder, EnsureCancelled } = await import('./tencent-provision.js');
const { readState, stateFileFor, writeState } = await import('./builder-state.js');
import type { TencentCvmConfig } from '../shared/types.js';

const realHome = process.env.HOME;
const CFG: TencentCvmConfig = {
  region: 'r', zone: 'z', instanceType: 't', imageId: 'i', vpcId: 'v', subnetId: 's', securityGroupIds: ['sg'],
  installUrl: 'http://10.0.0.5:7411/install.sh',
  installToken: 'baked-token',
};

function reset(): void {
  fake.calls = { runInstances: [], terminate: [], timerQueries: 0 };
  fake.timerView = 'auto';
  fake.retainAfterTerminate = false;
  fake.badDescribe = null;
  fake.terminateError = null;
  fake.onTimerQuery = null;
  fake.runError = null;
  fake.onRunCreated = null;
  fake.instances = [{ InstanceId: 'ins-NEW', InstanceState: 'RUNNING', PublicIpAddresses: ['43.139.1.2'] }];
}

async function provisionForTest(cfg: TencentCvmConfig, signal = new AbortController().signal): Promise<void> {
  await provisionBuilder({
    file: stateFileFor(cfg, 'sid'), creds: { secretId: 'sid', secretKey: 'skey' }, log: () => {},
    taskBudgetMs: 60_000, signal, cfg, distDir: 'd', bootstrapDir: 'b',
    keepMinutes: 0, agentUrl: ip => `http://${ip}:7410`,
  });
}

test('systemDisk: validated 100GiB CLOUD_BSSD reaches the actual RunInstances request', async () => {
  reset();
  await tmpHome();
  const config = validateConfig({
    builder: { mode: 'dynamic', dynamic: { provider: 'tencent', tencent: { ...CFG, systemDisk: { diskType: 'CLOUD_BSSD', diskSize: 100 } } } },
    runtime: { targets: { prod: { url: 'http://127.0.0.1:7410', token: 'test' } } },
  });
  await provisionForTest(config.builder.dynamic!.tencent!);
  assert.equal(fake.calls.runInstances.length, 1);
  assert.deepEqual((fake.calls.runInstances[0] as { SystemDisk?: unknown }).SystemDisk, { DiskType: 'CLOUD_BSSD', DiskSize: 100 });
});

test('systemDisk: legacy config omits SystemDisk and retains cloud defaults', async () => {
  reset();
  await tmpHome();
  await provisionForTest(CFG);
  assert.equal(fake.calls.runInstances.length, 1);
  assert.equal(Object.hasOwn(fake.calls.runInstances[0] as object, 'SystemDisk'), false);
});

class MockSdkError extends Error {
  constructor(message: string, readonly code = 'InvalidParameterValue.InvalidPassword') { super(message); }
  getMessage(): string { return this.message; }
  override toString(): string { return `[MockSDK] ${this.getMessage()}`; }
}

test('loginPassword: SDK RunInstances echo is redacted while preserving error identity/type/code', async () => {
  reset();
  await tmpHome();
  const loginPassword = 'synthetic-password#123';
  const problem = new MockSdkError(`Password rejected: ${loginPassword}; repeated ${loginPassword}`);
  void problem.stack; // Materialize the original stack before the provider cleans it.
  fake.runError = problem;
  await assert.rejects(provisionForTest({ ...CFG, loginPassword }), error => {
    assert.strictEqual(error, problem);
    assert.ok(error instanceof MockSdkError);
    assert.equal(error.code, 'InvalidParameterValue.InvalidPassword');
    for (const text of [error.message, error.stack!, error.getMessage(), String(error)]) {
      assert.equal(text.includes(loginPassword), false);
      assert.ok(text.includes('[REDACTED]'));
    }
    return true;
  });
  assert.equal(fake.calls.runInstances.length, 1);
  assert.equal(fake.calls.terminate.length, 0, 'creation rejected without an instance ID');
});

test('loginPassword: ordinary SDK errors retain their original content and metadata', async () => {
  for (const loginPassword of [undefined, 'synthetic-password#123']) {
    reset();
    await tmpHome();
    const problem = new MockSdkError('permission denied', 'UnauthorizedOperation');
    const originalStack = problem.stack;
    fake.runError = problem;
    await assert.rejects(provisionForTest({ ...CFG, loginPassword }), error => {
      assert.strictEqual(error, problem);
      assert.equal(problem.message, 'permission denied');
      assert.equal(problem.stack, originalStack);
      assert.equal(problem.code, 'UnauthorizedOperation');
      return true;
    });
  }
});

test('loginPassword: failed compensation cleans both primary and termination errors', async () => {
  reset();
  await tmpHome();
  const loginPassword = 'synthetic-password#123';
  const primary = new MockSdkError(`timer lookup echoes ${loginPassword}`);
  const termination = new MockSdkError(`termination echoes ${loginPassword}`, 'InternalError');
  fake.timerView = primary;
  fake.terminateError = termination;
  await assert.rejects(provisionForTest({ ...CFG, loginPassword }), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /COMPENSATION FAILED/);
    assert.equal(error.message.includes(loginPassword), false);
    assert.equal(error.stack!.includes(loginPassword), false);
    assert.ok(error.message.includes('[REDACTED]'));
    assert.equal(primary.message.includes(loginPassword), false);
    assert.equal(termination.message.includes(loginPassword), false);
    return true;
  });
  assert.deepEqual(fake.calls.terminate, [['ins-NEW']]);
  assert.equal((await readState(stateFileFor(CFG, 'sid')))?.instanceId, 'ins-NEW', 'failed cleanup preserves the ledger');
});

test('loginPassword: cancellation preserves EnsureCancelled semantics and compensates the created ID', async () => {
  reset();
  await tmpHome();
  const ac = new AbortController();
  fake.onRunCreated = () => ac.abort();
  await assert.rejects(provisionForTest({ ...CFG, loginPassword: 'synthetic-password#123' }, ac.signal), error => {
    assert.ok(error instanceof EnsureCancelled);
    assert.equal(error.message, 'builder provisioning cancelled by user signal');
    return true;
  });
  assert.deepEqual(fake.calls.terminate, [['ins-NEW']]);
  assert.equal(await readState(stateFileFor(CFG, 'sid')), null);
});

async function tmpHome(): Promise<string> {
  const home = await mkdtemp(path.join(tmpdir(), 'ship-prov-'));
  process.env.HOME = home;
  return home;
}

function state(over: Partial<BuilderState>): BuilderState {
  return {
    instanceId: 'ins-OLD', region: 'r', url: 'http://1.1.1.1:7410', token: 'old', status: 'ready',
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    expireAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
    ...over,
  };
}

test.afterEach(() => { process.env.HOME = realHome; });

test('F11: an unreadable ledger refuses ensure/release before any cloud mutation', async (t) => {
  reset();
  await tmpHome();
  const file = stateFileFor(CFG, 'sid');
  await writeState(file, state({}));
  const before = await readFile(file, 'utf8');
  await chmod(file, 0);
  t.after(() => chmod(file, 0o600));
  const provider = new TencentBuilderProvider(CFG, 30, 'd', 'b');
  await assert.rejects(provider.ensure(() => {}), /cannot read|unreadable|不可读|EACCES/i);
  await assert.rejects(provider.release(), /cannot read|unreadable|不可读|EACCES/i);
  assert.equal(fake.calls.runInstances.length, 0);
  assert.equal(fake.calls.terminate.length, 0);
  await chmod(file, 0o600);
  assert.equal(await readFile(file, 'utf8'), before, 'original ledger must remain intact');
});

test('F11: invalid ledger timestamps fail closed instead of bypassing expiry admission', async () => {
  reset();
  await tmpHome();
  const file = stateFileFor(CFG, 'sid');
  await writeState(file, state({ createdAt: 'invalid', expireAt: 'invalid' }));
  const before = await readFile(file, 'utf8');
  const provider = new TencentBuilderProvider(CFG, 30, 'd', 'b');
  await assert.rejects(provider.ensure(() => {}), /invalid|corrupt|timestamp|结构|时间/i);
  await assert.rejects(provider.release(), /invalid|corrupt|timestamp|结构|时间/i);
  assert.equal(fake.calls.runInstances.length, 0);
  assert.equal(fake.calls.terminate.length, 0);
  assert.equal(await readFile(file, 'utf8'), before);
});

test('RA07: matching cloud timer → ready, and the agent URL honours agentScheme/host/port (RA06)', async () => {
  reset();
  const home = await tmpHome();
  const p = new TencentBuilderProvider({ ...CFG, agentScheme: 'https', agentHost: 'builder.internal.example.com', agentPort: 8443 }, 30, 'd', 'b');
  const h = await p.ensure(() => {});
  // host carries NO port; the port comes exclusively from agentPort
  assert.equal(h.url, 'https://builder.internal.example.com:8443');
  assert.ok(!h.url.includes('example.com:8443:'), 'no duplicated port');
  assert.equal(h.token, 'baked-token'); // F18: installToken, not a random one
  assert.equal(fake.calls.timerQueries, 1, 'timer was actually queried with the real SDK method');
  const req = fake.calls.runInstances[0] as { ActionTimer?: { TimerAction: string } };
  assert.equal(req.ActionTimer?.TimerAction, 'TerminateInstances');
  const st = await readState(stateFileFor({ ...CFG }, 'sid'));
  assert.equal(st?.status, 'ready');
  void home;
});

test('RA07: timer verification mismatch → compensation terminate + state cleared', async () => {
  reset();
  const home = await tmpHome();
  fake.timerView = { ActionTimers: [{ InstanceId: 'ins-other', TimerAction: 'TerminateInstances', Status: 'UNDO', ActionTime: new Date().toISOString() }] };
  const p = new TencentBuilderProvider(CFG, 30, 'd', 'b');
  await assert.rejects(() => p.ensure(() => {}), /verification FAILED.*no timer entry references/);
  assert.deepEqual(fake.calls.terminate, [['ins-NEW']], 'created instance compensated');
  assert.equal(await readState(stateFileFor(CFG, 'sid')), null, 'no orphan record left behind');
  void home;
});

test('timer readiness: cancellation after an empty SDK read compensates the known instance', async () => {
  reset();
  await tmpHome();
  const ac = new AbortController();
  fake.timerView = { ActionTimers: [] };
  fake.onTimerQuery = () => ac.abort();
  const file = stateFileFor(CFG, 'sid');
  await assert.rejects(provisionBuilder({
    file, creds: { secretId: 'sid', secretKey: 'skey' }, log: () => {}, taskBudgetMs: 60_000,
    signal: ac.signal, cfg: CFG, distDir: 'd', bootstrapDir: 'b', keepMinutes: 0, agentUrl: ip => `http://${ip}:7410`,
  }), /cancelled/);
  assert.equal(fake.calls.timerQueries, 1);
  assert.deepEqual(fake.calls.terminate, [['ins-NEW']]);
  assert.equal(await readState(file), null);
});

test('timer readiness: visibility wait is reserved in the lifetime budget before creation', async () => {
  reset();
  await tmpHome();
  const cfg = { ...CFG, maxLifetimeMinutes: 97 };
  await assert.rejects(provisionBuilder({
    file: stateFileFor(cfg, 'sid'), creds: { secretId: 'sid', secretKey: 'skey' }, log: () => {},
    taskBudgetMs: 60 * 60_000, signal: new AbortController().signal, cfg, distDir: 'd', bootstrapDir: 'b',
    keepMinutes: 0, agentUrl: ip => `http://${ip}:7410`,
  }), /task budget 60min \+ provisioning 38min/);
  assert.equal(fake.calls.runInstances.length, 0);
  assert.equal(fake.calls.timerQueries, 0);
  assert.equal(fake.calls.terminate.length, 0);
});

test('RA07: timer query raising → also compensated', async () => {
  reset();
  const home = await tmpHome();
  fake.timerView = new Error('network down');
  const p = new TencentBuilderProvider(CFG, 30, 'd', 'b');
  await assert.rejects(() => p.ensure(() => {}), /network down/);
  assert.deepEqual(fake.calls.terminate, [['ins-NEW']]);
  void home;
});

test('RA04: a live foreign lease blocks ensure — no cloud mutation at all', async () => {
  reset();
  const home = await tmpHome();
  const holder = spawn('sleep', ['10']);
  try {
    await writeState(stateFileFor(CFG, 'sid'), state({ lease: { pid: holder.pid!, acquiredAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() } }));
    const p = new TencentBuilderProvider(CFG, 30, 'd', 'b');
    await assert.rejects(() => p.ensure(() => {}), /BUSY.*pid/);
    assert.equal(fake.calls.runInstances.length, 0);
    assert.equal(fake.calls.terminate.length, 0);
  } finally {
    holder.kill();
  }
  void home;
});

test('RA06 regression: no agentHost → IP host; no agentPort → default 7410; host never injects a port', async () => {
  reset();
  const home = await tmpHome();
  const p1 = new TencentBuilderProvider(CFG, 30, 'd', 'b');
  const h1 = await p1.ensure(() => {});
  assert.equal(h1.url, 'http://43.139.1.2:7410');
  // a SEPARATE ledger home: reuse of a ready state must return its persisted URL,
  // so URL construction is only observable on a fresh provisioning
  const home2 = await tmpHome();
  const p2 = new TencentBuilderProvider({ ...CFG, agentHost: 'tunnel.example.com' }, 30, 'd', 'b');
  const h2 = await p2.ensure(() => {});
  assert.equal(h2.url, 'http://tunnel.example.com:7410');
  void home; void home2;
});

test('RA03: insufficient remaining life → old instance replaced, never reused', async () => {
  reset();
  const home = await tmpHome();
  await writeState(stateFileFor(CFG, 'sid'), state({ expireAt: new Date(Date.now() + 20 * 60_000).toISOString() }));
  const p = new TencentBuilderProvider(CFG, 30, 'd', 'b');
  const h = await p.ensure(() => {}, 60 * 60_000);
  assert.deepEqual(fake.calls.terminate, [['ins-OLD']], 'short-lived machine released first');
  assert.equal(h.url, 'http://43.139.1.2:7410');
  assert.equal(fake.calls.runInstances.length, 1);
  void home;
});

test('RA03: explicit maxLifetimeMinutes below provisioning+task budget is rejected up front', async () => {
  reset();
  const home = await tmpHome();
  const p = new TencentBuilderProvider({ ...CFG, maxLifetimeMinutes: 90 }, 30, 'd', 'b');
  await assert.rejects(() => p.ensure(() => {}, 60 * 60_000), /maxLifetimeMinutes=90 cannot cover/);
  void home;
});

test('S06: release accepted by the SDK without confirmed disappearance leaves the existing ledger', async () => {
  reset();
  await tmpHome();
  fake.retainAfterTerminate = true;
  await writeState(stateFileFor(CFG, 'sid'), state({}));
  const p = new TencentBuilderProvider(CFG, 30, 'd', 'b');
  await assert.rejects(() => p.release(), /not confirmed/);
  assert.deepEqual(fake.calls.terminate, [['ins-OLD']]);
  assert.equal((await readState(stateFileFor(CFG, 'sid')))?.instanceId, 'ins-OLD');
});

test('S06: termination errors retain the existing ledger for a retry', async () => {
  reset();
  await tmpHome();
  fake.terminateError = new Error('mock TerminateInstances failed');
  await writeState(stateFileFor(CFG, 'sid'), state({}));
  const p = new TencentBuilderProvider(CFG, 30, 'd', 'b');
  await assert.rejects(() => p.release(), /mock TerminateInstances failed/);
  assert.equal((await readState(stateFileFor(CFG, 'sid')))?.instanceId, 'ins-OLD');
});

test('S06: missing/invalid Describe responses and query failures cannot confirm deletion', async () => {
  const { mkCvmClient } = await import('./tencent-client.js');
  const { terminateBuilder } = await import('./tencent-termination.js');
  for (const bad of ['missing', 'invalid', 'throws'] as const) {
    reset();
    fake.badDescribe = bad;
    const client = await mkCvmClient('sid', 'skey', 'r');
    await assert.rejects(() => terminateBuilder(client, 'ins-OLD', 40), /not confirmed|mock DescribeInstances failed/);
  }
});

test('S06: official SDK InstanceState=TERMINATED confirms release of the exact recorded id', async () => {
  reset();
  await tmpHome();
  fake.retainAfterTerminate = true;
  fake.instances = [{ InstanceId: 'ins-OLD', InstanceState: 'TERMINATED' }];
  await writeState(stateFileFor(CFG, 'sid'), state({}));
  await new TencentBuilderProvider(CFG, 30, 'd', 'b').release();
  assert.deepEqual(fake.calls.terminate, [['ins-OLD']]);
  assert.equal(await readState(stateFileFor(CFG, 'sid')), null);
});

test('S06: TERMINATED for another id cannot confirm release of this instance', async () => {
  reset();
  fake.retainAfterTerminate = true;
  fake.instances = [{ InstanceId: 'ins-FOREIGN', InstanceState: 'TERMINATED' }];
  const { mkCvmClient } = await import('./tencent-client.js');
  const { terminateBuilder } = await import('./tencent-termination.js');
  const client = await mkCvmClient('sid', 'skey', 'r');
  await assert.rejects(() => terminateBuilder(client, 'ins-OLD', 40), /not confirmed/);
});

test('S06: official SDK InstanceState=LAUNCH_FAILED aborts IP waiting and compensates', async () => {
  reset();
  await tmpHome();
  fake.instances = [{ InstanceId: 'ins-NEW', InstanceState: 'LAUNCH_FAILED' }];
  await assert.rejects(() => new TencentBuilderProvider(CFG, 30, 'd', 'b').ensure(() => {}), /instance launch failed/);
  assert.deepEqual(fake.calls.terminate, [['ins-NEW']]);
  assert.equal(await readState(stateFileFor(CFG, 'sid')), null);
});
