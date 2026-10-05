import test from 'node:test';
import assert from 'node:assert/strict';
import { terminateBuilder } from './tencent-termination.js';
import type { CvmClientLike } from './tencent-client.js';

const now = Date.parse('2026-10-05T16:00:00Z');
const id = 'ins-own';
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function client(overrides: Partial<CvmClientLike>): CvmClientLike {
  return {
    RunInstances: async () => { throw new Error('this test must never create instances'); },
    DescribeInstancesActionTimer: async () => ({}),
    TerminateInstances: async () => ({}),
    DescribeInstances: async () => ({ InstanceSet: [] }),
    ...overrides,
  };
}

test('termination readiness: accepted deletion waits beyond six seconds and confirms the target after 75 seconds', async ctx => {
  ctx.mock.timers.enable({ apis: ['Date', 'setTimeout'], now });
  const terminated: string[][] = [];
  let queries = 0;
  const sdk = client({
    TerminateInstances: async req => { terminated.push(req.InstanceIds as string[]); return {}; },
    DescribeInstances: async req => {
      assert.deepEqual(req, { InstanceIds: [id], Limit: 1 });
      queries++;
      return { InstanceSet: Date.now() - now < 75_000 ? [{ InstanceId: id, InstanceState: 'RUNNING' }] : [] };
    },
  });
  const result = terminateBuilder(sdk, id);
  void result.catch(() => {});
  await flush();
  for (let i = 0; i < 15; i++) { ctx.mock.timers.tick(5_000); await flush(); }
  await result;
  assert.deepEqual(terminated, [[id]]);
  assert.equal(queries, 16);
});

test('termination readiness: polling waits five seconds instead of issuing high-frequency Describe calls', async ctx => {
  ctx.mock.timers.enable({ apis: ['Date', 'setTimeout'], now });
  let queries = 0;
  const sdk = client({ DescribeInstances: async () => ({ InstanceSet: ++queries === 1 ? [{ InstanceId: id, InstanceState: 'RUNNING' }] : [] }) });
  const result = terminateBuilder(sdk, id);
  await flush();
  assert.equal(queries, 1);
  ctx.mock.timers.tick(4_999);
  await flush();
  assert.equal(queries, 1);
  ctx.mock.timers.tick(1);
  await result;
  assert.equal(queries, 2);
});

test('termination readiness: a perpetually live target fails at the three-minute deadline without a late query', async ctx => {
  ctx.mock.timers.enable({ apis: ['Date', 'setTimeout'], now });
  let queries = 0;
  const sdk = client({ DescribeInstances: async () => { queries++; return { InstanceSet: [{ InstanceId: id, InstanceState: 'RUNNING' }] }; } });
  const result = assert.rejects(terminateBuilder(sdk, id), /not confirmed within 180000ms.*retain the ledger/);
  await flush();
  ctx.mock.timers.tick(180_000);
  await result;
  assert.equal(queries, 1, 'deadline must be checked before issuing another SDK query');
});

test('termination readiness: both a hung terminate and a hung Describe are bounded by the same deadline', async ctx => {
  ctx.mock.timers.enable({ apis: ['Date', 'setTimeout'], now });
  for (const phase of ['terminate', 'describe']) {
    const sdk = client(phase === 'terminate'
      ? { TerminateInstances: () => new Promise(() => {}) }
      : { DescribeInstances: () => new Promise(() => {}) });
    const result = assert.rejects(terminateBuilder(sdk, id), /not confirmed within 180000ms/);
    await flush();
    ctx.mock.timers.tick(180_000);
    await result;
  }
});

test('termination readiness: non-positive or invalid budget issues no SDK requests', async () => {
  let calls = 0;
  const sdk = client({
    TerminateInstances: async () => { calls++; return {}; },
    DescribeInstances: async () => { calls++; return { InstanceSet: [] }; },
  });
  for (const budget of [0, -1, NaN, Infinity]) await assert.rejects(terminateBuilder(sdk, id, budget), /budget/);
  assert.equal(calls, 0);
});

test('termination readiness: only TERMINATED for the exact target confirms completion', async () => {
  await terminateBuilder(client({ DescribeInstances: async () => ({ InstanceSet: [{ InstanceId: id, InstanceState: 'TERMINATED' }] }) }), id);
  await assert.rejects(terminateBuilder(client({ DescribeInstances: async () => ({ InstanceSet: [{ InstanceId: 'ins-other', InstanceState: 'TERMINATED' }] }) }), id, 20), /not confirmed/);
});

test('termination readiness: failed SDK confirmation query is propagated without hiding its error', async () => {
  const problem = new Error('mock DescribeInstances rejected');
  await assert.rejects(terminateBuilder(client({ DescribeInstances: async () => { throw problem; } }), id), error => error === problem);
});

test('termination readiness: an explicit cancellation budget stays bounded at six seconds', async ctx => {
  ctx.mock.timers.enable({ apis: ['Date', 'setTimeout'], now });
  const sdk = client({ DescribeInstances: () => new Promise(() => {}) });
  const result = assert.rejects(terminateBuilder(sdk, id, 6_000), /not confirmed within 6000ms.*retain the ledger/);
  await flush();
  ctx.mock.timers.tick(6_000);
  await result;
});
