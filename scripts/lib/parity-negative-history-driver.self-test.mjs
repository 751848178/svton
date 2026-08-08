#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const driver = await readFile(
  new URL("../parity-negative-e2e.mjs", import.meta.url),
  "utf8",
);
const adapter = await readFile(
  new URL("./parity-negative-e2e-context.mjs", import.meta.url),
  "utf8",
);
const binding = await readFile(
  new URL("./parity-negative-history-db-binding.mjs", import.meta.url),
  "utf8",
);
const contract = await readFile(
  new URL("./parity-negative-history-contract.mjs", import.meta.url),
  "utf8",
);
const checkContract = await readFile(
  new URL("./parity-negative-history-check-contract.mjs", import.meta.url),
  "utf8",
);
const chainPaths = await readFile(
  new URL("./parity-history-chain-paths.mjs", import.meta.url),
  "utf8",
);

for (const name of [
  "F456_EVIDENCE_PATH",
  "F456_EVIDENCE_SHA256",
  "F456_CAPTURED_NOT_BEFORE",
  "F456_CAPTURED_NOT_AFTER",
]) {
  assert.doesNotMatch(driver, new RegExp(name));
  assert.doesNotMatch(adapter, new RegExp(name));
  assert.match(chainPaths, new RegExp(name));
}
assert.match(driver, /bindNegativeHistoryContext/);
assert.match(driver, /loadNegativeHistoryContext\(historyEvidenceInput\)/);
assert.doesNotMatch(driver, /loadNegativeHistoryContext\(\)/);
assert.match(driver, /negativeHistoryInputFromEnvironment\(process\.env\)/);
assert.doesNotMatch(adapter, /fixedIds/);
assert.doesNotMatch(adapter, /\/tmp\/codex-tool-runs\/svton\/f456/);
assert.match(
  adapter,
  /parseNegativeHistoryEvidence\(trusted\.bytes, trusted\.parserInput\)/,
);
assert.match(adapter, /evidenceFd: 3, receiptFd: 4/);
assert.doesNotMatch(adapter, /readFile/);
assert.doesNotMatch(binding, /\.(create|update|upsert|delete|deleteMany)\s*\(/);
assert.match(contract, /canonicalHistoryStepValid\(stepName, step\)/);
assert.match(contract, /validateTrustedHistoryBase\(baseStep, context\)/);
assert.match(
  checkContract,
  /historyStepChecks\(name, step\?\.result \|\| \{\}\)/,
);
for (const field of ["name", "pass", "actual", "expected"]) {
  assert.match(checkContract, new RegExp(`item\\.${field}`));
}

process.stdout.write("negative history driver static self-test passed\n");
