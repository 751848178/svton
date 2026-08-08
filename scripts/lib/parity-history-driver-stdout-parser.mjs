import { basename } from "node:path";

const ARTIFACT_TYPES = Object.freeze(["screenshot", "text", "dom"]);
const RECEIPT_TYPES = new Set([...ARTIFACT_TYPES, "evidence"]);
const SHA256 = /^[a-f0-9]{64}$/;

export function parseDriverStdout(stdout, expectedArtifacts) {
  requireValue(typeof stdout === "string", "not-a-string");
  const expected = expectedInventory(expectedArtifacts);
  const artifacts = [];
  const names = new Set();
  const logs = [];
  let evidenceReceipt = null;
  for (const [index, line] of stdout.split("\n").entries()) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (!isCandidate(trimmed)) {
      logs.push(line);
      continue;
    }
    const receipt = parseReceipt(trimmed, index + 1);
    if (receipt.type === "evidence") {
      requireValue(evidenceReceipt === null, "duplicate-evidence");
      evidenceReceipt = receipt.value;
      continue;
    }
    const name = basename(receipt.value[receipt.type]);
    requireValue(expected.has(name), `unexpected-artifact:${name}`);
    requireValue(!names.has(name), `duplicate-artifact:${name}`);
    requireValue(kindForName(name) === receipt.type, `filename-kind:${name}`);
    names.add(name);
    artifacts.push(receipt.value);
  }
  for (const name of expected) {
    requireValue(names.has(name), `missing-artifact:${name}`);
  }
  requireValue(evidenceReceipt !== null, "missing-evidence");
  return Object.freeze({ artifacts, evidenceReceipt, logs });
}

function expectedInventory(value) {
  requireValue(Array.isArray(value) && value.length > 0, "expected-inventory");
  const names = new Set();
  for (const name of value) {
    requireValue(
      typeof name === "string" && basename(name) === name,
      "expected-name",
    );
    requireValue(kindForName(name) !== null, `expected-kind:${name}`);
    requireValue(!names.has(name), `expected-duplicate:${name}`);
    names.add(name);
  }
  return names;
}

function isCandidate(line) {
  return line.startsWith("{") || line.startsWith("[");
}

function parseReceipt(line, lineNumber) {
  let value;
  try {
    value = JSON.parse(line);
  } catch {
    throw protocolError(`malformed-json:line-${lineNumber}`);
  }
  requireValue(isPlainObject(value), `object:line-${lineNumber}`);
  const receiptKeys = Object.keys(value).filter((key) =>
    RECEIPT_TYPES.has(key),
  );
  requireValue(receiptKeys.length === 1, `receipt-type:line-${lineNumber}`);
  const type = receiptKeys[0];
  if (type === "evidence") return evidenceReceipt(value, lineNumber);
  return artifactReceipt(value, type, lineNumber);
}

function artifactReceipt(value, type, lineNumber) {
  requireKeys(value, [type, "kind", "bytes", "sha256"], lineNumber);
  requireValue(nonEmpty(value[type]), `artifact-path:line-${lineNumber}`);
  requireValue(value.kind === type, `artifact-kind:line-${lineNumber}`);
  requireValue(
    Number.isInteger(value.bytes) && value.bytes >= 0,
    `artifact-bytes:line-${lineNumber}`,
  );
  requireSha(value.sha256, lineNumber);
  return { type, value: { ...value } };
}

function evidenceReceipt(value, lineNumber) {
  requireKeys(value, ["evidence", "sha256"], lineNumber);
  requireValue(
    nonEmpty(value.evidence) &&
      basename(value.evidence) === "cdp-evidence.json",
    `evidence-path:line-${lineNumber}`,
  );
  requireSha(value.sha256, lineNumber);
  return { type: "evidence", value: { ...value } };
}

function requireKeys(value, expected, lineNumber) {
  const actual = Object.keys(value).sort();
  requireValue(
    actual.length === expected.length &&
      expected.every((key) => Object.hasOwn(value, key)),
    `receipt-keys:line-${lineNumber}`,
  );
}

function requireSha(value, lineNumber) {
  requireValue(
    typeof value === "string" && SHA256.test(value),
    `sha:line-${lineNumber}`,
  );
}

function kindForName(name) {
  if (name.endsWith(".png")) return "screenshot";
  if (name.endsWith(".txt")) return "text";
  if (name.endsWith(".html")) return "dom";
  return null;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}

function requireValue(value, reason) {
  if (!value) throw protocolError(reason);
}

function protocolError(reason) {
  return new Error(`E2E_DRIVER_STDOUT_INVALID: ${reason}`);
}
