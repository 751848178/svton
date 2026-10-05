// Regression tests for RA05 (fresh ledger root) and RA04 (owner-verified locks + task leases).

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  acquireLease,
  leaseHeldByOther,
  listStates,
  readState,
  releaseLease,
  renewLease,
  stateFileFor,
  withLock,
  writeState,
  type BuilderState,
} from './builder-state.js';
import type { TencentCvmConfig } from '../shared/types.js';
import { lockPortFor } from '../shared/file-lock.js';

const realHome = process.env.HOME;

function withTmpHome(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'ship-home-'));
}

function cfg(): TencentCvmConfig {
  return { region: 'r', zone: 'z', instanceType: 't', imageId: 'i', vpcId: 'v', subnetId: 's', securityGroupIds: ['sg'] };
}

function state(over: Partial<BuilderState> = {}): BuilderState {
  return {
    instanceId: 'ins-x', region: 'r', token: 'tok', status: 'ready', createdAt: new Date().toISOString(),
    expireAt: new Date(Date.now() + 3 * 3600_000).toISOString(), ...over,
  };
}

async function deadPid(): Promise<number> {
  const child = spawn('true');
  const pid = child.pid!;
  await new Promise((r) => child.once('exit', r));
  return pid;
}

test('RA05: a brand-new ledger root (no ~/.ship/builders) acquires the lock without hanging', async (t) => {
  const home = await withTmpHome();
  t.after(() => { process.env.HOME = realHome; });
  process.env.HOME = home;
  const file = stateFileFor(cfg(), 'sid');
  const result = await withLock(file, async () => 'acquired', { waitMs: 2000 });
  assert.equal(result, 'acquired');
});

test('RA04: a stale lock owned by a LIVE process is never broken — we wait and then fail by deadline', async (t) => {
  const home = await withTmpHome();
  t.after(() => { process.env.HOME = realHome; });
  process.env.HOME = home;
  const file = stateFileFor(cfg(), 'sid');
  const lock = `${file}.lock`;
  await mkdir(lock, { recursive: true, mode: 0o700 });
  await writeFile(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  const old = new Date(Date.now() - 11 * 60_000);
  await utimes(lock, old, old);
  await utimes(path.join(lock, 'owner.json'), old, old);
  await assert.rejects(() => withLock(file, async () => 'x', { waitMs: 1200 }), /another ship process holds/);
});

test('RA04: a stale lock whose owner is DEAD is recovered', async (t) => {
  const home = await withTmpHome();
  t.after(() => { process.env.HOME = realHome; });
  process.env.HOME = home;
  const file = stateFileFor(cfg(), 'sid');
  const lock = `${file}.lock`;
  const pid = await deadPid();
  await mkdir(lock, { recursive: true, mode: 0o700 });
  await writeFile(path.join(lock, 'owner.json'), JSON.stringify({ pid }));
  const old = new Date(Date.now() - 11 * 60_000);
  await utimes(lock, old, old);
  await utimes(path.join(lock, 'owner.json'), old, old);
  const result = await withLock(file, async () => 'recovered', { waitMs: 5000 });
  assert.equal(result, 'recovered');
  await rm(lock, { recursive: true, force: true });
});

test('RA04: leases — an unexpired lease held by another process blocks reuse', async (t) => {
  const home = await withTmpHome();
  t.after(() => { process.env.HOME = realHome; });
  process.env.HOME = home;
  const file = stateFileFor(cfg(), 'sid');
  const holder = spawn('sleep', ['10']);
  t.after(() => holder.kill());
  await writeState(file, state({ lease: { pid: holder.pid!, acquiredAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() } }));
  const st = await readState(file);
  assert.ok(st && leaseHeldByOther(st), 'live holder → leased');
});

test('RA04: an expired lease is still honored while the holder is alive, ignored once dead', async (t) => {
  const home = await withTmpHome();
  t.after(() => { process.env.HOME = realHome; });
  process.env.HOME = home;
  const file = stateFileFor(cfg(), 'sid');
  const holder = spawn('sleep', ['10']);
  t.after(() => holder.kill());
  const expired = new Date(Date.now() - 60_000).toISOString();
  await writeState(file, state({ lease: { pid: holder.pid!, acquiredAt: expired, expiresAt: expired } }));
  assert.ok(leaseHeldByOther((await readState(file))!), 'alive holder outranks the wall clock');
  holder.kill();
  await new Promise((r) => holder.once('exit', r));
  assert.ok(!leaseHeldByOther((await readState(file))!), 'dead holder releases the claim');
});

test('RA04: releaseLease anchors the idle window at task completion', async (t) => {
  const home = await withTmpHome();
  t.after(() => { process.env.HOME = realHome; });
  process.env.HOME = home;
  const file = stateFileFor(cfg(), 'sid');
  await writeState(file, state({ lastUsedAt: new Date(Date.now() - 5 * 3600_000).toISOString() }));
  const leased = await acquireLease(file);
  const token = leased.lease!.ownerToken!;
  await renewLease(file, token);
  await releaseLease(file, token);
  const st = await readState(file);
  assert.ok(!st?.lease);
  assert.ok(st?.lastUsedAt && Date.now() - new Date(st.lastUsedAt).getTime() < 5000, 'lastUsedAt refreshed at task end');
});

test('RA04: acquireLease cannot overwrite a live foreign lease', async (t) => {
  const home = await withTmpHome();
  t.after(() => { process.env.HOME = realHome; });
  process.env.HOME = home;
  const file = stateFileFor(cfg(), 'sid');
  const holder = spawn('sleep', ['10']);
  t.after(() => holder.kill());
  await writeState(file, state({ lease: { pid: holder.pid!, acquiredAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() } }));
  await assert.rejects(acquireLease(file), /BUSY|lease.*held/i);
  assert.equal((await readState(file))?.lease?.pid, holder.pid);
});

test('RA04: an old token cannot renew or clear a newer same-process lease or mark lastUsed', async (t) => {
  const home = await withTmpHome();
  t.after(() => { process.env.HOME = realHome; });
  process.env.HOME = home;
  const file = stateFileFor(cfg(), 'sid');
  const timestamp = new Date(Date.now() - 30_000).toISOString();
  const replacementLease = { pid: process.pid, ownerToken: 'new-token', acquiredAt: timestamp, expiresAt: new Date(Date.now() + 60_000).toISOString() };
  await writeState(file, state({ lease: replacementLease, lastUsedAt: timestamp }));
  const before = await readFile(file, 'utf8');
  await renewLease(file, 'old-token');
  assert.equal(await readFile(file, 'utf8'), before, 'old renew must not extend the new lease');
  await releaseLease(file, 'old-token');
  assert.equal(await readFile(file, 'utf8'), before, 'old completion must not clear the new lease or move the idle anchor');
});

test('RA04: independent tasks in one process also require their exact lease tokens', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-same-pid-lease-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'builder.json');
  await writeState(file, state());
  await acquireLease(file, 'task-A');
  await assert.rejects(acquireLease(file, 'task-B'), /BUSY/);
  await releaseLease(file, 'task-A');
  await acquireLease(file, 'task-B');
  const before = await readFile(file, 'utf8');
  await releaseLease(file, 'task-A');
  assert.equal(await readFile(file, 'utf8'), before);
  await releaseLease(file, 'task-B');
});

