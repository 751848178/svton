import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { exec } from '../shared/exec.js';
import { freezeSourceDir } from '../cli/source-freeze.js';
import type { ProjectContext } from './project-context.js';

export async function fingerprint(c: ProjectContext, mode: 'git' | 'directory', keepEnv: boolean) {
  const envFiles = Object.values(c.spec.services).map((s) => s.envFile).filter((s): s is string => Boolean(s));
  const configBytes = await readFile(c.configPath);
  const configDigest = createHash('sha256').update(configBytes).digest('hex');
  const hash = createHash('sha256').update(configBytes).update(JSON.stringify(c.spec));
  // Private immutable bytes used by both validation and the eventual deploy.
  const envSnapshot: Record<string, string> = {};
  for (const file of keepEnv ? [] : envFiles) {
    const bytes = await readFile(path.resolve(c.rootPath, file)).catch(() => null);
    hash.update(file).update(bytes ?? Buffer.from('absent'));
    if (bytes) envSnapshot[file] = bytes.toString('utf8');
  }
  let sourceDigest: string | undefined;
  let gitRef: string | undefined;
  if (mode === 'directory') {
    const frozen = await freezeSourceDir(c.rootPath, envFiles, c.rootPath);
    try { sourceDigest = frozen.contentDigest; hash.update(sourceDigest); }
    finally { await frozen.cleanup(); }
  } else {
    const ref = c.config.source?.ref ?? 'HEAD';
    const commit = await exec('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: c.rootPath, timeoutMs: 15_000 });
    if (commit.code !== 0) throw new Error('Configured Git ref is unavailable locally; fetch it or use directory source');
    gitRef = commit.stdout.trim(); hash.update(gitRef);
  }
  hash.update(mode).update(keepEnv ? 'keep' : 'replace');
  return { fingerprint: hash.digest('hex'), sourceDigest, gitRef, configDigest, envSnapshot };
}
