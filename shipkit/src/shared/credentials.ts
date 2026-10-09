// Controller-side credential store: long-term agent tokens obtained via `ship pair`
// live in ~/.ship/credentials.json (0600) and are referenced from ship.config.yaml
// through `tokenRef`. Plaintext `token` keeps working; exactly one of the two is
// allowed. Read-modify-write runs under a cross-process lock and every write goes
// through secureWrite (M2-06/M2-07): random exclusive temp, exact mode, no symlink.

import { access, constants, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ConfigError } from './config.js';
import { secureWrite } from './secure-write.js';
import { withFileLock } from './file-lock.js';
import type { TargetConfig } from './types.js';

export interface CredentialEntry {
  url: string;
  token: string;
  role?: string;
  /** CA file pinned when the entry was paired against a custom-trust HTTPS entry;
   *  honored by the shared HTTP transport so doctor/init/release trust the same
   *  entry `ship pair --ca-file` verified (M2-10). */
  caFile?: string;
  createdAt?: string;
}

const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;

export function credentialNameError(name: string): string | null {
  return REF_RE.test(name) ? null : `凭据名须匹配 ${REF_RE.toString()}（当前 '${name}'）`;
}

export function credentialsFile(): string {
  return path.join(process.env.HOME ?? '.', '.ship', 'credentials.json');
}

export async function readCredentials(): Promise<Record<string, CredentialEntry>> {
  if (!existsSync(credentialsFile())) return {};
  try {
    const raw = JSON.parse(await readFile(credentialsFile(), 'utf8')) as Record<string, CredentialEntry>;
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    throw new ConfigError(`cannot parse ${credentialsFile()} — fix or remove it, then re-run \`ship pair\``);
  }
}

/** cheap pre-flight used before a one-time pairing code is consumed (M2-08):
 *  the store must parse and its directory must be writable */
export async function assertCredentialsStoreWritable(): Promise<void> {
  const file = credentialsFile();
  await readCredentials(); // throws ConfigError on a corrupt store
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await access(path.dirname(file), constants.W_OK);
}

export async function saveCredential(name: string, entry: CredentialEntry): Promise<void> {
  const err = credentialNameError(name);
  if (err) throw new ConfigError(err);
  const file = credentialsFile();
  // the kernel mutex does not touch the filesystem — the store directory is ours to create
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const all = await withFileLock(file, async () => {
    const current = await readCredentials();
    current[name] = { ...entry, createdAt: entry.createdAt ?? new Date().toISOString() };
    await secureWrite(file, JSON.stringify(current, null, 2), 0o600);
    return current;
  });
  return void all;
}

function normUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export interface ResolvedTarget {
  url: string;
  token: string;
  via: 'plaintext' | 'credential-ref';
  /** absolute CA file path when the paired credential pinned one (M2-10) */
  caFile?: string;
}

/** single boundary where a TargetConfig becomes a usable (url, token) pair */
export async function resolveTargetToken(t: TargetConfig, at = 'target'): Promise<ResolvedTarget> {
  const hasToken = typeof t.token === 'string' && t.token.length > 0;
  const hasRef = typeof t.tokenRef === 'string' && t.tokenRef.length > 0;
  if (hasToken && hasRef) throw new ConfigError(`${at}: token and tokenRef are mutually exclusive — keep exactly one`);
  if (hasToken) return { url: t.url, token: t.token!, via: 'plaintext', ...(t.caFile ? { caFile: t.caFile } : {}) };
  if (!hasRef) throw new ConfigError(`${at}.token is required (or use tokenRef + \`ship pair\`)`);
  const ref = t.tokenRef!;
  if (!REF_RE.test(ref)) throw new ConfigError(`${at}.tokenRef '${ref}' is not a valid credential name`);
  const entry = (await readCredentials())[ref];
  if (!entry?.token) {
    throw new ConfigError(`${at}.tokenRef '${ref}' not found in ~/.ship/credentials.json — run \`ship pair\` to create it, or use a plaintext token`);
  }
  if (entry.url && normUrl(entry.url) !== normUrl(t.url)) {
    throw new ConfigError(`${at}.tokenRef '${ref}' points at ${entry.url} but the config says ${t.url} — stale reference: re-pair or fix the config`);
  }
  if (entry.caFile !== undefined && !path.isAbsolute(entry.caFile)) {
    throw new ConfigError(
      `${at}.tokenRef '${ref}' 记录的 caFile 是相对路径 '${entry.caFile}'（历史版本写入，会随后续命令的工作目录漂移，无法确定原始基准目录）。` +
      `修复：用绝对路径重新配对（ship pair ${entry.url || t.url} --ca-file /绝对/路径/ca.pem --name ${ref}），` +
      `或直接编辑 ~/.ship/credentials.json 把该条目的 caFile 改为当初那份 CA 的绝对路径。` +
      '不要改用当前目录下同名的其他证书——它不一定是该入口的原信任来源。',
    );
  }
  return entry.caFile
    ? { url: t.url, token: entry.token, via: 'credential-ref', caFile: entry.caFile }
    : { url: t.url, token: entry.token, via: 'credential-ref' };
}
