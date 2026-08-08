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

for (const name of [
  "F456_EVIDENCE_PATH",
  "F456_EVIDENCE_SHA256",
  "F456_CAPTURED_NOT_BEFORE",
  "F456_CAPTURED_NOT_AFTER",
]) {
  assert.match(driver, new RegExp(name));
}
assert.match(driver, /bindNegativeHistoryContext/);
assert.match(driver, /loadNegativeHistoryContext\(historyEvidenceInput\)/);
assert.doesNotMatch(driver, /loadNegativeHistoryContext\(\)/);
assert.doesNotMatch(adapter, /fixedIds/);
assert.doesNotMatch(adapter, /\/tmp\/codex-tool-runs\/svton\/f456/);
assert.match(adapter, /parseNegativeHistoryEvidence\(bytes, input\)/);
assert.doesNotMatch(binding, /\.(create|update|upsert|delete|deleteMany)\s*\(/);

process.stdout.write("negative history driver static self-test passed\n");
