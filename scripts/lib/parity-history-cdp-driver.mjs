#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { describeCdpActions } from "./parity-history-cdp-action-evidence.mjs";
import { runCdpActions } from "./parity-history-cdp-actions.mjs";
import { writeExclusiveBrowserOutput } from "./parity-history-browser-output-writer.mjs";
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
  const profile = createProfile(options.out);
  const chrome = startChrome(profile);
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
    await writeEvidence(options.out, evidence);
  } finally {
    chrome.kill("SIGTERM");
  }
}

function parseArgs(args) {
  const options = {
    out: null,
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
  if (!options.out) throw new Error("E2E_CDP_DRIVER_OUT_REQUIRED");
  return { options, rawActions };
}

function createProfile(outDir) {
  const profile = path.join(outDir, "profile");
  mkdirSync(profile, { recursive: false, mode: 0o700 });
  const stats = lstatSync(profile, { bigint: true });
  if (
    !stats.isDirectory() ||
    stats.isSymbolicLink() ||
    stats.uid !== BigInt(process.geteuid()) ||
    (stats.mode & 0o777n) !== 0o700n
  ) {
    throw new Error("E2E_CDP_PROFILE_INVALID");
  }
  return profile;
}

function startChrome(profile) {
  return spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
}

async function writeEvidence(outDir, evidence) {
  const buffer = Buffer.from(JSON.stringify(evidence, null, 2));
  const { file } = await writeExclusiveBrowserOutput(
    outDir,
    "cdp-evidence.json",
    buffer,
  );
  process.stdout.write(
    `${JSON.stringify({ evidence: file, sha256: sha256(buffer) })}\n`,
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
