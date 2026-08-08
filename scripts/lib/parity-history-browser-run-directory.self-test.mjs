#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  createPinnedBrowserRunDirectory,
  removePinnedBrowserRunDirectory,
  validateBrowserRunIntent,
} from "./parity-history-browser-run-directory.mjs";
import {
  assertPinnedBrowserOutputDirectory,
  closePinnedBrowserOutputDirectory,
} from "./parity-history-safe-directory.mjs";

const canonicalTemp = await realpath(tmpdir());
const root = await mkdtemp(join(canonicalTemp, "f548-run-root-"));
const actions = ["wait:0", "shot:proof.png", "text:proof.txt"];
const seenPaths = new Set();
const seenInodes = new Set();
const livePins = [];
for (let index = 0; index < 100; index += 1) {
  const { pin, outputNames } = await createPinnedBrowserRunDirectory(
    root,
    actions,
  );
  assert.deepEqual(outputNames, ["proof.png", "proof.txt"]);
  assert.equal(dirname(pin.lexicalPath), root);
  assert.equal(pin.filePolicy, "exclusive-0600-single-link");
  assert.equal(await assertPinnedBrowserOutputDirectory(pin), true);
  const stats = await lstat(pin.lexicalPath, { bigint: true });
  assert.equal(stats.isDirectory(), true);
  assert.equal(stats.isSymbolicLink(), false);
  assert.equal(stats.uid, BigInt(process.geteuid()));
  assert.equal(stats.mode & 0o777n, 0o700n);
  seenPaths.add(pin.lexicalPath);
  seenInodes.add(`${stats.dev}:${stats.ino}`);
  livePins.push(pin);
}
assert.equal(seenPaths.size, 100);
assert.equal(seenInodes.size, 100);
for (const pin of livePins) {
  await removePinnedBrowserRunDirectory(pin);
  await closePinnedBrowserOutputDirectory(pin);
}

const beforeDuplicate = await readdir(root);
await assert.rejects(
  createPinnedBrowserRunDirectory(root, [
    "shot:duplicate.png",
    "shot:duplicate.png",
  ]),
  /E2E_BROWSER_RUN_INVALID: duplicate-output/,
);
assert.deepEqual(await readdir(root), beforeDuplicate);
assert.throws(
  () => validateBrowserRunIntent(["wait:1"]),
  /E2E_BROWSER_RUN_INVALID: empty-output-inventory/,
);

const fixed = join(root, "browser");
await mkdir(join(fixed, "profile"), { recursive: true });
const victim = join(fixed, "old-artifact.txt");
const oldProfile = join(fixed, "profile", "cookies.db");
await writeFile(victim, "old evidence bytes");
await writeFile(oldProfile, "old profile bytes");
const fresh = await createPinnedBrowserRunDirectory(root, actions);
assert.equal(await readFile(victim, "utf8"), "old evidence bytes");
assert.equal(await readFile(oldProfile, "utf8"), "old profile bytes");
assert.notEqual(fresh.pin.lexicalPath, fixed);
await removePinnedBrowserRunDirectory(fresh.pin);
await closePinnedBrowserOutputDirectory(fresh.pin);

const symlinkRootTarget = await mkdtemp(join(canonicalTemp, "f548-real-root-"));
const symlinkRoot = join(root, "trusted-root-alias");
await symlink(symlinkRootTarget, symlinkRoot, "dir");
const beforeAliasAttempt = await readdir(symlinkRootTarget);
await assert.rejects(
  createPinnedBrowserRunDirectory(symlinkRoot, actions),
  /E2E_BROWSER_RUN_INVALID: trusted-root-symlink/,
);
assert.deepEqual(await readdir(symlinkRootTarget), beforeAliasAttempt);

const sourceUrls = [
  "./parity-history-browser-output-capability.mjs",
  "./parity-history-browser-output-fd.mjs",
  "./parity-history-cdp-actions.mjs",
  "./parity-history-cdp-driver.mjs",
  "./parity-history-browser-profile.mjs",
  "../parity-version-history-e2e.mjs",
];
const sources = await Promise.all(
  sourceUrls.map((value) => readFile(new URL(value, import.meta.url), "utf8")),
);
const combined = sources.join("\n");
assert.doesNotMatch(combined, /\bO_TRUNC\b/);
assert.doesNotMatch(combined, /prepareBrowserFilesForPin/);
assert.doesNotMatch(combined, /["']--out["']|mkdirSync\(options\.out/);
assert.match(sources[0], /O_EXCL[\s\S]*O_NOFOLLOW[\s\S]*0o600/);
assert.match(sources[1], /writeSync\(/);
assert.match(sources[1], /fsyncSync\(/);
assert.match(sources[3], /decodeBrowserOutputPlan/);
assert.match(sources[4], /mkdtempSync/);

await rm(root, { recursive: true });
await rm(symlinkRootTarget, { recursive: true });
process.stdout.write("history browser run directory self-test passed\n");
