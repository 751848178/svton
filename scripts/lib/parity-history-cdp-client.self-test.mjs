import assert from "node:assert/strict";
import { connectCdp } from "./parity-history-cdp-client.mjs";
import { validateCdpSessionIdentity } from "./parity-history-cdp-session-identity.mjs";

const browserId = "11111111-2222-3333-4444-555555555555";
const pageId = "AAAAAAAA11111111BBBBBBBB22222222";
const profile = {
  path: "/tmp/svton-f456-profile-fixture",
  identity: { dev: "10", ino: "20" },
};
const chrome = { pid: 4242, exitCode: null, signalCode: null };
const calls = [];
const result = await connectCdp(
  { profile, chrome, startedAtMs: 1000 },
  runtime(calls),
);
assert.equal(result.client.kind, "page");
assert.equal(validateCdpSessionIdentity(result.identity), result.identity);
assert.deepEqual(result.identity, {
  schema: "devpilot.parity-history.cdp-session",
  version: 1,
  chromePid: 4242,
  port: 49123,
  profile: { dev: "10", ino: "20" },
  browserTargetId: browserId,
  pageTargetId: pageId,
  product: "Chrome/140.0.0.0",
  protocolVersion: "1.3",
});
assert.deepEqual(calls.slice(-2), [
  "Target.createTarget",
  "Target.getTargetInfo",
]);

await assert.rejects(
  connectCdp(
    { profile, chrome, startedAtMs: 1000 },
    runtime([], { processPid: 4343 }),
  ),
  /process-pid/,
);
await assert.rejects(
  connectCdp(
    { profile, chrome, startedAtMs: 1000 },
    runtime([], { listedTargetId: "OTHER-TARGET-1234" }),
  ),
  /target-list/,
);
await assert.rejects(
  connectCdp(
    { profile, chrome, startedAtMs: 1000 },
    runtime([], { browserPath: `/devtools/browser/${"9".repeat(36)}` }),
  ),
  /browser-endpoint/,
);

console.log("parity history CDP client self-test passed");

function runtime(calls, overrides = {}) {
  const browserPath = `/devtools/browser/${browserId}`;
  const activePath = overrides.browserPath || browserPath;
  return {
    readEndpoint: () => ({ port: 49123, browserPath: activePath }),
    getJson: async (url) => {
      if (url.endsWith("/json/version")) {
        return { webSocketDebuggerUrl: `ws://127.0.0.1:49123${browserPath}` };
      }
      return [
        {
          id: overrides.listedTargetId || pageId,
          type: "page",
          webSocketDebuggerUrl: `ws://localhost:49123/devtools/page/${pageId}`,
        },
      ];
    },
    openSocket: async (url) =>
      url.includes("/devtools/browser/")
        ? browserClient(calls, overrides)
        : { kind: "page" },
  };
}

function browserClient(calls, overrides) {
  return {
    async call(method) {
      calls.push(method);
      if (method === "Browser.getVersion") {
        return { product: "Chrome/140.0.0.0", protocolVersion: "1.3" };
      }
      if (method === "SystemInfo.getProcessInfo") {
        return {
          processInfo: [{ type: "browser", id: overrides.processPid || 4242 }],
        };
      }
      if (method === "Browser.getBrowserCommandLine") {
        return {
          arguments: [
            "--remote-debugging-port=0",
            `--user-data-dir=${profile.path}`,
          ],
        };
      }
      if (method === "Target.createTarget") return { targetId: pageId };
      if (method === "Target.getTargetInfo") {
        return {
          targetInfo: { targetId: pageId, type: "page", url: "about:blank" },
        };
      }
      assert.fail(`unexpected CDP call ${method}`);
    },
  };
}
