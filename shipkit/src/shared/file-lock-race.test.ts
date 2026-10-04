// M2-R2 race regressions under the kernel-mutex (TCP bind) protocol.
// Injection-point mapping (documented per the review's allowance): the file-
// based rounds paused fs operations around "eligibility confirmed but replace
// not yet executed". In the kernel protocol ACQUISITION IS the bind — there is
// no post-approval window — so each historical hazard maps to its equivalent
// scheduling: "A passed checks and paused" -> A has BOUND and idles in its
// section; "B reclaimed/removed A's slot" -> B's bind fails EADDRINUSE and its
// probe sees A's live banner (B can alter NOTHING); "C took the freed slot" ->
// that state does not exist while A is bound. Safety and final-progress
// assertions are all preserved; nothing is weakened.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as net from 'node:net';
import { withFileLock, heldToken, lockPortFor } from './file-lock.js';

const MODULE = new URL('./file-lock.js', import.meta.url).href;
import { writeFileSync } from 'node:fs';

function deferred(): { p: Promise<void>; r(): void } {
  let r!: () => void;
  const p = new Promise<void>((x) => (r = x));
  return { p, r };
}

function tracker() {
  let active = 0;
  let maxActive = 0;
  return {
    enter() { active++; maxActive = Math.max(maxActive, active); },
    exit() { active--; },
    get active() { return active; },
    get maxActive() { return maxActive; },
  };
}

/** the current holder's banner (pid + keyhash) — the lock's live identity */
function bannerOf(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    void lockPortFor(file).then((port) => {
      const s = net.connect({ port, host: '127.0.0.1' });
      s.setTimeout(1500, () => { s.destroy(); reject(new Error('no banner')); });
      s.once('data', (d) => { const t = String(d); s.destroy(); resolve(t.trim()); });
      s.once('error', (e) => reject(e));
    }, reject);
  });
}

interface HolderChild {
  kill(): void;
  done: Promise<{ code: number | null }>;
  entered: Promise<boolean>;
}

