// M2-R2 registry/identity regressions (REG-01/REG-02/KEY-01): real child
// processes with isolated TMPDIR environments, real claim files in the fixed
// /var/tmp registry, real listeners — no mocks. Assertions per the review:
// maxActive === 1, two increments land as 2, faults clear into progress,
// timeouts bounded, no self-listener/holding residue, old tokens never
// disturb a new holder.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withFileLock, lockKeyOf, lockPortFor, heldToken, releaseLockIfOwner } from './file-lock.js';
import { claimPort } from './lock-registry.js';

const MODULE = new URL('./file-lock.js', import.meta.url).href;
const REGISTRY_MODULE = new URL('./lock-registry.js', import.meta.url).href;

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

interface Worker {
  send(msg: string): void;
  messages: Array<{ event: string }>;
  wait(event: string, ms?: number): Promise<{ event: string } | null>;
  exited: Promise<void>;
}

/** a REAL child process; temp selects its isolated TMPDIR/TMP/TEMP namespace */
function worker(file: string, temp: string, createParent = false): Worker {
  const code = `
import { withFileLock, lockPortFor, lockKeyOf } from ${JSON.stringify(MODULE)};
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const file = ${JSON.stringify(file)};
let release;
process.on('message', async (m) => {
  try {
    if (m === 'claim') process.send({ event: 'claimed', port: await lockPortFor(file) });
    if (m === 'acquire') {
      const key = lockKeyOf(file);
      await withFileLock(file, async () => {
        const gate = new Promise((r) => (release = r));
        if (${JSON.stringify(createParent)}) await mkdir(path.dirname(file), { recursive: true });
        const old = Number(await readFile(file, 'utf8').catch(() => '0'));
        process.send({ event: 'entered', key, currentKey: lockKeyOf(file), old, port: await lockPortFor(key) });
        await gate;
        await writeFile(file, String(old + 1));
      }, { timeoutMs: 8000 });
      process.send({ event: 'finished' });
    }
    if (m === 'release') release?.();
    if (m === 'exit') process.exit(0);
  } catch (e) { process.send({ event: 'error', message: String(e.message) }); }
});
process.send({ event: 'ready' });
`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], {
    env: { ...process.env, TMPDIR: temp, TMP: temp, TEMP: temp }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  const messages: Array<{ event: string }> = [];
  child.on('message', (m: { event: string }) => messages.push(m));
  return {
    send: (msg) => child.send(msg),
    messages,
    wait: (event, ms = 4000) => new Promise((resolve) => {
      const end = Date.now() + ms;
      const t = setInterval(() => {
        const found = messages.find((m) => m.event === event);
        if (found || Date.now() > end) { clearInterval(t); resolve(found ?? null); }
      }, 10);
    }),
    exited: new Promise((r) => child.on('exit', () => r())),
  };
}

test('REG-01: isolated TMPDIR namespaces share ONE claim — serialized, no lost update', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-reg-'));
  const tmpA = path.join(dir, 'tmpA'), tmpB = path.join(dir, 'tmpB');
  await mkdir(tmpA, { recursive: true });
  await mkdir(tmpB, { recursive: true });
  const file = path.join(dir, 'state.json');
  await writeFile(file, '0');
  const a = worker(file, tmpA);
  assert.ok(await a.wait('ready'));
  a.send('acquire');
  const aEntered = await a.wait('entered', 8000);
  assert.ok(aEntered, 'A entered');
  const b = worker(file, tmpB);
  assert.ok(await b.wait('ready'));
  b.send('acquire');
  const bDuring = await b.wait('entered', 400); // must NOT enter while A holds
  assert.equal(bDuring, null, 'B (different TMPDIR) waits while A holds');
  a.send('release');
  await a.wait('finished');
  const bAfter = await b.wait('entered', 8000);
  assert.ok(bAfter, 'B entered after A released');
  b.send('release');
  await b.wait('finished');
  a.send('exit'); b.send('exit');
  await Promise.all([a.exited, b.exited]);
  assert.equal(Number(await readFile(file, 'utf8')), 2, 'both increments landed');
});

test('REG-02: candidate exhaustion FAILS conservatively (no unregistered lock); clearing the fault restores progress', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-reg-'));
  const file = path.join(dir, 'state.json');
  const key = lockKeyOf(file);
  // occupy all 64 candidate ports with OUR OWN listeners (never foreign ones)
  const listeners = [];
  const occupied: number[] = [];
  for (let i = 0; i < 64; i++) {
    const port = 49152 + createHash('sha256').update([key, String(i)].join('\u0000')).digest().readUInt32BE(0) % 16383;
    if (occupied.includes(port)) continue;
    const server = createServer((s) => s.destroy());
    const ok = await new Promise<boolean>((r) => {
      server.once('error', () => r(false));
      server.listen(port, '127.0.0.1', () => r(true));
    });
    if (ok) { listeners.push(server); occupied.push(port); }
  }
  try {
    await assert.rejects(
      () => claimPort(key),
      (e: Error) => /候选端口当前均不可用|保守失败/.test(e.message),
      'exhaustion must FAIL — an unregistered port must never become a lock',
    );
  } finally {
    for (const server of listeners.splice(0)) await new Promise<void>((r) => server.close(() => r()));
  }
  // fault cleared: allocation proceeds and the lock works end to end
  let ok = false;
  await withFileLock(file, () => { ok = true; }, { timeoutMs: 8000 });
  assert.ok(ok, 'progress restored after the fault cleared');
});

