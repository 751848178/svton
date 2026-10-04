// Agent-side security store: one-time pairing codes + paired tokens, persisted
// HASHED (sha256); replay of a consumed code is distinguishable from unknown.
// M2-06: every read-modify-write is a cross-process transaction (lock + re-read
// under the lock + exclusive-commit), so the agent and an administrator `--pair`
// process can never overwrite each other's state.

import { createHash, randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { HttpFail } from './http-fail.js';
import { secureWrite } from '../shared/secure-write.js';
import { withFileLock } from '../shared/file-lock.js';

export type PairRole = 'builder' | 'runtime';

export interface PairingCode {
  id: string;
  codeHash: string;
  role: PairRole;
  createdAt: string;
  expiresAt: string;
  maxAttempts: number;
  attempts: number;
  consumedAt: string | null;
}

export interface PairedToken {
  tokenHash: string;
  role: PairRole;
  label: string;
  createdAt: string;
}

interface SecurityFile {
  codes: PairingCode[];
  tokens: PairedToken[];
  /** global wrong-code budget: brute force must not iterate entries for free */
  failures: { count: number; windowStart: string };
}

const FAIL_WINDOW_MS = 15 * 60_000;
const FAIL_LIMIT = 20;
const CONSUMED_RETENTION_MS = 24 * 3600_000;

/** corrupt on-disk state: refuse to serve or overwrite it (M2-06) */
export class SecurityStateError extends Error {}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomWithPrefix(prefix: string): string {
  return prefix + randomBytes(24).toString('base64url');
}

export class SecurityStore {
  private file: SecurityFile = { codes: [], tokens: [], failures: { count: 0, windowStart: nowIso() } };
  private mtimeMs = -1;

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    if (!existsSync(this.filePath)) {
      this.mtimeMs = 0;
      this.file = { codes: [], tokens: [], failures: { count: 0, windowStart: nowIso() } };
      return;
    }
    let raw: Partial<SecurityFile>;
    try {
      raw = JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<SecurityFile>;
    } catch (e) {
      throw new SecurityStateError(
        `${this.filePath} 无法解析（${e instanceof Error ? e.message : String(e)}）——拒绝读取或覆盖损坏的安全状态；请人工检查该文件`,
      );
    }
    this.file = {
      codes: Array.isArray(raw.codes) ? raw.codes : [],
      tokens: Array.isArray(raw.tokens) ? raw.tokens : [],
      failures: raw.failures ?? { count: 0, windowStart: nowIso() },
    };
    this.mtimeMs = (await stat(this.filePath)).mtimeMs;
  }

  /** pick up writes made by other processes; throws SecurityStateError on corruption */
  private async refreshIfChanged(): Promise<void> {
    if (!existsSync(this.filePath)) return;
    const mtime = (await stat(this.filePath)).mtimeMs;
    if (mtime !== this.mtimeMs) await this.load();
  }

  private async persistLocked(): Promise<void> {
    // M2-07: random exclusive temp + exact 0600 + symlink refusal (shared secureWrite)
    await secureWrite(this.filePath, JSON.stringify(this.file, null, 2), 0o600);
    this.mtimeMs = (await stat(this.filePath)).mtimeMs;
  }

  /** lock → re-read → mutate → commit (also for marked dirty failures) → release */
  private async tx<T>(fn: (markDirty: () => void) => Promise<T> | T): Promise<T> {
    return withFileLock(this.filePath, async () => {
      await this.load();
      let dirty = false;
      const markDirty = () => { dirty = true; };
      try {
        const out = await fn(markDirty);
        await this.persistLocked();
        return out;
      } catch (e) {
        if (dirty) await this.persistLocked();
        throw e;
      }
    });
  }

  private pruneLocked(now: number): void {
    this.file.codes = this.file.codes.filter((c) => {
      if (c.consumedAt) return now - Date.parse(c.consumedAt) < CONSUMED_RETENTION_MS;
      return now < Date.parse(c.expiresAt) + 7 * 24 * 3600_000;
    });
  }

  async createCode(role: PairRole, ttlMinutes: number): Promise<{ code: string; id: string; expiresAt: string }> {
    const ttl = Math.min(Math.max(Math.floor(ttlMinutes), 1), 60);
    return this.tx(() => {
      const now = Date.now();
      this.pruneLocked(now);
      const code = randomWithPrefix('skp-');
      const entry: PairingCode = {
        id: randomBytes(6).toString('hex'),
        codeHash: sha256(code),
        role,
        createdAt: nowIso(),
        expiresAt: new Date(now + ttl * 60_000).toISOString(),
        maxAttempts: 5,
        attempts: 0,
        consumedAt: null,
      };
      this.file.codes.push(entry);
      return { code, id: entry.id, expiresAt: entry.expiresAt };
    });
  }

  /** wrong codes burn a shared budget — enumeration cannot probe entries for free */
  private burnFailureLocked(): void {
    const now = Date.now();
    if (now - Date.parse(this.file.failures.windowStart) > FAIL_WINDOW_MS) {
      this.file.failures = { count: 1, windowStart: nowIso() };
    } else {
      this.file.failures.count += 1;
    }
  }

  async exchange(code: string, label: string): Promise<{ token: string; role: PairRole }> {
    return this.tx((markDirty) => {
      const now = Date.now();
      if (this.file.failures.count >= FAIL_LIMIT && now - Date.parse(this.file.failures.windowStart) <= FAIL_WINDOW_MS) {
        throw new HttpFail(429, 'pairing_locked', 'too many failed pairing attempts — try again later');
      }
      const hash = sha256(code);
      const entry = this.file.codes.find((c) => c.codeHash === hash);
      if (!entry || entry.attempts >= entry.maxAttempts) {
        this.burnFailureLocked();
        markDirty();
        throw new HttpFail(401, 'pairing_invalid', 'unknown or exhausted pairing code');
      }
      if (entry.consumedAt) {
        this.burnFailureLocked();
        markDirty();
        throw new HttpFail(401, 'pairing_replayed', 'pairing code already used — ask the administrator for a new one');
      }
      if (now >= Date.parse(entry.expiresAt)) {
        this.burnFailureLocked();
        markDirty();
        throw new HttpFail(401, 'pairing_expired', 'pairing code expired — ask the administrator for a new one');
      }
      const token = randomWithPrefix('skt-');
      this.file.tokens.push({ tokenHash: sha256(token), role: entry.role, label, createdAt: nowIso() });
      entry.consumedAt = nowIso();
      return { token, role: entry.role };
    });
  }

  /** auth path: fresh-enough mirror, then a pure in-memory hash lookup */
  async authenticate(bearer: string): Promise<PairRole | null> {
    await this.refreshIfChanged();
    const hash = sha256(bearer);
    return this.file.tokens.find((t) => t.tokenHash === hash)?.role ?? null;
  }

  /** sanitized view for `--pair --list`: never exposes hashes or plaintext */
  async listCodes(): Promise<Array<{ id: string; role: PairRole; expiresAt: string; consumed: boolean; attempts: number; maxAttempts: number }>> {
    return this.tx(() => this.file.codes.map((c) => ({
      id: c.id, role: c.role, expiresAt: c.expiresAt, consumed: c.consumedAt !== null, attempts: c.attempts, maxAttempts: c.maxAttempts,
    })));
  }
}
