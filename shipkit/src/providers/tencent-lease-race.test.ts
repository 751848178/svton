import test from 'node:test';
import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readState, writeState } from './builder-state.js';

interface Event { event: string; error?: string }
type Worker = ChildProcess & { events: Event[] };
function worker(file: string, mode = 'task'): Worker {
  const child = fork(new URL('./test-fixtures/lease-race-child.js', import.meta.url), [], {
    execArgv: ['--experimental-test-module-mocks'],
    env: { ...process.env, TASK_STATE_FILE: file, TASK_MODE: mode },
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  }) as Worker;
  child.events = [];
  child.on('message', (message) => child.events.push(message as Event));
  return child;
}
async function event(child: Worker, ...names: string[]): Promise<Event> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const found = child.events.find(e => names.includes(e.event));
    if (found) return found;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error(`worker event timeout (${names}): ${JSON.stringify(child.events)}`);
}

test('RA04: admission and lease claim serialize; an earlier completion cannot release a working competitor', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-provider-lease-race-'));
  const file = path.join(dir, 'builder.json');
  const children: Worker[] = [];
  t.after(async () => {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await rm(dir, { recursive: true, force: true });
  });
  await writeState(file, {
    instanceId: 'ins-synthetic-existing', region: 'mock', url: 'http://127.0.0.1:9', token: 'mock', status: 'ready',
    createdAt: new Date().toISOString(), expireAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
  });
  const a = worker(file); children.push(a);
  await event(a, 'at-health');
  const b = worker(file); children.push(b);
  await event(b, 'ready');
  a.send('health-done');
  const first = await event(a, 'at-acquire', 'task-started');
  if (first.event === 'at-acquire') {
    // Before the fix A no longer holds the state lock. Both admissions can
    // complete before either claim; release the two claims in a fixed order.
    await event(b, 'at-health'); b.send('health-done');
    await event(b, 'at-acquire');
    a.send('claim'); await event(a, 'task-started');
    b.send('claim'); await event(b, 'task-started');
    a.send('finish'); await event(a, 'task-finished');
  } else {
    const rejected = await event(b, 'rejected');
    assert.match(rejected.error ?? '', /BUSY/);
  }
  const releaser = worker(file, 'release'); children.push(releaser);
  const releaseOutcome = await event(releaser, 'released', 'rejected');
  assert.equal(b.events.some(e => e.event === 'task-started'), false, 'two live tasks must never enter on one builder');
  assert.equal(releaseOutcome.event, 'rejected', 'release must refuse while the admitted task is working');
  assert.equal(releaser.events.some(e => e.event === 'terminated'), false);
  assert.equal((await readState(file))?.lease?.pid, a.pid);
  a.send('finish'); await event(a, 'task-finished');
  assert.equal((await readState(file))?.lease, undefined);
});
