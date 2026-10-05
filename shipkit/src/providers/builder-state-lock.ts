// Builder ledger transactions reuse the existing kernel mutex. The legacy
// mkdir gate also remains, so a live older CLI is never bypassed. TCP serializes
// stale reclaim among current callers; release removes only our exact token.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { withFileLock } from '../shared/file-lock.js';

const LOCK_STALE_MS = 10 * 60_000;
interface LockOwner { pid: number; ownerToken?: string }

export function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (e) { return (e as NodeJS.ErrnoException).code !== 'ESRCH'; }
}

async function ownerOf(lock: string): Promise<LockOwner | null> {
  try {
    const owner = JSON.parse(await readFile(path.join(lock, 'owner.json'), 'utf8')) as LockOwner;
    return Number.isInteger(owner?.pid) && owner.pid > 0 ? owner : null;
  } catch { return null; }
}

async function lockBreakable(lock: string): Promise<boolean> {
  const owner = await ownerOf(lock);
  if (!owner || pidAlive(owner.pid)) return false; // unreadable/unknown is never proven dead
  const info = await stat(path.join(lock, 'owner.json')).catch(() => null);
  return Boolean(info && Date.now() - info.mtimeMs > LOCK_STALE_MS);
}

async function withLegacyGate<T>(file: string, deadline: number, fn: () => Promise<T>): Promise<T> {
  const lock = `${file}.lock`;
  await mkdir(path.dirname(lock), { recursive: true, mode: 0o700 });
  for (;;) {
    if (Date.now() >= deadline) throw new Error(`another ship process holds the builder lock (${path.basename(file)})`);
    try { await mkdir(lock, { mode: 0o700 }); }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw new Error(`builder lock cannot be created (${(e as NodeJS.ErrnoException).code ?? e}): ${lock}`);
      if (await lockBreakable(lock)) {
        await rm(lock, { recursive: true, force: true });
        continue;
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(500, Math.max(1, deadline - Date.now()))));
      continue;
    }
    const ownerToken = randomUUID();
    const ownerFile = path.join(lock, 'owner.json');
    await writeFile(ownerFile, JSON.stringify({ pid: process.pid, ownerToken, startedAt: new Date().toISOString() }), { mode: 0o600 });
    const ours = async () => {
      const owner = await ownerOf(lock);
      return owner?.pid === process.pid && owner.ownerToken === ownerToken;
    };
    const heartbeat = setInterval(() => {
      void ours().then(owned => owned ? utimes(ownerFile, new Date(), new Date()) : undefined).catch(() => {});
    }, 30_000);
    try { return await fn(); }
    finally {
      clearInterval(heartbeat);
      if (!await ours()) throw new Error(`builder lock ownership changed — refusing to remove ${lock}`);
      await rm(lock, { recursive: true, force: true });
    }
  }
}

export function withLock<T>(file: string, fn: () => Promise<T>, opts?: { waitMs?: number }): Promise<T> {
  const waitMs = opts?.waitMs ?? 30_000;
  const deadline = Date.now() + waitMs;
  return withFileLock(`${file}.builder-mutex`, () => withLegacyGate(file, deadline, fn), { timeoutMs: waitMs });
}
