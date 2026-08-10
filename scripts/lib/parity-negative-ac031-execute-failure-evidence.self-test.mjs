#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../parity-negative-e2e.mjs", import.meta.url),
  "utf8",
);
const stepName = "ac-031-concurrent-execute";
const start = source.indexOf(`step("${stepName}",`);
assert.ok(start >= 0, `${stepName}: missing step`);
const next = source.indexOf('step("', start + 1);
const region = source.slice(start, next < 0 ? source.length : next);

assert.match(
  region,
  /select:\s*\{ id: true, status: true, error: true, logs: true, result: true \}/,
);
assert.match(
  region,
  /select:\s*\{ status: true, errorCode: true, errorMessage: true \}/,
);
for (const field of [
  "winnerMessage",
  "deploymentRunError",
  "deploymentRunLogs",
  "deploymentRunResult",
  "releaseRunErrorCode",
  "releaseRunErrorMessage",
]) {
  assert.match(region, new RegExp(`${field}:`), `${stepName}: missing ${field}`);
}

process.stdout.write("negative AC-031 execute failure evidence self-test passed\n");
