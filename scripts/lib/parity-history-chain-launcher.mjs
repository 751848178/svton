import { closeSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { openHistoryChainArtifact } from "./parity-history-chain-artifact.mjs";
import {
  assertPublicHistoryChainInvocation,
  chainChildEnvironment,
  chainConsumerEnvironment,
  createHistoryChainPaths,
} from "./parity-history-chain-paths.mjs";
import {
  buildHistoryChainReceipt,
  writeHistoryChainReceipt,
} from "./parity-history-chain-receipt.mjs";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export async function runHistoryChain(options = {}) {
  const args = options.args ?? process.argv.slice(2);
  const environment = options.env ?? process.env;
  const spawn = options.spawn ?? spawnSync;
  const now = options.now ?? Date.now;
  assertPublicHistoryChainInvocation(args, environment);
  const paths = await (options.createPaths ?? createHistoryChainPaths)();
  const producerStartedAtMs = now();
  const producer = spawnChild(
    spawn,
    ["scripts/parity-version-history-e2e.mjs"],
    {
      env: chainChildEnvironment(environment, paths.runRoot),
      stdio: "inherit",
    },
  );
  const producerEndedAtMs = now();
  requireSuccess(producer, "F456 producer");
  let f455;
  let f456;
  let receiptFd;
  try {
    const artifactInput = {
      runRoot: paths.runRoot,
      producerStartedAtMs,
      producerEndedAtMs,
    };
    f455 = await (options.openArtifact ?? openHistoryChainArtifact)({
      ...artifactInput,
      path: paths.f455Evidence,
    });
    f456 = await (options.openArtifact ?? openHistoryChainArtifact)({
      ...artifactInput,
      path: paths.f456Evidence,
    });
    const launcherObservedAtMs = now();
    const receipt = buildHistoryChainReceipt({
      paths,
      f455,
      f456,
      producerPid: producer.pid,
      producerStartedAtMs,
      producerEndedAtMs,
      launcherObservedAtMs,
    });
    receiptFd = (options.writeReceipt ?? writeHistoryChainReceipt)(
      paths.receipt,
      receipt,
    );
    const consumer = spawnChild(spawn, ["scripts/parity-negative-e2e.mjs"], {
      env: chainConsumerEnvironment(environment, paths.runRoot),
      stdio: ["inherit", "inherit", "inherit", f456.handle.fd, receiptFd],
    });
    requireSuccess(consumer, "F474 consumer");
    return Object.freeze({
      status: "passed",
      runRoot: paths.runRoot,
      f455Sha256: f455.sha256,
      f456Sha256: f456.sha256,
      receiptPath: paths.receipt,
      producerPid: producer.pid,
      consumerPid: consumer.pid,
    });
  } finally {
    if (receiptFd !== undefined) closeSync(receiptFd);
    await f456?.handle.close();
    await f455?.handle.close();
  }
}

function spawnChild(spawn, args, options) {
  return spawn(process.execPath, args, {
    cwd: repositoryRoot,
    timeout: 1_800_000,
    ...options,
  });
}

function requireSuccess(result, label) {
  if (result?.error) throw result.error;
  if (result?.status !== 0) {
    throw new Error(
      `${label} failed with status ${result?.status ?? "unknown"}`,
    );
  }
  if (!Number.isInteger(result.pid)) throw new Error(`${label} pid missing`);
}
