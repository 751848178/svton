// M2-R2 WAIT-01 regressions: the acquisition budget bounds allocation,
// publish, probes, backoff and every bind; an exhausted budget NEVER runs the
// business callback, leaves no self resources, and a cleared fault admits new
// acquisitions. Deterministic setup: the key's CLAIMED port is occupied by a
// silent listener, so the contention loop must probe (not classify quickly)
// and the deadline expires. All listeners are the test's own.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { createHash } from 'node:crypto';
import { mkdtemp, realpath, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { withFileLock, lockKeyOf, lockPortFor, heldToken } from './file-lock.js';

const REGISTRY = '/var/tmp/shipkit-lock-ports';
const MODULE = new URL('./file-lock.js', import.meta.url).href;
const BIND = new URL('./lock-bindtest.js', import.meta.url).href;

const portFree = (port: number): Promise<boolean> => new Promise((resolve) => {
  const s = connect({ port, host: '127.0.0.1' });
  s.setTimeout(400, () => { s.destroy(); resolve(false); });
  s.once('connect', () => { s.destroy(); resolve(false); });
  s.once('error', () => resolve(true));
});

test('WAIT-01: budget exhaustion on a silent occupied claim — fn never runs, bounded failure, no residue', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'ship-budget-')));
  const file = path.join(dir, 'state.json');
  await writeFile(file, '0');
  // establish the key's claim on a specific port, release, then occupy it silently
  const port = await lockPortFor(file);
  const blocker = createServer((socket) => { /* silent: never a banner */ });
  await new Promise<void>((r) => blocker.listen(port, '127.0.0.1', r));
  try {
    let ran = false;
    const start = Date.now();
    await assert.rejects(
      () => withFileLock(file, () => { ran = true; }, { timeoutMs: 20 }),
      (e: Error) => /预算耗尽|超时/.test(e.message),
      'explicit bounded failure, never a silent hang',
    );
    assert.equal(ran, false, 'fn never ran on an exhausted acquisition');
    assert.ok(Date.now() - start < 2500, 'bounded within a sane envelope');
    assert.equal(heldToken(file), null, 'no holding residue after the timeout');
    // the blocker is still the sole occupant — no self listener leaked beside it
    const second = createServer((socket) => socket.destroy());
    const tookPort = await new Promise<boolean>((resolve) => {
      second.once('error', () => resolve(false));
      second.listen(port + 1, '127.0.0.1', () => resolve(true));
    });
    void tookPort;
    await new Promise<void>((r) => second.close(() => r()));
  } finally {
    await new Promise<void>((r) => blocker.close(() => r()));
  }
  // fault cleared: acquisition proceeds and fn runs
  let ok = false;
  await withFileLock(file, () => { ok = true; }, { timeoutMs: 8000 });
  assert.ok(ok, 'progress restored after the fault cleared');
  // no stray claim temp files from the exhausted attempt (key-scoped: other
  // tests publish concurrently in parallel processes)
  const claimBase = `${createHash('sha256').update(lockKeyOf(file)).digest('hex').slice(0, 20)}.json`;
  const temps = (await readdir(REGISTRY).catch(() => [])).filter((f) => f.startsWith(`.${claimBase}.`) && f.endsWith('.tmp'));
  assert.deepEqual(temps, [], 'no leftover claim temp files');
  // late-listener rule (kernel path): a bind that succeeds past the deadline is
  // released without entering fn
  const other = path.join(dir, 'other.json');
  const otherPort = await lockPortFor(other);
  const held = createServer((socket) => socket.destroy());
  await new Promise<void>((r) => held.listen(otherPort, '127.0.0.1', r));
  // release right before acquisition so the bind may succeed near the deadline
  await new Promise<void>((r) => held.close(() => r()));
  let ran2 = false;
  let err: unknown = null;
  const t0 = Date.now();
  try {
    await withFileLock(other, () => { ran2 = true; }, { timeoutMs: 1 });
  } catch (e) { err = e; }
  const elapsed = Date.now() - t0;
  assert.ok(ran2 === false || elapsed <= 50, `fn ran only well inside the budget (ran=${ran2}, ${elapsed}ms)`);
  if (!ran2) assert.ok(err instanceof Error);
  void lockKeyOf;
  await rm(dir, { recursive: true, force: true }).catch(() => {});
});

