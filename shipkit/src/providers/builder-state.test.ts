// Regression tests for RA05 (fresh ledger root) and RA04 (owner-verified locks + task leases).

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  acquireLease,
  leaseHeldByOther,
  readState,
  releaseLease,
  renewLease,
  stateFileFor,
  withLock,
  writeState,
  type BuilderState,
} from './builder-state.js';
import type { TencentCvmConfig } from '../shared/types.js';

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
  await acquireLease(file);
  await renewLease(file);
  await releaseLease(file);
  const st = await readState(file);
  assert.ok(!st?.lease);
  assert.ok(st?.lastUsedAt && Date.now() - new Date(st.lastUsedAt).getTime() < 5000, 'lastUsedAt refreshed at task end');
});
