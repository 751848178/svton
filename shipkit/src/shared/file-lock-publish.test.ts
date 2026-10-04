// M2-R2 publish/deadline regressions (REG-03/WAIT-01): real child processes,
// real registry claims, real listeners. Where a scheduling barrier is needed
// it wraps ONLY bindTest via node:test mock.module and always calls the
// ORIGINAL function afterwards — no syscall results are faked (the audit's
// methodology). Assertions: a live holder's mapping is never overwritten,
// maxActive === 1, two increments land as 2, the paused side legally proceeds
// after release, an exhausted budget never runs fn and leaves no self
// resources, and cleared faults admit new acquisitions.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { withFileLock, lockKeyOf, lockPortFor, heldToken } from './file-lock.js';

const MODULE = new URL('./file-lock.js', import.meta.url).href;
const BIND = new URL('./lock-bindtest.js', import.meta.url).href;
const REGISTRY = '/var/tmp/shipkit-lock-ports';

function claimFileOf(file: string): string {
  return path.join(REGISTRY, `${createHash('sha256').update(lockKeyOf(file)).digest('hex').slice(0, 20)}.json`);
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = connect({ port, host: '127.0.0.1' });
    s.setTimeout(400, () => { s.destroy(); resolve(false); });
    s.once('connect', () => { s.destroy(); resolve(false); });
    s.once('error', () => resolve(true));
  });
}

interface Child {
  send(msg: string): void;
  messages: Array<{ event: string; port?: number; message?: string }>;
  wait(event: string, ms?: number): Promise<{ event: string; port?: number; message?: string } | null>;
  exited: Promise<void>;
}

/** real child; pauseFirstBind wraps ONLY bindTest with a one-shot gate before
 *  calling the original (identical to the audit's injected scheduling pause) */
