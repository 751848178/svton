// Cross-process publication mutex (REG-03) — a Lamport BAKERY built from
// name-owned directories. Two phases close the create/scan TOCTOU that a
// plain pid-ordered queue cannot: (1) create a CHOOSING marker
// `<claim>.pubc-<pid>-<rand>`, (2) read the committed queue dirs and COMMIT
// my own `<claim>.pubq-<seq>-<pid>-<rand>` with seq = max(committed)+1, then
// remove the marker. Entry waits until no live choosing marker remains and no
// live committed dir sorts before (seq, pid, rand). Creation IS ownership; a
// leaked marker/dir is reclaimed ONLY when its NAME pid is provably dead
// (kill ESRCH — EPERM, parse failure or self count as alive). FAULT RULES:
// an unenumerable directory is NEVER an empty queue (bounded retry, then an
// explicit conservative error); a cleanup failure of EITHER marker settles
// the in-process gate first and records that exact name for recovery — a
// later call for the same claim recovers its own leftovers by name, never
// another live call's slot. Every wait is deadline-bounded.

import { kill as killProbe } from 'node:process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const jitter = (ms = 25) => new Promise((r) => setTimeout(r, 5 + Math.floor(Math.random() * ms)));

/** readdir with bounded retry on permission/transient faults; an
 *  unenumerable directory is never an empty queue — fail closed on timeout */
export async function readEntries(dir: string, expired: () => boolean, stage: string): Promise<string[]> {
  for (;;) {
    try {
      return await readdir(dir);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'EACCES' && code !== 'EPERM' && code !== 'EAGAIN') throw e;
      if (expired()) throw new Error(`锁注册表目录不可枚举（${dir}：${code}，${stage}）— 保守失败，可重试`);
      await jitter();
    }
  }
}

/** PROVEN death only: ESRCH. EPERM (exists), unparsed or own pid ⇒ alive. */
function pidDead(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return false;
  try {
    killProbe(pid, 0);
    return false;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'ESRCH';
  }
}
/** rm a marker ignoring reclaimer races (ENOENT/ENOTEMPTY) */
async function rmMarker(dir: string): Promise<void> {
  for (let i = 0; i < 3; i++) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'ENOTEMPTY' && code !== 'ENOENT') throw e;
      await new Promise((r) => setTimeout(r, 2));
    }
  }
}
interface Slot {
  seq: number;
  pid: number;
  rand: string;
}
/** `b` outranks `a` in the total order (a must wait for b) */
const outranks = (a: Slot, b: Slot): boolean =>
  b.seq < a.seq || (b.seq === a.seq && (b.pid < a.pid || (b.pid === a.pid && b.rand < a.rand)));
function parseQueue(qprefix: string, name: string): Slot | null {
  const parts = name.slice(qprefix.length).split('-');
  const seq = Number(parts[0]);
  const pid = Number(parts[1]);
  if (!Number.isInteger(seq) || !Number.isInteger(pid) || pid <= 0) return null; // garbage
  return { seq, pid, rand: parts.slice(2).join('-') };
}
/** reclaim dead contenders; report live choosing markers and earlier slots.
 *  `skip` names are THIS process's own leaked slots — removed by exact name,
 *  never counted as blockers, and never confused with another live call's */
async function scanQueue(
  parent: string,
  cprefix: string,
  qprefix: string,
  self: Slot & { name: string },
  skip: ReadonlySet<string>,
  expired: () => boolean,
): Promise<{ choosing: number; earlier: boolean }> {
  let choosing = 0;
  let earlier = false;
  for (const e of await readEntries(parent, expired, '发布队列扫描')) {
    if (skip.has(e)) {
      await rmMarker(path.join(parent, e)).catch(() => {}); // our leftover — safe by name
      continue;
    }
    if (e.startsWith(cprefix)) {
      const pid = Number(e.slice(cprefix.length).split('-')[0]);
      if (pidDead(pid)) await rmMarker(path.join(parent, e));
      else choosing++; // unknown-number contender (or garbage): must wait
      continue;
    }
    if (!e.startsWith(qprefix) || e === self.name) continue;
    const slot = parseQueue(qprefix, e);
    if (!slot) { earlier = true; continue; } // garbage queue name: conservative block
    if (pidDead(slot.pid)) await rmMarker(path.join(parent, e)); // proven dead — reclaim
    else if (outranks(self, slot)) earlier = true;
  }
  return { choosing, earlier };
}
/** per-key in-process chain: REQUIRED before touching the queue — same-pid
 *  siblings are never reclaimable, so same-process callers must not queue */
