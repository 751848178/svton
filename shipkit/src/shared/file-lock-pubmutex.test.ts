// M2-R2 REG-03 bakery regressions: the publication right is the Lamport
// bakery in lock-pubmutex.ts. Real child processes, real registry, real
// listeners; mock.module ONLY adds a scheduling pause around the ORIGINAL
// mkdir (queue-slot commit) — no syscall result is faked. Covers the
// "floor owned but publication not finished" two-child interleave (the
// owner-file window of the audited protocol no longer exists: creation IS
// ownership, and a stalled owner's slot is never reclaimed while its pid is
// alive) plus same-process concurrent claimPort/withFileLock. Assertions:
// maxActive === 1, two increments land as 2, the live mapping is never
// rewritten, both sides legally progress, no marker/temp residue.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { withFileLock, lockKeyOf, lockPortFor } from './file-lock.js';
import { claimPort } from './lock-registry.js';

const MODULE = new URL('./file-lock.js', import.meta.url).href;
const REGISTRY = '/var/tmp/shipkit-lock-ports';
const claimFileOf = (file: string): string =>
  path.join(REGISTRY, `${createHash('sha256').update(lockKeyOf(file)).digest('hex').slice(0, 20)}.json`);
const markersOf = (claim: string): Promise<string[]> =>
  readdir(REGISTRY).catch(() => []).then((l) => l.filter((f) => f.startsWith(`${path.basename(claim)}.pub`)));
const tempsOf = (claim: string): Promise<string[]> =>
  readdir(REGISTRY).catch(() => []).then((l) => l.filter((f) => f.startsWith(`.${path.basename(claim)}.`) && f.endsWith('.tmp')));

interface Child {
  c: { pid?: number };
  send(m: string): void;
  messages: Array<{ event: string; port?: number; message?: string }>;
  at: Map<string, number>;
  wait(event: string, ms?: number): Promise<{ event: string; port?: number } | null>;
  exited: Promise<void>;
}

/** real child; pauseAfterCommit wraps ONLY mkdir with a one-shot gate AFTER
 *  the queue-slot commit (the equivalent danger instant of the audit's
 *  "publock created, owner not yet written" — the new protocol has no owner
 *  file; the committed slot IS the owned floor) */
function child(file: string, claim: string, opts: { pauseAfterCommit?: boolean; timeoutMs?: number } = {}): Child {
  const code = `
import { mock } from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
const file = ${JSON.stringify(file)};
const claimPath = ${JSON.stringify(claim)};
let resume, release;
process.on('message', (m) => { if (m === 'resume') resume?.(); if (m === 'release') release?.(); if (m === 'exit') process.exit(0); });
if (${JSON.stringify(Boolean(opts.pauseAfterCommit))}) {
  const real = await import('node:fs/promises');
  let first = true;
  mock.module('node:fs/promises', { namedExports: { ...real, mkdir: async (p, ...rest) => {
    const r = await real.mkdir(p, ...rest); // real syscall first
    if (first && String(p).includes('.pubq-')) { first = false; const gate = new Promise((g) => (resume = g)); process.send({ event: 'slot-committed' }); await gate; }
    return r;
  } } });
}
const { withFileLock } = await import(${JSON.stringify(MODULE)});
process.send({ event: 'started' });
try {
  await withFileLock(file, async () => {
    const gate = new Promise((g) => (release = g));
    const old = Number(await readFile(file, 'utf8'));
    const c = JSON.parse(await readFile(claimPath, 'utf8'));
    process.send({ event: 'entered', old, port: c.port });
    await gate;
    await writeFile(file, String(old + 1));
  }, { timeoutMs: ${opts.timeoutMs ?? 20000} });
  process.send({ event: 'finished' });
} catch (e) { process.send({ event: 'error', message: String(e.message) }); }
`;
  const c = spawn(process.execPath, ['--experimental-test-module-mocks', '--input-type=module', '-e', code], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  c.on('error', () => { /* send() after natural exit — harmless here */ });
  const messages: Child['messages'] = [];
  const at = new Map<string, number>();
  c.on('message', (m: { event: string }) => { messages.push(m); at.set(m.event, Date.now()); });
  return {
    c, messages, at,
    send: (m: string) => { try { c.send(m); } catch { /* already exited */ } },
    wait: (event, ms = 8000) => new Promise((resolve) => {
      const end = Date.now() + ms;
      const t = setInterval(() => {
        const found = messages.find((m) => m.event === event);
        if (found || Date.now() > end) { clearInterval(t); resolve(found ?? null); }
      }, 10);
    }),
    exited: new Promise((r) => c.on('exit', () => r())),
  };
}

async function freshState(): Promise<{ file: string; claim: string }> {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), `ship-pm-${randomBytes(3).toString('hex')}-`)));
  const file = path.join(dir, 'state.json');
  await writeFile(file, '0');
  return { file, claim: claimFileOf(file) };
}

