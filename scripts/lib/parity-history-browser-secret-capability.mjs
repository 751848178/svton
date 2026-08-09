import { randomBytes } from "node:crypto";
import { constants, fstatSync, readFileSync } from "node:fs";
import { open, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { assertPinnedBrowserOutputDirectory } from "./parity-history-safe-directory.mjs";

const CAPABILITY = Symbol("browser-secret-capability");
const CLOSED = new WeakSet();
const REFERENCE_PREFIX = "$browser-secret:";
const FLAGS =
  constants.O_RDWR |
  constants.O_CREAT |
  constants.O_EXCL |
  constants.O_NOFOLLOW;

export function browserSecretReference(name) {
  requireValue(validName(name), "invalid-reference");
  return `${REFERENCE_PREFIX}${name}`;
}

export function resolveBrowserSecret(value, secrets) {
  if (!value.startsWith(REFERENCE_PREFIX)) return value;
  const name = value.slice(REFERENCE_PREFIX.length);
  requireValue(validName(name), "invalid-reference");
  requireValue(Object.hasOwn(secrets, name), "missing-reference");
  return secrets[name];
}

export async function createBrowserSecretCapability(pin, secrets) {
  const payload = encodeSecrets(secrets);
  const path = resolve(
    pin.lexicalPath,
    `.browser-secrets-${randomBytes(16).toString("hex")}`,
  );
  let handle;
  try {
    await assertPinnedBrowserOutputDirectory(pin);
    handle = await open(path, FLAGS, 0o600);
    await handle.write(payload, 0, payload.length, 0);
    await handle.sync();
    requireSecret(await handle.stat({ bigint: true }), payload.length, 1n);
    await unlink(path);
    requireSecret(await handle.stat({ bigint: true }), payload.length, 0n);
    return Object.freeze({ [CAPABILITY]: true, handle, bytes: payload.length });
  } catch (error) {
    await handle?.close().catch(() => {});
    await unlink(path).catch(() => {});
    throw normalize(error, "create-failed");
  }
}

export async function cleanupBrowserSecretCapability(capability) {
  requireCapability(capability);
  requireValue(!CLOSED.has(capability), "already-closed");
  CLOSED.add(capability);
  requireSecret(
    await capability.handle.stat({ bigint: true }),
    capability.bytes,
    0n,
  );
  await capability.handle.close();
}

export function readBrowserSecretsFd(fd) {
  requireValue(Number.isInteger(fd) && fd >= 3, "missing-fd");
  const before = fstatSync(fd, { bigint: true });
  requireSecret(before, Number(before.size), 0n);
  requireValue(before.size <= 65_536n, "payload-too-large");
  const secrets = JSON.parse(readFileSync(fd, "utf8"));
  validateSecrets(secrets);
  const after = fstatSync(fd, { bigint: true });
  requireValue(
    before.dev === after.dev && before.ino === after.ino,
    "identity-drift",
  );
  return Object.freeze({ ...secrets });
}

function encodeSecrets(secrets) {
  validateSecrets(secrets);
  const payload = Buffer.from(JSON.stringify(secrets));
  requireValue(payload.length > 2 && payload.length <= 65_536, "payload-size");
  return payload;
}

function validateSecrets(secrets) {
  requireValue(
    secrets !== null &&
      typeof secrets === "object" &&
      !Array.isArray(secrets) &&
      Object.getPrototypeOf(secrets) === Object.prototype,
    "invalid-map",
  );
  const entries = Object.entries(secrets);
  requireValue(entries.length > 0 && entries.length <= 16, "invalid-count");
  for (const [name, value] of entries) {
    requireValue(validName(name), "invalid-name");
    requireValue(
      typeof value === "string" && value.length > 0,
      "invalid-value",
    );
  }
}

function validName(name) {
  return typeof name === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(name);
}

function requireCapability(capability) {
  requireValue(capability?.[CAPABILITY] === true, "invalid-capability");
}

function requireSecret(stats, bytes, links) {
  requireValue(stats.isFile(), "not-file");
  requireValue(stats.uid === BigInt(process.geteuid()), "wrong-owner");
  requireValue((stats.mode & 0o777n) === 0o600n, "wrong-mode");
  requireValue(stats.nlink === links, "wrong-links");
  requireValue(stats.size === BigInt(bytes), "wrong-size");
}

function normalize(error, reason) {
  if (error?.message?.startsWith("E2E_BROWSER_SECRET_INVALID:")) return error;
  return new Error(`E2E_BROWSER_SECRET_INVALID:${reason}`);
}

function requireValue(value, reason) {
  if (!value) throw new Error(`E2E_BROWSER_SECRET_INVALID:${reason}`);
}
