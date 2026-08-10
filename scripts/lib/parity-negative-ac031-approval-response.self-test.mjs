#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../parity-negative-e2e.mjs", import.meta.url),
  "utf8",
);
const stepName = "ac-031-approve-winner";
const start = source.indexOf(`step("${stepName}",`);
assert.ok(start >= 0, `${stepName}: missing step`);
const next = source.indexOf('step("', start + 1);
const region = source.slice(start, next < 0 ? source.length : next);
const returnAt = region.indexOf("return {");
assert.ok(returnAt >= 0, `${stepName}: missing evidence projection`);
const projection = region.slice(returnAt);

assert.match(region, /decision:\s*"approved"/, `${stepName}: request decision`);
assert.match(
  projection,
  /decision:\s*"approved"/,
  `${stepName}: evidence decision`,
);
assert.doesNotMatch(
  projection,
  /reviewed\.decision/,
  `${stepName}: canonical response has no decision field`,
);
assert.match(
  projection,
  /status:\s*reviewed\.status/,
  `${stepName}: response status`,
);

process.stdout.write("negative AC-031 approval response self-test passed\n");
