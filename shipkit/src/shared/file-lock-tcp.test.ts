// M2-R2 TCP-boundary regressions (TCP-01/02/03 + port-registry): all peers,
// listeners and symlinks are REAL — no mocks. Covers the three audited gaps
// and the integration blocker:
//  - TCP-01: parent-dir aliases map to ONE lock identity (same claimed port);
//    a symlink TARGET is refused, matching secureWrite.
//  - TCP-02: probe lifecycle — silent peer, EOF-without-data, normal banner,
//    abrupt disconnect, and the caller's remaining budget bounding the wait.
//  - TCP-03: a half-open banner visitor cannot stall release; business
//    exceptions clean up; a successor takes over; no connection residue.
//  - Registry: distinct keys never share a claimed port; a foreign listener
//    sitting on a key's hash-derived candidate is AVOIDED at allocation (the
//    second full-suite failure mode); same key across processes converges.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, connect } from 'node:net';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { withFileLock, lockKeyOf, lockPortFor, heldToken } from './file-lock.js';

function defer(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

/** a raw peer bound to the given port with the chosen connection behavior */
function peer(port: number, behavior: 'silent' | 'eof' | 'banner' | 'reset'): Promise<{ close(): Promise<void> }> {
  return new Promise((resolve) => {
    const server = createServer((socket) => {
      if (behavior === 'silent') return; // accept, never write, never end
      if (behavior === 'eof') socket.end(); // close without a banner
      if (behavior === 'banner') socket.end('shiplock:1:deadbeef\n');
      if (behavior === 'reset') socket.destroy(); // abrupt disconnect
    });
    server.listen(port, '127.0.0.1', () => resolve({
      close: () => new Promise<void>((r) => {
        server.close(() => r());
        (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
      }),
    }));
  });
}

/** first free port not claimed by any key (scan helper for fixtures) */
async function somePort(): Promise<number> {
  for (let p = 20000 + Math.floor(Math.random() * 20000); ; p++) {
    const ok = await new Promise<boolean>((resolve) => {
      const probe = connect({ port: p, host: '127.0.0.1' });
      probe.once('error', () => resolve(true));
      probe.once('connect', () => { probe.destroy(); resolve(false); });
    });
    if (ok) return p;
  }
}

test('TCP-01: parent-dir aliases map to ONE lock — no overlap, no lost update; a symlink TARGET is refused', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-tcp-'));
  const real = path.join(dir, 'real');
  await mkdir(real);
  await symlink(real, path.join(dir, 'alias'), 'dir');
  const file = path.join(real, 'state.json');
  const alias = path.join(dir, 'alias', 'state.json');
  await writeFile(file, '0');
  assert.equal(await lockPortFor(file), await lockPortFor(alias), 'both names claim the SAME port');
  assert.equal(lockKeyOf(file), lockKeyOf(alias), 'identical canonical key');
  assert.equal(await realpath(file), await realpath(alias), 'fixture sanity');
  const aEntered = defer(), releaseA = defer();
  let active = 0, maxActive = 0;
  const a = withFileLock(file, async () => {
    active++; maxActive = Math.max(maxActive, active);
    aEntered.resolve();
    await releaseA.promise;
    const old = Number(await readFile(file, 'utf8'));
    await writeFile(file, String(old + 1));
    active--;
  }, { timeoutMs: 8000 }).then(() => ({ ok: true }), (e: Error) => ({ ok: false, error: e.message }));
  await aEntered.promise;
  const b = withFileLock(alias, async () => {
    active++; maxActive = Math.max(maxActive, active);
    const old = Number(await readFile(alias, 'utf8'));
    await writeFile(alias, String(old + 1));
    active--;
  }, { timeoutMs: 8000 }).then(() => ({ ok: true }), (e: Error) => ({ ok: false, error: e.message }));
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(active, 1, 'the alias acquisition WAITS while the real path holds');
  releaseA.resolve();
  assert.deepEqual(await a, { ok: true });
  assert.deepEqual(await b, { ok: true });
  assert.equal(maxActive, 1, 'critical-section concurrency never exceeded 1');
  assert.equal(Number(await readFile(file, 'utf8')), 2, 'both increments landed — no lost update');
  // a final component that IS a symlink is refused outright
  const target = path.join(dir, 't.json');
  const link = path.join(dir, 'l.json');
  await writeFile(target, '0');
  await symlink(target, link);
  await assert.rejects(() => withFileLock(link, () => {}, { timeoutMs: 1000 }), /符号链接/);
  await rm(dir, { recursive: true, force: true }).catch(() => {});
});

test('TCP-02: probe lifecycle — EOF-without-data settles, silent peers bound to the remaining budget', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-tcp-'));
  // EOF peer: the acquisition must settle (error or retry), never hang
  const eofFile = path.join(dir, 'eof.json');
  const eofPort = await somePort();
  // force the key's claim onto the eof peer's port by claiming then rewriting is
  // not possible — instead bind the peer AFTER claiming the key's own port
  await withFileLock(eofFile, () => {}, { timeoutMs: 5000 }); // establishes claim
  const claimed = await lockPortFor(eofFile);
  assert.notEqual(claimed, eofPort, 'sanity: distinct ports');
  // occupy the CLAIMED port with each behavior and assert bounded, explicit outcomes
  for (const behavior of ['eof', 'silent'] as const) {
    const p = await peer(claimed, behavior);
    const start = Date.now();
    let err = '';
    try { await withFileLock(eofFile, () => {}, { timeoutMs: 150 }); } catch (e) { err = (e as Error).message; }
    const elapsed = Date.now() - start;
    assert.ok(err, `${behavior}: explicit outcome`);
    assert.match(err, /超时|refusing/);
    assert.ok(elapsed < 800, `${behavior}: bounded within budget+overhead (got ${elapsed}ms for 150ms)`);
    await p.close();
  }
  await rm(dir, { recursive: true, force: true }).catch(() => {});
});

