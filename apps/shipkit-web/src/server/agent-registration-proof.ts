import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { AgentGatewayFault } from './agent-registration-fault';

export function canonicalGatewayProof(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value) && Buffer.from(value, 'base64url').length === 32
    && Buffer.from(value, 'base64url').toString('base64url') === value;
}

/** Bounded private configuration only: no symlinks, hardlinks or unsafe ownership. */
export function readAgentGatewayProof(file: string | undefined): string {
  let fd: number | undefined;
  try {
    if (!file || !path.isAbsolute(file)) throw new Error();
    const parent = path.dirname(file), directory = lstatSync(parent);
    const owners = new Set([0, process.getuid?.() ?? 0]);
    if (!directory.isDirectory() || (directory.mode & 0o777) !== 0o700 || !owners.has(directory.uid)
      || realpathSync(parent) !== path.resolve(parent)) throw new Error();
    const before = lstatSync(file);
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = fstatSync(fd);
    if (!opened.isFile() || (opened.mode & 0o777) !== 0o600 || !owners.has(opened.uid) || opened.nlink !== 1
      || opened.ino !== before.ino || opened.dev !== before.dev || opened.size < 43 || opened.size > 44) throw new Error();
    const buffer = Buffer.alloc(45), count = readSync(fd, buffer, 0, buffer.length, 0);
    const value = buffer.subarray(0, count).toString('utf8').replace(/\n$/, '');
    const after = fstatSync(fd), named = lstatSync(file);
    if (count !== opened.size || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs
      || after.ctimeMs !== opened.ctimeMs || after.nlink !== 1 || named.ino !== opened.ino || named.dev !== opened.dev
      || !canonicalGatewayProof(value)) throw new Error();
    return value;
  } catch { throw new AgentGatewayFault('AGENT_GATEWAY_CONFIGURATION'); }
  finally { if (fd !== undefined) closeSync(fd); }
}
