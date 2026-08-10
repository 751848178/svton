import { constants, closeSync, fsyncSync, openSync, writeSync } from "node:fs";
import { basename } from "node:path";

export function buildHistoryChainReceipt(input) {
  const {
    paths,
    f455,
    f456,
    producerStartedAtMs,
    producerEndedAtMs,
    launcherObservedAtMs,
  } = input;
  requireValue(
    launcherObservedAtMs >= producerEndedAtMs,
    "observation-before-producer-end",
  );
  requireValue(
    launcherObservedAtMs <= producerEndedAtMs + 10_000,
    "launcher-observation-delayed",
  );
  const link = f456.document.steps?.["base-f455-chain-rerun"]?.result;
  requireValue(
    f456.document.context?.sourceEvidenceSha256 === f455.sha256,
    "embedded-context-sha",
  );
  requireValue(
    link?.sourceEvidence === paths.f455Evidence,
    "embedded-f455-path",
  );
  requireValue(link?.sourceEvidenceSha256 === f455.sha256, "embedded-f455-sha");
  return Object.freeze({
    version: 1,
    launcher: "scripts/parity-history-negative-e2e.mjs",
    launcherPid: process.pid,
    runId: basename(paths.runRoot),
    canonicalTempRoot: paths.canonicalTempRoot,
    canonicalRunRoot: paths.runRoot,
    producerPid: input.producerPid,
    producerStartedAt: new Date(producerStartedAtMs).toISOString(),
    producerEndedAt: new Date(producerEndedAtMs).toISOString(),
    launcherObservedAt: new Date(launcherObservedAtMs).toISOString(),
    consumerDeadlineAt: new Date(launcherObservedAtMs + 10_000).toISOString(),
    f455: artifactReceipt(f455),
    f456: {
      ...artifactReceipt(f456),
      embeddedF455Path: link.sourceEvidence,
      embeddedF455Sha256: link.sourceEvidenceSha256,
    },
  });
}

export function writeHistoryChainReceipt(path, receipt) {
  requireValue(Number.isInteger(constants.O_NOFOLLOW), "no-follow-unsupported");
  const flags =
    constants.O_CREAT |
    constants.O_EXCL |
    constants.O_RDWR |
    constants.O_NOFOLLOW;
  const fd = openSync(path, flags, 0o400);
  try {
    const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
    requireValue(
      writeSync(fd, bytes, 0, bytes.length, 0) === bytes.length,
      "receipt-short-write",
    );
    fsyncSync(fd);
    return fd;
  } catch (error) {
    closeSync(fd);
    throw error;
  }
}

function artifactReceipt(artifact) {
  return {
    path: artifact.path,
    sha256: artifact.sha256,
    identity: artifact.identity,
    capturedAt: artifact.capturedAt,
  };
}

function requireValue(value, reason) {
  if (!value) throw new Error(`F537_HISTORY_RECEIPT_INVALID: ${reason}`);
}
