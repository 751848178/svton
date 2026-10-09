// Builder machine ledger: per-identity state files (0600) + owner-verified mkdir locks (RA04/RA05)
// + task leases so a second CLI can never destroy a machine mid-build (RA04).
// Lock rules: parent dir created before locking; only EEXIST enters competition; every retry is
// deadline-bound; a lock is breakable only when its heartbeat is stale AND the owner process is dead.

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TencentCvmConfig } from '../shared/types.js';
import { pidAlive, withLock } from './builder-state-lock.js';
export { pidAlive, withLock } from './builder-state-lock.js';

export const LEASE_TTL_MS = 3 * 60_000;

export interface TaskLease {
  pid: number;
  acquiredAt: string;
  expiresAt: string;
  /** Exact task authority; legacy token-less leases remain conservatively busy. */
  ownerToken?: string;
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
  return path.join(process.env.SHIPKIT_STATE_DIR ?? path.join(process.env.HOME ?? '.', '.ship'), 'builders');
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
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error(`builder state ${path.basename(file)} cannot read (${(e as NodeJS.ErrnoException).code ?? 'EIO'}) — refusing cloud mutation`);
  }
  try {
    const s = JSON.parse(text) as BuilderState;
    const string = (value: unknown) => typeof value === 'string' && value.length > 0;
    const date = (value: unknown) => string(value) && Number.isFinite(Date.parse(value as string));
    const l = s?.lease;
    if (!s || typeof s !== 'object' || !string(s.instanceId) || !string(s.region) || !string(s.token) ||
      !['ready', 'provisioning'].includes(s.status) || !date(s.createdAt) || !date(s.expireAt) ||
      (s.url !== undefined && !string(s.url)) || (s.lastUsedAt !== undefined && !date(s.lastUsedAt)) ||
      (l !== undefined && (!l || !Number.isInteger(l.pid) || l.pid <= 0 || !date(l.acquiredAt) || !date(l.expiresAt) ||
        (l.ownerToken !== undefined && !string(l.ownerToken))))) throw new Error('invalid shape or timestamp');
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
  const files = (await readdir(root).catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return [] as string[];
    throw e;
  })).filter((f) => f.startsWith('b-') && f.endsWith('.json'));
  const out: Array<{ file: string; state: BuilderState }> = [];
  for (const f of files) {
    const file = path.join(root, f);
    const state = await readState(file);
    if (state) out.push({ file, state });
  }
  return out;
}

// ---- task leases (RA04) ----

/** unexpired, or expired while the holder process is still alive (it will renew or release) */
export function leaseHeldByOther(st: BuilderState, ownerToken?: string): boolean {
  const l = st.lease;
  if (!l) return false;
  if (ownerToken && l.pid === process.pid && l.ownerToken === ownerToken) return false;
  if (new Date(l.expiresAt).getTime() > Date.now()) return true;
  return pidAlive(l.pid);
}

/** Caller must already hold withLock: admission and claim are one transaction. */
export async function acquireLeaseLocked(file: string, ownerToken: string): Promise<BuilderState> {
  const st = await readState(file);
  if (!st) throw new Error('cannot lease: no builder state');
  if (leaseHeldByOther(st, ownerToken)) throw new Error(`builder is BUSY: lease held by pid ${st.lease?.pid}`);
  const next: BuilderState = {
    ...st,
    lease: { pid: process.pid, ownerToken, acquiredAt: new Date().toISOString(), expiresAt: new Date(Date.now() + LEASE_TTL_MS).toISOString() },
  };
  await writeState(file, next);
  return next;
}

export function acquireLease(file: string, ownerToken: string = randomUUID()): Promise<BuilderState> {
  return withLock(file, () => acquireLeaseLocked(file, ownerToken));
}

export async function renewLease(file: string, ownerToken: string): Promise<void> {
  await withLock(file, async () => {
    const st = await readState(file);
    if (!st?.lease || st.lease.pid !== process.pid || st.lease.ownerToken !== ownerToken) return;
    await writeState(file, { ...st, lease: { ...st.lease, expiresAt: new Date(Date.now() + LEASE_TTL_MS).toISOString() } });
  });
}

/** task END: clears the lease and anchors the idle window here (RA04) */
export async function releaseLease(file: string, ownerToken: string): Promise<void> {
  await withLock(file, async () => {
    const st = await readState(file);
    if (!st?.lease || st.lease.pid !== process.pid || st.lease.ownerToken !== ownerToken) return;
    await writeState(file, { ...st, lease: undefined, lastUsedAt: new Date().toISOString() });
  });
}
