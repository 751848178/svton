// Per-HOST port registry for the kernel-mutex lock (fixed root, never under
// TMPDIR); one claim per canonical key. REG-03: the publication right is the
// Lamport bakery in lock-pubmutex.ts (sound cross-process serialization —
// every publisher rechecks the claim INSIDE the mutex and converges to any
// valid mapping, so a live holder's port is never rewritten; only a torn
// record — external damage, rename never tears — is repaired, and only TO a
// banner-verified live port). Discovery is CONSERVATIVE: a busy candidate
// that cannot be identified aborts acquisition instead of risking a publish
// over a live holder. WAIT-01: the deadline bounds mutex wait, discovery,
// scan and publish (checked right before rename). No unregistered fallback;
// same key ⇒ same port; different keys never share; nothing is terminated.

import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { bindTest, probeBanner } from './lock-bindtest.js';
import { withPublishMutex, readEntries } from './lock-pubmutex.js';

const PORT_LO = 49152;
const PORT_SPAN = 16383;
const REGISTRY_ROOT = '/var/tmp/shipkit-lock-ports';
const ATTEMPTS = 64;

function hashInt(...parts: string[]): number {
  return createHash('sha256').update(parts.join('\u0000')).digest().readUInt32BE(0);
}

const candidateFor = (key: string, attempt: number) => PORT_LO + (hashInt(key, String(attempt)) % PORT_SPAN);

/** absent ⇒ null; torn/invalid content ⇒ null; an UNREADABLE record is a
 *  fault, never "absent" — fail closed (an unreadable-but-valid mapping must
 *  not be published over) */
async function readClaim(file: string): Promise<{ port: number } | null> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return null;
    throw new Error(`锁注册表记录不可读（${file}：${code ?? 'EIO'}）— 保守失败，可重试`);
  }
  try {
    const parsed = JSON.parse(text) as { port?: unknown };
    const port = Number(parsed?.port);
    if (!Number.isInteger(port) || port < PORT_LO || port >= PORT_LO + PORT_SPAN) return null;
    return { port };
  } catch {
    return null; // torn content
  }
}

/** Atomic publication. Every exit owns this call's temp file (WAIT-01): the
 *  expiry return removes it, success renames it away, errors clean up in the
 *  catch. A rename that completes "late" (caller already timed out) still
 *  lands BEFORE our bakery slot is released — no other publisher can have
 *  created a mapping meanwhile — and the caller's discarded acquire pipeline
 *  closes its late listener, so the landed claim is a legitimate, single
 *  mapping that later acquirers converge to; it is never compensated by
 *  deleting a mapping someone else is using. */
async function publishAtomic(file: string, port: number, expired: () => boolean): Promise<void> {
  // key-scoped temp name so concurrent publishers never confuse residue checks
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${randomBytes(6).toString('hex')}.tmp`);
  try {
    await writeFile(temp, `${JSON.stringify({ port })}\n`, { mode: 0o644 });
    if (expired()) return; // caller gave up — drop our temp (WAIT-01)
    await rename(temp, file); // atomic: a claim is absent or COMPLETE
  } finally {
    await rm(temp, { force: true }).catch(() => {}); // rename moved it (ENOENT ok)
  }
}

/** find a live listener with OUR keyhash among the deterministic candidates.
 *  A PERSISTENTLY busy-but-unidentifiable candidate may be our holder with a
 *  stalled banner — scanning CONTINUES (our holder may sit on a later
 *  candidate), and only a completed scan that found no 'ours' while at least
 *  one candidate stayed unidentifiable aborts conservatively: never publish.
 *  A candidate that turns free (transient closer) or classifies as another
 *  keyhash/foreign is simply skipped. */
async function discoverLive(key: string, keyHash: string, deadline: number): Promise<number | null> {
  let inconclusive = false;
  for (let a = 0; a < ATTEMPTS; a++) {
    const port = candidateFor(key, a);
    if (await bindTest(port)) continue; // free right now — nobody holds it
    for (let round = 0; ; round++) {
      const left = deadline - Date.now();
      if (left <= 0) return null;
      const verdict = await probeBanner(port, keyHash, Math.min(150, left));
      if (verdict.kind === 'ours') return port;
      if (verdict.kind !== 'none') break; // classified: not ours — next candidate
      if (await bindTest(port)) break; // transient closer — next candidate
      if (round >= 2) { inconclusive = true; break; } // remember, keep scanning
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  if (inconclusive) {
    throw new Error(`锁注册表无法安全判定部分候选端口的占用者（${key}）— 保守失败，可重试`);
  }
  return null;
}

/** the ONE registered port for a lock key (bounded, conservative) */
export async function claimPort(lockKey: string, deadline = Number.POSITIVE_INFINITY): Promise<number> {
  const expired = () => Date.now() >= deadline;
  const overBudget = (stage: string) => new Error(`无法获得文件锁（获取预算耗尽）：${lockKey} — ${stage}超时`);
  try {
    await mkdir(REGISTRY_ROOT, { recursive: true, mode: 0o777 });
  } catch (e) {
    throw new Error(`锁注册表不可用（${REGISTRY_ROOT}：${e instanceof Error ? e.message : String(e)}）— 拒绝在未登记端口上加锁`);
  }
  const file = path.join(REGISTRY_ROOT, `${createHash('sha256').update(lockKey).digest('hex').slice(0, 20)}.json`);
  const keyHash = createHash('sha256').update(lockKey).digest('hex').slice(0, 8);
  let candidate: number | null = null;
  for (;;) {
    const existing = await readClaim(file);
    if (existing) return existing.port;
    if (expired()) throw overBudget('注册表分配');
    const torn = await access(file).then(() => true, () => false);
    if (torn) {
      const live = await discoverLive(lockKey, keyHash, deadline);
      if (live !== null) {
        const adopted = await withPublishMutex(file, lockKey, expired, async () => {
          const recheck = await readClaim(file);
          if (recheck) return recheck.port; // a valid mapping exists: honor it
          await publishAtomic(file, live, expired); // repair TO the live port
          return (await readClaim(file))?.port ?? live;
        });
        if (adopted !== null) return adopted;
      }
      if (expired()) throw overBudget('发现/修复');
    }
    if (candidate === null) {
      const taken = new Set<number>();
      for (const e of await readEntries(REGISTRY_ROOT, expired, '占用端口枚举')) {
        if (!e.endsWith('.json') || e === path.basename(file)) continue;
        const c = await readClaim(path.join(REGISTRY_ROOT, e));
        if (c) taken.add(c.port);
      }
      for (let a = 0; a < ATTEMPTS; a++) {
        if (expired()) throw overBudget('候选评估');
        const c = candidateFor(lockKey, a);
        if (!taken.has(c) && (await bindTest(c))) { candidate = c; break; }
      }
      if (candidate === null) {
        throw new Error(`锁注册表分配失败：${lockKey} 的 ${ATTEMPTS} 个候选端口当前均不可用 — 保守失败`);
      }
    }
    if (expired()) throw overBudget('发布前');
    const pick = candidate;
    const won = await withPublishMutex(file, lockKey, expired, async () => {
      const recheck = await readClaim(file);
      if (recheck) return recheck.port; // converge with any valid mapping
      if (!(await bindTest(pick))) return null; // candidate taken — rescan
      await publishAtomic(file, pick, expired);
      return (await readClaim(file))?.port ?? pick;
    });
    if (won !== null) return won;
    candidate = null; // our candidate lost its window — rescan on the next pass
  }
}
