// Provision-flow regression tests (RA03/RA04/RA07) with a fully faked cloud client.
// The fake closes over `fake`; tencent-client.js is module-mocked before tencent.js is imported.

import test from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ActionTimerView } from './tencent-lifecycle.js';
import type { BuilderState } from './builder-state.js';

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
  instances: Array<{ InstanceStatus?: string; PublicIpAddresses?: string[] }>;
} = {
  calls: { runInstances: [], terminate: [], timerQueries: 0 },
  ip: '43.139.1.2',
  timerView: 'auto',
  instances: [{ InstanceStatus: 'RUNNING', PublicIpAddresses: ['43.139.1.2'] }],
};

mock.module('./tencent-client.js', {
  namedExports: {
    requireCreds: () => ({ secretId: 'sid', secretKey: 'skey' }),
    mkCvmClient: async () => ({
      RunInstances: async (req: unknown) => {
        fake.calls.runInstances.push(req);
        return { InstanceIdSet: ['ins-NEW'] };
      },
      DescribeInstances: async () => ({ InstanceSet: fake.instances }),
      TerminateInstances: async (req: { InstanceIds: string[] }) => {
        fake.calls.terminate.push(req.InstanceIds);
        return {};
      },
      DescribeInstancesActionTimer: async () => {
        fake.calls.timerQueries++;
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
    terminateQuietly: async (client: unknown, instanceId: string) => {
      fake.calls.terminate.push([instanceId]);
    },
    authedBuilderStatus: async () => ({ kind: 'tencent', active: true }),
  },
});

const { TencentBuilderProvider } = await import('./tencent.js');
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
}

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

test('RA07: timer verification failure (empty set) → compensation terminate + state cleared', async () => {
  reset();
  const home = await tmpHome();
  fake.timerView = { ActionTimers: [] };
  const p = new TencentBuilderProvider(CFG, 30, 'd', 'b');
  await assert.rejects(() => p.ensure(() => {}), /verification FAILED.*no action timers/);
  assert.deepEqual(fake.calls.terminate, [['ins-NEW']], 'created instance compensated');
  assert.equal(await readState(stateFileFor(CFG, 'sid')), null, 'no orphan record left behind');
  void home;
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
