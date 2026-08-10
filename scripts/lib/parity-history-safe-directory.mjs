import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const IDENTITY_FIELDS = ["dev", "ino", "uid", "gid", "mode"];
const DIRECTORY_PIN = Symbol("browser-output-directory-pin");

export async function pinBrowserOutputDirectory(
  path,
  trustedRoot,
  options = {},
) {
  let handle;
  try {
    const lexicalPath = resolve(path);
    const lexicalRoot = resolve(trustedRoot);
    requireDescendant(lexicalPath, lexicalRoot, "outside-trusted-root");
    await assertDirectoryComponents(lexicalRoot, lexicalPath);
    const canonicalRoot = await realpath(lexicalRoot);
    const canonicalPath = await realpath(lexicalPath);
    requireFlags();
    const pathStats = await lstat(lexicalPath, { bigint: true });
    requireDirectory(pathStats, "pin-path-nondirectory");
    handle = await open(
      lexicalPath,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const handleStats = await handle.stat({ bigint: true });
    requireDirectory(handleStats, "pin-handle-nondirectory");
    const identity = identityOf(pathStats);
    requireValue(
      sameIdentity(identity, identityOf(handleStats)),
      "pin-path-handle-mismatch",
    );
    return Object.freeze({
      [DIRECTORY_PIN]: true,
      lexicalPath,
      canonicalPath,
      lexicalRoot,
      canonicalRoot,
      identity,
      filePolicy: options.filePolicy || null,
      handle,
    });
  } catch (error) {
    await handle?.close().catch(() => {});
    if (isDirectoryError(error)) throw error;
    throw directoryError(error?.code || error?.message || "pin-failed");
  }
}

export async function assertPinnedBrowserOutputDirectory(pin) {
  try {
    requirePin(pin);
    const handleStats = await pin.handle.stat({ bigint: true });
    const pathStats = await lstat(pin.lexicalPath, { bigint: true });
    requireDirectory(handleStats, "handle-nondirectory");
    requireDirectory(pathStats, "path-nondirectory");
    requireValue(
      sameIdentity(identityOf(handleStats), pin.identity),
      "handle-identity-drift",
    );
    requireValue(
      sameIdentity(identityOf(pathStats), pin.identity),
      "path-identity-drift",
    );
    await assertDirectoryComponents(pin.lexicalRoot, pin.lexicalPath);
    requireValue(
      (await realpath(pin.lexicalPath)) === pin.canonicalPath,
      "canonical-path-drift",
    );
    return true;
  } catch (error) {
    if (isDirectoryError(error)) throw error;
    throw directoryError(error?.code || error?.message || "assert-failed");
  }
}

export async function assertPinnedBrowserChild(pin, path) {
  requirePin(pin);
  const parent = dirname(resolve(path));
  requireValue(parent === pin.lexicalPath, "lexical-parent-mismatch");
  try {
    requireValue(
      (await realpath(parent)) === pin.canonicalPath,
      "canonical-parent-mismatch",
    );
  } catch (error) {
    if (isDirectoryError(error)) throw error;
    throw directoryError(error?.code || error?.message || "parent-failed");
  }
}

export async function closePinnedBrowserOutputDirectory(pin) {
  requirePin(pin);
  try {
    await pin.handle.close();
  } catch (error) {
    throw directoryError(error?.code || error?.message || "close-failed");
  }
}

async function assertDirectoryComponents(root, path) {
  requireDescendant(path, root, "outside-trusted-root");
  requireDirectory(await lstat(root, { bigint: true }), "root-nondirectory");
  let current = root;
  for (const part of relative(root, path).split(sep)) {
    current = join(current, part);
    requireDirectory(
      await lstat(current, { bigint: true }),
      "ancestor-nondirectory",
    );
  }
}

function requireDescendant(path, root, reason) {
  const value = relative(root, path);
  requireValue(
    value.length > 0 &&
      value !== ".." &&
      !value.startsWith(`..${sep}`) &&
      !isAbsolute(value),
    reason,
  );
}

function requireDirectory(stats, reason) {
  requireValue(stats?.isDirectory() === true, reason);
  requireValue(stats.isSymbolicLink?.() !== true, reason);
}

function identityOf(stats) {
  const values = Object.fromEntries(
    IDENTITY_FIELDS.map((field) => [field, stats?.[field]?.toString()]),
  );
  requireValue(
    Object.values(values).every((value) => value !== undefined),
    "stat-identity-incomplete",
  );
  return Object.freeze(values);
}

function sameIdentity(left, right) {
  return IDENTITY_FIELDS.every((field) => left[field] === right?.[field]);
}

function requireFlags() {
  requireValue(
    Number.isInteger(constants.O_DIRECTORY),
    "directory-not-supported",
  );
  requireValue(
    Number.isInteger(constants.O_NOFOLLOW),
    "no-follow-not-supported",
  );
}

function requirePin(pin) {
  requireValue(pin?.[DIRECTORY_PIN] === true, "invalid-pin");
}

function requireValue(value, reason) {
  if (!value) throw directoryError(reason);
}

function isDirectoryError(error) {
  return error?.message?.startsWith("E2E_BROWSER_DIRECTORY_INVALID:");
}

function directoryError(reason) {
  return new Error(`E2E_BROWSER_DIRECTORY_INVALID: ${reason}`);
}
