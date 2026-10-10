import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import path from 'node:path';
import { RegistrationRequestError } from './request-errors.js';

const CA_BYTES = 65_536;
const invalid = (): never => { throw new RegistrationRequestError('REGISTRATION_CA_INVALID'); };
function trustedOwner(uid: number): boolean { return uid === 0 || uid === process.getuid?.(); }

/** Local trust inputs must not be replaceable through a link or unsafe parent. */
export async function loadRegistrationCa(caFile: string, signal: AbortSignal): Promise<Buffer> {
  if (typeof caFile !== 'string' || caFile.length > 4_096 || !path.isAbsolute(caFile)
    || path.normalize(caFile) !== caFile || /[\u0000-\u001f\u007f]/.test(caFile)) return invalid();
  let handle;
  try {
    let parent = path.parse(caFile).root;
    for (const segment of caFile.slice(parent.length).split(path.sep).slice(0, -1)) {
      parent = path.join(parent, segment);
      const stat = await lstat(parent);
      const stickyRoot = stat.uid === 0 && (stat.mode & 0o1000) !== 0;
      if (!stat.isDirectory() || stat.isSymbolicLink() || !trustedOwner(stat.uid)
        || ((stat.mode & 0o022) !== 0 && !stickyRoot)) return invalid();
      signal.throwIfAborted();
    }
    const before = await lstat(caFile);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || !trustedOwner(before.uid)
      || (before.mode & 0o022) !== 0 || before.size < 1 || before.size > CA_BYTES) return invalid();
    handle = await open(caFile, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.nlink !== 1 || opened.size !== before.size
      || opened.uid !== before.uid || opened.mode !== before.mode) return invalid();
    signal.throwIfAborted();
    const bytes = Buffer.alloc(before.size + 1);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    const after = await handle.stat(), linked = await lstat(caFile);
    if (bytesRead !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs
      || after.ctimeMs !== before.ctimeMs || after.nlink !== 1 || linked.dev !== before.dev || linked.ino !== before.ino
      || !linked.isFile() || linked.isSymbolicLink() || linked.nlink !== 1) return invalid();
    signal.throwIfAborted();
    return bytes.subarray(0, bytesRead);
  } catch { return invalid(); } finally { await handle?.close(); }
}
