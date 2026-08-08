import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const OUTPUT_FLAGS =
  constants.O_WRONLY |
  constants.O_CREAT |
  constants.O_EXCL |
  constants.O_NOFOLLOW |
  constants.O_NONBLOCK;

export async function writeExclusiveBrowserOutput(
  directory,
  name,
  buffer,
  runtime = {},
) {
  requireValue(Buffer.isBuffer(buffer), "invalid-buffer");
  const parent = resolve(directory);
  requireValue(validName(name), "invalid-name");
  const file = resolve(parent, name);
  requireValue(dirname(file) === parent, "invalid-parent");
  const openFile = runtime.open || open;
  let handle;
  let failure;
  let identity;
  try {
    handle = await openFile(file, OUTPUT_FLAGS, 0o600);
    const before = await handle.stat({ bigint: true });
    requireOutputFile(before, "opened-file-policy");
    await handle.writeFile(buffer);
    await handle.sync();
    const after = await handle.stat({ bigint: true });
    requireOutputFile(after, "written-file-policy");
    requireValue(sameFile(before, after), "file-identity-drift");
    requireValue(after.size === BigInt(buffer.length), "size-mismatch");
    identity = outputIdentity(after);
  } catch (error) {
    failure = normalizeError(error, "write-failed");
  }
  try {
    await handle?.close();
  } catch (error) {
    failure ||= normalizeError(error, "close-failed");
  }
  if (failure) throw failure;
  return Object.freeze({ file, bytes: buffer.length, identity });
}

function validName(name) {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    basename(name) === name &&
    name !== "." &&
    name !== ".."
  );
}

function requireOutputFile(stats, reason) {
  requireValue(stats?.isFile() === true, reason);
  requireValue(stats.isSymbolicLink?.() !== true, reason);
  requireValue(stats.nlink === 1n, reason);
  requireValue(stats.uid === BigInt(process.geteuid()), reason);
  requireValue((stats.mode & 0o777n) === 0o600n, reason);
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function outputIdentity(stats) {
  return Object.freeze({
    dev: stats.dev.toString(),
    ino: stats.ino.toString(),
    size: stats.size.toString(),
    nlink: stats.nlink.toString(),
    uid: stats.uid.toString(),
    mode: stats.mode.toString(),
  });
}

function requireValue(value, reason) {
  if (!value) throw outputError(reason);
}

function normalizeError(error, fallback) {
  if (error?.message?.startsWith("E2E_BROWSER_OUTPUT_INVALID:")) return error;
  return outputError(error?.code || error?.message || fallback);
}

function outputError(reason) {
  return new Error(`E2E_BROWSER_OUTPUT_INVALID: ${reason}`);
}
