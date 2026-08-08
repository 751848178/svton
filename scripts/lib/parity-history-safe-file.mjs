import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import {
  assertPinnedBrowserChild,
  assertPinnedBrowserOutputDirectory,
} from "./parity-history-safe-directory.mjs";

const IDENTITY_FIELDS = ["dev", "ino", "size", "mtime", "ctime"];

export async function prepareBrowserFilesForPin(directory, names) {
  requireValue(
    Array.isArray(names) && new Set(names).size === names.length,
    "invalid-prepare-list",
  );
  for (const name of names) {
    requireValue(
      typeof name === "string" && name.length > 0 && basename(name) === name,
      "invalid-prepare-name",
    );
    const path = resolve(directory, name);
    requireValue(
      dirname(path) === resolve(directory),
      "invalid-prepare-parent",
    );
    let handle;
    try {
      const flags =
        constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_TRUNC |
        constants.O_NOFOLLOW |
        constants.O_NONBLOCK;
      handle = await open(path, flags, 0o600);
      requireRegular(await handle.stat({ bigint: true }), "prepare-nonregular");
    } catch (error) {
      if (error?.message?.startsWith("E2E_BROWSER_")) throw error;
      throw fileError(error?.code || error?.message || "prepare-failed");
    } finally {
      await handle?.close();
    }
  }
}

export async function readPinnedBrowserFile(pin, name, options = {}) {
  requireValue(
    typeof name === "string" && name.length > 0 && basename(name) === name,
    "invalid-child-name",
  );
  const path = resolve(pin?.lexicalPath || "", name);
  const guard = async (phase) => {
    await options.parentGuard?.(phase);
    await assertPinnedBrowserOutputDirectory(pin);
    await assertPinnedBrowserChild(pin, path);
  };
  const snapshot = await readStableBrowserFile(path, {
    ...options,
    parentGuard: guard,
  });
  await guard("complete");
  return snapshot;
}

export async function readStableBrowserFile(path, options = {}) {
  const lstatFile = options.lstat || lstat;
  const openFile = options.open || open;
  let handle;
  try {
    await options.parentGuard?.("before");
    const pathBefore = await lstatFile(path, { bigint: true });
    requireRegular(pathBefore, "pre-open-nonregular");
    requireValue(
      Number.isInteger(constants.O_NOFOLLOW),
      "no-follow-not-supported",
    );
    const flags =
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
    handle = await openFile(path, flags);
    const before = await handle.stat({ bigint: true });
    requireRegular(before, "opened-nonregular");
    requireValue(sameIdentity(pathBefore, before), "pre-open-replaced");
    await options.parentGuard?.("opened");
    await options.afterOpen?.({ path, handle, before });
    const buffer = await handle.readFile();
    await options.afterRead?.({ path, handle, before, buffer });
    const after = await handle.stat({ bigint: true });
    const pathAfter = await lstatFile(path, { bigint: true });
    requireRegular(after, "post-read-nonregular");
    requireRegular(pathAfter, "post-read-path-nonregular");
    requireValue(sameIdentity(before, after), "file-changed-during-read");
    requireValue(sameIdentity(after, pathAfter), "path-replaced-during-read");
    requireValue(
      after.size === BigInt(buffer.length),
      "snapshot-size-mismatch",
    );
    await options.parentGuard?.("after");
    return { buffer, identity: identityOf(after) };
  } catch (error) {
    if (error?.message?.startsWith("E2E_BROWSER_")) throw error;
    throw fileError(error?.code || error?.message || "read-failed");
  } finally {
    await handle?.close();
  }
}

function requireRegular(stats, reason) {
  requireValue(stats?.isFile() === true, reason);
  requireValue(stats.isSymbolicLink?.() !== true, reason);
}

function sameIdentity(left, right) {
  const leftIdentity = identityOf(left);
  const rightIdentity = identityOf(right);
  return IDENTITY_FIELDS.every(
    (field) => leftIdentity[field] === rightIdentity[field],
  );
}

function identityOf(stats) {
  const values = {
    dev: stats?.dev,
    ino: stats?.ino,
    size: stats?.size,
    mtime: stats?.mtimeNs ?? stats?.mtimeMs ?? stats?.mtime?.getTime?.(),
    ctime: stats?.ctimeNs ?? stats?.ctimeMs ?? stats?.ctime?.getTime?.(),
  };
  requireValue(
    Object.values(values).every((value) => value !== undefined),
    "stat-identity-incomplete",
  );
  return Object.freeze(
    Object.fromEntries(
      IDENTITY_FIELDS.map((field) => [field, values[field].toString()]),
    ),
  );
}

function requireValue(value, reason) {
  if (!value) throw fileError(reason);
}

function fileError(reason) {
  return new Error(`E2E_BROWSER_FILE_INVALID: ${reason}`);
}
