// Git commands use administrator policy, pinned DNS, bounded output and temporary authentication.
import { exec, type ExecResult } from '../shared/exec.js';
import { createGitAuth } from '../shared/git-auth.js';
import { assertGitRepositoryUrl, resolveGitAddresses } from '../shared/git-policy.js';
import { assertNoGitLfs } from './git-lfs-check.js';
import type { GitCommand, GitRunOptions } from './git-command-types.js';
export type { GitCommand, GitRunOptions } from './git-command-types.js';

export async function gitCommand(rawRepo: string, token: string | undefined, log: (line: string) => void, username?: string): Promise<GitCommand> {
  const url = assertGitRepositoryUrl(rawRepo);
  const config = await exec('git', ['help', '--config'], { timeoutMs: 15_000, maxBytes: 128 * 1024 });
  if (config.code !== 0 || !config.stdout.split('\n').includes('http.curloptResolve')) throw new Error('Builder Git must support http.curloptResolve for pinned repository connections');
  const addresses = await resolveGitAddresses(url.hostname);
  const auth = await createGitAuth(token, username);
  const pinned = `${url.hostname}:${url.port || '443'}:${addresses.map(({ address }) => address.includes(':') ? `[${address}]` : address).join(',')}`;
  const policy = [...auth.gitArgs, '-c', `http.${url.toString()}.proxy=`, '-c', `http.curloptResolve=${pinned}`];
  return { repo: url.toString(),
    run: (args, timeoutMs = 60_000, options) => exec('git', [...policy, ...args], { env: auth.env, timeoutMs, maxBytes: 1024 * 1024,
      onLine: (line, stream) => { if (stream === 'err' || options?.logStdout !== false) log(line); } }),
    cleanup: auth.cleanup,
  };
}

export async function requireGit(git: GitCommand, args: string[], timeoutMs?: number, options?: GitRunOptions): Promise<ExecResult> {
  const result = await git.run(args, timeoutMs, options);
  if (result.code !== 0 || result.timedOut) throw new Error(`Git ${args.includes('clone') ? 'clone' : args.includes('fetch') ? 'fetch' : 'operation'} failed${result.timedOut ? ' (timeout)' : ` (exit ${result.code})`}`);
  if (result.truncated) throw new Error('Git output exceeded the bounded capture limit');
  return result;
}

export async function assertSupportedGitTree(git: GitCommand, dir: string): Promise<void> {
  const modes = await git.run(['-C', dir, 'ls-tree', '-r', '--full-tree', '--format=%(objectmode)', 'HEAD'], 15_000, { logStdout: false });
  if (modes.code !== 0 || modes.timedOut) throw new Error('Git tree check failed; Builder Git must support ls-tree --format=%(objectmode)');
  if (modes.truncated) throw new Error('Git output exceeded the bounded capture limit');
  const objectModes = modes.stdout ? modes.stdout.slice(0, -1).split('\n') : [];
  if ((modes.stdout && !modes.stdout.endsWith('\n')) || objectModes.some(mode => !['100644', '100755', '120000', '160000'].includes(mode))) {
    throw new Error('Git tree check returned unexpected object modes');
  }
  const modules = await requireGit(git, ['-C', dir, 'ls-tree', '--format=%(objectmode)', 'HEAD', '--', '.gitmodules'], 15_000, { logStdout: false });
  if (modules.stdout && !['100644\n', '100755\n', '120000\n', '160000\n', '040000\n'].includes(modules.stdout)) throw new Error('Git .gitmodules check returned unexpected metadata');
  if (modules.stdout || objectModes.includes('160000')) throw new Error('Git submodules are not supported in this release; vendor the required source');
  await assertNoGitLfs(git, dir);
}
