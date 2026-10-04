// Cross-process exclusive lock for read-modify-write transactions on a shared
// file (M2-06/M2-07). Same host only. The mutex is a KERNEL-owned resource:
// a TCP listener on 127.0.0.1, one port per canonical lock key claimed via
// the fixed-root registry in lock-registry.ts (same key ⇒ same port forever).
// Identity (TCP-01/KEY-01): parent aliases and missing multi-level parents
// yield ONE stable key; a final symlink component is refused.
// ACQUIRE = bind (atomic; success means we HOLD — no approved-but-unbound
// window). HOLD = the listener answers every probe with
// `shiplock:<pid>:<keyhash>`; no fs operation can steal a bound port. CRASH
// RELEASE: the kernel closes the socket when the process dies. RELEASE binds
// the ACQUISITION key/token; every accepted connection is tracked and
// destroyed at shutdown (half-open peers cannot stall server.close). PROBE
// (TCP-02): each of data/end/close/error/timeout settles exactly once within
// the remaining budget; informative results are remembered. EADDRINUSE: our
// keyhash ⇒ wait; other keyhash ⇒ collision ⇒ wait; non-shiplock banner ⇒
// clear error (never steal); no banner ⇒ jitter and retry. WAIT-01: the
// WHOLE acquisition (allocation, first bind, every retry/backoff) races one
// deadline; any late-success listener is closed and fn never runs.
import { createServer, connect, type Server, type Socket } from 'node:net';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { claimPort } from './lock-registry.js';
import { probeBanner, type BannerProbe } from './lock-bindtest.js';

export interface LockOptions {
  /** give up after this long (default 15s); never steals a live lock */
  timeoutMs?: number;
}
interface Holding {
  key: string; token: string; server: Server; port: number;
}
const holdings = new Map<string, Holding>(); // this process's release authority

/**
 * Canonical lock identity (TCP-01 + KEY-01): refuse a symlink final target;
 * walk up to the deepest EXISTING ancestor, realpath it (parent aliases
 * normalize) and rejoin EVERY remaining component — a not-yet-created
 * multi-level parent keeps its full tail, so the key is byte-identical
 * before and after those directories appear. The target's own inode is
 * never used (secureWrite replaces it atomically).
 */