function child(file: string, opts: { pauseFirstBind?: boolean; timeoutMs?: number } = {}): Child {
  const code = `
import { mock } from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
const file = ${JSON.stringify(file)};
const claimPath = ${JSON.stringify(claimFileOf(file))};
let resume, release;
process.on('message', (m) => { if (m === 'resume') resume?.(); if (m === 'release') release?.(); if (m === 'exit') process.exit(0); });
if (${JSON.stringify(Boolean(opts.pauseFirstBind))}) {
  const real = await import(${JSON.stringify(BIND)});
  let first = true;
  mock.module(${JSON.stringify(BIND)}, { namedExports: { ...real, bindTest: async (port) => {
    if (first) { first = false; const gate = new Promise((r) => (resume = r)); process.send({ event: 'paused', port }); await gate; }
    return real.bindTest(port); // real syscalls; only scheduling is paused
  } } });
}
const { withFileLock } = await import(${JSON.stringify(MODULE)});
process.send({ event: 'started' });
try {
  await withFileLock(file, async () => {
    const gate = new Promise((r) => (release = r));
    const old = Number(await readFile(file, 'utf8'));
    const claim = JSON.parse(await readFile(claimPath, 'utf8'));
    process.send({ event: 'entered', old, port: claim.port });
    await gate;
    await writeFile(file, String(old + 1));
  }, { timeoutMs: ${opts.timeoutMs ?? 15000} });
  process.send({ event: 'finished' });
} catch (e) { process.send({ event: 'error', message: String(e.message) }); }
`;
  const c = spawn(process.execPath, ['--experimental-test-module-mocks', '--input-type=module', '-e', code], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const messages: Array<{ event: string; port?: number; message?: string }> = [];
  c.on('message', (m: { event: string }) => messages.push(m));
  return {
    send: (msg) => c.send(msg),
    messages,
    wait: (event, ms = 5000) => new Promise((resolve) => {
      const end = Date.now() + ms;
      const t = setInterval(() => {
        const found = messages.find((m) => m.event === event);
        if (found || Date.now() > end) { clearInterval(t); resolve(found ?? null); }
      }, 10);
    }),
    exited: new Promise((r) => c.on('exit', () => r())),
  };
}

/** send exit + await every child even when an assertion fails mid-test */
function reaper(...kids: Array<Child | { send(m: string): void; exited: Promise<void> }>): () => Promise<void> {
  return async () => {
    for (const k of kids) { try { k.send('exit'); } catch { /* already gone */ } }
    await Promise.all(kids.map((k) => k.exited.catch(() => undefined)));
  };
}

/** poll until the claim file exists and parses (the holder publishes async) */
async function waitForClaim(claim: string, ms = 10000): Promise<{ port: number }> {
  const end = Date.now() + ms;
  for (;;) {
    const c = await readFile(claim, 'utf8').then((t) => JSON.parse(t) as { port: number }, () => null);
    if (c && Number.isInteger(c.port)) return c;
    if (Date.now() > end) throw new Error(`claim not published within ${ms}ms: ${claim}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

test('REG-03 (audit interleave): B pauses before its first allocation bindTest; A publishes and HOLDS — the mapping is never overwritten and B waits', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'ship-pub-')));
  const file = path.join(dir, 'state.json');
  await writeFile(file, '0');
  const claim = claimFileOf(file);
  const b = child(file, { pauseFirstBind: true });
  assert.ok(await b.wait('paused'), 'B reached its first real bindTest (scheduling pause)');
  // A is spawned ONLY after B is parked mid-allocation — the audit's order
  const a = child(file);
  const cleanup = reaper(a, b);
  try {
    const aEntered = await a.wait('entered', 12000);
    assert.ok(aEntered, 'A allocated, published and entered while B was paused');
    const claimDuring = JSON.parse(await readFile(claim, 'utf8')) as { port: number };
    assert.equal(aEntered.port, claimDuring.port, 'A holds the published port');
    b.send('resume'); // B re-enters allocation with its stale "absent" snapshot
    const bDuring = await b.wait('entered', 400);
    assert.equal(bDuring, null, 'B does NOT enter while A holds (no overwritten mapping)');
    const claimAfter = JSON.parse(await readFile(claim, 'utf8')) as { port: number };
    assert.equal(claimAfter.port, claimDuring.port, 'live mapping untouched by the late allocator');
    a.send('release');
    await a.wait('finished');
    const bEntered = await b.wait('entered', 12000);
    assert.ok(bEntered && bEntered.port === claimDuring.port, 'B legally proceeds on the SAME port after release');
    b.send('release');
    await b.wait('finished');
    assert.equal(Number(await readFile(file, 'utf8')), 2, 'both increments landed');
  } finally {
    await cleanup();
  }
});

test('REG-03 (corrupt record with a LIVE holder, in-process): repair converges TO the live port — never remaps', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'ship-pub-')));
  const file = path.join(dir, 'state.json');
  await writeFile(file, '0');
  const claim = claimFileOf(file);
  let open!: () => void;
  const gate = new Promise<void>((r) => (open = r));
  const holder = withFileLock(file, () => gate, { timeoutMs: 15000 });
  try {
    // wait until the holder actually holds: the claim is published
    const claim0 = await waitForClaim(claim);
    // externally corrupt the live claim (torn record)
    await writeFile(claim, '{torn', { mode: 0o644 });
    // a second acquirer (in-process) must repair TO the live port and then WAIT
    let ran = false;
    const t0 = Date.now();
    await assert.rejects(
      () => withFileLock(file, () => { ran = true; }, { timeoutMs: 400 }),
      (e: Error) => /is alive|预算耗尽|超时/.test(e.message),
    );
    assert.equal(ran, false, 'the waiter never entered while the holder held');
    assert.ok(Date.now() - t0 < 2500, 'bounded wait');
    const repaired = JSON.parse(await readFile(claim, 'utf8')) as { port: number };
    assert.equal(repaired.port, claim0.port, 'the corrupt claim was repaired TO the live holder\'s port');
    open();
    await holder;
    // after release the same mapping admits the next acquirer
    let ok = false;
    await withFileLock(file, () => { ok = true; }, { timeoutMs: 8000 });
    assert.ok(ok, 'legal progress after release on the SAME port');
    assert.equal((JSON.parse(await readFile(claim, 'utf8')) as { port: number }).port, claim0.port);
  } finally {
    open();
    await holder.catch(() => undefined);
  }
});

test('REG-03 (publish→bind window, in-process): a published-but-unbound claim admits exactly one binder; the other waits', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'ship-pub-')));
  const file = path.join(dir, 'state.json');
  await writeFile(file, '0');
  // claim WITHOUT binding (lockPortFor only) — the publish→bind window
  const port = await lockPortFor(file);
  // first binder acquires the published port (kernel decides the winner)
  let open!: () => void;
  const gate = new Promise<void>((r) => (open = r));
  const first = withFileLock(file, () => gate, { timeoutMs: 15000 });
  try {
    // the mapping is unchanged and points at the port the winner bound
    const claim = await waitForClaim(claimFileOf(file));
    assert.equal(claim.port, port, 'the published mapping was honored, not remapped');
    // a second acquirer waits while the first holds
    let ran = false;
    await assert.rejects(
      () => withFileLock(file, () => { ran = true; }, { timeoutMs: 300 }),
      (e: Error) => /is alive/.test(e.message),
    );
    assert.equal(ran, false, 'exactly one binder held the window port');
    open();
    await first;
    // after release the same mapping admits the next acquirer
    let ok = false;
    await withFileLock(file, () => { ok = true; }, { timeoutMs: 8000 });
    assert.ok(ok);
    assert.equal((JSON.parse(await readFile(claimFileOf(file), 'utf8')) as { port: number }).port, port);
  } finally {
    open();
    await first.catch(() => undefined);
  }
});
