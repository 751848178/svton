#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeExclusiveBrowserOutput } from "./parity-history-browser-output-writer.mjs";

const root = await mkdtemp(
  join(await realpath(tmpdir()), "f548-output-writer-"),
);
const original = Buffer.from("fresh exclusive browser output");
const written = await writeExclusiveBrowserOutput(root, "proof.txt", original);
assert.equal(written.bytes, original.length);
assert.deepEqual(await readFile(written.file), original);
const stats = await lstat(written.file, { bigint: true });
assert.equal(stats.isFile(), true);
assert.equal(stats.nlink, 1n);
assert.equal(stats.uid, BigInt(process.geteuid()));
assert.equal(stats.mode & 0o777n, 0o600n);

await assert.rejects(
  writeExclusiveBrowserOutput(root, "proof.txt", Buffer.from("replacement")),
  /E2E_BROWSER_OUTPUT_INVALID: EEXIST/,
);
assert.deepEqual(await readFile(written.file), original);

const outsideDirectory = await mkdtemp(
  join(await realpath(tmpdir()), "f548-outside-victim-"),
);
const outside = join(outsideDirectory, "outside-victim.txt");
await writeFile(outside, "outside bytes", { mode: 0o600 });
const hardlink = join(root, "hardlink.txt");
await link(outside, hardlink);
await rejectsExisting("hardlink.txt");
assert.equal(await readFile(outside, "utf8"), "outside bytes");

const symlinkPath = join(root, "symlink.txt");
await symlink(outside, symlinkPath);
await rejectsExisting("symlink.txt");
const fifoPath = join(root, "fifo.txt");
assert.equal(spawnSync("mkfifo", [fifoPath]).status, 0);
await rejectsExisting("fifo.txt");
await mkdir(join(root, "directory.txt"));
await rejectsExisting("directory.txt");

const oldRun = await mkdtemp(join(root, "old-run-"));
const oldLeaf = join(oldRun, "old.txt");
await writeFile(oldLeaf, "old run remains", { mode: 0o600 });
const failedRun = await mkdtemp(join(root, "failed-run-"));
await writeExclusiveBrowserOutput(
  failedRun,
  "first.txt",
  Buffer.from("partial new run"),
);
await link(outside, join(failedRun, "second.txt"));
await assert.rejects(
  writeExclusiveBrowserOutput(
    failedRun,
    "second.txt",
    Buffer.from("must not truncate"),
  ),
  /E2E_BROWSER_OUTPUT_INVALID: EEXIST/,
);
assert.equal(await readFile(oldLeaf, "utf8"), "old run remains");
assert.equal(await readFile(outside, "utf8"), "outside bytes");
assert.equal(
  await readFile(join(failedRun, "first.txt"), "utf8"),
  "partial new run",
);

await rejectsInjected("write-failure.txt", "writeFile");
await rejectsInjected("sync-failure.txt", "sync");
await rejectsInjected("close-failure.txt", "close");
await assert.rejects(
  writeExclusiveBrowserOutput(root, "../escape.txt", original),
  /E2E_BROWSER_OUTPUT_INVALID: invalid-name/,
);

await rm(root, { recursive: true });
await rm(outsideDirectory, { recursive: true });
process.stdout.write("history browser output writer self-test passed\n");

async function rejectsExisting(name) {
  await assert.rejects(
    writeExclusiveBrowserOutput(root, name, Buffer.from("new bytes")),
    /E2E_BROWSER_OUTPUT_INVALID: EEXIST/,
  );
}

async function rejectsInjected(name, method) {
  await assert.rejects(
    writeExclusiveBrowserOutput(root, name, original, {
      open: async (...args) => failingHandle(await open(...args), method),
    }),
    /E2E_BROWSER_OUTPUT_INVALID: injected-/,
  );
}

function failingHandle(handle, method) {
  return {
    stat: (...args) => handle.stat(...args),
    writeFile: (...args) =>
      method === "writeFile"
        ? Promise.reject(new Error("injected-write"))
        : handle.writeFile(...args),
    sync: () =>
      method === "sync"
        ? Promise.reject(new Error("injected-sync"))
        : handle.sync(),
    close: async () => {
      await handle.close();
      if (method === "close") throw new Error("injected-close");
    },
  };
}
