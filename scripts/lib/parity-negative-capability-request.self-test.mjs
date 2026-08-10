#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../parity-negative-e2e.mjs", import.meta.url),
  "utf8",
);
const start = source.indexOf('step("ac-026-confirm-rejected"');
const end = source.indexOf('step("ac-027-', start);
assert.ok(start >= 0 && end > start, "AC-026 confirm source region");
const region = source.slice(start, end);
assert.match(region, /expectedInputHash:\s*"f"\.repeat\(64\)/);
assert.doesNotMatch(region, /does-not-matter-capability-check-first/);

process.stdout.write("negative capability request identity self-test passed\n");
