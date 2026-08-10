import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

const ACTIVE_PORT = "DevToolsActivePort";

export function readCdpActiveEndpoint(profile, startedAtMs, runtime = {}) {
  const lstat = runtime.lstatSync || lstatSync;
  const readFile = runtime.readFileSync || readFileSync;
  const realpath = runtime.realpathSync || realpathSync;
  requireValue(Number.isFinite(startedAtMs), "invalid-start-time");
  const directory = lstat(profile?.path, { bigint: true });
  requireDirectory(directory, profile, realpath);
  const path = join(profile.path, ACTIVE_PORT);
  const before = lstat(path, { bigint: true });
  requireFile(before, startedAtMs);
  const bytes = readFile(path);
  requireValue(Buffer.isBuffer(bytes) && bytes.length <= 512, "invalid-size");
  const after = lstat(path, { bigint: true });
  requireValue(sameFile(before, after), "identity-drift");
  const lines = bytes.toString("utf8").trimEnd().split("\n");
  requireValue(lines.length === 2, "invalid-lines");
  const port = Number(lines[0]);
  requireValue(
    Number.isInteger(port) && port >= 1024 && port <= 65535,
    "invalid-port",
  );
  const browserPath = lines[1];
  requireValue(
    /^\/devtools\/browser\/[A-Za-z0-9-]{16,128}$/.test(browserPath),
    "invalid-browser-path",
  );
  return Object.freeze({ port, browserPath });
}

function requireDirectory(stats, profile, realpath) {
  requireValue(
    stats.isDirectory() && !stats.isSymbolicLink(),
    "profile-policy",
  );
  requireValue(stats.uid === BigInt(process.geteuid()), "profile-owner");
  requireValue((stats.mode & 0o777n) === 0o700n, "profile-mode");
  requireValue(
    stats.dev.toString() === profile?.identity?.dev &&
      stats.ino.toString() === profile?.identity?.ino,
    "profile-identity",
  );
  requireValue(realpath(profile.path) === profile.path, "profile-realpath");
}

function requireFile(stats, startedAtMs) {
  requireValue(stats.isFile() && !stats.isSymbolicLink(), "file-policy");
  requireValue(stats.uid === BigInt(process.geteuid()), "file-owner");
  requireValue(stats.nlink === 1n, "file-links");
  const mode = stats.mode & 0o777n;
  requireValue((mode & 0o600n) === 0o600n, "file-owner-mode");
  requireValue((mode & 0o022n) === 0n, "file-writable-mode");
  requireValue(stats.size > 0n && stats.size <= 512n, "file-size");
  requireValue(Number(stats.mtimeMs) >= startedAtMs - 2000, "file-stale");
}

function sameFile(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs
  );
}

function requireValue(value, reason) {
  if (!value) throw new Error(`E2E_CDP_ENDPOINT_INVALID:${reason}`);
}
