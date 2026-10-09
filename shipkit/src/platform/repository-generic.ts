import { spawn } from 'node:child_process';
import { mkdtemp, readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createGitAuth } from '../shared/git-auth.js';
import { resolveGitAddresses } from '../shared/git-policy.js';
import type { RepositoryDescriptor } from './repository-metadata.js';
import { sourceSnapshot } from './repository-metadata.js';
import type { RepositoryResolveOptions } from './repository-contracts.js';

async function directoryBytes(directory: string, limit: number): Promise<number> {
  let bytes = 0, count = 0;
  const walk = async (folder: string): Promise<void> => {
    const files = await readdir(folder, { withFileTypes: true }).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    });
    for (const file of files) {
      if (++count > 10000) throw new Error('Repository temporary cache contains too many entries');
      const full = path.join(folder, file.name);
      if (file.isDirectory()) await walk(full);
      else bytes += await stat(full).then(info => info.size).catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
        throw error;
      });
      if (bytes > limit) throw new Error('Repository temporary cache exceeded its byte limit');
    }
  };
  await walk(directory); return bytes;
}
export async function resolveGenericSource(d: RepositoryDescriptor, options: RepositoryResolveOptions) {
  const directory = await mkdtemp(path.join(options.temporaryRoot ?? tmpdir(), 'shipkit-repository-'));
  let auth: Awaited<ReturnType<typeof createGitAuth>> | undefined;
  const limit = options.maxBytes ?? 32 * 1024 * 1024, deadline = Date.now() + Math.min(options.timeoutMs ?? 30000, 120000);
  try {
    auth = await createGitAuth(options.token, options.username);
    const gitAuth = auth;
    const addresses = await resolveGitAddresses(d.url.hostname, options);
    const resolve = `${d.url.hostname}:${d.url.port || '443'}:${addresses.map(a => a.family === 6 ? `[${a.address}]` : a.address).join(',')}`;
    const common = [...gitAuth.gitArgs, '-c', `http.curloptResolve=${resolve}`];
    const git = (args: string[]) => new Promise<string>((accept, reject) => {
      if (Date.now() >= deadline) { reject(new Error('Repository Git operation timed out')); return; }
      const group = process.platform !== 'win32';
      const child = spawn('git', [...common, ...args], { env: { ...process.env, ...gitAuth.env }, stdio: ['ignore', 'pipe', 'pipe'], detached: group });
      let output = '', outputBytes = 0, failure: Error | undefined, checking: Promise<void> | undefined, settled = false;
      let killTimer: NodeJS.Timeout | undefined, finishTimer: NodeJS.Timeout | undefined;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true; clearInterval(timer); clearTimeout(deadlineTimer); clearTimeout(killTimer); clearTimeout(finishTimer);
        if (error) reject(error); else accept(output.trim());
      };
      const signal = (kind: NodeJS.Signals) => {
        if (group && child.pid) { try { process.kill(-child.pid, kind); return; } catch { /* exited or no process group */ } }
        child.kill(kind);
      };
      const stop = (error: Error) => {
        if (failure || settled) return;
        failure = error; signal('SIGTERM');
        killTimer = setTimeout(() => {
          if (settled) return;
          signal('SIGKILL');
          finishTimer = setTimeout(() => {
            child.stdout.destroy(); child.stderr.destroy(); finish(failure);
          }, 250);
        }, 250);
      };
      const collect = (chunk: Buffer, capture: boolean) => {
        if (failure || settled) return;
        outputBytes += chunk.length;
        if (outputBytes > 1024 * 1024) stop(new Error('Repository Git output exceeded its byte limit'));
        else if (capture) output += chunk.toString();
      };
      child.stdout.on('data', chunk => collect(chunk, true));
      child.stderr.on('data', chunk => collect(chunk, false));
      const timer = setInterval(() => {
        if (!checking && !settled && !failure) {
          checking = directoryBytes(directory, limit).then(() => {}, stop).finally(() => { checking = undefined; });
        }
      }, 100);
      const deadlineTimer = setTimeout(() => stop(new Error('Repository Git operation timed out')), Math.max(0, deadline - Date.now()));
      child.once('error', finish);
      child.once('close', code => {
        clearInterval(timer);
        void (async () => {
          await checking;
          await directoryBytes(directory, limit);
          if (failure) finish(failure);
          else if (code !== 0) finish(new Error('Repository Git operation failed; check read credentials and ref'));
          else finish();
        })().catch(error => finish(error as Error));
      });
    });
    await git(['init', '--bare', directory]);
    await git(['-C', directory, 'remote', 'add', 'origin', d.source.repoUrl]);
    let ref = d.source.ref.value;
    if (!ref) {
      const head = await git(['ls-remote', '--symref', '--', d.source.repoUrl, 'HEAD']);
      ref = /^ref:\s+refs\/heads\/(.+)\s+HEAD$/m.exec(head)?.[1] ?? '';
      if (!ref) throw new Error('Repository default branch is unavailable');
    }
    const wanted = d.source.ref.kind === 'commit' ? ref : `refs/${d.source.ref.kind === 'branch' ? 'heads' : 'tags'}/${ref}`;
    await git(['-C', directory, 'fetch', '--depth=1', '--filter=blob:none', '--no-tags', 'origin', wanted]);
    const commit = await git(['-C', directory, 'rev-parse', 'FETCH_HEAD^{commit}']);
    const tree = await git(['-C', directory, 'ls-tree', commit, '--', d.source.specPath, '.gitmodules']);
    if (tree.includes('\t.gitmodules')) throw new Error('Submodules are not supported for repository projects');
    if (!tree.split('\n').some(line => line.startsWith('100') && line.endsWith(`\t${d.source.specPath}`))) throw new Error('Repository definition must be a regular file');
    const content = await git(['-C', directory, 'show', `${commit}:${d.source.specPath}`]);
    await directoryBytes(directory, limit);
    return sourceSnapshot(d, commit, ref, content);
  } finally {
    try { await auth?.cleanup(); } finally { await rm(directory, { recursive: true, force: true }); }
  }
}
