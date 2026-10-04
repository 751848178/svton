// Project-level init lock (M1-09): a second concurrent `ship init` in the same
// directory must stop instead of planning against files another run is writing.
// Stale locks (dead pid or older than the takeover window) are removed.

import { mkdir, open, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const LOCK_TTL_MS = 10 * 60_000;

export class LockHeldError extends Error {
  constructor(lockPath: string, holder: string) {
    super(`另一个 ship init 正在运行（${holder}，锁文件 ${lockPath}）；完成后重试，或确认无进程后删除该锁文件。`);
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function writeExclusively(lockPath: string): Promise<void> {
  const fh = await open(lockPath, 'wx', 0o600);
  await fh.writeFile(String(process.pid));
  await fh.close();
}

async function acquire(lockPath: string): Promise<void> {
  await mkdir(path.dirname(lockPath), { recursive: true });
  try {
    await writeExclusively(lockPath);
    return;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
  }
  let holder = '未知进程';
  let stale = false;
  try {
    const body = (await readFile(lockPath, 'utf8')).trim();
    const pid = Number(body);
    holder = `pid ${body}`;
    stale = !Number.isInteger(pid) || !pidAlive(pid);
    if (!stale) {
      const age = Date.now() - (await stat(lockPath)).mtimeMs;
      if (age >= LOCK_TTL_MS) stale = true;
    }
  } catch {
    stale = true; // unreadable lock: treat as stale
  }
  if (!stale) throw new LockHeldError(lockPath, holder);
  await rm(lockPath, { force: true });
  try {
    await writeExclusively(lockPath);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw new LockHeldError(lockPath, '刚被其他进程抢占');
    throw e;
  }
}

/** run `fn` while holding <cwd>/.ship/init.lock; always released on exit */
export async function withInitLock<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = path.join(cwd, '.ship', 'init.lock');
  await acquire(lockPath);
  try {
    return await fn();
  } finally {
    await rm(lockPath, { force: true });
  }
}
