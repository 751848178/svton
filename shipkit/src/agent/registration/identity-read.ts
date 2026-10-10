import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import path from 'node:path';
import { assertDirectoryChain, assertPrivateFile } from './identity-paths.js';
import { identityFault, RegistrationIdentityError } from './identity-error.js';
import { parsePrivateIdentityJson } from './identity-json.js';

export const REGISTRATION_FILE_MAX_BYTES = 16 * 1024;
/** NOFOLLOW + bounded descriptor read prevents FIFO, hard-link and replacement reads. */
export async function readPrivateRegistrationJson(file: string): Promise<unknown> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    if (!path.isAbsolute(file) || path.resolve(file) !== file) return identityFault('REGISTRATION_PATH_UNSAFE');
    await assertDirectoryChain(path.dirname(file));
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = await handle.stat();
    assertPrivateFile(before);
    if (before.size < 1 || before.size > REGISTRATION_FILE_MAX_BYTES) return identityFault('REGISTRATION_FILE_INVALID');
    const bytes = Buffer.alloc(before.size + 1);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    const after = await handle.stat();
    if (bytesRead !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs
      || after.ctimeMs !== before.ctimeMs || after.nlink !== 1) return identityFault('REGISTRATION_FILE_CHANGED');
    return parsePrivateIdentityJson(bytes.subarray(0, bytesRead));
  } catch (error) {
    if (error instanceof RegistrationIdentityError) throw error;
    return identityFault('REGISTRATION_FILE_INVALID');
  } finally { await handle?.close(); }
}
