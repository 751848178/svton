#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../parity-negative-e2e.mjs", import.meta.url),
  "utf8",
);
const stepName = "ac-034-member-execute-rejected";
const start = source.indexOf(`step("${stepName}",`);
assert.ok(start >= 0, `${stepName}: missing step`);
const next = source.indexOf('step("', start + 1);
const region = source.slice(start, next < 0 ? source.length : next);

assert.match(
  region,
  /expectedInputHash:\s*"f"\.repeat\(64\)/,
  `${stepName}: valid DTO hash must reach authorization`,
);
assert.doesNotMatch(region, /expectedInputHash:\s*"f457-member"/);

process.stdout.write("negative AC-034 permission payload self-test passed\n");
