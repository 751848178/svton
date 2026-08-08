import { createHash } from "node:crypto";
import { fstatSync, readSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative } from "node:path";

const IDENTITY_KEYS = [
  "ctimeNs",
  "dev",
  "ino",
  "mode",
  "mtimeNs",
  "nlink",
  "size",
];
const ARTIFACT_KEYS = ["capturedAt", "identity", "path", "sha256"];

export function readHistoryChainReceipt(input) {
  const receiptRead = readStableFd(input.receiptFd, true);
  const receipt = JSON.parse(receiptRead.buffer.toString("utf8"));
  validateReceiptShape(receipt);
  const started = time(receipt.producerStartedAt, "producer-start");
  const ended = time(receipt.producerEndedAt, "producer-end");
  const observed = time(receipt.launcherObservedAt, "launcher-observed");
  const deadline = time(receipt.consumerDeadlineAt, "consumer-deadline");
  requireValue(started <= ended && ended <= observed, "time-order");
  requireValue(observed <= ended + 10_000, "launcher-window-wide");
  requireValue(deadline === observed + 10_000, "consumer-window-wide");
  requireValue(
    (input.nowMs ?? Date.now()) <= deadline,
    "consumer-observation-delayed",
  );
  requireValue(
    receipt.launcherPid === (input.parentPid ?? process.ppid),
    "launcher-parent-mismatch",
  );
  validateOwnedPaths(receipt);
  const evidence = readStableFd(input.evidenceFd, false);
  requireValue(
    sameIdentity(evidence.identity, receipt.f456.identity),
    "evidence-identity-mismatch",
  );
  const sha256 = createHash("sha256").update(evidence.buffer).digest("hex");
  requireValue(sha256 === receipt.f456.sha256, "evidence-sha-mismatch");
  requireValue(
    receipt.f456.embeddedF455Path === receipt.f455.path,
    "f455-path-link-mismatch",
  );
  requireValue(
    receipt.f456.embeddedF455Sha256 === receipt.f455.sha256,
    "f455-sha-link-mismatch",
  );
  return Object.freeze({
    bytes: evidence.buffer,
    parserInput: Object.freeze({
      evidencePath: receipt.f456.path,
      expectedSha256: receipt.f456.sha256,
      capturedNotBefore: new Date(started - 5_000).toISOString(),
      capturedNotAfter: new Date(ended + 5_000).toISOString(),
      nowMs: input.nowMs ?? Date.now(),
    }),
    receipt,
  });
}

function readStableFd(fd, receipt) {
  requireValue(Number.isInteger(fd) && fd >= 3, "fd-invalid");
  const before = fstatSync(fd, { bigint: true });
  requireValue(before.isFile() && before.nlink === 1n, "fd-not-regular");
  if (receipt) requireValue((before.mode & 0o777n) === 0o400n, "receipt-mode");
  requireValue(before.size <= 20_000_000n, "fd-too-large");
  const buffer = Buffer.alloc(Number(before.size));
  let offset = 0;
  while (offset < buffer.length) {
    const read = readSync(fd, buffer, offset, buffer.length - offset, offset);
    requireValue(read > 0, "fd-short-read");
    offset += read;
  }
  const after = fstatSync(fd, { bigint: true });
  const identity = identityOf(after);
  requireValue(
    sameIdentity(identityOf(before), identity),
    "fd-changed-during-read",
  );
  return { buffer, identity };
}

function validateReceiptShape(receipt) {
  exactKeys(
    receipt,
    "canonicalRunRoot canonicalTempRoot consumerDeadlineAt f455 f456 launcher launcherObservedAt launcherPid producerEndedAt producerPid producerStartedAt runId version",
  );
  exactKeys(receipt.f455, ARTIFACT_KEYS.join(" "));
  exactKeys(
    receipt.f456,
    `${ARTIFACT_KEYS.join(" ")} embeddedF455Path embeddedF455Sha256`,
  );
  exactKeys(receipt.f455.identity, IDENTITY_KEYS.join(" "));
  exactKeys(receipt.f456.identity, IDENTITY_KEYS.join(" "));
  validateArtifact(receipt.f455);
  validateArtifact(receipt.f456);
  requireValue(
    receipt.version === 1 &&
      receipt.launcher === "scripts/parity-history-negative-e2e.mjs",
    "receipt-version",
  );
  requireValue(
    Number.isInteger(receipt.launcherPid) &&
      Number.isInteger(receipt.producerPid),
    "receipt-pid",
  );
}

function validateOwnedPaths(receipt) {
  requireValue(
    receipt.canonicalTempRoot === realpathSync(tmpdir()),
    "temp-root-mismatch",
  );
  requireValue(isAbsolute(receipt.canonicalRunRoot), "run-root-relative");
  requireValue(
    dirname(receipt.canonicalRunRoot) === receipt.canonicalTempRoot,
    "run-root-not-direct-child",
  );
  requireValue(
    basename(receipt.canonicalRunRoot) === receipt.runId,
    "run-id-mismatch",
  );
  requireValue(
    receipt.f455.path ===
      join(receipt.canonicalRunRoot, "f455", "f455-positive-e2e-evidence.json"),
    "f455-path",
  );
  requireValue(
    receipt.f456.path ===
      join(
        receipt.canonicalRunRoot,
        "f456",
        "f456-version-history-evidence.json",
      ),
    "f456-path",
  );
  requireValue(
    !relative(receipt.canonicalRunRoot, receipt.f456.path).startsWith(".."),
    "path-outside-root",
  );
}

function validateArtifact(artifact) {
  requireValue(/^[a-f0-9]{64}$/.test(artifact.sha256 || ""), "artifact-sha");
  requireValue(artifact.identity.nlink === "1", "artifact-link-count");
  for (const key of IDENTITY_KEYS) {
    requireValue(/^\d+$/.test(artifact.identity[key] || ""), `artifact-${key}`);
  }
  requireValue(
    Number.isFinite(Date.parse(artifact.capturedAt || "")),
    "artifact-captured-at",
  );
}

function identityOf(stats) {
  return Object.fromEntries(
    IDENTITY_KEYS.map((key) => [key, stats[key].toString()]),
  );
}

function sameIdentity(left, right) {
  return IDENTITY_KEYS.every((key) => left[key] === right[key]);
}

function exactKeys(value, keys) {
  requireValue(
    value && typeof value === "object" && !Array.isArray(value),
    "receipt-object",
  );
  requireValue(
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify(keys.split(" ").sort()),
    "receipt-keys",
  );
}

function time(value, label) {
  const parsed = Date.parse(value || "");
  requireValue(Number.isFinite(parsed), label);
  return parsed;
}

function requireValue(value, reason) {
  if (!value) throw new Error(`F537_HISTORY_RECEIPT_INVALID: ${reason}`);
}
