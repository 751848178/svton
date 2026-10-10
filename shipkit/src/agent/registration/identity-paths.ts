import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { identityFault } from './identity-error.js';

const owners = (): Set<number> => new Set([0, process.getuid?.() ?? 0]);
export async function optionalStat(file: string) {
  try { return await lstat(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
/** A root-owned sticky temporary ancestor is safe; the private leaf stays 0700. */
export async function assertDirectoryChain(directory: string, privateLeaf = false): Promise<void> {
  if (!path.isAbsolute(directory) || path.resolve(directory) !== directory) return identityFault('REGISTRATION_PATH_UNSAFE');
  const parsed = path.parse(directory), parts = directory.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (const part of ['', ...parts]) {
    if (part) current = path.join(current, part);
    const info = await lstat(current);
    const mode = info.mode & 0o777;
    const stickyRoot = info.uid === 0 && Boolean(info.mode & 0o1000);
    if (!info.isDirectory() || info.isSymbolicLink() || !owners().has(info.uid)
      || ((mode & 0o022) !== 0 && !stickyRoot)) return identityFault('REGISTRATION_PATH_UNSAFE');
    if (current === directory && privateLeaf && mode !== 0o700) return identityFault('REGISTRATION_PATH_UNSAFE');
  }
}
export function assertPrivateFile(info: import('node:fs').Stats): void {
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || !owners().has(info.uid)
    || (info.mode & 0o777) !== 0o600) return identityFault('REGISTRATION_FILE_UNSAFE');
}
