// Exclusive, permission-verified atomic writes for every secret-bearing file
// (controller credentials, agent registry creds, security store, init state).
// A fresh random temp name + 'wx' creation defeats stale temps, symlink planting
// and permission inheritance from files that happen to exist at a fixed temp
// path (M1-08, M2-07).

import { chmod, rename, rm, stat, writeFile } from 'node:fs/promises';
import { lstatSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

/** the final target is a symlink — replacing it would silently drop the linked file */
export class UnsafeTargetError extends Error {
  constructor(abs: string) {
    super(`拒绝写入符号链接：${abs}`);
  }
}

function isSymbolicLink(abs: string): boolean {
  try {
    return lstatSync(abs).isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Atomically write `data` to `abs` with exactly `mode` (0o600 for secrets).
 * The temp file is created exclusively (wx) under a random name next to the
 * target, its mode is set and verified, then it is renamed into place.
 */
export async function secureWrite(abs: string, data: string, mode: number): Promise<void> {
  if (isSymbolicLink(abs)) throw new UnsafeTargetError(abs);
  const tmp = path.join(
    path.dirname(abs),
    `.${path.basename(abs)}.${process.pid}-${randomBytes(6).toString('hex')}.tmp`,
  );
  try {
    await writeFile(tmp, data, { flag: 'wx', mode });
    await chmod(tmp, mode); // umask may have stripped bits at creation time
    const real = (await stat(tmp)).mode & 0o777;
    if (real !== mode) {
      throw new Error(`临时文件权限校验失败：${real.toString(8)} ≠ ${mode.toString(8)}`);
    }
    await rename(tmp, abs);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
}
