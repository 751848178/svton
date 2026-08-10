import { mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import {
  assertTrustedNodeEnvironment,
  trustedNodeChildEnvironment,
} from "./parity-trusted-node-environment.mjs";

export const HISTORY_CHAIN_CHILD = "DEVPILOT_HISTORY_CHAIN_CHILD";
export const HISTORY_CHAIN_CONSUMER = "DEVPILOT_HISTORY_CHAIN_CONSUMER";
export const HISTORY_CHAIN_RUN_ROOT = "DEVPILOT_HISTORY_CHAIN_RUN_ROOT";
export const LEGACY_HISTORY_INPUTS = Object.freeze([
  "F456_EVIDENCE_PATH",
  "F456_EVIDENCE_SHA256",
  "F456_CAPTURED_NOT_BEFORE",
  "F456_CAPTURED_NOT_AFTER",
]);

export async function createHistoryChainPaths(options = {}) {
  const requestedParent = options.parentDirectory ?? tmpdir();
  const canonicalTempRoot = await realpath(requestedParent);
  if (
    options.parentDirectory !== undefined &&
    resolve(requestedParent) !== canonicalTempRoot
  ) {
    throw new Error("F537_HISTORY_CHAIN_PATH_INVALID: parent not canonical");
  }
  const runRoot = await mkdtemp(join(canonicalTempRoot, "svton-f537-"));
  return freezePaths(canonicalTempRoot, runRoot);
}

export function historyChainOutputDirectory(env, stage, fallback) {
  const child = env[HISTORY_CHAIN_CHILD];
  const runRoot = env[HISTORY_CHAIN_RUN_ROOT];
  if (child === undefined && runRoot === undefined) return fallback;
  requireValue(child === "1" && validRunRoot(runRoot), "invalid child root");
  requireValue(["f455", "f456", "f457"].includes(stage), "invalid stage");
  return join(runRoot, stage);
}

export function assertPublicHistoryChainInvocation(args, env) {
  requireValue(args.length === 0, "launcher accepts no arguments");
  assertTrustedNodeEnvironment(env);
  for (const name of [
    ...LEGACY_HISTORY_INPUTS,
    HISTORY_CHAIN_CHILD,
    HISTORY_CHAIN_CONSUMER,
    HISTORY_CHAIN_RUN_ROOT,
  ]) {
    requireValue(env[name] === undefined, `caller input forbidden: ${name}`);
  }
}

export function chainChildEnvironment(env, runRoot) {
  const child = trustedNodeChildEnvironment(env);
  for (const name of LEGACY_HISTORY_INPUTS) delete child[name];
  child[HISTORY_CHAIN_CHILD] = "1";
  child[HISTORY_CHAIN_RUN_ROOT] = runRoot;
  delete child[HISTORY_CHAIN_CONSUMER];
  return child;
}

export function chainConsumerEnvironment(env, runRoot) {
  const child = chainChildEnvironment(env, runRoot);
  child[HISTORY_CHAIN_CONSUMER] = "1";
  return child;
}

function freezePaths(canonicalTempRoot, runRoot) {
  const paths = {
    canonicalTempRoot,
    runRoot,
    f455Directory: join(runRoot, "f455"),
    f455Evidence: join(runRoot, "f455", "f455-positive-e2e-evidence.json"),
    f456Directory: join(runRoot, "f456"),
    f456Evidence: join(runRoot, "f456", "f456-version-history-evidence.json"),
    f457Directory: join(runRoot, "f457"),
    receipt: join(runRoot, "f537-history-chain-receipt.json"),
  };
  requireValue(validRunRoot(runRoot), "invalid generated root");
  requireValue(
    relative(canonicalTempRoot, runRoot).split("/").length === 1,
    "run root not direct child",
  );
  return Object.freeze(paths);
}

function validRunRoot(value) {
  return (
    typeof value === "string" &&
    isAbsolute(value) &&
    resolve(value) === value &&
    basename(value).startsWith("svton-f537-")
  );
}

function requireValue(value, message) {
  if (!value) throw new Error(`F537_HISTORY_CHAIN_PATH_INVALID: ${message}`);
}
