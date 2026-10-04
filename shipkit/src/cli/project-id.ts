// Project & environment identity for deploy isolation.
//
// PROJECT identity (the repo): explicit `config.source.repo` first, then the
// git origin, else `local:` + a sha256 digest of the resolved working
// directory. The local digest is stable across reruns, immune to spaces and
// path-length limits, and carries no whitespace (it travels in JSON bodies).
// The project identity keys last-build records (image provenance is a repo
// property — environments of the same repo may share built images).
//
// ENVIRONMENT identity: the runtime target NAME (`--to prod|staging`). The
// AGENT binds an app name to (project, env): a different project OR a
// different environment deploying the same app name on the same agent is
// refused explicitly — never silently shared or overwritten.

import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { gitRemote } from '../shared/git.js';
import type { ShipConfig } from '../shared/types.js';

/** strip protocol, credentials, trailing .git and a trailing slash; lowercase
 *  the host part — git@host:owner/repo and https://host/owner/repo unify */
export function normalizeRepoUrl(url: string): string {
  const value = url.trim();
  const cleanPath = (p: string) => p.replace(/\/+$/, '').replace(/\.git$/, '');
  if (/^(https?|ssh|git):\/\//i.test(value)) {
    const parsed = new URL(value);
    const defaultPort = (parsed.protocol === 'ssh:' && parsed.port === '22') ||
      (parsed.protocol === 'git:' && parsed.port === '9418');
    const host = parsed.hostname.toLowerCase() + (parsed.port && !defaultPort ? `:${parsed.port}` : '');
    return `${host}${cleanPath(parsed.pathname)}`;
  }
  const scp = /^(?:[^/@:]+@)?([^/:]+):(.+)$/.exec(value);
  if (scp) return `${scp[1]!.toLowerCase()}/${cleanPath(scp[2]!)}`;
  return cleanPath(value);
}

/** stable local-project identity: content-addressed, no spaces, length-bounded */
export function localProjectId(cwd: string): string {
  const abs = realpathSync(path.resolve(cwd));
  return `local:${createHash('sha256').update(abs).digest('hex').slice(0, 32)}`;
}

/** the PROJECT identity (repo): explicit config.source.repo wins, then git
 *  origin, else the local digest */
export async function resolveProjectId(cwd: string, config?: ShipConfig, fromDir?: string): Promise<string> {
  // A local upload supersedes source.repo: bind the code actually uploaded,
  // not a configured Git repository which was never used by this build.
  const sourceDir = fromDir ? path.resolve(cwd, fromDir) : cwd;
  const remote = (fromDir ? undefined : config?.source?.repo) || await gitRemote(sourceDir);
  if (!remote) return localProjectId(sourceDir);
  const normalized = normalizeRepoUrl(remote);
  if (normalized.length <= 200 && !/\s/.test(normalized)) return normalized;
  return `repo:${createHash('sha256').update(normalized).digest('hex')}`;
}
