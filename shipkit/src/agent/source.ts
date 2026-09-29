// Source materialization (F07 id containment, F08 token redaction, F23 per-invocation fetch auth, F24 ref resolution).

import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { exec } from '../shared/exec.js';
import type { BuildSource } from '../shared/types.js';

type Log = (line: string) => void;

const TARBALL_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA_RE = /^[0-9a-f]{7,40}$/;

const REDACT = (s: string) => s.replace(/(https?:\/\/)[^@/\s]+@/g, '$1***@');

async function git(log: Log, args: string[], timeoutMs: number): Promise<void> {
  const r = await exec('git', args, { timeoutMs, onLine: (l) => log(l) });
  if (r.code !== 0) throw new Error(`git ${REDACT(args.join(' '))} failed (exit ${r.code})`);
}

function authUrl(repo: string, token: string | undefined): string {
  if (!token || !repo.startsWith('http')) return repo;
  try {
    const u = new URL(repo);
    u.username = 'x-access-token';
    u.password = token;
    return u.toString();
  } catch {
    return repo;
  }
}

async function refExists(dir: string, rev: string): Promise<boolean> {
  const r = await exec('git', ['-C', dir, 'rev-parse', '--verify', '--quiet', rev], { timeoutMs: 15_000 });
  return r.code === 0;
}

/** commit > remote branch > tag; unknown refs fail with a clear message (F24). */
async function resolveRef(log: Log, dir: string, ref: string): Promise<string> {
  if (SHA_RE.test(ref) && (await refExists(dir, `${ref}^{commit}`))) return ref;
  if (await refExists(dir, `origin/${ref}`)) return `origin/${ref}`;
  if (await refExists(dir, `refs/tags/${ref}`)) return `refs/tags/${ref}`;
  throw new Error(`ref '${ref}' not found as commit/branch/tag after fetch`);
}

export async function ensureSource(
  workRoot: string,
  source: BuildSource,
  log: Log,
): Promise<{ dir: string; sha?: string }> {
  const sourcesRoot = path.join(workRoot, 'sources');
  await mkdir(sourcesRoot, { recursive: true });
  const rootReal = await realpath(sourcesRoot);

  if (source.type === 'tarball') {
    if (!TARBALL_ID_RE.test(source.id)) throw new Error(`invalid tarball source id '${source.id}'`);
    const dir = path.join(sourcesRoot, `tar-${source.id}`);
    const real = await realpath(dir).catch(() => null);
    if (!real || !real.startsWith(rootReal + path.sep)) {
      throw new Error(`tarball source ${source.id} not found (upload it first via POST /api/sources)`);
    }
    return { dir };
  }

  const repo = source.repo;
  if (!/^https?:\/\//.test(repo)) throw new Error(`git repo must be an http(s) URL, got: ${repo}`);
  const ref = source.ref ?? 'HEAD';
  const key = createHash('sha1').update(`${repo}#${ref}`).digest('hex').slice(0, 12);
  const dir = path.join(sourcesRoot, `git-${key}`);

  if (existsSync(path.join(dir, '.git'))) {
    log(`fetching updates in existing clone of ${repo}`);
    // auth URL passed per-invocation and never persisted in .git/config (F23)
    await git(log, [
      '-C', dir, 'fetch', '--tags', '--force', authUrl(repo, source.token),
      '+refs/heads/*:refs/remotes/origin/*', '+refs/tags/*:refs/tags/*',
    ], 10 * 60_000);
  } else {
    log(`cloning ${repo} (ref ${ref})`);
    try {
      await git(log, ['clone', authUrl(repo, source.token), dir], 30 * 60_000);
    } catch (e) {
      await rm(dir, { recursive: true, force: true });
      throw e;
    }
    if (source.token) await git(log, ['-C', dir, 'remote', 'set-url', 'origin', repo], 60_000);
  }

  let target: string;
  if (ref === 'HEAD') {
    await git(log, ['-C', dir, 'remote', 'set-head', 'origin', '--auto'], 60_000);
    target = 'origin/HEAD';
  } else {
    target = await resolveRef(log, dir, ref);
  }
  await git(log, ['-C', dir, 'checkout', '--detach', '--force', target], 60_000);

  const shaR = await exec('git', ['-C', dir, 'rev-parse', 'HEAD'], { timeoutMs: 15_000 });
  return { dir, sha: shaR.code === 0 ? shaR.stdout.trim() : undefined };
}

export function newTarballId(): string {
  return randomUUID();
}
