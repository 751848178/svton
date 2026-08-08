#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertBrowserOutputDirectoryForMutation,
  assertPinnedBrowserOutputDirectory,
  closePinnedBrowserOutputDirectory,
  pinBrowserOutputDirectory,
} from "./parity-history-safe-directory.mjs";

const valid = await createFixture();
const precreatedLeaf = join(valid.browserOut, "precreated.txt");
await writeFile(precreatedLeaf, "");
const validPin = await pinBrowserOutputDirectory(valid.browserOut, valid.root);
assert.equal(Object.isFrozen(validPin), true);
assert.equal(await assertPinnedBrowserOutputDirectory(validPin), true);
for (const field of ["dev", "ino", "nlink", "mode"]) {
  assert.match(validPin.identity[field], /^\d+$/);
}
await mkdir(join(valid.profile, "descendant"));
await writeFile(precreatedLeaf, "producer overwrite");
assert.equal(await assertPinnedBrowserOutputDirectory(validPin), true);
await closePinnedBrowserOutputDirectory(validPin);
await assert.rejects(
  assertPinnedBrowserOutputDirectory(validPin),
  /E2E_BROWSER_DIRECTORY_INVALID/,
);
await cleanup(valid);

const leafLink = await createFixture();
const outsideLeaf = await mkdtemp(join(tmpdir(), "f540-outside-leaf-"));
await rm(leafLink.browserOut, { recursive: true });
await symlink(outsideLeaf, leafLink.browserOut, "dir");
await rejectsBeforeMutation(leafLink.browserOut, leafLink.root);
await rejectsPin(leafLink.browserOut, leafLink.root);
await cleanup(leafLink, outsideLeaf);

const ancestorLink = await createFixture(false);
const realAncestor = join(ancestorLink.root, "real");
const alias = join(ancestorLink.root, "alias");
await mkdir(join(realAncestor, "browser"), { recursive: true });
await symlink(realAncestor, alias, "dir");
await rejectsBeforeMutation(join(alias, "browser"), ancestorLink.root);
await rejectsPin(join(alias, "browser"), ancestorLink.root);
await cleanup(ancestorLink);

const containment = await createFixture();
const sibling = await mkdtemp(join(tmpdir(), "f540-root-prefix-evil-"));
await rejectsPin(sibling, containment.root);
await rejectsPin(containment.root, containment.root);
await cleanup(containment, sibling);

const invalidTarget = await createFixture();
const regular = join(invalidTarget.root, "regular");
const fifo = join(invalidTarget.root, "fifo");
await writeFile(regular, "not a directory");
assert.equal(spawnSync("mkfifo", [fifo]).status, 0);
await rejectsPin(regular, invalidTarget.root);
await rejectsPin(fifo, invalidTarget.root);
await rejectsPin(join(invalidTarget.root, "missing"), invalidTarget.root);
await cleanup(invalidTarget);

await rejectsPinnedMutation(async ({ browserOut, root }) => {
  await rename(browserOut, join(root, "browser-original"));
  await mkdir(browserOut);
});
await rejectsPinnedMutation(async ({ browserOut, root }) => {
  const child = spawnSync(
    process.execPath,
    [
      "-e",
      'const fs=require("node:fs");fs.renameSync(process.argv[1],process.argv[2]);fs.mkdirSync(process.argv[1])',
      browserOut,
      join(root, "browser-child-original"),
    ],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 0, child.stderr);
});
await rejectsPinnedMutation(async ({ browserOut, root }) => {
  await rename(browserOut, join(root, "browser-original"));
});
await rejectsPinnedMutation(async ({ browserOut, root }) => {
  const outside = await mkdtemp(join(tmpdir(), "f540-swap-outside-"));
  await rename(browserOut, join(root, "browser-original"));
  await symlink(outside, browserOut, "dir");
  return () => rm(outside, { recursive: true, force: true });
});
await rejectsPinnedMutation(async ({ browserOut }) => {
  await chmod(browserOut, 0o000);
  return () => chmod(browserOut, 0o755);
});
await rejectsPinnedMutation(async ({ browserOut }) =>
  mkdir(join(browserOut, "unexpected-directory")),
);

process.stdout.write("history safe directory self-test passed\n");

async function createFixture(withBrowser = true) {
  const root = await mkdtemp(join(tmpdir(), "f540-safe-directory-"));
  const browserOut = join(root, "browser");
  const profile = join(browserOut, "profile");
  if (withBrowser) await mkdir(profile, { recursive: true });
  return { root, browserOut, profile };
}

async function rejectsPin(path, root) {
  await assert.rejects(
    pinBrowserOutputDirectory(path, root),
    /E2E_BROWSER_DIRECTORY_INVALID/,
  );
}

async function rejectsBeforeMutation(path, root) {
  const calls = { remove: 0, write: 0 };
  await assert.rejects(
    guardedMutation(path, root, {
      remove: () => {
        calls.remove += 1;
      },
      write: () => {
        calls.write += 1;
      },
    }),
    /E2E_BROWSER_DIRECTORY_INVALID/,
  );
  assert.deepEqual(calls, { remove: 0, write: 0 });
}

async function guardedMutation(path, root, hooks) {
  await assertBrowserOutputDirectoryForMutation(path, root);
  await hooks.remove();
  await hooks.write();
}

async function rejectsPinnedMutation(mutate) {
  const fixture = await createFixture();
  const pin = await pinBrowserOutputDirectory(fixture.browserOut, fixture.root);
  let extraCleanup;
  try {
    extraCleanup = await mutate(fixture);
    await assert.rejects(
      assertPinnedBrowserOutputDirectory(pin),
      /E2E_BROWSER_DIRECTORY_INVALID/,
    );
  } finally {
    await closePinnedBrowserOutputDirectory(pin);
    await extraCleanup?.();
    await cleanup(fixture);
  }
}

async function cleanup(fixture, extraPath) {
  await rm(fixture.root, { recursive: true, force: true });
  if (extraPath) await rm(extraPath, { recursive: true, force: true });
}
