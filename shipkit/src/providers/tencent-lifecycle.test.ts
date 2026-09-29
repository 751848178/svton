// Pure lifecycle decisions: RA03 admission with real budgets, RA07 strict timer verification.

import test from 'node:test';
import assert from 'node:assert/strict';
import { admissionDecision, sdkTimerEntry, verifyActionTimer, type ActionTimerView } from './tencent-lifecycle.js';
import type { BuilderState } from './builder-state.js';

function base(over: Partial<BuilderState> = {}): BuilderState {
  return {
    instanceId: 'ins-1', region: 'r', url: 'http://1.2.3.4:7410', token: 't', status: 'ready',
    createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    expireAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
    ...over,
  };
}

test('RA03: reuse allowed when idle fits the window and remaining life covers budget+buffer', () => {
  const d = admissionDecision({ state: base(), keepMinutes: 30, taskBudgetMs: 60 * 60_000 });
  assert.equal(d.action, 'reuse');
});

test('RA03: idle anchored at task end — 30min window, last task finished 40min ago → replace', () => {
  const d = admissionDecision({
    state: base({ lastUsedAt: new Date(Date.now() - 40 * 60_000).toISOString() }),
    keepMinutes: 30,
    taskBudgetMs: 30 * 60_000,
  });
  assert.equal(d.action, 'replace');
  assert.match(d.reason, /idle/);
});

test('RA03: 31 minutes remaining does NOT admit a 60min task (old 30min-budget bug)', () => {
  const d = admissionDecision({
    state: base({ expireAt: new Date(Date.now() + 31 * 60_000).toISOString() }),
    keepMinutes: 30,
    taskBudgetMs: 60 * 60_000,
  });
  assert.equal(d.action, 'replace');
  assert.match(d.reason, /remaining 31min < task budget 60min/);
});

test('RA03: exactly budget+buffer remaining is admissible (boundary)', () => {
  const d = admissionDecision({
    state: base({ expireAt: new Date(Date.now() + 70 * 60_000).toISOString() }),
    keepMinutes: 30,
    taskBudgetMs: 60 * 60_000,
    bufferMs: 10 * 60_000,
  });
  assert.equal(d.action, 'reuse');
});

const EXPECTED = new Date(Date.now() + 3600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');

test('A: SDK shape success — ActionTimers field, UNDO status, matching time', () => {
  const view = { ActionTimers: [sdkTimerEntry({ InstanceId: 'ins-1', ActionTime: EXPECTED })] } satisfies ActionTimerView;
  const v = verifyActionTimer(view, 'ins-1', EXPECTED);
  assert.ok(v.ok, v.ok ? '' : v.reason);
  assert.equal(v.actionTime, EXPECTED);
});

test('A: absent / empty / undefined ActionTimers fails', () => {
  assert.ok(!verifyActionTimer({}, 'ins-1', EXPECTED).ok);
  assert.ok(!verifyActionTimer({ ActionTimers: [] }, 'ins-1', EXPECTED).ok);
  assert.ok(!verifyActionTimer({ ActionTimers: undefined }, 'ins-1', EXPECTED).ok);
});

test('A: a timer for another instance fails', () => {
  const view = { ActionTimers: [sdkTimerEntry({ InstanceId: 'ins-OTHER', ActionTime: EXPECTED })] } satisfies ActionTimerView;
  const v = verifyActionTimer(view, 'ins-1', EXPECTED);
  assert.ok(!v.ok);
  assert.match(v.reason, /no timer entry references/);
});

test('A: wrong action fails', () => {
  const view = { ActionTimers: [sdkTimerEntry({ InstanceId: 'ins-1', ActionTime: EXPECTED, TimerAction: 'RebootInstances' })] } satisfies ActionTimerView;
  const v = verifyActionTimer(view, 'ins-1', EXPECTED);
  assert.ok(!v.ok && /expected TerminateInstances/.test(v.reason));
});

test('A: off-schedule or unparsable ActionTime fails', () => {
  const off = verifyActionTimer({ ActionTimers: [sdkTimerEntry({ InstanceId: 'ins-1', ActionTime: new Date(Date.now() + 7200_000).toISOString() })] } satisfies ActionTimerView, 'ins-1', EXPECTED);
  assert.ok(!off.ok && /deviates/.test(off.reason));
  const bad = verifyActionTimer({ ActionTimers: [sdkTimerEntry({ InstanceId: 'ins-1', ActionTime: 'not-a-date' })] } satisfies ActionTimerView, 'ins-1', EXPECTED);
  assert.ok(!bad.ok && /unparsable/.test(bad.reason));
});

test('A: a timer WITHOUT a status is rejected — only an explicit UNDO admits', () => {
  const view = { ActionTimers: [sdkTimerEntry({ InstanceId: 'ins-1', ActionTime: EXPECTED, Status: undefined })] } satisfies ActionTimerView;
  const v = verifyActionTimer(view, 'ins-1', EXPECTED);
  assert.ok(!v.ok);
  assert.match(v.reason, /missing.*UNDO|UNDO/);
});

test('A: non-UNDO status (DOING/DONE) rejects admission', () => {
  const doing = verifyActionTimer({ ActionTimers: [sdkTimerEntry({ InstanceId: 'ins-1', ActionTime: EXPECTED, Status: 'DOING' })] } satisfies ActionTimerView, 'ins-1', EXPECTED);
  assert.ok(!doing.ok && /only an explicit UNDO/.test(doing.reason));
  const done = verifyActionTimer({ ActionTimers: [sdkTimerEntry({ InstanceId: 'ins-1', ActionTime: EXPECTED, Status: 'DONE' })] } satisfies ActionTimerView, 'ins-1', EXPECTED);
  assert.ok(!done.ok && /only an explicit UNDO/.test(done.reason));
});

test('A: the pre-fix WRONG field name no longer typechecks against the official shape', () => {
  // @ts-expect-error ActionTimerSet was the drifted field; the official SDK field is ActionTimers
  const wrong = { ActionTimerSet: [sdkTimerEntry({ InstanceId: 'ins-1', ActionTime: EXPECTED })] } satisfies ActionTimerView;
  assert.equal((wrong as object).constructor, Object);
});

test('A: official response object (incl. RequestId) is assignable to the view', () => {
  const full = { ActionTimers: [sdkTimerEntry({ InstanceId: 'ins-1', ActionTime: EXPECTED })], RequestId: 'req-1' };
  const v = verifyActionTimer(full, 'ins-1', EXPECTED);
  assert.ok(v.ok);
});
