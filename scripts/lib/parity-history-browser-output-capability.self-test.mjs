#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  artifactMetadata,
  readBackBrowserArtifacts,
} from "./parity-history-browser-artifacts.mjs";
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupBrowserOutputCapability,
  createBrowserOutputCapability,
  readBrowserOutputCapability,
} from "./parity-history-browser-output-capability.mjs";
import { writeBrowserOutputFd } from "./parity-history-browser-output-fd.mjs";
import { decodeBrowserOutputPlan } from "./parity-history-browser-output-plan.mjs";
import {
  createPinnedBrowserRunDirectory,
  removePinnedBrowserRunDirectory,
} from "./parity-history-browser-run-directory.mjs";
import { closePinnedBrowserOutputDirectory } from "./parity-history-safe-directory.mjs";

const root = await mkdtemp(
  join(await realpath(tmpdir()), "f551-output-capability-"),
);
const actions = ["text:proof.txt"];

const first = await createRun();
const firstPlan = decodeBrowserOutputPlan(first.capability.encodedPlan);
assert.equal(firstPlan.runNonce, first.capability.runNonce);
assert.deepEqual(Object.keys(firstPlan.outputs), [
  "proof.txt",
  "cdp-evidence.json",
]);
const proof = Buffer.from("current descriptor proof");
write(first.capability, "proof.txt", proof);
write(first.capability, "cdp-evidence.json", Buffer.from("current evidence"));
assert.equal(
  (
    await readBrowserOutputCapability(first.capability, "proof.txt")
  ).buffer.toString(),
  proof.toString(),
);
const readback = await readBackBrowserArtifacts(
  [{ text: "proof.txt", ...artifactMetadata("text", proof) }],
  first.pin,
  {
    readSnapshot: (name) => readBrowserOutputCapability(first.capability, name),
  },
);
assert.equal(readback.contents["proof.txt"].toString(), proof.toString());
await cleanupRun(first);

const second = await createRun();
assert.notEqual(second.capability.runNonce, first.capability.runNonce);
await cleanupRun(second);

const inherited = await createRun();
const child = spawnSync(
  process.execPath,
  [
    fileURLToPath(
      new URL(
        "./parity-history-browser-output-child.fixture.mjs",
        import.meta.url,
      ),
    ),
    inherited.capability.encodedPlan,
  ],
  { encoding: "utf8", stdio: inherited.capability.stdio },
);
assert.equal(child.status, 0, child.stderr);
assert.equal(child.stdout.trim(), inherited.capability.runNonce);
assert.equal(
  (
    await readBrowserOutputCapability(inherited.capability, "proof.txt")
  ).buffer.toString(),
  "child descriptor proof",
);
await cleanupRun(inherited);

const swapped = await createRun();
const moved = `${swapped.pin.lexicalPath}-moved`;
await rename(swapped.pin.lexicalPath, moved);
await mkdir(swapped.pin.lexicalPath, { mode: 0o700 });
const replacement = join(swapped.pin.lexicalPath, "proof.txt");
await writeFile(replacement, "replacement victim", { mode: 0o600 });
write(swapped.capability, "proof.txt", Buffer.from("descriptor proof"));
write(
  swapped.capability,
  "cdp-evidence.json",
  Buffer.from("descriptor evidence"),
);
assert.equal(await readFile(replacement, "utf8"), "replacement victim");
await rm(swapped.pin.lexicalPath, { recursive: true });
await rename(moved, swapped.pin.lexicalPath);
assert.equal(
  (
    await readBrowserOutputCapability(swapped.capability, "proof.txt")
  ).buffer.toString(),
  "descriptor proof",
);
await cleanupRun(swapped);

const linked = await createRun();
const outsideLink = join(root, "outside-link.txt");
await link(linked.capability.entries[0].path, outsideLink);
assert.throws(
  () => write(linked.capability, "proof.txt", Buffer.from("must fail")),
  /before-policy/,
);
assert.equal((await readFile(outsideLink)).length, 0);
await unlink(outsideLink);
await cleanupRun(linked);

const victim = join(root, "victim.txt");
await writeFile(victim, "victim bytes", { mode: 0o600 });
for (const kind of ["hardlink", "symlink", "fifo"]) {
  const run = await createPinnedBrowserRunDirectory(root, actions);
  const target = join(run.pin.lexicalPath, "proof.txt");
  if (kind === "hardlink") await link(victim, target);
  else if (kind === "symlink") await symlink(victim, target);
  else assert.equal(spawnSync("mkfifo", [target]).status, 0);
  await assert.rejects(
    createBrowserOutputCapability(run.pin, run.outputNames),
    /E2E_BROWSER_OUTPUT_CAPABILITY_INVALID:EEXIST/,
  );
  assert.equal(await readFile(victim, "utf8"), "victim bytes");
  await rm(target, { force: true });
  await removePinnedBrowserRunDirectory(run.pin);
  await closePinnedBrowserOutputDirectory(run.pin);
}

const partial = await createPinnedBrowserRunDirectory(root, [
  "text:first.txt",
  "text:second.txt",
]);
await link(victim, join(partial.pin.lexicalPath, "second.txt"));
await assert.rejects(
  createBrowserOutputCapability(partial.pin, partial.outputNames),
  /E2E_BROWSER_OUTPUT_CAPABILITY_INVALID:EEXIST/,
);
await assert.rejects(readFile(join(partial.pin.lexicalPath, "first.txt")));
assert.equal(await readFile(victim, "utf8"), "victim bytes");
await unlink(join(partial.pin.lexicalPath, "second.txt"));
await removePinnedBrowserRunDirectory(partial.pin);
await closePinnedBrowserOutputDirectory(partial.pin);

await rm(root, { recursive: true });
process.stdout.write("history browser output capability self-test passed\n");

async function createRun() {
  const { pin, outputNames } = await createPinnedBrowserRunDirectory(
    root,
    actions,
  );
  const capability = await createBrowserOutputCapability(pin, outputNames);
  return { pin, capability };
}

function write(capability, name, buffer) {
  const index = capability.entries.findIndex((entry) => entry.name === name);
  return writeBrowserOutputFd(
    { [name]: capability.stdio[index + 3] },
    name,
    buffer,
  );
}

async function cleanupRun(run) {
  await cleanupBrowserOutputCapability(run.capability);
  await removePinnedBrowserRunDirectory(run.pin);
  await closePinnedBrowserOutputDirectory(run.pin);
}