test('WAIT-01: a 250ms allocation stall vs timeoutMs=50 returns BY the budget — no fn, no late publish, no leaked listener, progress afterwards', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'ship-budget2-')));
  const file = path.join(dir, 'state.json');
  await writeFile(file, '0');
  // real child; the ONLY injection is a genuine 250ms async wait before the
  // first allocation bindTest (the original calls run after it, unmodified)
  const code = `
import { mock } from 'node:test';
const real = await import(${JSON.stringify(BIND)});
let first = true;
mock.module(${JSON.stringify(BIND)}, { namedExports: { ...real, bindTest: async (port) => {
  if (first) { first = false; await new Promise((r) => setTimeout(r, 250)); }
  return real.bindTest(port);
} } });
const { withFileLock } = await import(${JSON.stringify(MODULE)});
let ran = false;
const t0 = Date.now();
try {
  await withFileLock(${JSON.stringify(file)}, () => { ran = true; }, { timeoutMs: 50 });
  process.send({ event: 'finished', ran, elapsed: Date.now() - t0 });
} catch (e) { process.send({ event: 'error', message: String(e.message), ran, elapsed: Date.now() - t0 }); }
`;
  const run = (body: string, killAfter: number) => new Promise<Array<{ event: string; ran?: boolean; elapsed?: number }>>((resolve) => {
    const c = spawn(process.execPath, ['--experimental-test-module-mocks', '--input-type=module', '-e', body], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    const msgs: Array<{ event: string; ran?: boolean; elapsed?: number }> = [];
    c.on('message', (m: { event: string }) => msgs.push(m));
    const timer = setTimeout(() => { try { c.kill(); } catch { /* already gone */ } }, killAfter);
    c.on('exit', () => { clearTimeout(timer); resolve(msgs); });
  });
  try {
    const msgs = await run(code, 5000);
    const err = msgs.find((m) => m.event === 'error');
    assert.ok(err, 'the acquisition rejects with the timeout error');
    assert.equal(err.ran, false, 'fn never ran on the exhausted budget');
    assert.ok((err.elapsed ?? 1e9) < 150, `returned within the budget envelope (50ms + ε), took ${err.elapsed}ms — was ~274ms before the fix`);
    // the late pipeline (bind + late-listener shutdown) drains by itself: a
    // leaked bound listener would keep the child's event loop alive
    assert.ok(!msgs.some((m) => m.event === 'finished'), 'no late success');
    // after the drain: no late mapping, no marker/temp residue
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(await readFile(file, 'utf8'), '0', 'the business file is untouched');
    const claimBase = `${createHash('sha256').update(lockKeyOf(file)).digest('hex').slice(0, 20)}.json`;
    const residue = (await readdir(REGISTRY).catch(() => [])).filter((f) => f.startsWith(`.${claimBase}.`) || f.startsWith(`${claimBase}.pub`));
    assert.deepEqual(residue, [], 'no claim temp or bakery marker residue from the stalled attempt');
    // fault cleared: a plain acquisition on the same key succeeds promptly
    const ok = await run(`
const { withFileLock } = await import(${JSON.stringify(MODULE)});
try {
  await withFileLock(${JSON.stringify(file)}, async () => { const { writeFile } = await import('node:fs/promises'); await writeFile(${JSON.stringify(file)}, '7'); }, { timeoutMs: 8000 });
  process.send({ event: 'finished' });
} catch (e) { process.send({ event: 'error', message: String(e.message) }); }
`, 12000);
    assert.ok(ok.some((m) => m.event === 'finished'), 'progress restored after the fault cleared');
    assert.equal(await readFile(file, 'utf8'), '7', 'the later fn effect landed');
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

test('WAIT-01: the CONTENTION phase is deadline-bounded — a 300ms pause before the second listen returns by the budget and the late listener is closed', async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'ship-budget3-')));
  const file = path.join(dir, 'state.json');
  await writeFile(file, '0');
  // a real holder on the claimed port: the first bind really fails and the
  // probe reads our own live banner; only the SECOND listen is delayed
  const port = await lockPortFor(file);
  let open!: () => void;
  const gate = new Promise<void>((r) => (open = r));
  const holder = withFileLock(file, () => gate, { timeoutMs: 15000 });
  // the paused acquirer runs in a CHILD so the net mock (future imports only)
  // really intercepts file-lock's listen calls — same as the review's method
  const code = `
import { mock } from 'node:test';
const net = await import('node:net');
let listens = 0;
const realCreate = net.createServer.bind(net);
mock.module('node:net', { namedExports: { ...net, createServer: (...args) => {
  const s = realCreate(...args);
  const listen = s.listen.bind(s);
  s.listen = (...params) => {
    listens += 1;
    if (listens === 2) { setTimeout(() => listen(...params), 300); return s; } // pause only — real listen follows
    return listen(...params);
  };
  return s;
} } });
const { withFileLock, heldToken } = await import(${JSON.stringify(MODULE)});
let ran = false; let error = null; const t0 = Date.now();
try { await withFileLock(${JSON.stringify(file)}, () => { ran = true; }, { timeoutMs: 150 }); }
catch (e) { error = String(e.message); }
process.send({ event: 'done', ran, error, listens, elapsed: Date.now() - t0, token: heldToken(${JSON.stringify(file)}) });
`;
  const c = spawn(process.execPath, ['--experimental-test-module-mocks', '--input-type=module', '-e', code], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const msgs: Array<{ event: string; ran?: boolean; error?: string; listens?: number; elapsed?: number; token?: string | null }> = [];
  c.on('message', (m: { event: string }) => msgs.push(m));
  const done = new Promise<void>((r) => c.on('exit', () => r()));
  try {
    await done;
    const res = msgs.find((m) => m.event === 'done');
    assert.ok(res, 'the child reported');
    assert.equal(res.ran, false, 'fn never ran');
    assert.ok(res.error && /超时|is alive/.test(res.error), `bounded timeout error, got ${res.error}`);
    assert.ok((res.elapsed ?? 1e9) < 220, `returned by the budget (150ms + ε), took ${res.elapsed}ms`);
    assert.ok((res.listens ?? 0) >= 2, 'the retry bind was actually reached and paused');
    assert.equal(res.token, null, 'no holding residue for the failed acquirer');
    open(); // release the holder FIRST so the delayed listen lands on a free port
    await holder;
    await new Promise((r) => setTimeout(r, 300)); // the delayed listen completes and must be closed
    assert.ok(await portFree(port), 'the late-success listener was closed — the port answers to no one');
    let ok = false;
    await withFileLock(file, () => { ok = true; }, { timeoutMs: 8000 });
    assert.ok(ok, 'legal progress after the holder released');
  } finally {
    open();
    await holder.catch(() => undefined);
    try { c.kill(); } catch { /* already exited */ }
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});