test('REG-02: interrupted publish (empty or torn claim) is repaired — no independent lock, both sides progress', async () => {
  // a conservative discovery abort is RETRYABLE by contract: under the
  // parallel suite a foreign fixture may silently squat one of this KEY's
  // candidates for seconds — retry with a FRESH key (new candidate set)
  for (let scenario = 0; scenario < 3; scenario++) {
    if (await runTornClaimScenario() === 'ok') return;
  }
  throw new Error('REG-02: conservative abort persisted across 3 fresh keys');
});

async function runTornClaimScenario(): Promise<'ok' | 'conservative'> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-reg-'));
  const file = path.join(dir, 'state.json');
  await writeFile(file, '0');
  // simulate a torn publish for THIS key: an empty claim, and a corrupt one
  const claimName = `${createHash('sha256').update(lockKeyOf(file)).digest('hex').slice(0, 20)}.json`;
  for (const garbage of ['', '{broken']) {
    await writeFile(path.join('/var/tmp/shipkit-lock-ports', claimName), garbage, { mode: 0o644 });
    let ok = false;
    try {
      await withFileLock(file, () => { ok = true; }, { timeoutMs: 8000 });
    } catch (e) {
      // only a conservative abort retries with a fresh key; anything else fails
      if (!/保守失败|不可枚举|不可读/.test(String((e as Error).message))) throw e;
      return 'conservative';
    }
    assert.ok(ok, `claim "${garbage || 'empty'}" repaired into a working lock`);
    const claim = JSON.parse(await readFile(path.join('/var/tmp/shipkit-lock-ports', claimName), 'utf8')) as { port: number };
    assert.ok(Number.isInteger(claim.port), 'the repaired claim is complete');
  }
  // a second process converges on the SAME repaired claim
  const tmp = path.join(dir, 'tmp');
  await mkdir(tmp, { recursive: true });
  const a = worker(file, tmp);
  assert.ok(await a.wait('ready'));
  a.send('claim');
  const claimed = await a.wait('claimed', 4000) as unknown as { port: number };
  a.send('exit');
  await a.exited;
  assert.equal(claimed.port, JSON.parse(await readFile(path.join('/var/tmp/shipkit-lock-ports', claimName), 'utf8')).port);
  return 'ok';
}

test('KEY-01: a multi-level parent created INSIDE the section keeps one identity — serialized, no residue', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-reg-'));
  const file = path.join(dir, 'new', 'nested', 'state.json');
  const originalKey = lockKeyOf(file);
  const { realpath } = await import('node:fs/promises');
  assert.equal(originalKey, path.join(await realpath(dir), 'new', 'nested', 'state.json'), 'full remainder preserved BEFORE creation');
  const tmp = path.join(dir, 'tmp');
  await mkdir(tmp, { recursive: true });
  const m = worker(file, tmp, true);
  assert.ok(await m.wait('ready'));
  m.send('acquire');
  const entered = await m.wait('entered', 8000) as unknown as { key: string; currentKey: string };
  assert.ok(entered, 'creator entered');
  assert.equal(entered.key, originalKey, 'acquisition key kept the full tail');
  assert.equal(entered.currentKey, originalKey, 'key IDENTICAL after the parent was created');
  const n = worker(file, tmp);
  assert.ok(await n.wait('ready'));
  n.send('acquire');
  assert.equal(await n.wait('entered', 400), null, 'second process waits while the creator holds');
  m.send('release');
  await m.wait('finished');
  const nEntered = await n.wait('entered', 8000);
  assert.ok(nEntered, 'second process entered after release');
  n.send('release');
  await n.wait('finished');
  m.send('exit'); n.send('exit');
  await Promise.all([m.exited, n.exited]);
  assert.equal(Number(await readFile(file, 'utf8')), 2, 'both increments landed');
});

test('KEY-01: in-process release binds the acquisition identity — no holding residue, old token never disturbs a new holder', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-reg-'));
  const file = path.join(dir, 'a', 'b', 'state.json');
  const originalKey = lockKeyOf(file);
  let token: string | null = null;
  await withFileLock(file, async () => {
    token = heldToken(originalKey);
    await mkdir(path.dirname(file), { recursive: true }); // parent appears mid-flight
  });
  assert.ok(token, 'captured the acquisition token');
  assert.equal(heldToken(originalKey), null, 'no holding residue after a successful return');
  assert.equal(await releaseLockIfOwner(originalKey, token), false, 'already released — idempotent refusal');
  // a NEW holder is untouched by the OLD token
  let secondDone = false;
  await withFileLock(file, async () => {
    assert.equal(await releaseLockIfOwner(originalKey, token!), false, 'old token must not release the new holder');
    secondDone = true;
  }, { timeoutMs: 8000 });
  assert.ok(secondDone);
  assert.equal(heldToken(lockKeyOf(file)), null);
  // and the acquisition-time port is free again (no leaked listener)
  const port = await lockPortFor(file);
  const net = await import('node:net');
  const free = await new Promise<boolean>((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    s.setTimeout(400, () => { s.destroy(); resolve(false); });
    s.once('connect', () => { s.destroy(); resolve(false); });
    s.once('error', () => resolve(true));
  });
  assert.equal(free, true, 'no self-listener residue');
});
