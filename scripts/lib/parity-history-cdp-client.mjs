import { readCdpActiveEndpoint } from "./parity-history-cdp-endpoint.mjs";
import { cdpSessionIdentity } from "./parity-history-cdp-session-identity.mjs";
import {
  openCdpSocket,
  requestCdpJson,
} from "./parity-history-cdp-transport.mjs";

export async function connectCdp(options, runtime = {}) {
  const getJson = runtime.getJson || requestCdpJson;
  const openSocket = runtime.openSocket || openCdpSocket;
  const endpoint = await waitForEndpoint(options, runtime);
  const origin = `http://127.0.0.1:${endpoint.port}`;
  const versionDocument = await getJson(`${origin}/json/version`);
  requireWebSocket(
    versionDocument.webSocketDebuggerUrl,
    endpoint.port,
    endpoint.browserPath,
    "browser-endpoint",
  );
  const browser = await openSocket(versionDocument.webSocketDebuggerUrl);
  const [version, processResult, commandLine] = await Promise.all([
    browser.call("Browser.getVersion"),
    browser.call("SystemInfo.getProcessInfo"),
    browser.call("Browser.getBrowserCommandLine"),
  ]);
  requireChromeIdentity(options, processResult, commandLine);
  const created = await browser.call("Target.createTarget", {
    url: "about:blank",
  });
  requireValue(validId(created?.targetId), "created-target");
  const info = await browser.call("Target.getTargetInfo", {
    targetId: created.targetId,
  });
  requireValue(
    info?.targetInfo?.targetId === created.targetId &&
      info.targetInfo.type === "page" &&
      info.targetInfo.url === "about:blank",
    "target-info",
  );
  const targets = await getJson(`${origin}/json/list`);
  const page = targets.find(
    (target) => target.id === created.targetId && target.type === "page",
  );
  requireValue(page, "target-list");
  requireWebSocket(
    page.webSocketDebuggerUrl,
    endpoint.port,
    `/devtools/page/${created.targetId}`,
    "page-endpoint",
  );
  const client = await openSocket(page.webSocketDebuggerUrl);
  assertChromeRunning(options.chrome);
  return Object.freeze({
    client,
    identity: cdpSessionIdentity({
      chromePid: options.chrome.pid,
      port: endpoint.port,
      profile: { ...options.profile.identity },
      browserTargetId: endpoint.browserPath.split("/").at(-1),
      pageTargetId: created.targetId,
      product: version.product,
      protocolVersion: version.protocolVersion,
    }),
  });
}

async function waitForEndpoint(options, runtime) {
  const readEndpoint = runtime.readEndpoint || readCdpActiveEndpoint;
  const pause =
    runtime.sleep ||
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < 120; attempt += 1) {
    assertChromeRunning(options.chrome);
    try {
      return readEndpoint(options.profile, options.startedAtMs);
    } catch (error) {
      if (!notReady(error)) throw error;
    }
    await pause(250);
  }
  throw new Error("E2E_CDP_SESSION_INVALID:endpoint-timeout");
}

function requireChromeIdentity(options, result, commandLine) {
  assertChromeRunning(options.chrome);
  const browser = result?.processInfo?.find((item) => item.type === "browser");
  requireValue(browser?.id === options.chrome.pid, "process-pid");
  requireValue(Array.isArray(commandLine?.arguments), "command-line");
  requireValue(
    commandLine.arguments.includes("--remote-debugging-port=0"),
    "dynamic-port-argument",
  );
  requireValue(
    commandLine.arguments.includes(`--user-data-dir=${options.profile.path}`),
    "profile-argument",
  );
}

function requireWebSocket(value, port, path, reason) {
  let url;
  try {
    url = new URL(value);
  } catch {
    requireValue(false, reason);
  }
  requireValue(url.protocol === "ws:", reason);
  requireValue(
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname),
    reason,
  );
  requireValue(Number(url.port) === port && url.pathname === path, reason);
  requireValue(
    !url.username && !url.password && !url.search && !url.hash,
    reason,
  );
}

function assertChromeRunning(chrome) {
  requireValue(Number.isInteger(chrome?.pid) && chrome.pid > 1, "chrome-pid");
  requireValue(
    chrome.exitCode === null && chrome.signalCode === null,
    "chrome-exited",
  );
}

function notReady(error) {
  return error?.code === "ENOENT" || error?.code === "EBUSY";
}

function validId(value) {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,128}$/.test(value);
}

function requireValue(value, reason) {
  if (!value) throw new Error(`E2E_CDP_SESSION_INVALID:${reason}`);
}
