import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runHistoryBrowserSession } from "./parity-history-browser-session.mjs";

const root = await mkdtemp(join(tmpdir(), "f570-cdp-runtime-"));
const trustedPath = join(root, "trusted");
await mkdir(trustedPath);
const trustedRoot = await realpath(trustedPath);
const server = spawn(
  process.execPath,
  [new URL("./parity-history-cdp-http.fixture.mjs", import.meta.url).pathname],
  { stdio: ["ignore", "pipe", "inherit"] },
);

try {
  const port = await readPort(server);
  const querySecrets = ["OAUTH-SENTINEL", "AWS-SENTINEL", "GENERIC-SENTINEL"];
  const result = await runHistoryBrowserSession({
    actions: [
      `navigate:http://127.0.0.1:${port}/?code=${querySecrets[0]}&X-Amz-Signature=${querySecrets[1]}&key=${querySecrets[2]}&safe=yes`,
      "waitText:F570 session identity",
      "shot:proof.png",
      "text:proof.txt",
    ],
    secrets: { unused: "runtime-smoke-secret" },
    trustedRoot,
    driver: new URL("./parity-history-cdp-driver.mjs", import.meta.url)
      .pathname,
    width: 960,
    height: 720,
    timeout: 120000,
    logPath: join(root, "driver.log"),
  });
  assert.match(
    result.contents["proof.txt"].toString("utf8"),
    /F570 session identity/,
  );
  const identity = result.cdpEvidence.session;
  const persistedEvidence = JSON.stringify(result.cdpEvidence);
  for (const sentinel of querySecrets) {
    assert.doesNotMatch(persistedEvidence, new RegExp(sentinel));
  }
  assert.match(persistedEvidence, /%5BREDACTED%5D/);
  assert.match(persistedEvidence, /safe=yes/);
  assert.ok(identity.chromePid > 1);
  assert.ok(identity.port >= 1024 && identity.port <= 65535);
  assert.notEqual(identity.port, 9333);
  assert.notEqual(identity.browserTargetId, identity.pageTargetId);
  process.stdout.write(`${JSON.stringify({ status: "passed", identity })}\n`);
} finally {
  await stopServer(server);
  await rm(root, { recursive: true });
}

function readPort(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(
      () => reject(new Error("fixture server timeout")),
      5000,
    );
    child.once("error", reject);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const line = output.split("\n")[0];
      if (!/^\d+$/.test(line)) return;
      clearTimeout(timeout);
      resolve(Number(line));
    });
  });
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill("SIGTERM");
  });
}
