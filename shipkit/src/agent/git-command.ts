// Git commands use administrator policy, pinned DNS, bounded output and temporary authentication.
import { exec, type ExecResult } from '../shared/exec.js';
import { createGitAuth } from '../shared/git-auth.js';
import { assertGitRepositoryUrl, resolveGitAddresses } from '../shared/git-policy.js';

export interface GitCommand {
  repo: string;
  run(args: string[], timeoutMs?: number): Promise<ExecResult>;
  cleanup(): Promise<void>;
}

export async function gitCommand(rawRepo: string, token: string | undefined, log: (line: string) => void, username?: string): Promise<GitCommand> {
  const url = assertGitRepositoryUrl(rawRepo);
  const config = await exec('git', ['help', '--config'], { timeoutMs: 15_000, maxBytes: 128 * 1024 });
  if (config.code !== 0 || !config.stdout.split('\n').includes('http.curloptResolve')) throw new Error('Builder Git must support http.curloptResolve for pinned repository connections');
  const addresses = await resolveGitAddresses(url.hostname);
  const auth = await createGitAuth(token, username);
  const pinned = `${url.hostname}:${url.port || '443'}:${addresses.map(({ address }) => address.includes(':') ? `[${address}]` : address).join(',')}`;
  const policy = [...auth.gitArgs, '-c', `http.${url.toString()}.proxy=`, '-c', `http.curloptResolve=${pinned}`];
  return { repo: url.toString(),
    run: (args, timeoutMs = 60_000) => exec('git', [...policy, ...args], { env: auth.env, timeoutMs, maxBytes: 1024 * 1024, onLine: line => log(line) }),
    cleanup: auth.cleanup,
  };
}

export async function requireGit(git: GitCommand, args: string[], timeoutMs?: number): Promise<ExecResult> {
  const result = await git.run(args, timeoutMs);
  if (result.code !== 0 || result.timedOut) throw new Error(`Git ${args.includes('clone') ? 'clone' : args.includes('fetch') ? 'fetch' : 'operation'} failed${result.timedOut ? ' (timeout)' : ` (exit ${result.code})`}`);
  if (result.truncated) throw new Error('Git output exceeded the bounded capture limit');
  return result;
}

export async function assertSupportedGitTree(git: GitCommand, dir: string): Promise<void> {
  const modules = await git.run(['-C', dir, 'cat-file', '-e', 'HEAD:.gitmodules'], 15_000);
  const tree = await requireGit(git, ['-C', dir, 'ls-tree', '-r', '--full-tree', 'HEAD'], 15_000);
  if (modules.code === 0 || /^160000 /m.test(tree.stdout)) throw new Error('Git submodules are not supported in this release; vendor the required source');
  const lfs = await git.run(['-C', dir, 'grep', '-I', '-l', '-E', 'filter[[:space:]]*=[[:space:]]*lfs|version https://git-lfs.github.com/spec/v1', 'HEAD', '--'], 15_000);
  if (lfs.code === 0) throw new Error('Git LFS is not supported in this release; commit ordinary files');
  if (lfs.code !== 1 || lfs.timedOut || lfs.truncated) throw new Error('Git LFS support check failed');
}
