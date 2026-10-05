// Real SDK adapter + real ledger locks: acceptance cannot erase a live or replaced builder.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { CvmClientLike } from './tencent-client.js';
import type { BuilderState } from './builder-state.js';

const realState = await import('./builder-state.js');
const realTermination = await import('./tencent-termination.js');
// Keep negative ledger integrations fast; the default cloud budget is independently
// exercised with a mocked clock in tencent-termination-budget.test.ts.
mock.module('./tencent-termination.js', { namedExports: {
  ...realTermination,
  terminateBuilder: (client: CvmClientLike, instanceId: string, budgetMs?: number) => realTermination.terminateBuilder(client, instanceId, budgetMs ?? 500),
} });
const fx = {
  file: '', mode: 'absent' as 'absent' | 'running' | 'throws',
  terminated: [] as string[], cleared: [] as string[], logs: [] as string[],
  afterList: null as null | (() => Promise<void>), onTerminate: null as null | (() => Promise<void>),
};
mock.module('./builder-state.js', { namedExports: {
  ...realState,
  listStates: async () => {
    const state = await realState.readState(fx.file);
    if (fx.afterList) await fx.afterList();
    return state ? [{ file: fx.file, state }] : [];
  },
  clearState: async (file: string) => { fx.cleared.push(file); await realState.clearState(file); },
} });
class Client {
  async TerminateInstances(req: { InstanceIds: string[] }) {
    fx.terminated.push(...req.InstanceIds);
    if (fx.onTerminate) await fx.onTerminate();
    return {};
  }
  async DescribeInstances(): ReturnType<CvmClientLike['DescribeInstances']> {
    if (fx.mode === 'throws') throw new Error('mock confirmation query rejected');
    return { InstanceSet: fx.mode === 'absent' ? [] : [{ InstanceId: 'ins-sweeper-own', InstanceState: 'RUNNING' }] };
  }
}
mock.module('tencentcloud-sdk-nodejs-cvm', { namedExports: {
  default: { cvm: { v20170312: { Client } } }, cvm: { v20170312: { Client } },
} });
const { sweepExpiredBuilders } = await import('./tencent-client.js');
process.env.TENCENTCLOUD_SECRET_ID = 'AKIDmock';
process.env.TENCENTCLOUD_SECRET_KEY = 'mock-key';

function builder(instanceId = 'ins-sweeper-own', expireAt = new Date(0).toISOString()): BuilderState {
  return { instanceId, region: 'mock', expireAt, createdAt: new Date(0).toISOString(), status: 'provisioning', token: 'mock-token' };
}
test.beforeEach(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-sweeper-'));
  fx.file = path.join(dir, 'own-ledger.json');
  fx.mode = 'absent'; fx.terminated = []; fx.cleared = []; fx.logs = []; fx.afterList = null; fx.onTerminate = null;
  await realState.writeState(fx.file, builder());
});
test.afterEach(() => rm(path.dirname(fx.file), { recursive: true, force: true }));
const log = (message: string) => { fx.logs.push(message); };

test('S06: expired-builder sweep clears only after confirmed absence', async () => {
  await sweepExpiredBuilders(log);
  assert.deepEqual(fx.terminated, ['ins-sweeper-own']);
  assert.deepEqual(fx.cleared, [fx.file]);
  assert.equal(await realState.readState(fx.file), null);
});

test('S06: expired-builder sweep retains accepted-but-live instance state', async () => {
  fx.mode = 'running';
  await sweepExpiredBuilders(log);
  assert.deepEqual(fx.terminated, ['ins-sweeper-own']);
  assert.deepEqual(fx.cleared, []);
  assert.equal((await realState.readState(fx.file))?.instanceId, 'ins-sweeper-own');
  assert.match(fx.logs.join('\n'), /failed to sweep/);
});

test('S06: failed confirmation query retains expired-builder state', async () => {
  fx.mode = 'throws';
  await sweepExpiredBuilders(log);
  assert.deepEqual(fx.cleared, []);
  assert.match(fx.logs.join('\n'), /failed to sweep/);
});

test('S06: a ledger replaced after the sweep snapshot is neither terminated nor cleared', async () => {
  fx.afterList = () => realState.withLock(fx.file, () => realState.writeState(fx.file, builder('ins-B', new Date(Date.now() + 60_000).toISOString())));
  await sweepExpiredBuilders(log);
  assert.deepEqual(fx.terminated, []);
  assert.equal((await realState.readState(fx.file))?.instanceId, 'ins-B');
});

test('S06: an ensure writer during termination waits for the sweep lock and its B ledger survives', async () => {
  let written = false;
  let writtenDuringDeletion = false;
  let writer: Promise<void> | undefined;
  fx.onTerminate = async () => {
    writer = realState.withLock(fx.file, async () => {
      await realState.writeState(fx.file, builder('ins-B', new Date(Date.now() + 60_000).toISOString()));
      written = true;
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    writtenDuringDeletion = written;
  };
  await sweepExpiredBuilders(log);
  await writer;
  assert.equal(writtenDuringDeletion, false, 'ensure must wait until confirmation and clear finish');
  assert.deepEqual(fx.terminated, ['ins-sweeper-own']);
  assert.equal((await realState.readState(fx.file))?.instanceId, 'ins-B');
});