test('RA04: the legacy gate never reclaims an unreadable or unparsed stale owner', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-unknown-owner-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'builder.json');
  const lock = `${file}.lock`;
  await mkdir(lock);
  const owner = path.join(lock, 'owner.json');
  await writeFile(owner, '{broken');
  const old = new Date(Date.now() - 11 * 60_000);
  await utimes(owner, old, old);
  await lockPortFor(`${file}.builder-mutex`); // measure the legacy wait, not first-time registry allocation
  let entered = false;
  await assert.rejects(withLock(file, async () => { entered = true; }, { waitMs: 500 }), /holds the builder lock/);
  assert.equal(entered, false);
  assert.equal(await readFile(owner, 'utf8'), '{broken');
});

test('RA04: the TCP outer gate remains exclusive when legacy metadata changes; release preserves the foreign token', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-ledger-gate-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'builder.json');
  let ready!: () => void;
  const entered = new Promise<void>(r => { ready = r; });
  let finish!: () => void;
  const hold = new Promise<void>(r => { finish = r; });
  const first = withLock(file, async () => { ready(); await hold; }).then(() => null, e => e as Error);
  await entered;
  const owner = path.join(`${file}.lock`, 'owner.json');
  const foreign = JSON.stringify({ pid: await deadPid(), ownerToken: 'foreign' });
  await writeFile(owner, foreign);
  const old = new Date(Date.now() - 11 * 60_000);
  await utimes(owner, old, old);
  let competing = false;
  await assert.rejects(withLock(file, async () => { competing = true; }, { waitMs: 100 }), /超时|预算耗尽/);
  assert.equal(competing, false, 'stale metadata cannot bypass the held kernel mutex');
  finish();
  assert.match((await first)?.message ?? '', /ownership changed/);
  assert.equal(await readFile(owner, 'utf8'), foreign, 'release cannot delete another owner token');
});

test('F11: listStates treats only a missing directory as empty; unreadable directory fails closed', async (t) => {
  const home = await withTmpHome();
  const root = path.join(home, '.ship', 'builders');
  const beforeHome = process.env.HOME;
  t.after(async () => { await chmod(root, 0o700).catch(() => {}); process.env.HOME = beforeHome; await rm(home, { recursive: true, force: true }); });
  process.env.HOME = home;
  assert.deepEqual(await listStates(), []);
  await mkdir(root, { recursive: true });
  await writeState(path.join(root, 'b-synthetic.json'), state());
  await chmod(root, 0);
  await assert.rejects(listStates(), (e: NodeJS.ErrnoException) => e.code === 'EACCES');
  await chmod(root, 0o700);
  assert.equal((await listStates()).length, 1, 'fault must preserve the existing ledger');
});
