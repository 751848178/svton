#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { describeCdpActions } from "./parity-history-cdp-action-evidence.mjs";
import { runCdpActions } from "./parity-history-cdp-actions.mjs";
import {
  createCdpCapture,
  validateCdpEvidence,
} from "./parity-history-cdp-capture.mjs";
import { connectCdp } from "./parity-history-cdp-client.mjs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;

main().catch((error) => {
  process.stderr.write(`CDP_DRIVER_ERROR ${safeErrorMessage(error)}\n`);
  process.exit(1);
});

async function main() {
  const { options, rawActions } = parseArgs(process.argv.slice(2));
  const actionDescriptors = describeCdpActions(rawActions);
  mkdirSync(options.out, { recursive: true });
  const chrome = startChrome(options.out);
  try {
    const cdp = await connectCdp(PORT);
    await Promise.all([
      cdp.call("Page.enable"),
      cdp.call("Runtime.enable"),
      cdp.call("Network.enable"),
      cdp.call("Log.enable"),
    ]);
    const capture = createCdpCapture();
    cdp.onEvent(capture.record);
    await runCdpActions(cdp, rawActions, options);
    const evidence = validateCdpEvidence({
      viewport: { width: options.width, height: options.height },
      ...capture.snapshot(actionDescriptors),
    });
    writeEvidence(options.out, evidence);
  } finally {
    chrome.kill("SIGTERM");
  }
}

function parseArgs(args) {
  const options = {
    out: "/tmp/codex-tool-runs/svton/f456/browser",
    width: 1484,
    height: 1324,
  };
  const rawActions = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--out") options.out = args[++index];
    else if (value === "--width") options.width = Number(args[++index]);
    else if (value === "--height") options.height = Number(args[++index]);
    else rawActions.push(value);
  }
  return { options, rawActions };
}

function startChrome(outDir) {
  return spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${path.join(outDir, "profile")}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
}

function writeEvidence(outDir, evidence) {
  const file = path.join(outDir, "cdp-evidence.json");
  writeFileSync(file, JSON.stringify(evidence, null, 2));
  process.stdout.write(
    `${JSON.stringify({ evidence: file, sha256: sha256(readFileSync(file)) })}\n`,
  );
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeErrorMessage(error) {
  const message = typeof error?.message === "string" ? error.message : "";
  return /^E2E_CDP_[A-Z_]+(?::[A-Za-z0-9_-]+)*$/.test(message)
    ? message
    : "E2E_CDP_DRIVER_FAILED";
}
