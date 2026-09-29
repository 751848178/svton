// Git helpers for resolving default build source from the controller's cwd.

import { exec } from './exec.js';

async function gitOutput(cwd: string, args: string[]): Promise<string | null> {
  const r = await exec('git', args, { cwd, timeoutMs: 15_000 });
  return r.code === 0 ? r.stdout.trim() : null;
}

export async function gitRemote(cwd: string): Promise<string | null> {
  return gitOutput(cwd, ['remote', 'get-url', 'origin']);
}

export async function gitHeadSha(cwd: string): Promise<string | null> {
  return gitOutput(cwd, ['rev-parse', 'HEAD']);
}
