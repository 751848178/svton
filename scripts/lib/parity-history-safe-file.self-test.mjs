#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmod,
  link,
  mkdtemp,
  open,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readStableBrowserFile } from "./parity-history-safe-file.mjs";

const directory = await mkdtemp(join(tmpdir(), "f533-safe-file-"));
const path = join(directory, "proof.txt");
const original = Buffer.from("stable snapshot marker");
await writeFile(path, original, { mode: 0o600 });
const valid = await readStableBrowserFile(path, { exclusivePolicy: true });
assert.deepEqual(valid.buffer, original);
for (const field of [
  "dev",
  "ino",
  "size",
  "nlink",
  "uid",
  "mode",
  "mtime",
  "ctime",
]) {
  assert.match(valid.identity[field], /^\d+$/);
}

const linkPath = join(directory, "proof-link.txt");
await symlink(path, linkPath);
await rejects(linkPath, /pre-open-nonregular/);
await rejects(directory, /pre-open-nonregular/);

const fifo = join(directory, "proof.fifo");
const fifoCreated = spawnSync("mkfifo", [fifo], { encoding: "utf8" });
assert.equal(fifoCreated.status, 0, fifoCreated.stderr);
await rejects(fifo, /pre-open-nonregular/);
const linked = join(directory, "linked.txt");
await link(path, linked);
await assert.rejects(
  readStableBrowserFile(path, { exclusivePolicy: true }),
  /pre-open-nonregular/,
);
await rm(linked);
await chmod(path, 0o644);
await assert.rejects(
  readStableBrowserFile(path, { exclusivePolicy: true }),
  /pre-open-nonregular/,
);
await chmod(path, 0o600);

await writeFile(path, original);
const replaced = join(directory, "proof-original.txt");
await assert.rejects(
  readStableBrowserFile(path, {
    afterOpen: async () => {
      await rename(path, replaced);
      await writeFile(path, Buffer.from("replacement bytes"), { mode: 0o600 });
    },
  }),
  /(?:file-changed|path-replaced)-during-read/,
);

await writeFile(path, original);
await assert.rejects(
  readStableBrowserFile(path, {
    afterRead: async () => writeFile(path, Buffer.from("drift")),
  }),
  /file-changed-during-read/,
);

await writeFile(path, original);
let closed = false;
await assert.rejects(
  readStableBrowserFile(path, {
    open: async (filePath, flags) => {
      const handle = await open(filePath, flags);
      return {
        stat: (...args) => handle.stat(...args),
        readFile: (...args) => handle.readFile(...args),
        close: async () => {
          closed = true;
          await handle.close();
        },
      };
    },
    afterRead: async () => {
      throw new Error("injected read failure");
    },
  }),
  /E2E_BROWSER_FILE_INVALID/,
);
assert.equal(closed, true);

await rm(directory, { recursive: true });
process.stdout.write("history safe file self-test passed\n");

async function rejects(filePath, pattern) {
  await assert.rejects(readStableBrowserFile(filePath), pattern);
}
