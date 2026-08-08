import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";

const IDENTITY_FIELDS = ["dev", "ino", "size", "mtime", "ctime"];

export async function readStableBrowserFile(path, options = {}) {
  const lstatFile = options.lstat || lstat;
  const openFile = options.open || open;
  const pathBefore = await lstatFile(path, { bigint: true });
  requireRegular(pathBefore, "pre-open-nonregular");
  requireValue(
    Number.isInteger(constants.O_NOFOLLOW),
    "no-follow-not-supported",
  );
  const flags =
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
  let handle;
  try {
    handle = await openFile(path, flags);
    const before = await handle.stat({ bigint: true });
    requireRegular(before, "opened-nonregular");
    requireValue(sameIdentity(pathBefore, before), "pre-open-replaced");
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
    return { buffer, identity: identityOf(after) };
  } catch (error) {
    if (error?.message?.startsWith("E2E_BROWSER_FILE_INVALID:")) throw error;
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
