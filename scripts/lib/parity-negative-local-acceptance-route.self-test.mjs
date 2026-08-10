#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../parity-negative-e2e.mjs", import.meta.url),
  "utf8",
);

for (const stepName of [
  "ac-029-create-r3-drift",
  "ac-033-create-r4-probe-404",
]) {
  const start = source.indexOf(`step("${stepName}",`);
  assert.ok(start >= 0, `${stepName}: missing step`);
  const next = source.indexOf('step("', start + 1);
  const region = source.slice(start, next < 0 ? source.length : next);
  assert.match(
    region,
    /routeSnapshot:\s*\{[\s\S]*?domains:\s*\["parity\.example\.test"\][\s\S]*?tlsRequired:\s*false/,
    `${stepName}: local acceptance route must stay HTTP`,
  );
  assert.doesNotMatch(
    region,
    /tlsRequired:\s*true/,
    `${stepName}: must not bypass guarded local acceptance`,
  );
}

process.stdout.write("negative local acceptance route self-test passed\n");