test('REG-03 (bakery): A stalls right after committing its queue slot — the competitor neither reclaims the slot nor enters; one mapping, maxActive 1, final 2', async () => {
  const { file, claim } = await freshState();
  const a = child(file, claim, { pauseAfterCommit: true });
  try {
    assert.ok(await a.wait('slot-committed'), 'A committed its slot (owns the floor) and stalls');
    const slotAlive = (await markersOf(claim)).some((m) => m.startsWith(`${path.basename(claim)}.pubq-`));
    assert.ok(slotAlive, "A's committed slot exists while A stalls");
    // queue order is (seq, pid, rand): normally B sorts later and must WAIT at
    // the bakery (no publish, no entry) until A proceeds; if pid wraparound
    // makes B sort earlier it legitimately completes first — A published
    // nothing, so both continuations are safe; detect which one happened
    const b = child(file, claim);
    try {
      await new Promise((r) => setTimeout(r, 500));
      const bDone = b.messages.some((m) => m.event === 'entered');
      const claimEarly = await readFile(claim, 'utf8').then(() => true, () => false);
      const branch = bDone && claimEarly ? 'earlier-sort' : 'waits';
      if (branch === 'waits') {
        assert.ok(!b.messages.some((m) => m.event === 'entered'), 'B does not enter while A owns the floor');
        assert.ok(!(await readFile(claim, 'utf8').then(() => true, () => false)), 'B publishes nothing while A owns the floor');
      }
      assert.ok((await markersOf(claim)).some((m) => m.startsWith(`${path.basename(claim)}.pubq-`)), "A's slot was never reclaimed by the competitor");
      a.send('resume');
      const aIn = await a.wait('entered');
      assert.ok(aIn, 'A proceeds after the stall');
      await new Promise((r) => setTimeout(r, 400));
      const during = JSON.parse(await readFile(claim, 'utf8')) as { port: number };
      const later = branch === 'waits' ? b : a;
      const earlier = branch === 'waits' ? a : b;
      if (branch === 'waits') {
        assert.ok(!b.messages.some((m) => m.event === 'entered'), 'B converged and WAITS — no second entry');
        assert.equal(aIn.port, during.port, 'mapping == holder port');
      } else {
        await b.wait('finished'); // B finished its own section first
        assert.ok(!a.messages.some((m) => m.event === 'entered'), 'resumed A converges and WAITS — no remap');
      }
      earlier.send('release');
      await earlier.wait('finished');
      const lateIn = await later.wait('entered');
      assert.ok(lateIn, 'the waiter legally proceeds after the release');
      assert.equal(lateIn.port, during.port, 'same port — the live mapping was never rewritten');
      later.send('release');
      await later.wait('finished');
      assert.equal(Number(await readFile(file, 'utf8')), 2, 'both increments landed');
      const a1 = a.at.get('entered') ?? 0, a2 = a.at.get('finished') ?? 0;
      const b1 = b.at.get('entered') ?? 0, b2 = b.at.get('finished') ?? 0;
      const overlap = Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
      assert.ok(a1 > 0 && a2 > a1 && b1 > 0 && b2 > b1 && overlap === 0, `simultaneous sections === 0 (maxActive 1), got ${overlap}ms`);
      a.send('exit'); b.send('exit');
      await Promise.all([a.exited, b.exited]);
      assert.deepEqual(await markersOf(claim), [], 'no bakery marker residue');
      assert.deepEqual(await tempsOf(claim), [], 'no claim temp residue');
    } finally {
      b.send('exit');
      await b.exited.catch(() => undefined);
    }
  } finally {
    a.send('exit');
    await a.exited.catch(() => undefined);
    await rm(claim, { force: true }).catch(() => {});
    for (const m of await markersOf(claim)) await rm(path.join(REGISTRY, m), { recursive: true, force: true }).catch(() => {});
    await rm(path.dirname(file), { recursive: true, force: true }).catch(() => {});
  }
});

test('REG-03 (same-process): concurrent claimPort calls converge to ONE port; concurrent sections serialize', async () => {
  const { file, claim } = await freshState();
  try {
    const ports = await Promise.all(Array.from({ length: 8 }, () => claimPort(lockKeyOf(file))));
    assert.ok(ports.every((p) => p === ports[0]), `8 concurrent claimPorts return one identical port, got ${[...new Set(ports)]}`);
    const published = JSON.parse(await readFile(claim, 'utf8')) as { port: number };
    assert.equal(published.port, ports[0], 'the claim maps to that port');
    assert.deepEqual(await markersOf(claim), [], 'no bakery marker residue after the in-process race');
    let active = 0;
    let maxActive = 0;
    await Promise.all([0, 1].map(() => withFileLock(file, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 100));
      const old = Number(await readFile(file, 'utf8'));
      await writeFile(file, String(old + 1));
      active -= 1;
    }, { timeoutMs: 15000 })));
    assert.equal(maxActive, 1, 'in-process sections serialize (maxActive 1)');
    assert.equal(Number(await readFile(file, 'utf8')), 2, 'both increments landed');
    assert.equal((JSON.parse(await readFile(claim, 'utf8')) as { port: number }).port, ports[0], 'mapping unchanged');
    void lockPortFor;
  } finally {
    await rm(claim, { force: true }).catch(() => {});
    await rm(path.dirname(file), { recursive: true, force: true }).catch(() => {});
  }
});
