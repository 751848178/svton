import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const IDENTITY_FIELDS = [
  "dev",
  "ino",
  "size",
  "nlink",
  "mode",
  "mtimeNs",
  "ctimeNs",
];

export async function openHistoryChainArtifact(input) {
  const { path, runRoot, producerStartedAtMs, producerEndedAtMs } = input;
  let handle;
  try {
    await assertOwnedPath(path, runRoot);
    const lexical = await lstat(path, { bigint: true });
    requireRegular(lexical, "path-not-regular");
    requireValue(lexical.nlink === 1n, "path-not-single-link");
    requireValue(
      Number.isInteger(constants.O_NOFOLLOW),
      "no-follow-unsupported",
    );
    handle = await open(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = await handle.stat({ bigint: true });
    requireRegular(before, "opened-not-regular");
    requireValue(sameIdentity(lexical, before), "pre-open-replaced");
    await input.afterOpen?.({ path, handle });
    const buffer = await handle.readFile();
    await input.afterRead?.({ path, handle, buffer });
    const after = await handle.stat({ bigint: true });
    const pathAfter = await lstat(path, { bigint: true });
    requireValue(sameIdentity(before, after), "changed-during-read");
    requireValue(sameIdentity(after, pathAfter), "path-replaced-during-read");
    requireValue(after.size === BigInt(buffer.length), "size-mismatch");
    const document = JSON.parse(buffer.toString("utf8"));
    const capturedAtMs = Date.parse(document.capturedAt || "");
    requireValue(document.status === "passed", "document-not-passed");
    requireFresh(
      capturedAtMs,
      producerStartedAtMs,
      producerEndedAtMs,
      "capturedAt",
    );
    requireFresh(
      nsToMs(after.mtimeNs),
      producerStartedAtMs,
      producerEndedAtMs,
      "mtime",
    );
    requireFresh(
      nsToMs(after.ctimeNs),
      producerStartedAtMs,
      producerEndedAtMs,
      "ctime",
    );
    return Object.freeze({
      path,
      buffer,
      document,
      capturedAt: document.capturedAt,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      identity: identityOf(after),
      handle,
    });
  } catch (error) {
    await handle?.close();
    if (error?.message?.startsWith("F537_HISTORY_ARTIFACT_INVALID"))
      throw error;
    throw artifactError(error?.code || error?.message || "read-failed");
  }
}

async function assertOwnedPath(path, runRoot) {
  requireValue(isAbsolute(path) && resolve(path) === path, "path-not-exact");
  requireValue((await realpath(runRoot)) === runRoot, "run-root-alias");
  const suffix = relative(runRoot, path);
  requireValue(
    suffix && !suffix.startsWith("..") && !isAbsolute(suffix),
    "path-outside-root",
  );
  let cursor = runRoot;
  for (const part of suffix.split(sep).slice(0, -1)) {
    cursor = resolve(cursor, part);
    const stats = await lstat(cursor, { bigint: true });
    requireValue(
      stats.isDirectory() && !stats.isSymbolicLink(),
      "symlink-ancestor",
    );
  }
  requireValue(
    dirname(path).startsWith(`${runRoot}${sep}`),
    "path-parent-outside-root",
  );
}

function requireFresh(value, startedAt, endedAt, label) {
  requireValue(Number.isFinite(value), `${label}-invalid`);
  requireValue(value >= startedAt - 5_000, `${label}-stale`);
  requireValue(value <= endedAt + 5_000, `${label}-future`);
}

function requireRegular(stats, reason) {
  requireValue(stats?.isFile() === true, reason);
  requireValue(stats.isSymbolicLink?.() !== true, reason);
}

function sameIdentity(left, right) {
  const a = identityOf(left);
  const b = identityOf(right);
  return IDENTITY_FIELDS.every((field) => a[field] === b[field]);
}

function identityOf(stats) {
  return Object.freeze(
    Object.fromEntries(
      IDENTITY_FIELDS.map((field) => {
        const value = stats[field];
        requireValue(value !== undefined, "identity-incomplete");
        return [field, value.toString()];
      }),
    ),
  );
}

function nsToMs(value) {
  return Number(value / 1_000_000n);
}

function requireValue(value, reason) {
  if (!value) throw artifactError(reason);
}

function artifactError(reason) {
  return new Error(`F537_HISTORY_ARTIFACT_INVALID: ${reason}`);
}
