import test from 'node:test';
import assert from 'node:assert/strict';
import { initialDelivery, transitionDelivery, deliveryTargets } from '../src/components/deliveryScenarioModel.js';

test('new artifact cannot enter production with old staging proof', () => {
  const initial = initialDelivery();
  assert.equal(transitionDelivery(initial, 'start'), initial);
  const staged = transitionDelivery(initial, 'stage');
  assert.equal(staged.proven, staged.candidate);
  assert.equal(transitionDelivery(staged, 'start').phase, 'unknown');
});
test('unknown execution must be inspected; repeat resume cannot duplicate records', () => {
  const unknown = initialDelivery('interrupted');
  assert.equal(transitionDelivery(unknown, 'resume'), unknown);
  const inspected = transitionDelivery(unknown, 'inspect');
  const deployed = transitionDelivery(inspected, 'resume');
  assert.equal(deployed.run, unknown.run);
  assert.equal(deployed.current, '1.4.0');
  assert.equal(transitionDelivery(deployed, 'resume'), deployed);
  assert.equal(deployed.phase, 'access');
});
test('aborting batches does not silently roll back successful host', () => {
  const aborted = transitionDelivery(initialDelivery('batch'), 'abort');
  assert.equal(deliveryTargets(aborted)[0][1], '1.4.0');
  assert.equal(deliveryTargets(aborted)[1][1], '1.3.2');
});
test('recovery appends history, preserves original run and restores all targets', () => {
  const failed = transitionDelivery(initialDelivery('batch'), 'continue');
  const recovered = transitionDelivery(failed, 'recover');
  assert.equal(recovered.run, failed.run);
  assert.equal(recovered.history.length, failed.history.length + 1);
  assert.ok(recovered.events.includes('第 2 台健康检查失败；第 3 台未执行'));
  assert.ok(deliveryTargets(recovered).every((row) => row[1] === '1.3.2'));
});
test('deployment and access acceptance are distinct', () => {
  const deployed = initialDelivery('access');
  assert.equal(deployed.current, '1.4.0');
  assert.equal(deployed.phase, 'access');
  assert.equal(transitionDelivery(deployed, 'verify').phase, 'complete');
});
