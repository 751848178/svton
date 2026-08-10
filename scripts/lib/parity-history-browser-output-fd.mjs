import { fstatSync, fsyncSync, writeSync } from "node:fs";

export function writeBrowserOutputFd(outputs, name, buffer) {
  const fd = outputs?.[name];
  requireValue(Number.isInteger(fd) && fd >= 3, "missing-fd");
  requireValue(Buffer.isBuffer(buffer), "invalid-buffer");
  const before = fstatSync(fd, { bigint: true });
  requireOutput(before, "before-policy");
  requireValue(before.size === 0n, "already-written");
  writeAll(fd, buffer);
  fsyncSync(fd);
  const after = fstatSync(fd, { bigint: true });
  requireOutput(after, "after-policy");
  requireValue(sameFile(before, after), "identity-drift");
  requireValue(after.size === BigInt(buffer.length), "size-mismatch");
  return Object.freeze({ name, bytes: buffer.length });
}

function writeAll(fd, buffer) {
  let offset = 0;
  while (offset < buffer.length) {
    const written = writeSync(
      fd,
      buffer,
      offset,
      buffer.length - offset,
      offset,
    );
    requireValue(written > 0, "short-write");
    offset += written;
  }
}

function requireOutput(stats, reason) {
  requireValue(stats.isFile(), reason);
  requireValue(stats.nlink === 1n, reason);
  requireValue(stats.uid === BigInt(process.geteuid()), reason);
  requireValue((stats.mode & 0o777n) === 0o600n, reason);
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function requireValue(value, reason) {
  if (!value) throw new Error(`E2E_BROWSER_OUTPUT_INVALID:${reason}`);
}
