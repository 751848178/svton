import test from 'node:test';
import assert from 'node:assert/strict';
import { platformSupervisorLifecycle } from './platform-supervisor-lifecycle.mjs';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
test('stop during asynchronous log open closes the descriptor and never spawns after lease release', async () => {
  const lifecycle = platformSupervisorLifecycle(), opened = deferred();
  let closed = false, spawned = false, released = false;
  await lifecycle.acquire(async () => () => { released = true; });
  const launch = lifecycle.launch(() => opened.promise, () => { spawned = true; });
  const rejected = assert.rejects(launch, /startup was stopped/);
  assert.equal(await lifecycle.stop(), true);
  assert.equal(released, true);
  opened.resolve({ close: async () => { closed = true; } });
  await rejected;
  assert.equal(closed, true);
  assert.equal(spawned, false);
});
test('stop while lease acquisition is blocked releases the late lease without launching', async () => {
  const lifecycle = platformSupervisorLifecycle(), acquired = deferred();
  let released = false;
  const lease = lifecycle.acquire(() => acquired.promise);
  const rejected = assert.rejects(lease, /startup was stopped/);
  assert.equal(await lifecycle.stop(), true);
  acquired.resolve(() => { released = true; });
  await rejected;
  assert.equal(released, true);
  await assert.rejects(lifecycle.launch(async () => { throw Error('must not open'); }, () => {}), /startup was stopped/);
});
