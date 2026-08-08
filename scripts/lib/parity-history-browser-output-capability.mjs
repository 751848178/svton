import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, unlink } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { assertPinnedBrowserOutputDirectory } from "./parity-history-safe-directory.mjs";
import { encodeBrowserOutputPlan } from "./parity-history-browser-output-plan.mjs";

const CAPABILITY = Symbol("browser-output-capability");
const CLOSED = new WeakSet();
const FLAGS =
  constants.O_RDWR |
  constants.O_CREAT |
  constants.O_EXCL |
  constants.O_NOFOLLOW |
  constants.O_NONBLOCK;

export async function createBrowserOutputCapability(pin, artifactNames) {
  const names = [...artifactNames, "cdp-evidence.json"];
  requireValue(
    names.every(
      (name) =>
        typeof name === "string" && name.length > 0 && basename(name) === name,
    ),
    "invalid-name",
  );
  requireValue(new Set(names).size === names.length, "duplicate-name");
  const entries = [];
  try {
    await assertPinnedBrowserOutputDirectory(pin);
    for (const name of names) {
      const path = resolve(pin.lexicalPath, name);
      const handle = await open(path, FLAGS, 0o600);
      const stats = await handle.stat({ bigint: true });
      requireOutput(stats, "create-policy");
      entries.push({ name, path, handle, identity: identityOf(stats) });
    }
    await assertPinnedBrowserOutputDirectory(pin);
    const runNonce = randomBytes(32).toString("hex");
    return Object.freeze({
      [CAPABILITY]: true,
      pin,
      runNonce,
      artifactNames: Object.freeze([...artifactNames]),
      encodedPlan: encodeBrowserOutputPlan(runNonce, names),
      stdio: Object.freeze([
        "ignore",
        "pipe",
        "pipe",
        ...entries.map(({ handle }) => handle.fd),
      ]),
      entries: Object.freeze(entries),
    });
  } catch (error) {
    await closeEntries(entries);
    await removeCreated(pin, entries).catch(() => {});
    throw normalize(error, "create-failed");
  }
}

export async function readBrowserOutputCapability(capability, name) {
  requireCapability(capability);
  requireValue(!CLOSED.has(capability), "closed");
  const entry = capability.entries.find((item) => item.name === name);
  requireValue(entry, "unknown-name");
  const before = await entry.handle.stat({ bigint: true });
  requireOutput(before, "read-before-policy");
  requireValue(
    sameIdentity(entry.identity, identityOf(before)),
    "read-identity",
  );
  const size = Number(before.size);
  requireValue(Number.isSafeInteger(size) && size >= 0, "read-size");
  const buffer = Buffer.alloc(size);
  const { bytesRead } = await entry.handle.read(buffer, 0, size, 0);
  requireValue(bytesRead === size, "read-short");
  const after = await entry.handle.stat({ bigint: true });
  requireOutput(after, "read-after-policy");
  requireValue(sameFile(before, after), "read-drift");
  return { buffer, identity: identityOf(after) };
}

export async function cleanupBrowserOutputCapability(capability) {
  requireCapability(capability);
  requireValue(!CLOSED.has(capability), "already-closed");
  CLOSED.add(capability);
  await closeEntries(capability.entries);
  await removeCreated(capability.pin, capability.entries);
}

async function removeCreated(pin, entries) {
  await assertPinnedBrowserOutputDirectory(pin);
  const current = await Promise.all(
    entries.map(async (entry) => ({
      entry,
      stats: await lstat(entry.path, { bigint: true }),
    })),
  );
  for (const { entry, stats } of current) {
    requireOutput(stats, "cleanup-policy");
    requireValue(
      sameIdentity(entry.identity, identityOf(stats)),
      "cleanup-identity",
    );
  }
  await assertPinnedBrowserOutputDirectory(pin);
  for (const { entry } of current) await unlink(entry.path);
}

async function closeEntries(entries) {
  const failures = [];
  for (const { handle } of entries) {
    try {
      await handle.close();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) throw normalize(failures[0], "close-failed");
}

function requireCapability(value) {
  requireValue(value?.[CAPABILITY] === true, "invalid-capability");
}

function requireOutput(stats, reason) {
  requireValue(stats?.isFile() === true, reason);
  requireValue(stats.nlink === 1n, reason);
  requireValue(stats.uid === BigInt(process.geteuid()), reason);
  requireValue((stats.mode & 0o777n) === 0o600n, reason);
}

function identityOf(stats) {
  return Object.freeze({
    dev: stats.dev.toString(),
    ino: stats.ino.toString(),
  });
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function requireValue(value, reason) {
  if (!value)
    throw new Error(`E2E_BROWSER_OUTPUT_CAPABILITY_INVALID:${reason}`);
}

function normalize(error, fallback) {
  if (error?.message?.startsWith("E2E_BROWSER_")) return error;
  return new Error(
    `E2E_BROWSER_OUTPUT_CAPABILITY_INVALID:${error?.code || fallback}`,
  );
}
