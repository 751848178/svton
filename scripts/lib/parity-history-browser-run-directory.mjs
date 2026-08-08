import { constants } from "node:fs";
import { lstat, mkdtemp, open, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { describeCdpActions } from "./parity-history-cdp-action-evidence.mjs";
import { pinBrowserOutputDirectory } from "./parity-history-safe-directory.mjs";

const RUN_PREFIX = "svton-f456-browser-";

export async function createPinnedBrowserRunDirectory(trustedRoot, rawActions) {
  const outputNames = validateBrowserRunIntent(rawActions);
  const root = await canonicalTrustedRoot(trustedRoot);
  let parentHandle;
  try {
    requireFlags();
    const rootBefore = await lstat(root, { bigint: true });
    requireDirectory(rootBefore, "trusted-root-policy");
    parentHandle = await open(
      root,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const handleBefore = await parentHandle.stat({ bigint: true });
    requireValue(sameDirectory(rootBefore, handleBefore), "trusted-root-open");
    const runPath = await mkdtemp(join(root, RUN_PREFIX));
    const runStats = await lstat(runPath, { bigint: true });
    requireRunDirectory(runStats);
    requireValue(dirname(runPath) === root, "run-parent");
    requireValue(basename(runPath).startsWith(RUN_PREFIX), "run-prefix");
    const rootAfter = await parentHandle.stat({ bigint: true });
    requireValue(sameDirectory(handleBefore, rootAfter), "trusted-root-drift");
    const pin = await pinBrowserOutputDirectory(runPath, root, {
      filePolicy: "exclusive-0600-single-link",
    });
    return Object.freeze({ pin, outputNames });
  } catch (error) {
    if (isRunError(error)) throw error;
    throw runError(error?.code || error?.message || "create-failed");
  } finally {
    await parentHandle?.close().catch(() => {});
  }
}

export function validateBrowserRunIntent(rawActions) {
  const descriptors = describeCdpActions(rawActions);
  const outputNames = descriptors
    .filter(({ type }) => ["shot", "text", "dom"].includes(type))
    .map(({ artifact }) => artifact);
  requireValue(outputNames.length > 0, "empty-output-inventory");
  requireValue(
    new Set(outputNames).size === outputNames.length,
    "duplicate-output",
  );
  requireValue(!outputNames.includes("cdp-evidence.json"), "reserved-output");
  return Object.freeze(outputNames);
}

async function canonicalTrustedRoot(trustedRoot) {
  requireValue(
    typeof trustedRoot === "string" && isAbsolute(trustedRoot),
    "trusted-root-path",
  );
  const lexical = resolve(trustedRoot);
  const canonical = await realpath(lexical);
  requireValue(lexical === canonical, "trusted-root-symlink");
  return canonical;
}

function requireRunDirectory(stats) {
  requireDirectory(stats, "run-directory-policy");
  requireValue(stats.uid === BigInt(process.geteuid()), "run-owner");
  requireValue((stats.mode & 0o777n) === 0o700n, "run-mode");
}

function requireDirectory(stats, reason) {
  requireValue(stats?.isDirectory() === true, reason);
  requireValue(stats.isSymbolicLink?.() !== true, reason);
}

function sameDirectory(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function requireFlags() {
  requireValue(Number.isInteger(constants.O_DIRECTORY), "directory-flag");
  requireValue(Number.isInteger(constants.O_NOFOLLOW), "nofollow-flag");
}

function requireValue(value, reason) {
  if (!value) throw runError(reason);
}

function isRunError(error) {
  return error?.message?.startsWith("E2E_BROWSER_RUN_INVALID:");
}

function runError(reason) {
  return new Error(`E2E_BROWSER_RUN_INVALID: ${reason}`);
}
