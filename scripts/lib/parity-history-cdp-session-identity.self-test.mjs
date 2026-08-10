import assert from "node:assert/strict";
import {
  cdpSessionIdentity,
  validateCdpSessionIdentity,
} from "./parity-history-cdp-session-identity.mjs";

const valid = cdpSessionIdentity({
  chromePid: 42,
  port: 49123,
  profile: { dev: "10", ino: "20" },
  browserTargetId: "browser-12345678",
  pageTargetId: "page-12345678",
  product: "Chrome/140.0.0.0",
  protocolVersion: "1.3",
});
assert.equal(validateCdpSessionIdentity(valid), valid);
reject((value) => (value.chromePid = 1));
reject((value) => (value.pageTargetId = value.browserTargetId));
reject((value) => (value.profile.ino = "not-an-inode"));
reject((value) => (value.extra = true));
console.log("parity history CDP session identity self-test passed");

function reject(mutate) {
  const value = structuredClone(valid);
  mutate(value);
  assert.throws(
    () => validateCdpSessionIdentity(value),
    /E2E_CDP_SESSION_INVALID/,
  );
}
