import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForVerifiedActionTimer, ACTION_TIMER_TIMEOUT_MS } from './tencent-timer-ready.js';
import type { ActionTimerView } from './tencent-lifecycle.js';

const instanceId = 'ins-test';
const now = Date.parse('2026-10-05T14:30:00Z');
const expected = '2026-10-05T15:30:00Z';
const valid = { InstanceId: instanceId, TimerAction: 'TerminateInstances', ActionTime: expected, Status: 'UNDO' };
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const log = () => {};

test('timer readiness: real 75-second empty-to-scheduled pattern passes within the default budget', async ctx => {
  ctx.mock.timers.enable({ apis: ['Date', 'setTimeout'], now });
  let queries = 0;
  const client = { DescribeInstancesActionTimer: async (req: { InstanceIds: string[] }) => {
    assert.deepEqual(req.InstanceIds, [instanceId]);
    queries++;
    return { ActionTimers: Date.now() - now < 75_000 ? [] : [valid] };
  } };
  const result = waitForVerifiedActionTimer(client, instanceId, expected, new AbortController().signal, log);
  void result.catch(() => {}); // Keep the pre-fix failure observable when the clock advances first.
  await flush();
  for (let i = 0; i < 15; i++) { ctx.mock.timers.tick(5_000); await flush(); }
  assert.deepEqual(await result, { ok: true, actionTime: expected });
  assert.equal(queries, 16);
});

test('timer readiness: perpetual empty list fails after three minutes', async ctx => {
  ctx.mock.timers.enable({ apis: ['Date', 'setTimeout'], now });
  let queries = 0;
  const client = { DescribeInstancesActionTimer: async () => { queries++; return { ActionTimers: [] }; } };
  const result = assert.rejects(waitForVerifiedActionTimer(client, instanceId, expected, new AbortController().signal, log), /no action timers.*180000ms/);
  await flush();
  ctx.mock.timers.tick(ACTION_TIMER_TIMEOUT_MS);
  await result;
  assert.equal(queries, 1, 'no post-deadline cloud query');
});

test('timer readiness: observed mismatch or malformed response fails immediately without retry', async () => {
  const bad: ActionTimerView[] = [
    {}, { ActionTimers: [{ ...valid, InstanceId: 'ins-other' }] },
    { ActionTimers: [{ ...valid, TimerAction: 'StopInstances' }] },
    { ActionTimers: [{ ...valid, Status: 'DONE' }] },
    { ActionTimers: [{ ...valid, ActionTime: '2026-10-05T16:30:00Z' }] },
    { ActionTimers: [{ ...valid, ActionTime: 'invalid' }] },
  ];
  for (const view of bad) {
    let queries = 0;
    const client = { DescribeInstancesActionTimer: async () => { queries++; return view; } };
    await assert.rejects(waitForVerifiedActionTimer(client, instanceId, expected, new AbortController().signal, log), /verification FAILED/);
    assert.equal(queries, 1);
  }
});

test('timer readiness: SDK query error is propagated without retry', async () => {
  let queries = 0;
  const problem = new Error('mock SDK permission denied');
  const client = { DescribeInstancesActionTimer: async () => { queries++; throw problem; } };
  await assert.rejects(waitForVerifiedActionTimer(client, instanceId, expected, new AbortController().signal, log), e => e === problem);
  assert.equal(queries, 1);
});

test('timer readiness: cancellation interrupts the five-second empty-list polling sleep', async () => {
  const ac = new AbortController();
  const client = { DescribeInstancesActionTimer: async () => ({ ActionTimers: [] }) };
  const result = assert.rejects(waitForVerifiedActionTimer(client, instanceId, expected, ac.signal, log), /cancelled/);
  await flush();
  ac.abort();
  await result;
});

test('timer readiness: cancellation interrupts a hung read-only SDK query', async () => {
  const ac = new AbortController();
  const client = { DescribeInstancesActionTimer: () => new Promise<ActionTimerView>(() => {}) };
  const result = assert.rejects(waitForVerifiedActionTimer(client, instanceId, expected, ac.signal, log), /cancelled/);
  await flush();
  ac.abort();
  await result;
});

test('timer readiness: a hung SDK query is bounded by the same three-minute deadline', async ctx => {
  ctx.mock.timers.enable({ apis: ['Date', 'setTimeout'], now });
  const client = { DescribeInstancesActionTimer: () => new Promise<ActionTimerView>(() => {}) };
  const result = assert.rejects(waitForVerifiedActionTimer(client, instanceId, expected, new AbortController().signal, log), /verification deadline/);
  await flush();
  ctx.mock.timers.tick(ACTION_TIMER_TIMEOUT_MS);
  await result;
});

test('timer readiness: already cancelled work issues no SDK query', async () => {
  const ac = new AbortController();
  ac.abort();
  let queries = 0;
  const client = { DescribeInstancesActionTimer: async () => { queries++; return { ActionTimers: [valid] }; } };
  await assert.rejects(waitForVerifiedActionTimer(client, instanceId, expected, ac.signal, log), /cancelled/);
  assert.equal(queries, 0);
});
