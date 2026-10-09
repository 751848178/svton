import test from 'node:test';
import assert from 'node:assert/strict';
import { withBuilderLease } from './builder-lease.js';
import type { ShipConfig } from '../shared/types.js';
import type { BuilderProvider } from '../providers/provider.js';

function fixture(keepMinutes = 0, failRelease = false) {
  const events: Array<{ stage: string; status: string; detail?: Record<string, unknown> }> = [];
  let releaseCalls = 0;
  const provider: BuilderProvider = {
    kind: 'sdk-simulated', ensure: async () => ({ url: 'http://builder', token: 'test-only' }),
    status: async () => ({ kind: 'sdk-simulated', active: true, detail: { instanceId: 'owned-test-instance' } }),
    release: async () => { releaseCalls++; if (failRelease) throw new Error('simulated cloud outage'); },
  };
  const options = {
    config: { builder: { mode: 'dynamic', dynamic: { keepMinutes } } } as ShipConfig,
    taskBudgetMs: 60_000, managedCancellation: true,
    providerFactory: async () => provider,
    log: { info: () => {}, warn: () => {}, stage: async (stage: string, status: string, detail?: Record<string, unknown>) => { events.push({ stage, status, detail }); } },
  };
  return { options, events, releaseCalls: () => releaseCalls };
}

test('managed cancellation overrides normal keep window and releases owned instance', async () => {
  const f = fixture(10);
  await assert.rejects(withBuilderLease({ ...f.options, run: async () => { throw Object.assign(new Error('cancelled'), { cancelled: true }); } }), /cancelled/);
  assert.equal(f.releaseCalls(), 1);
  assert.equal(f.events.at(-1)?.detail?.builderRelease, 'released');
});

test('archive failure preserves instance even without a keep window', async () => {
  const f = fixture();
  await assert.rejects(withBuilderLease({ ...f.options, run: async () => { throw Object.assign(new Error('archive failed'), { archiveIncomplete: true }); } }), /archive failed/);
  assert.equal(f.releaseCalls(), 0);
  assert.equal(f.events.at(-1)?.detail?.builderRelease, 'pending');
});

test('cloud release failure preserves successful build outcome as independent cleanup failure', async () => {
  const f = fixture(0, true);
  const result = await withBuilderLease({ ...f.options, run: async () => 'archived-build' });
  assert.equal(result.value, 'archived-build');
  assert.equal(result.release.builderRelease, 'failed');
  assert.equal(f.releaseCalls(), 1);
});

test('provision emits actual SDK instance reference and destruction follows archive completion', async () => {
  const f = fixture();
  let archived = false;
  const result = await withBuilderLease({ ...f.options, run: async () => { assert.equal(f.releaseCalls(), 0); archived = true; return 'done'; } });
  assert.equal(archived, true);
  assert.equal(result.release.builderRelease, 'released');
  assert.deepEqual(f.events.find((e) => e.stage === 'provision' && e.status === 'succeeded')?.detail,
    { mode: 'dynamic', provider: 'sdk-simulated', leaseRef: 'owned-test-instance' });
});
