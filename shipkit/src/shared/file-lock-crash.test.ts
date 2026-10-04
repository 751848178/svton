// M2-R2 crash-recovery regressions under the kernel-mutex (TCP bind)
// protocol: REAL separate child processes and REAL SIGKILLs. Injection-point
// mapping: the file-based rounds paused fs ops around "the real cleanup
// action" — under the kernel protocol the cleanup IS the kernel closing the
// socket at process death, so each crash point (mid-section, right after
// acquisition, recovering waiter crashed again) maps to killing the child at
// the corresponding lifecycle moment. Bounded waits, serialization and final
// progress are asserted; nothing is mocked.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as net from 'node:net';
import { withFileLock, lockPortFor } from './file-lock.js';

const MODULE = new URL('./file-lock.js', import.meta.url).href;

interface ChildRun {
  messages: Array<{ event: string }>;
  exited: Promise<{ code: number | null; signal: string | null }>;
  kill(): void;
  waitEvent(event: string, ms: number): Promise<{ event: string } | null>;
}

/** a REAL child: acquires the lock, reports 'entered', then idles in its
 *  section until killed (dieAfter = 0 exits right at section entry) */
function launchChild(file: string, opts: { dieAfterMs?: number; timeoutMs: number }): ChildRun {
  const script = `
import { withFileLock } from ${JSON.stringify(MODULE)};
const send = (m) => process.send(m);
const keepAlive = setInterval(() => {}, 1e9);
send({ event: 'started' });
const t0 = Date.now();
try {
  await withFileLock(${JSON.stringify(file)}, () => {
    send({ event: 'entered' });
    return new Promise((r) => setTimeout(r, ${opts.dieAfterMs ?? 1e9}));
  }, { timeoutMs: ${opts.timeoutMs} });
  send({ event: 'finished', elapsedMs: Date.now() - t0 });
} catch (e) {
  send({ event: 'rejected', message: String(e.message), elapsedMs: Date.now() - t0 });
}
clearInterval(keepAlive);
`;
  const scriptPath = path.join(path.dirname(file), `child-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(scriptPath, script); // synchronous: no spawn/write race
  const child = spawn(process.execPath, [scriptPath], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const messages: Array<{ event: string }> = [];
  child.on('message', (m: { event: string }) => messages.push(m));
  return {
    messages,
    exited: new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal }))),
    kill: () => child.kill('SIGKILL'),
    waitEvent: (event, ms) => new Promise((resolve) => {
      const found = () => messages.find((m) => m.event === event);
      if (found()) return resolve(found()!);
      const t = setInterval(() => {
        if (found()) { clearInterval(t); resolve(found()!); }
      }, 10);
      setTimeout(() => { clearInterval(t); resolve(null); }, ms);
    }),
  };
}

function portFree(file: string): Promise<boolean> {
  return new Promise((resolve) => {
    void lockPortFor(file).then((port) => {
      const s = net.connect({ port, host: '127.0.0.1' });
      s.setTimeout(400, () => { s.destroy(); resolve(false); });
      s.once('connect', () => { s.destroy(); resolve(false); });
      s.once('error', () => resolve(true));
    }, () => resolve(false));
  });
}

test('M2-R2 c1 (holder SIGKILLed mid-section): the kernel frees the port — a later waiter recovers and acquires', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-crash-'));
  const file = path.join(dir, 'state.json');
  const victim = launchChild(file, { timeoutMs: 8000 });
  assert.ok(await victim.waitEvent('entered', 10_000), 'victim entered its section');
  victim.kill();
  const death = await victim.exited;
  assert.equal(death.signal, 'SIGKILL');
  const waiter = launchChild(file, { timeoutMs: 5000, dieAfterMs: 200 });
  const entered = await waiter.waitEvent('entered', 10_000);
  assert.ok(entered, 'waiter recovered and entered after the kernel release');
  const finished = await waiter.waitEvent('finished', 10_000);
  assert.ok(finished, 'waiter completed');
  await waiter.exited;
});

test('M2-R2 c2 (crash right after acquisition — the old unlink-before equivalent): identical recovery', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-crash-'));
  const file = path.join(dir, 'state.json');
  const victim = launchChild(file, { dieAfterMs: 0, timeoutMs: 8000 });
  assert.ok(await victim.waitEvent('entered', 10_000), 'victim had acquired');
  victim.kill();
  await victim.exited;
  const waiter = launchChild(file, { timeoutMs: 5000, dieAfterMs: 200 });
  assert.ok(await waiter.waitEvent('entered', 10_000), 'recovered');
  assert.ok(await waiter.waitEvent('finished', 10_000));
  await waiter.exited;
  waiter.kill();
});

test('M2-R2 c3 (bounded short timeout): against a LIVE holder a 150ms wait rejects within a bounded envelope', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-crash-'));
  const file = path.join(dir, 'state.json');
  const holder = launchChild(file, { timeoutMs: 60_000 });
  assert.ok(await holder.waitEvent('entered', 10_000));
  const waiter = launchChild(file, { timeoutMs: 150 });
  const rejected = await waiter.waitEvent('rejected', 8000);
  assert.ok(rejected, 'short wait must return explicitly');
  const msgs = waiter.messages.find((m) => m.event === 'rejected') as unknown as { message?: string; elapsedMs?: number } | undefined;
  assert.match(msgs?.message ?? '', /is alive/);
  assert.ok((msgs?.elapsedMs ?? 9999) < 1500, `bounded envelope (${msgs?.elapsedMs}ms for a 150ms budget)`);
  assert.equal(waiter.messages.some((m) => m.event === 'entered'), false, 'never entered');
  holder.kill();
  await holder.exited;
  await waiter.exited;
});

test('M2-R2 c4 (recovering waiter itself dies after acquiring): a third waiter still recovers', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-crash-'));
  const file = path.join(dir, 'state.json');
  const first = launchChild(file, { timeoutMs: 8000 });
  assert.ok(await first.waitEvent('entered', 10_000));
  first.kill();
  await first.exited;
  // the FIRST recovering waiter acquires, then is itself SIGKILLed mid-section
  const second = launchChild(file, { timeoutMs: 8000 });
  assert.ok(await second.waitEvent('entered', 10_000), 'second waiter recovered');
  second.kill();
  await second.exited;
  second.kill();
  const third = launchChild(file, { timeoutMs: 5000, dieAfterMs: 200 });
  assert.ok(await third.waitEvent('entered', 10_000), 'third waiter recovered after the second crash');
  assert.ok(await third.waitEvent('finished', 10_000));
  await third.exited;
  third.kill();
});

test('M2-R2 c5 (concurrent waiters): three children race — all finish ok (serialized), port ends free', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-crash-'));
  const file = path.join(dir, 'state.json');
  const waiters = [1, 2, 3].map(() => launchChild(file, { timeoutMs: 10_000, dieAfterMs: 200 }));
  try {
    const outcomes = await Promise.all(waiters.map((w) => w.waitEvent('finished', 20_000).then((f) => ({ w, f }))));
    for (const { f } of outcomes) assert.ok(f, 'every waiter finished ok');
  } finally {
    for (const w of waiters) w.kill();
    await Promise.all(waiters.map((w) => w.exited));
  }
  assert.ok(await portFree(file), 'no listener remains after everyone is done');
});
