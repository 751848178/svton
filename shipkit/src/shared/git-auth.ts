// Per-invocation HTTPS Git authentication; token never enters URL, argv or remote config.
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

export async function createGitAuth(token?: string, username = 'x-access-token'): Promise<{ env: NodeJS.ProcessEnv; gitArgs: string[]; cleanup(): Promise<void> }> {
  if (typeof username !== 'string' || !username || username.length > 256 || /[\u0000-\u001f\u007f-\u009f]/.test(username)) throw new Error('Git username must contain 1-256 characters without control characters');
  if (token !== undefined && (typeof token !== 'string' || token.length > 16384 || /[\u0000-\u001f\u007f-\u009f]/.test(token))) throw new Error('Git credential must be a single-line token without control characters');
  const dir = await mkdtemp(path.join(tmpdir(), 'shipkit-git-auth-'));
  const secretFile = path.join(dir, 'credential'), usernameFile = path.join(dir, 'username');
  try {
    await chmod(dir, 0o700);
    await writeFile(secretFile, token ?? '', { mode: 0o600 });
    await writeFile(usernameFile, username, { mode: 0o600 });
  } catch (error) { await rm(dir, { recursive: true, force: true }); throw error; }
  return {
    env: { GIT_ASKPASS: process.execPath, NODE_OPTIONS: `--import=${new URL('./git-askpass.js', import.meta.url).href}`,
      GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: '/dev/null',
      GIT_CONFIG_GLOBAL: '/dev/null', GIT_LFS_SKIP_SMUDGE: '1', SHIPKIT_GIT_CREDENTIAL_FILE: secretFile, SHIPKIT_GIT_USERNAME_FILE: usernameFile,
      LC_ALL: 'C', LANG: 'C',
      GIT_CONFIG_COUNT: '0', GIT_TRACE: '0', GIT_TRACE_PACKET: '0', GIT_TRACE_CURL: '0', GIT_TRACE2: '0',
      // Git enables curl verbosity by presence, even for '0'; override inherited values with absence.
      GIT_CURL_VERBOSE: undefined,
      HTTPS_PROXY: '', HTTP_PROXY: '', ALL_PROXY: '', https_proxy: '', http_proxy: '', all_proxy: '' },
    gitArgs: ['-c', 'credential.helper=', '-c', 'core.hooksPath=/dev/null', '-c', 'http.followRedirects=false',
      '-c', 'http.proxy=', '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always', '-c', 'submodule.recurse=false',
      '-c', 'filter.lfs.required=false', '-c', 'filter.lfs.smudge=', '-c', 'filter.lfs.process='],
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}