const processMutexes = new Map<string, Promise<unknown>>();
/** this process's own slots whose cleanup failed (recovered by exact name on
 *  a later call for the same claim — never another live call's slot) */
const leakedSlots = new Map<string, Set<string>>();
export async function withPublishMutex<T>(
  claimFile: string,
  lockKey: string,
  expired: () => boolean,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = processMutexes.get(lockKey) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const next = prev.then(() => gate);
  processMutexes.set(lockKey, next);
  await prev.catch(() => undefined);
  const parent = path.dirname(claimFile);
  const stem = path.basename(claimFile);
  const cprefix = `${stem}.pubc-`;
  const qprefix = `${stem}.pubq-`;
  const pid = process.pid;
  const rand = randomBytes(4).toString('hex');
  const mutexOver = new Error('无法获得文件锁（获取预算耗尽）：发布互斥等待超时');
  // cleanup failed: the gate STILL settles; remember this exact marker so a
  // later call for the same claim can recover it safely by name
  const recordLeak = (name: string): void => {
    const l = leakedSlots.get(claimFile) ?? new Set<string>();
    l.add(name);
    leakedSlots.set(claimFile, l);
  };
  let choosingDir = ''; // created by phase 1 (empty until it succeeds)
  let queueDir = ''; // committed slot created by phase 2
  try {
    const leaked = leakedSlots.get(claimFile);
    if (leaked?.size) {
      for (const name of [...leaked]) {
        try {
          await rmMarker(path.join(parent, name));
          leaked.delete(name);
        } catch { /* fault persists — retried on the next call */ }
      }
      if (!leaked.size) leakedSlots.delete(claimFile);
    }
    for (;;) {
      if (expired()) throw mutexOver;
      choosingDir = `${cprefix}${pid}-${rand}`;
      try {
        await mkdir(path.join(parent, choosingDir), { mode: 0o777 }); // phase 1: choosing
        break;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; // rand collision — retry
      }
    }
    let seq = 1;
    try {
      for (const e of await readEntries(parent, expired, '序号读取')) {
        if (!e.startsWith(qprefix)) continue;
        const n = Number(e.slice(qprefix.length).split('-')[0]);
        if (Number.isInteger(n) && n >= seq) seq = n + 1; // my number: max committed + 1
      }
      queueDir = `${qprefix}${String(seq).padStart(12, '0')}-${pid}-${rand}`;
      await mkdir(path.join(parent, queueDir), { mode: 0o777 }); // phase 2: COMMIT my number
    } finally {
      try {
        await rmMarker(path.join(parent, choosingDir)); // phase 3 (crash ⇒ dead-pid reclaim)
      } catch (e) {
        recordLeak(choosingDir); // failed marker cleanup: record, fail closed, gate settles below
        throw e;
      }
    }
    const self: Slot & { name: string } = { seq, pid, rand, name: queueDir };
    for (;;) {
      if (expired()) throw mutexOver;
      const st = await scanQueue(parent, cprefix, qprefix, self, leakedSlots.get(claimFile) ?? new Set(), expired);
      if (st.choosing === 0 && !st.earlier) break; // phase 4: my turn
      await jitter();
    }
    return await fn();
  } finally {
    if (queueDir) {
      try {
        await rmMarker(path.join(parent, queueDir));
      } catch (e) {
        recordLeak(queueDir); // never leak my slot silently — recover on a later call
        void e;
      }
    }
    release();
    if (processMutexes.get(lockKey) === next) processMutexes.delete(lockKey);
  }
}
