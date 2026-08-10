#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const files = (await readdir(directory))
  .filter((name) => name.endsWith(".self-test.mjs"))
  .sort();
for (const name of files) {
  const result = spawnSync(process.execPath, [join(directory, name)], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(`SELF_TEST_FAILED ${name}\n${result.stderr || ""}`);
    process.exit(result.status || 1);
  }
}
process.stdout.write(`self-tests=${files.length} failed=0\n`);
