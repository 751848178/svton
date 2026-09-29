// Builder machine ledger: per-identity state files (0600) + owner-verified mkdir locks (RA04/RA05)
// + task leases so a second CLI can never destroy a machine mid-build (RA04).
// Lock rules: parent dir created before locking; only EEXIST enters competition; every retry is
// deadline-bound; a lock is breakable only when its heartbeat is stale AND the owner process is dead.

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TencentCvmConfig } from '../shared/types.js';

const LOCK_STALE_MS = 10 * 60_000;
const LOCK_POLL_MS = 500;
export const LEASE_TTL_MS = 3 * 60_000;

export interface TaskLease {
  pid: number;
  acquiredAt: string;
  expiresAt: string;
}

export interface BuilderState {
  instanceId: string;
  region: string;
  url?: string;
  token: string;
  status: 'provisioning' | 'ready';
  createdAt: string;
  /** idle anchor: set when a TASK COMPLETES, not when the machine is reused (RA04) */
  lastUsedAt?: string;
  /** cloud-enforced terminate deadline (ActionTimer) and local sweep backstop */
  expireAt: string;
  /** held for the duration of an actual build/push task; renewed by the holder */
  lease?: TaskLease;
}

export function buildersRoot(): string {
  return path.join(process.env.HOME ?? '.', '.ship', 'builders');
}

export function stateFileFor(cfg: TencentCvmConfig, secretId: string): string {
  const fp = createHash('sha1')
    .update([secretId, cfg.region, cfg.zone, cfg.instanceType, cfg.vpcId, cfg.subnetId].join('|'))
    .digest('hex')
    .slice(0, 12);
  return path.join(buildersRoot(), `b-${fp}.json`);
}

export async function readState(file: string): Promise<BuilderState | null> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return null;
  }
  try {
    const s = JSON.parse(text) as BuilderState;
    if (!s?.instanceId) return null;
    return s;
  } catch (e) {
    throw new Error(`builder state ${path.basename(file)} is corrupt (${(e as Error).message}); fix or delete it`);
  }
}

export async function writeState(file: string, s: BuilderState): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${randomUUID().slice(0, 8)}.tmp`;
  await writeFile(tmp, JSON.stringify(s, null, 2), { mode: 0o600 });
  await rename(tmp, file);
}

export async function clearState(file: string): Promise<void> {
  await rm(file, { force: true });
}

export async function listStates(): Promise<Array<{ file: string; state: BuilderState }>> {
  const root = buildersRoot();
  const files = (await readdir(root).catch(() => [] as string[])).filter((f) => f.startsWith('b-') && f.endsWith('.json'));
  const out: Array<{ file: string; state: BuilderState }> = [];
  for (const f of files) {
    const file = path.join(root, f);
    const state = await readState(file);
    if (state) out.push({ file, state });
  }
  return out;
}

// ---- task leases (RA04) ----

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** unexpired, or expired while the holder process is still alive (it will renew or release) */
export function leaseHeldByOther(st: BuilderState): boolean {
  const l = st.lease;
  if (!l) return false;
  if (l.pid === process.pid) return false;
  if (new Date(l.expiresAt).getTime() > Date.now()) return true;
  return pidAlive(l.pid);
}

export async function acquireLease(file: string): Promise<BuilderState> {
  const st = await readState(file);
  if (!st) throw new Error('cannot lease: no builder state');
  const next: BuilderState = {
    ...st,
    lease: { pid: process.pid, acquiredAt: new Date().toISOString(), expiresAt: new Date(Date.now() + LEASE_TTL_MS).toISOString() },
  };
  await writeState(file, next);
  return next;
}

export async function renewLease(file: string): Promise<void> {
  const st = await readState(file);
  if (!st?.lease || st.lease.pid !== process.pid) return;
  await writeState(file, { ...st, lease: { ...st.lease, expiresAt: new Date(Date.now() + LEASE_TTL_MS).toISOString() } });
}

/** task END: clears the lease and anchors the idle window here (RA04) */
export async function releaseLease(file: string): Promise<void> {
  const st = await readState(file);
  if (!st) return;
  await writeState(file, { ...st, lease: undefined, lastUsedAt: new Date().toISOString() });
}

// ---- mkdir lock with owner verification and heartbeat (RA04/RA05) ----

interface LockOwner {
  pid: number;
  startedAt: string;
}

async function lockBreakable(lock: string): Promise<boolean> {
  const dirStat = await stat(lock).catch(() => null);
  if (!dirStat) return false;
  const ownerFile = path.join(lock, 'owner.json');
  const ownerStat = await stat(ownerFile).catch(() => null);
  const age = Date.now() - (ownerStat?.mtimeMs ?? dirStat.mtimeMs);
  if (age <= LOCK_STALE_MS) return false;
  let pid = -1;
  try {
    pid = (JSON.parse(await readFile(ownerFile, 'utf8')) as LockOwner).pid;
  } catch {
    // unreadable owner on a stale lock: treat as dead
  }
  if (pid > 0 && pidAlive(pid)) return false; // alive but silent → keep waiting until deadline
  return true;
}

export async function withLock<T>(file: string, fn: () => Promise<T>, opts?: { waitMs?: number }): Promise<T> {
  const lock = `${file}.lock`;
  // create the ledger parent BEFORE locking — a missing parent must not masquerade as contention (RA05)
  await mkdir(path.dirname(lock), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + (opts?.waitMs ?? 30_000);
  for (;;) {
    try {
      await mkdir(lock, { mode: 0o700 });
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw new Error(`builder lock cannot be created (${code ?? e}): ${lock}`);
      if (await lockBreakable(lock)) {
        await rm(lock, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > deadline) throw new Error(`another ship process holds the builder lock (${path.basename(file)})`);
      await new Promise((r) => setTimeout(r, LOCK_POLL_MS));
      continue;
    }
    const ownerFile = path.join(lock, 'owner.json');
    await writeFile(ownerFile, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() } satisfies LockOwner), { mode: 0o600 });
    // heartbeat: keep the lock fresh while the critical section runs (provisioning can exceed 10 min)
    const hb = setInterval(() => {
      void utimes(ownerFile, new Date(), new Date()).catch(() => {});
    }, 30_000);
    try {
      return await fn();
    } finally {
      clearInterval(hb);
      await rm(lock, { recursive: true, force: true });
    }
  }
}
