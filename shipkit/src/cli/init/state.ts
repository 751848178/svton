// `.ship/init-state.json` — resumable init progress. Never stores tokens or passwords:
// a defensive strip drops secret-looking keys before anything is serialized.

import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { secureWrite } from '../../shared/secure-write.js';

export const STATE_SCHEMA_VERSION = 1;
// tokenRef is a credential NAME, not a secret — it must survive in saved progress
/** a credential NAME (tokenRef) is not a secret — it stays visible in previews */
const SECRET_KEY_RE = /token|password|secret|credential/i;
const NOT_A_SECRET_RE = /ref$/i;

export type InitStep = 'app' | 'machines' | 'registry' | 'review' | 'done';

export interface InitState {
  schemaVersion: number;
  updatedAt: string;
  step: InitStep;
  /** why the wizard cannot continue, e.g. 'no-dockerfile' / 'check-failed' */
  blocked?: string;
  /** fingerprints of the existing spec/config files when the draft was saved;
   *  a mismatch on resume means the user edited the file and the draft's
   *  defaults for that group are stale (M1-02) */
  files?: { spec?: string | null; config?: string | null };
  app?: {
    name: string;
    dockerfile: string;
    ports: string[];
    healthcheckPath: string | null;
    healthcheckHostPort: number | null;
    envFile: string | null;
  };
  machines?: { builderUrl: string; targetName: string; runtimeUrl: string };
  registry?: { url: string; namespace: string };
  checks?: Record<string, string>;
}

export function stateDir(cwd: string): string {
  return path.join(cwd, '.ship');
}

export function statePath(cwd: string): string {
  return path.join(stateDir(cwd), 'init-state.json');
}

function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_RE.test(k) && !NOT_A_SECRET_RE.test(k)) continue;
      out[k] = stripSecrets(v);
    }
    return out;
  }
  return value;
}

export async function readInitState(cwd: string): Promise<InitState | null> {
  const file = statePath(cwd);
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(await readFile(file, 'utf8')) as InitState;
    if (raw?.schemaVersion !== STATE_SCHEMA_VERSION || typeof raw.step !== 'string') return null;
    return raw;
  } catch {
    return null; // unreadable progress is treated as absent; the wizard starts over
  }
}

export async function saveInitState(cwd: string, state: InitState): Promise<void> {
  await mkdir(stateDir(cwd), { recursive: true });
  const body = JSON.stringify(stripSecrets({ ...state, updatedAt: new Date().toISOString() }), null, 2);
  // exclusive random temp + permission check (M1-08) — same primitive as config writes
  await secureWrite(statePath(cwd), body, 0o600);
}