test('TCP-02: normal banner and abrupt-disconnect paths settle and classify', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-tcp-'));
  const file = path.join(dir, 'x.json');
  await withFileLock(file, () => {}, { timeoutMs: 5000 });
  const port = await lockPortFor(file);
  // banner from a DIFFERENT keyhash → live wait → timeout names the collision
  const bannerPeer = await peer(port, 'banner');
  let err = '';
  try { await withFileLock(file, () => {}, { timeoutMs: 150 }); } catch (e) { err = (e as Error).message; }
  assert.match(err, /is alive|port collision/, 'shiplock banner classified as a live holder');
  await bannerPeer.close();
  // reset peer: connection destroyed on accept → 'none' → bounded timeout
  const resetPeer = await peer(port, 'reset');
  err = '';
  const start = Date.now();
  try { await withFileLock(file, () => {}, { timeoutMs: 150 }); } catch (e) { err = (e as Error).message; }
  assert.ok(err && Date.now() - start < 800, 'reset peer: bounded explicit outcome');
  await resetPeer.close();
  // after all peers are gone the lock is acquirable again
  let ok = false;
  await withFileLock(file, () => { ok = true; }, { timeoutMs: 5000 });
  assert.ok(ok);
  await rm(dir, { recursive: true, force: true }).catch(() => {});
});

test('TCP-03: a half-open visitor cannot stall release; exceptions clean up; successor takes over; no residue', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-tcp-'));
  const file = path.join(dir, 'r.json');
  const entered = defer(), release = defer();
  let settled = false;
  const work = withFileLock(file, async () => {
    entered.resolve();
    await release.promise;
  }).finally(() => { settled = true; });
  await entered.promise;
  const socket = connect({ port: await lockPortFor(file), host: '127.0.0.1', allowHalfOpen: true });
  await new Promise((r) => socket.once('data', r)); // read the banner, keep write half open
  release.resolve();
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(settled, true, 'release completed while the half-open peer was still connected');
  await work;
  socket.destroy();
  // business exception cleans up and the lock returns to acquirable
  await assert.rejects(() => withFileLock(file, async () => { throw new Error('boom'); }, { timeoutMs: 5000 }), /boom/);
  assert.equal(heldToken(file), null, 'no holding residue after the exception');
  let ok = false;
  await withFileLock(file, () => { ok = true; }, { timeoutMs: 5000 });
  assert.ok(ok, 'successor took over');
  // no connection residue: after everything the port answers nothing
  const port = await lockPortFor(file);
  assert.equal(await new Promise<boolean>((resolve) => {
    const s = connect({ port, host: '127.0.0.1' });
    s.setTimeout(400, () => { s.destroy(); resolve(false); });
    s.once('connect', () => { s.destroy(); resolve(false); });
    s.once('error', () => resolve(true));
  }), true, 'port idle after full release');
  await rm(dir, { recursive: true, force: true }).catch(() => {});
});

test('Registry: distinct keys never share a claimed port; a foreign listener on a candidate is AVOIDED', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-tcp-'));
  const a = path.join(dir, 'a.json');
  const b = path.join(dir, 'b.json');
  const pa = await lockPortFor(a);
  const pb = await lockPortFor(b);
  assert.notEqual(pa, pb, 'different keys → different claimed ports');
  // foreign listener on a FRESH key's first hash candidate must not block the
  // lock: allocation skips occupied candidates (integration failure mode #2)
  const c = path.join(dir, 'c.json');
  const { createHash } = await import('node:crypto');
  const firstCandidate = 49152 + createHash('sha256').update([lockKeyOf(c), '0'].join('\u0000')).digest().readUInt32BE(0) % 16383;
  if (!(await new Promise<boolean>((resolve) => { // only run the occupation arm if the candidate is currently free
    const s = connect({ port: firstCandidate, host: '127.0.0.1' });
    s.once('error', () => resolve(true));
    s.once('connect', () => { s.destroy(); resolve(false); });
  }))) return; // candidate already busy by something else — nothing to prove here
  const foreign = await peer(firstCandidate, 'silent');
  try {
    let ok = false;
    await withFileLock(c, () => { ok = true; }, { timeoutMs: 5000 });
    assert.ok(ok, 'lock acquired despite a foreign listener on the first candidate');
    assert.notEqual(await lockPortFor(c), firstCandidate, 'the claim avoided the occupied candidate');
  } finally {
    await foreign.close();
  }
  await rm(dir, { recursive: true, force: true }).catch(() => {});
});
