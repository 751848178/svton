import { cdpSessionIdentity } from "./parity-history-cdp-session-identity.mjs";

export function cdpSessionFixture(overrides = {}) {
  return cdpSessionIdentity({
    chromePid: 4242,
    port: 49123,
    profile: { dev: "10", ino: "20" },
    browserTargetId: "browser-12345678",
    pageTargetId: "page-12345678",
    product: "Chrome/140.0.0.0",
    protocolVersion: "1.3",
    ...overrides,
  });
}
