import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import path from 'node:path';

export type MachineIngressMode = 'disabled' | 'local-development' | 'trusted-proxy';
export const MACHINE_INGRESS_PROOF_HEADER = 'x-shipkit-agent-ingress';
const hash = (value: string) => createHash('sha256').update('shipkit:agent-ingress:v1\0').update(value).digest();
const unavailable = () => new ServiceUnavailableException('机器入口配置不可用');
const canonicalProof = (value: string): boolean => /^[\w-]{43}$/.test(value)
  && Buffer.from(value, 'base64url').length === 32 && Buffer.from(value, 'base64url').toString('base64url') === value;

/** Read one bounded private proof from a safe regular file; never the platform key. */
function readProof(file: string | undefined): Buffer {
  let fd: number | undefined;
  try {
    if (!file || !path.isAbsolute(file)) throw unavailable();
    const parent = path.dirname(file), directory = lstatSync(parent);
    const owners = new Set([0, process.getuid?.() ?? 0]);
    if (!directory.isDirectory() || directory.isSymbolicLink() || (directory.mode & 0o777) !== 0o700
      || !owners.has(directory.uid) || realpathSync(parent) !== path.resolve(parent)) throw unavailable();
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 || !owners.has(stat.uid) || stat.size < 43 || stat.size > 44) throw unavailable();
    const buffer = Buffer.alloc(45), count = readSync(fd, buffer, 0, buffer.length, 0);
    const value = buffer.subarray(0, count).toString('utf8').replace(/\n$/, '');
    const after = fstatSync(fd);
    if (count !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || !canonicalProof(value)) throw unavailable();
    return hash(value);
  } catch { throw unavailable(); }
  finally { if (fd !== undefined) closeSync(fd); }
}

@Injectable()
export class MachineIngressSettings {
  readonly mode: MachineIngressMode;
  readonly publicOrigin?: URL;
  readonly #proofHash?: Buffer;
  constructor() {
    const mode = process.env.SHIPKIT_AGENT_INGRESS_MODE ?? 'disabled';
    if (!['disabled', 'local-development', 'trusted-proxy'].includes(mode)) throw unavailable();
    this.mode = mode as MachineIngressMode;
    if (this.mode === 'trusted-proxy') {
      try {
        const value = process.env.SHIPKIT_AGENT_PUBLIC_ORIGIN;
        if (!value) throw unavailable();
        const origin = new URL(value);
        if (origin.protocol !== 'https:' || origin.origin !== value || origin.username || origin.password) throw unavailable();
        this.publicOrigin = origin;
        this.#proofHash = readProof(process.env.SHIPKIT_AGENT_INGRESS_PROOF_FILE);
      } catch { throw unavailable(); }
    }
  }
  assertProof(value: string | undefined): void {
    if (!value || !canonicalProof(value) || !this.#proofHash || !timingSafeEqual(this.#proofHash, hash(value))) {
      throw new ForbiddenException('机器入口证明无效');
    }
  }
}
