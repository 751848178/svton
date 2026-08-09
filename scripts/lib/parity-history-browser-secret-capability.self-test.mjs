import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  browserSecretReference,
  cleanupBrowserSecretCapability,
  createBrowserSecretCapability,
  readBrowserSecretsFd,
  resolveBrowserSecret,
} from "./parity-history-browser-secret-capability.mjs";
import {
  createPinnedBrowserRunDirectory,
  removePinnedBrowserRunDirectory,
} from "./parity-history-browser-run-directory.mjs";
import { closePinnedBrowserOutputDirectory } from "./parity-history-safe-directory.mjs";

const root = await mkdtemp(join(tmpdir(), "history-browser-secret-"));
const trusted = join(root, "trusted");
await mkdir(trusted);
const canonicalTrusted = await realpath(trusted);
const { pin } = await createPinnedBrowserRunDirectory(canonicalTrusted, [
  "text:proof.txt",
]);
const sentinel = "ARGV-SECRET-SENTINEL";
const capability = await createBrowserSecretCapability(pin, {
  password: sentinel,
});
const secrets = readBrowserSecretsFd(capability.handle.fd);
assert.equal(secrets.password, sentinel);
const reference = browserSecretReference("password");
assert.equal(resolveBrowserSecret(reference, secrets), sentinel);
assert.equal(resolveBrowserSecret("ordinary", secrets), "ordinary");
assert.throws(() => resolveBrowserSecret("$browser-secret:missing", secrets));
await cleanupBrowserSecretCapability(capability);
await removePinnedBrowserRunDirectory(pin);
await closePinnedBrowserOutputDirectory(pin);
await rm(root, { recursive: true });
console.log("parity history browser secret capability self-test passed");
