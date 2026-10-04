// Registry credentials distributed via the agent API (UX07). Stored at
// <workRoot>/registry-creds.json (0600, atomic). Handlers prefer the env
// bootstrap (F21) and fall back to this file; passwords never reach logs.

import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { secureWrite } from '../shared/secure-write.js';
import { withFileLock } from '../shared/file-lock.js';

export type CredKind = 'push' | 'pull';

export interface RegistryCreds {
  user: string;
  password: string;
}

interface CredsFile {
  push?: RegistryCreds;
  pull?: RegistryCreds;
}

function fileFor(workRoot: string): string {
  return path.join(workRoot, 'registry-creds.json');
}

export async function readRegistryCreds(workRoot: string, kind: CredKind): Promise<RegistryCreds | null> {
  const file = fileFor(workRoot);
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(await readFile(file, 'utf8')) as CredsFile;
    const c = raw?.[kind];
    return typeof c?.user === 'string' && typeof c?.password === 'string' && c.user && c.password ? c : null;
  } catch {
    return null; // unreadable creds fall back to env / anonymous
  }
}

export async function writeRegistryCreds(workRoot: string, kind: CredKind, creds: RegistryCreds): Promise<void> {
  const file = fileFor(workRoot);
  await withFileLock(file, async () => {
    let current: CredsFile = {};
    if (existsSync(file)) {
      try {
        current = JSON.parse(await readFile(file, 'utf8')) as CredsFile;
      } catch {
        current = {};
      }
    }
    current[kind] = creds;
    await mkdir(path.dirname(file), { recursive: true });
    // M2-07: shared secureWrite — random exclusive temp, exact 0600, no symlink target
    await secureWrite(file, JSON.stringify(current, null, 2), 0o600);
  });
}

/** env bootstrap wins (F21); the API-distributed file is the fallback (UX07).
 *  null = anonymous push — the registry's own 401 then names the real problem. */
export async function resolvePushCreds(workRoot: string): Promise<RegistryCreds | null> {
  const user = process.env.SHIP_PUSH_USER;
  const password = process.env.SHIP_PUSH_PASSWORD;
  if (user && password) return { user, password };
  return readRegistryCreds(workRoot, 'push');
}

/** null = anonymous pull is intended (public registry) */
export async function resolvePullCreds(workRoot: string): Promise<RegistryCreds | null> {
  const user = process.env.SHIP_PULL_USER;
  const password = process.env.SHIP_PULL_PASSWORD;
  if (user && password) return { user, password };
  return readRegistryCreds(workRoot, 'pull');
}
