#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { assertEvidenceReceiptMatches } from "./parity-history-driver-evidence-receipt.mjs";
import { parseDriverStdout } from "./parity-history-driver-stdout-parser.mjs";

const SHA = "a".repeat(64);
const NONCE = "b".repeat(64);
const OUTPUTS = [
  "01-after-login.png",
  "01-after-login.txt",
  "02-release-detail.txt",
  "02-release-detail.html",
  "02-release-detail.png",
  "02b-staging-step.txt",
  "02b-staging-step.png",
  "03-build-log-drawer.txt",
  "03-build-log-drawer.png",
  "04-staging-run-log.txt",
  "04-staging-run-log.png",
  "05-production-recovery-log.txt",
  "05-production-recovery-log.png",
  "06-env-versions.txt",
  "06-env-versions.html",
  "06-env-versions.png",
];
const RECEIPTS = [
  ...OUTPUTS.map((name, index) =>
    artifact(kindForName(name), `/run/${name}`, 128 + index),
  ),
  evidence("/run/cdp-evidence.json"),
];

const parsed = parseDriverStdout(
  ["driver log", ...RECEIPTS.map(JSON.stringify)].join("\n"),
  { artifactNames: OUTPUTS, runNonce: NONCE },
);
assert.equal(parsed.artifacts.length, OUTPUTS.length);
assert.equal(parsed.logs[0], "driver log");
assert.equal(parsed.evidenceReceipt.sha256, SHA);

const evidenceBytes = Buffer.from("current CDP evidence");
const digest = createHash("sha256").update(evidenceBytes).digest("hex");
assert.doesNotThrow(() =>
  assertEvidenceReceiptMatches({ sha256: digest }, evidenceBytes),
);
assert.throws(
  () => assertEvidenceReceiptMatches({ sha256: SHA }, evidenceBytes),
  /evidence-sha-mismatch/,
);

reject("malformed", ["{"]);
reject("array wrapper", [JSON.stringify(RECEIPTS)]);
reject("unknown object", [JSON.stringify({ unknown: "/run/x" })]);
reject("ambiguous", [JSON.stringify({ ...RECEIPTS[0], text: "/run/x.txt" })]);
reject("extra field", [JSON.stringify({ ...RECEIPTS[0], extra: true })]);
reject("duplicate artifact", [JSON.stringify(RECEIPTS[0])]);
reject("missing artifact", [], OUTPUTS, RECEIPTS.slice(1));
reject("missing evidence", [], OUTPUTS, RECEIPTS.slice(0, -1));
reject("duplicate evidence", [JSON.stringify(RECEIPTS.at(-1))]);
reject("unexpected artifact", [
  JSON.stringify(artifact("text", "/run/extra.txt", 16)),
]);
reject("kind mismatch", [JSON.stringify({ ...RECEIPTS[0], kind: "text" })]);
reject("filename kind", [JSON.stringify(artifact("text", "/run/01.png", 16))]);
reject("bad sha", [JSON.stringify({ ...RECEIPTS[0], sha256: "bad" })]);
reject("stale nonce", [
  JSON.stringify({ ...RECEIPTS[0], runNonce: "c".repeat(64) }),
]);

process.stdout.write("history driver stdout parser self-test passed\n");

function artifact(type, path, bytes) {
  return { [type]: path, kind: type, bytes, sha256: SHA, runNonce: NONCE };
}

function evidence(path) {
  return { evidence: path, sha256: SHA, runNonce: NONCE };
}

function kindForName(name) {
  if (name.endsWith(".png")) return "screenshot";
  if (name.endsWith(".txt")) return "text";
  return "dom";
}

function reject(label, additions, outputs = OUTPUTS, base = RECEIPTS) {
  assert.throws(
    () =>
      parseDriverStdout(
        [...base.map(JSON.stringify), ...additions].join("\n"),
        { artifactNames: outputs, runNonce: NONCE },
      ),
    /E2E_DRIVER_STDOUT_INVALID/,
    label,
  );
}