export function lockKeyOf(file: string): string {
  const abs = path.resolve(file);
  try {
    if (lstatSync(abs).isSymbolicLink()) {
      throw new Error(`拒绝为符号链接目标加锁：${abs}（与安全写入规则一致）`);
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; // absent = first creation, fine
  }
  const parts: string[] = [];
  let dir = path.dirname(abs);
  for (;;) {
    try {
      dir = realpathSync(dir);
      break;
    } catch {
      parts.unshift(path.basename(dir)); // missing component: KEEP it (KEY-01)
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return path.join(dir, ...parts, path.basename(abs));
}

/** the claimed port for a lock file (test/diagnostic aid) */
export function lockPortFor(file: string): Promise<number> {
  return claimPort(lockKeyOf(file));
}

/** bind with per-connection tracking so shutdown never depends on peers */
function bindTracked(port: number, banner: string): Promise<Server | null> {
  return new Promise((resolve) => {
    const server = createServer();
    const sockets = new Set<Socket>();
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.once('close', () => sockets.delete(socket));
      socket.end(banner);
    });
    (server as unknown as { __sockets?: Set<Socket> }).__sockets = sockets;
    server.once('error', () => resolve(null));
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}
type Probe = BannerProbe;
function shutdown(server: Server): Promise<void> {
  const sockets = (server as unknown as { __sockets?: Set<Socket> }).__sockets;
  for (const s of sockets ?? []) s.destroy(); // half-open peers cannot stall us
  return new Promise((resolve) => server.close(() => resolve()));
}
/** release only what still owns `token` (acquisition identity) */
export async function releaseLockIfOwner(lockPath: string, token: string): Promise<boolean> {
  const current = holdings.get(lockKeyOf(lockPath));
  const held = current?.token === token ? current
    : [...holdings.values()].find((h) => h.token === token); // acquisition-time identity
  if (!held) return false; // not ours / already released
  holdings.delete(held.key);
  await shutdown(held.server);
  return true;
}
/** this process's current holding token (test/diagnostic aid) */
export function heldToken(lockPath: string): string | null {
  return holdings.get(lockKeyOf(lockPath))?.token ?? null;
}

function timeoutError(key: string, timeoutMs: number, info: Probe): Error {
  const state = info.kind === 'ours'
    ? `holder pid ${info.pid ?? '?'} is alive`
    : info.kind === 'other'
      ? `端口被另一锁文件占用（keyhash 不同）— port collision`
      : 'holder cannot be identified (port busy, no banner)';
  return new Error(`无法获得文件锁（等待 ${timeoutMs}ms 超时）：${key} — ${state}；不会抢占仍被持有的锁`);
}

/** settle `step` by `deadline`; infoAt() supplies the rejection's probe info
 *  so contention-phase errors keep the classification seen while waiting */
function raceDeadline<T>(
  step: Promise<T>,
  deadline: number,
  key: string,
  timeoutMs: number,
  infoAt: () => Probe = () => ({ kind: 'none' }),
): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw timeoutError(key, timeoutMs, infoAt());
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(timeoutError(key, timeoutMs, infoAt())), Math.max(1, remaining));
    step.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

export async function withFileLock<T>(file: string, fn: () => Promise<T> | T, opts: LockOptions = {}): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const key = lockKeyOf(file);
  const keyHash = createHash('sha256').update(key).digest('hex').slice(0, 8);
  const token = randomBytes(16).toString('hex');
  const banner = `shiplock:${process.pid}:${keyHash}\n`;
  const deadline = Date.now() + timeoutMs;
  // WAIT-01: the acquisition must RETURN by the deadline — allocate+bind races it; late binds are shut down
  const acquiring = (async () => {
    const port = await claimPort(key, deadline);
    if (Date.now() >= deadline) throw timeoutError(key, timeoutMs, { kind: 'none' });
    const s = await bindTracked(port, banner);
    return { port, server: s };
  })();
  let port: number;
  let server: Server | null;
  try {
    ({ port, server } = await raceDeadline(acquiring, deadline, key, timeoutMs));
  } catch (e) {
    // the step may still complete later: close any late listener, never publish
    acquiring.then((r) => { if (r.server) shutdown(r.server).catch(() => undefined); }, () => undefined).catch(() => undefined);
    throw e;
  }
  let lastInfo: Probe | null = null; // informative results survive tiny-budget 'none's
  while (!server) {
    const remaining = deadline - Date.now();
    if (remaining < 20) {
      const info = lastInfo ?? { kind: 'none' } as Probe;
      if (info.kind === 'foreign') {
        throw new Error(`无法获得文件锁：端口 ${port}（由 ${key} 领取）被无关服务占用 — refusing to steal`);
      }
      throw timeoutError(key, timeoutMs, info);
    }
    const info = await probeBanner(port, keyHash, remaining);
    if (info.kind !== 'none') lastInfo = info;
    if (info.kind === 'foreign') {
      throw new Error(`无法获得文件锁：端口 ${port}（由 ${key} 领取）被无关服务占用 — refusing to steal`);
    }
    if (Date.now() >= deadline) throw timeoutError(key, timeoutMs, lastInfo ?? info);
    await new Promise((r) => setTimeout(r, Math.min(20 + randomInt(30), Math.max(1, deadline - Date.now()))));
    // WAIT-01: every retry bind races the deadline; a late listener is closed
    const attempt = bindTracked(port, banner);
    try {
      server = await raceDeadline(attempt, deadline, key, timeoutMs, () => lastInfo ?? { kind: 'none' } as Probe);
    } catch (e) {
      attempt.then((s) => { if (s) shutdown(s).catch(() => undefined); }, () => undefined).catch(() => undefined);
      throw e;
    }
  }
  const holding: Holding = { key, token, server, port };
  if (Date.now() >= deadline) {
    // acquired past the budget: release the late listener and fail — fn must
    // never run on an exhausted acquisition (WAIT-01)
    await shutdown(holding.server);
    throw timeoutError(key, timeoutMs, { kind: 'none' });
  }
  holdings.set(key, holding);
  try {
    return await fn();
  } finally {
    if (holdings.get(key) === holding) { // release by ACQUISITION identity
      holdings.delete(key);
      await shutdown(holding.server);
    }
  }
}
