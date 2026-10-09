// Materialize immutable source input under the Agent-owned source root.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import type { BuildSource } from '../shared/types.js';
import { assertSupportedGitTree, gitCommand, requireGit, type GitCommand } from './git-command.js';
import { secretLog, type SecretLog } from './log-secrets.js';

const TARBALL_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA_RE = /^[0-9a-f]{7,40}$/;

async function refExists(git: GitCommand, dir: string, rev: string): Promise<boolean> {
  const result = await git.run(['-C', dir, 'rev-parse', '--verify', '--quiet', rev], 15_000);
  return result.code === 0;
}
async function resolveRef(git: GitCommand, dir: string, ref: string): Promise<string> {
  if (SHA_RE.test(ref) && await refExists(git, dir, `${ref}^{commit}`)) return ref;
  if (await refExists(git, dir, `origin/${ref}`)) return `origin/${ref}`;
  if (await refExists(git, dir, `refs/tags/${ref}`)) return `refs/tags/${ref}`;
  throw new Error('Git ref not found as commit, branch or tag after fetch');
}

export async function ensureSource(workRoot: string, source: BuildSource, inputLog: SecretLog): Promise<{ dir: string; sha?: string }> {
  const sourcesRoot = path.join(workRoot, 'sources');
  await mkdir(sourcesRoot, { recursive: true });
  const rootReal = await realpath(sourcesRoot);
  if (source.type === 'tarball') {
    if (!TARBALL_ID_RE.test(source.id)) throw new Error(`invalid tarball source id '${source.id}'`);
    const dir = path.join(sourcesRoot, `tar-${source.id}`);
    const real = await realpath(dir).catch(() => null);
    if (!real || !real.startsWith(rootReal + path.sep)) throw new Error(`tarball source ${source.id} not found (upload it first via POST /api/sources)`);
    return { dir };
  }
  const log = secretLog(inputLog);
  if (source.token) log.addSecrets?.([source.token]);
  if (source.username) log.addSecrets?.([source.username]);
  const ref = source.ref ?? 'HEAD';
  if (!ref || ref.startsWith('-') || /[\s\0~^:?*\[\\]/.test(ref) || ref.includes('..') || ref.includes('@{') || ref.endsWith('/')) throw new Error('Git ref must be a commit SHA, branch or tag without revision operators');
  const git = await gitCommand(source.repo, source.token, log, source.username);
  const key = createHash('sha1').update(`${git.repo}#${ref}`).digest('hex').slice(0, 12);
  const dir = path.join(sourcesRoot, `git-${key}`);
  let cloning = false;
  try {
    const real = await realpath(dir).catch(() => null);
    if (real && !real.startsWith(rootReal + path.sep)) throw new Error('Git source cache escapes the Agent source root');
    if (existsSync(path.join(dir, '.git'))) {
      log(`fetching updates from ${git.repo}`);
      await requireGit(git, ['-C', dir, 'remote', 'set-url', 'origin', git.repo]);
      await requireGit(git, ['-C', dir, 'fetch', '--tags', '--force', git.repo,
        '+refs/heads/*:refs/remotes/origin/*', '+refs/tags/*:refs/tags/*'], 10 * 60_000);
    } else {
      cloning = true;
      log(`cloning ${git.repo}`);
      await requireGit(git, ['clone', '--no-checkout', '--no-recurse-submodules', '--', git.repo, dir], 10 * 60_000);
    }
    if (ref === 'HEAD') await requireGit(git, ['-C', dir, 'remote', 'set-head', 'origin', '--auto']);
    const target = ref === 'HEAD' ? 'origin/HEAD' : await resolveRef(git, dir, ref);
    await requireGit(git, ['-C', dir, 'checkout', '--detach', '--force', target]);
    await assertSupportedGitTree(git, dir);
    const sha = (await requireGit(git, ['-C', dir, 'rev-parse', 'HEAD'], 15_000)).stdout.trim();
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Git did not return a full commit SHA');
    return { dir, sha };
  } catch (error) {
    if (cloning) await rm(dir, { recursive: true, force: true });
    throw error;
  } finally { await git.cleanup(); }
}

export function newTarballId(): string { return randomUUID(); }
