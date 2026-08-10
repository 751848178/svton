#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../parity-negative-e2e.mjs", import.meta.url),
  "utf8",
);
const stepName = "ac-033-create-r4-probe-404";
const start = source.indexOf(`step("${stepName}",`);
assert.ok(start >= 0, `${stepName}: missing step`);
const next = source.indexOf('step("', start + 1);
const region = source.slice(start, next < 0 ? source.length : next);

assert.match(
  region,
  /const created = requireConfigRevisionCreateResponse\(r4\)/,
  `${stepName}: canonical response helper`,
);
for (const field of ["r4RevisionId: created.id", "revision: created.revision"]) {
  assert.match(region, new RegExp(field), `${stepName}: missing ${field}`);
}
assert.doesNotMatch(region, /r4ProductionId = r4\.id/);
assert.doesNotMatch(region, /currentConfigRevisionId === r4\.id/);

process.stdout.write("negative AC-033 config response self-test passed\n");
