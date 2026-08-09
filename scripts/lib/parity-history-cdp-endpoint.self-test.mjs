import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import {
  cleanupBrowserProfile,
  createBrowserProfile,
} from "./parity-history-browser-profile.mjs";
import { readCdpActiveEndpoint } from "./parity-history-cdp-endpoint.mjs";

const profile = createBrowserProfile();
const path = join(profile.path, "DevToolsActivePort");
const browserId = "11111111-2222-3333-4444-555555555555";
writeFileSync(path, `49123\n/devtools/browser/${browserId}\n`, { mode: 0o600 });
const endpoint = readCdpActiveEndpoint(profile, Date.now() - 1000);
assert.deepEqual(endpoint, {
  port: 49123,
  browserPath: `/devtools/browser/${browserId}`,
});

assert.throws(
  () =>
    readCdpActiveEndpoint(
      { ...profile, identity: { ...profile.identity, ino: "0" } },
      Date.now() - 1000,
    ),
  /profile-identity/,
);
writeFileSync(path, "9333\n/devtools/page/not-browser\n");
assert.throws(
  () => readCdpActiveEndpoint(profile, Date.now() - 1000),
  /invalid-browser-path/,
);
await rm(path);
cleanupBrowserProfile(profile);
console.log("parity history CDP endpoint self-test passed");
