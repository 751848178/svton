// M2-R2 base regressions under the kernel-mutex (TCP bind) protocol. All
// holders are REAL child processes or real in-process acquisitions; nothing
// is mocked. Injection-point mapping from the file-based rounds: "alive
// holder", "crashed holder", "competing takers", "late release", "concurrent
// counter" and "unidentifiable occupant" all map 1:1 — the states they used
// to manipulate are now kernel-owned.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { withFileLock, releaseLockIfOwner, heldToken } from './file-lock.js';

const MODULE = new URL('./file-lock.js', import.meta.url).href;

interface HolderChild {
  kill(): void;
  done: Promise<{ code: number | null }>;
  entered: Promise<boolean>;
}

/** a REAL child that acquires the lock, reports 'entered' over IPC, then idles
 *  inside its section (mode 'idle') or exits immediately after acquiring
 *  (mode 'bind-die' — crash between acquisition and section body) */
function holderChild(file: string, mode: 'idle' | 'bind-die'): HolderChild {
  const script = `
import { withFileLock } from ${JSON.stringify(MODULE)};
const keepAlive = setInterval(() => {}, 1e9);
await withFileLock(${JSON.stringify(file)}, () => {
  process.send({ event: 'entered' });
  if (${JSON.stringify(mode)} === 'bind-die') process.exit(0);
  return new Promise(() => {});
});
clearInterval(keepAlive);
`;
  const scriptPath = path.join(path.dirname(file), `holder-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(scriptPath, script); // synchronous: no spawn/write race
  const child = spawn(process.execPath, [scriptPath], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const entered = new Promise<boolean>((resolve) => {
    const t = setTimeout(() => resolve(false), 10_000);
    child.on('message', (m: { event?: string }) => {
      if (m?.event === 'entered') { clearTimeout(t); resolve(true); }
    });
    child.on('exit', () => { clearTimeout(t); resolve(false); });
  });
  return {
    kill: () => child.kill('SIGKILL'),
    done: new Promise((resolve) => child.on('exit', (code) => resolve({ code }))),
    entered,
  };
}

test('M2-R2: an ALIVE holder keeps the lock; the waiter times out without stealing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-lock-'));
  const file = path.join(dir, 'state.json');
  // in-process alive holder: a concurrent call in the SAME process serializes too
  let open!: () => void;
  let markEntered!: () => void;
  const gate = new Promise<void>((r) => (open = r));
  const entered = new Promise<void>((r) => (markEntered = r));
  const holder = withFileLock(file, () => { markEntered(); return gate; }, { timeoutMs: 5000 });
  try {
    await Promise.race([entered, holder]);
    const token = heldToken(file);
    assert.ok(token, 'holder entered and owns the lock before the waiter starts');
    let waiterRan = false;
    await assert.rejects(
      () => withFileLock(file, () => { waiterRan = true; }, { timeoutMs: 300 }),
      (e: Error) => /超时/.test(e.message) && /不会抢占/.test(e.message),
    );
    assert.equal(waiterRan, false, 'the waiter never enters the held section');
    assert.equal(heldToken(file), token, 'the original holder still owns the lock');
  } finally {
    open();
    await holder;
    await rm(dir, { recursive: true, force: true });
  }
});

test('M2-R2: a holder that CRASHED (SIGKILL) is released by the kernel at once', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-lock-'));
  const file = path.join(dir, 'state.json');
  const holder = holderChild(file, 'idle');
  assert.ok(await holder.entered, 'holder child entered its section');
  holder.kill();
  await holder.done;
  const start = Date.now();
  let ran = false;
  await withFileLock(file, () => { ran = true; }, { timeoutMs: 5000 });
  assert.ok(ran);
  assert.ok(Date.now() - start < 4000, 'kernel release is immediate — no age threshold');
});

test('M2-R2: competing takers serialize — no overlap, no lost updates', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-lock-'));
  const file = path.join(dir, 'state.json');
  const log = path.join(dir, 'log.jsonl');
  const workers = Array.from({ length: 4 }, (_, i) => withFileLock(file, async () => {
    const lines = (await readFile(log, 'utf8').catch(() => '')).split('\n').filter(Boolean);
    const enteredNames = lines.filter((l) => l.endsWith('enter')).map((l) => l.split(' ')[0]);
    const exitedNames = lines.filter((l) => l.endsWith('exit')).map((l) => l.split(' ')[0]);
    const active = enteredNames.filter((w) => !exitedNames.includes(w));
    if (active.length > 0) throw new Error(`critical section overlapped with ${active}`);
    await writeFile(log, `${lines.join('\n')}${lines.length ? '\n' : ''}w${i} enter\nw${i} exit\n`);
  }, { timeoutMs: 15_000 }));
  await Promise.all(workers);
  const lines = (await readFile(log, 'utf8')).split('\n').filter(Boolean);
  assert.equal(lines.length, 8, 'every worker entered and exited exactly once');
});

test('M2-R2: a LATE release under an old token cannot touch the current holding', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-lock-'));
  const file = path.join(dir, 'state.json');
  let firstToken: string | null = null;
  await withFileLock(file, async () => { firstToken = heldToken(file); });
  assert.ok(firstToken, 'captured the first holder\'s token');
  let secondDone = false;
  const second = withFileLock(file, async () => {
    assert.equal(await releaseLockIfOwner(file, firstToken!), false, 'old token must not release the new holding');
    secondDone = true;
  }, { timeoutMs: 5000 });
  assert.deepEqual(await second.then(() => 'ok'), 'ok');
  assert.ok(secondDone);
  assert.equal(heldToken(file), null, 'released cleanly');
});

test('M2-R2 (baseline): normal concurrent locking serializes a counter without lost updates', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-lock-'));
  const file = path.join(dir, 'state.json');
  const counter = path.join(dir, 'count');
  await writeFile(counter, '0');
  await Promise.all(Array.from({ length: 12 }, () => withFileLock(file, async () => {
    const n = Number(await readFile(counter, 'utf8')) + 1;
    await writeFile(counter, String(n));
  }, { timeoutMs: 15_000 })));
  assert.equal(await readFile(counter, 'utf8'), '12');
});

test('M2-R2: a foreign occupant of the CLAIMED port is NEVER stolen (clear error)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-lock-'));
  const file = path.join(dir, 'state.json');
  const { createServer } = await import('node:net');
  // establish the key's claim first (any port), release, THEN occupy it
  await withFileLock(file, () => {}, { timeoutMs: 5000 });
  const { lockPortFor } = await import('./file-lock.js');
  const port = await lockPortFor(file);
  const foreign = createServer((s) => s.end('not-a-shiplock\n'));
  await new Promise<void>((r) => foreign.listen(port, '127.0.0.1', r));
  try {
    await assert.rejects(
      () => withFileLock(file, async () => {}, { timeoutMs: 2000 }),
      (e: Error) => /无关服务占用|refusing to steal/.test(e.message),
    );
  } finally {
    (foreign as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    await new Promise<void>((r) => foreign.close(() => r()));
  }
  let ok = false;
  await withFileLock(file, () => { ok = true; }, { timeoutMs: 5000 });
  assert.ok(ok, 'acquirable again once the foreign listener is gone');
});
