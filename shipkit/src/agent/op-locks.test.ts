// RA02: deploy (reader) vs GC (writer) coordination on one machine.

import test from 'node:test';
import assert from 'node:assert/strict';
import { withDeploySlot, withGcSlot } from './app-lock.js';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('GC waits for an in-flight deploy to finish before computing/deleting', async () => {
  const order: string[] = [];
  const deploy = withDeploySlot(async () => {
    order.push('deploy-start');
    await delay(60);
    order.push('deploy-end');
  });
  await delay(10); // let the deploy actually enter its slot first
  const gc = withGcSlot(async () => {
    order.push('gc-start');
    await delay(5);
    order.push('gc-end');
  });
  await Promise.all([deploy, gc]);
  assert.deepEqual(order, ['deploy-start', 'deploy-end', 'gc-start', 'gc-end']);
});

test('a running GC blocks new deploys until it completes', async () => {
  const order: string[] = [];
  const gc = withGcSlot(async () => {
    order.push('gc-start');
    await delay(60);
    order.push('gc-end');
  });
  await delay(10);
  const deploy = withDeploySlot(async () => {
    order.push('deploy-start');
  });
  await Promise.all([gc, deploy]);
  assert.deepEqual(order, ['gc-start', 'gc-end', 'deploy-start']);
});

test('multiple deploys may still run concurrently (readers are not mutually exclusive)', async () => {
  const started: number[] = [];
  await Promise.all(
    Array.from({ length: 3 }, () =>
      withDeploySlot(async () => {
        started.push(Date.now());
        await delay(40);
      }),
    ),
  );
  // all three entered within the first 40ms window (concurrently)
  assert.ok(started.every((t) => Math.max(...started) - t < 40));
});
