#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import {
  cleanupBrowserProfile,
  createBrowserProfile,
} from "./parity-history-browser-profile.mjs";

const profile = createBrowserProfile();
await writeFile(join(profile.path, "owned.txt"), "owned profile bytes");
cleanupBrowserProfile(profile);
await assert.rejects(lstat(profile.path));

const replaced = createBrowserProfile();
const moved = `${replaced.path}-moved`;
await rename(replaced.path, moved);
await mkdir(replaced.path, { mode: 0o700 });
await writeFile(join(replaced.path, "victim.txt"), "replacement bytes");
assert.throws(() => cleanupBrowserProfile(replaced), /cleanup-identity/);
assert.equal(
  await readFile(join(replaced.path, "victim.txt"), "utf8"),
  "replacement bytes",
);
await rm(replaced.path, { recursive: true });
await rename(moved, replaced.path);
cleanupBrowserProfile(replaced);

process.stdout.write("history browser profile self-test passed\n");