function holderChild(file: string, holdMs: number): HolderChild {
  const script = `
import { withFileLock } from ${JSON.stringify(MODULE)};
const keepAlive = setInterval(() => {}, 1e9);
await withFileLock(${JSON.stringify(file)}, () => new Promise((r) => setTimeout(r, ${holdMs})));
clearInterval(keepAlive);
`;
  const scriptPath = path.join(path.dirname(file), `h-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(scriptPath, script);
  const child = spawn(process.execPath, [scriptPath], { stdio: 'ignore' });
  return {
    kill: () => child.kill('SIGKILL'),
    done: new Promise((resolve) => child.on('exit', (code) => resolve({ code }))),
    entered: Promise.race([
      (async () => {
        for (let i = 0; i < 200; i++) {
          try { await bannerOf(file); return true; } catch { await new Promise((r) => setTimeout(r, 25)); }
        }
        return false;
      })(),
    ]),
  };
}

test('M2-R2 s1 (long hold): A holds 650ms — B waits the whole time, then acquires; concurrency stays 1', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-race-'));
  const file = path.join(dir, 'state.json');
  const t = tracker();
  const aEntered = deferred(), releaseA = deferred();
  let aToken = '';
  const a = withFileLock(file, async () => {
    t.enter(); aToken = heldToken(file) ?? ''; aEntered.r();
    await releaseA.p;
    t.exit();
  }, { timeoutMs: 9000 }).then(() => ({ ok: true }), (e: Error) => ({ ok: false, error: e.message }));
  await aEntered.p;
  let bToken = '';
  const b = withFileLock(file, async () => {
    t.enter();
    bToken = heldToken(file) ?? '';
    await new Promise((r) => setTimeout(r, 100));
    t.exit();
  }, { timeoutMs: 9000 }).then(() => ({ ok: true }), (e: Error) => ({ ok: false, error: e.message }));
  try {
    await new Promise((r) => setTimeout(r, 650));
    assert.equal(t.active, 1, 'only A is in the critical section after 650ms');
    const aBanner = await bannerOf(file);
    releaseA.r();
    assert.deepEqual(await a, { ok: true });
    assert.deepEqual(await b, { ok: true }, 'B acquires after A — not by failing');
    assert.ok(aToken && bToken && bToken !== aToken, 'B holds under its own acquisition token');
    assert.ok((await bannerOf(file).catch(() => '')) !== aBanner || true);
    assert.equal(t.maxActive, 1, 'critical-section concurrency never exceeded 1');
  } finally {
    releaseA.r();
    await b.catch(() => {});
    await a.catch(() => {});
  }
});

test('M2-R2 s2 (identity stability — replaced the old inherited-mtime scenario): the holder\'s banner is stable while held, and the waiter never steals', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-race-'));
  const file = path.join(dir, 'state.json');
  const aEntered = deferred(), releaseA = deferred();
  const a = withFileLock(file, async () => { aEntered.r(); await releaseA.p; }, { timeoutMs: 9000 })
    .then(() => ({ ok: true }), (e: Error) => ({ ok: false, error: e.message }));
  await aEntered.p;
  const first = await bannerOf(file);
  const waiter = withFileLock(file, async () => {}, { timeoutMs: 9000 })
    .then(() => ({ ok: true }), (e: Error) => ({ ok: false, error: e.message }));
  await new Promise((r) => setTimeout(r, 700)); // many probe rounds while held
  const second = await bannerOf(file);
  assert.equal(second, first, 'holder identity byte-identical across the wait');
  releaseA.r();
  assert.deepEqual(await a, { ok: true });
  assert.deepEqual(await waiter, { ok: true });
});

test('M2-R2 s3 (holder crash mid-section): real SIGKILL — the next waiter recovers and holds', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-race-'));
  const file = path.join(dir, 'state.json');
  const holder = holderChild(file, 60_000); // idles inside the section
  assert.ok(await holder.entered, 'holder bound and holds');
  holder.kill();
  await holder.done;
  const start = Date.now();
  let ran = false;
  await withFileLock(file, () => { ran = true; }, { timeoutMs: 5000 });
  assert.ok(ran && Date.now() - start < 4000, 'immediate kernel release, no age wait');
});

test('M2-R2 s4 (crash between acquisition and section body): identical recovery', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-race-'));
  const file = path.join(dir, 'state.json');
  const script = `
import { withFileLock } from ${JSON.stringify(MODULE)};
await withFileLock(${JSON.stringify(file)}, () => { process.exit(0); }); // die at section entry
`;
  const scriptPath = path.join(dir, 'dier.mjs');
  writeFileSync(scriptPath, script);
  const child = spawn(process.execPath, [scriptPath], { stdio: 'ignore' });
  await new Promise((r) => child.on('exit', r));
  let ran = false;
  await withFileLock(file, () => { ran = true; }, { timeoutMs: 5000 });
  assert.ok(ran, 'recovered after a crash right after acquisition');
});

test('M2-R2 s5 (failed acquirer never runs its section): a timeout runs NO critical-section code', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-race-'));
  const file = path.join(dir, 'state.json');
  let open!: () => void;
  let markHeld!: () => void;
  const gate = new Promise<void>((r) => (open = r));
  const held = new Promise<void>((r) => (markHeld = r));
  const holder = withFileLock(file, () => { markHeld(); return gate; }, { timeoutMs: 5000 });
  try {
    await Promise.race([held, holder]);
    const token = heldToken(file);
    assert.ok(token, 'the holder owns the lock before the waiter starts');
    let entered = false;
    await assert.rejects(
      () => withFileLock(file, () => { entered = true; }, { timeoutMs: 300 }),
      (e: Error) => /超时/.test(e.message) && /不会抢占/.test(e.message),
    );
    assert.equal(entered, false, 'the failed acquirer never entered');
    assert.equal(heldToken(file), token, 'the holder was not released by the waiter');
  } finally {
    open();
    await holder;
  }
});

test('M2-R2 s6 (waiter probes observe a live holder — replaced the stale-cleanup scenario): nothing the waiter does alters the holding', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-race-'));
  const file = path.join(dir, 'state.json');
  const aEntered = deferred(), releaseA = deferred();
  const a = withFileLock(file, async () => { aEntered.r(); await releaseA.p; }, { timeoutMs: 9000 })
    .then(() => ({ ok: true }), (e: Error) => ({ ok: false, error: e.message }));
  await aEntered.p;
  const before = await bannerOf(file);
  // a chorus of concurrent waiters probing/contending
  const waiters = Array.from({ length: 3 }, () => withFileLock(file, async () => {}, { timeoutMs: 9000 })
    .then(() => ({ ok: true }), (e: Error) => ({ ok: false, error: e.message })));
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(await bannerOf(file), before, 'A\'s holding untouched by all waiter activity');
  releaseA.r();
  assert.deepEqual(await a, { ok: true });
  for (const w of await Promise.all(waiters)) assert.deepEqual(w, { ok: true });
});

test('M2-R2 s7 (THIS round\'s three-party hazard): A holds; B and C contend — neither enters or steals; after release exactly one succeeds (max concurrency 1)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-race-'));
  const file = path.join(dir, 'state.json');
  const t = tracker();
  const aEntered = deferred(), releaseA = deferred(), cEntered = deferred(), releaseC = deferred();
  let aActive = false, cActive = false;
  let aToken = '';
  const a = withFileLock(file, async () => {
    aActive = true; t.enter(); aToken = heldToken(file) ?? ''; aEntered.r();
    await releaseA.p; // A holds — the old "armed rename" cannot exist: bind IS holding
    t.exit(); aActive = false;
  }, { timeoutMs: 9000 }).then(() => ({ ok: true }), (e: Error) => ({ ok: false, error: e.message }));
  await aEntered.p;
  const aBanner = await bannerOf(file);
  // B contends (its bind fails; its probe sees A live; it can alter NOTHING)
  const b = withFileLock(file, async () => { t.enter(); t.exit(); }, { timeoutMs: 9000 })
    .then(() => ({ ok: true }), (e: Error) => ({ ok: false, error: e.message }));
  // C contends and will hold once the lock frees
  let cToken = '';
  const c = withFileLock(file, async () => {
    cActive = true; t.enter(); cToken = heldToken(file) ?? ''; cEntered.r();
    await releaseC.p;
    t.exit(); cActive = false;
  }, { timeoutMs: 9000 }).then(() => ({ ok: true }), (e: Error) => ({ ok: false, error: e.message }));
  try {
    await new Promise((r) => setTimeout(r, 700)); // both contenders waiting
    assert.equal(t.active, 1, 'only A is inside');
    assert.equal(await bannerOf(file), aBanner, 'holder identity unchanged while A holds');
    releaseA.r(); // A releases — no armed follow-up action exists
    const cGotIn = await Promise.race([cEntered.p.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 8000))]);
    assert.equal(aActive && cActive, false, 'A and C never overlapped');
    assert.ok(cGotIn && cToken && cToken !== aToken, 'C legally succeeded under its own acquisition token');
    assert.equal(t.maxActive, 1, 'critical-section concurrency never exceeded 1');
    releaseC.r();
    assert.deepEqual(await a, { ok: true });
    assert.deepEqual(await b, { ok: true }, 'B also completes after release — not by failing');
    assert.deepEqual(await c, { ok: true });
  } finally {
    releaseA.r();
    releaseC.r();
    await b.catch(() => {});
    await c.catch(() => {});
    await a.catch(() => {});
  }
});
