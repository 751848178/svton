import { constants } from 'node:fs';
import { open, rename, rm, lstat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { assertDirectoryChain, assertPrivateFile, optionalStat } from './identity-paths.js';
import { REGISTRATION_FILE_MAX_BYTES } from './identity-read.js';
import { identityFault } from './identity-error.js';

export type IdentityWriteStage = 'file-synced' | 'before-rename' | 'renamed' | 'directory-synced';
export interface IdentityWriteOptions { readonly stage?: (stage: IdentityWriteStage) => Promise<void> | void }
/** Secret write: exclusive temp + file fsync + same-directory rename + directory fsync. */
export async function writeRegistrationIdentityJson(file: string, value: unknown, options: IdentityWriteOptions = {}): Promise<void> {
  const parent = path.dirname(file), bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  if (bytes.length > REGISTRATION_FILE_MAX_BYTES) return identityFault('REGISTRATION_FILE_INVALID');
  await assertDirectoryChain(parent);
  const previous = await optionalStat(file);
  if (previous) assertPrivateFile(previous);
  const temporary = path.join(parent, `.${path.basename(file)}.${randomUUID()}.tmp`);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let created: import('node:fs').Stats | undefined;
  try {
    handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    await handle.chmod(0o600);
    created = await handle.stat();
    assertPrivateFile(created);
    await handle.writeFile(bytes);
    await handle.sync();
    await options.stage?.('file-synced');
    await handle.close(); handle = undefined;
    await options.stage?.('before-rename');
    await assertDirectoryChain(parent);
    const current = await optionalStat(file);
    if (current) assertPrivateFile(current);
    if (Boolean(current) !== Boolean(previous) || (current && previous
      && (current.ino !== previous.ino || current.dev !== previous.dev || current.ctimeMs !== previous.ctimeMs))) {
      return identityFault('REGISTRATION_FILE_CHANGED');
    }
    const tempNow = await lstat(temporary);
    assertPrivateFile(tempNow);
    if (tempNow.ino !== created.ino || tempNow.dev !== created.dev) return identityFault('REGISTRATION_FILE_CHANGED');
    await rename(temporary, file);
    await options.stage?.('renamed');
    const directory = await open(parent, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { await directory.sync(); } finally { await directory.close(); }
    await options.stage?.('directory-synced');
  } finally {
    await handle?.close();
    const left = await optionalStat(temporary);
    if (created && left?.ino === created.ino && left.dev === created.dev) await rm(temporary);
  }
}
