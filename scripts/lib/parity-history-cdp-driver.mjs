#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { describeCdpActions } from "./parity-history-cdp-action-evidence.mjs";
import { runCdpActions } from "./parity-history-cdp-actions.mjs";
import { writeBrowserOutputFd } from "./parity-history-browser-output-fd.mjs";
import { decodeBrowserOutputPlan } from "./parity-history-browser-output-plan.mjs";
import {
  cleanupBrowserProfile,
  createBrowserProfile,
} from "./parity-history-browser-profile.mjs";
import {
  createCdpCapture,
  validateCdpEvidence,
} from "./parity-history-cdp-capture.mjs";
import { connectCdp } from "./parity-history-cdp-client.mjs";
import { readBrowserSecretsFd } from "./parity-history-browser-secret-capability.mjs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

main().catch((error) => {
  process.stderr.write(`CDP_DRIVER_ERROR ${safeErrorMessage(error)}\n`);
  process.exit(1);
});

async function main() {
  const { options, rawActions } = parseArgs(process.argv.slice(2));
  options.secrets = readBrowserSecretsFd(options.secretFd);
  const actionDescriptors = describeCdpActions(rawActions);
  const profile = createBrowserProfile();
  let chrome;
  try {
    const startedAtMs = Date.now();
    chrome = startChrome(profile.path);
    const session = await connectCdp({ profile, chrome, startedAtMs });
    const cdp = session.client;
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
      session: session.identity,
      viewport: { width: options.width, height: options.height },
      ...capture.snapshot(actionDescriptors),
    });
    await writeEvidence(options, evidence);
  } finally {
    await cleanupDriver(chrome, profile);
  }
}

async function cleanupDriver(chrome, profile) {
  let failure;
  try {
    if (chrome) await stopChrome(chrome);
  } catch (error) {
    failure = error;
  }
  try {
    cleanupBrowserProfile(profile);
  } catch (error) {
    failure ||= error;
  }
  if (failure) throw failure;
}

async function stopChrome(chrome) {
  if (chrome.exitCode !== null || chrome.signalCode !== null) return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("E2E_CDP_CHROME_STOP_TIMEOUT")),
      5000,
    );
    chrome.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    chrome.kill("SIGTERM");
  });
}

function parseArgs(args) {
  const options = {
    outputPlan: null,
    secretFd: null,
    width: 1484,
    height: 1324,
  };
  const rawActions = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--output-plan") options.outputPlan = args[++index];
    else if (value === "--secret-fd") options.secretFd = Number(args[++index]);
    else if (value === "--width") options.width = Number(args[++index]);
    else if (value === "--height") options.height = Number(args[++index]);
    else rawActions.push(value);
  }
  const plan = decodeBrowserOutputPlan(options.outputPlan);
  options.outputs = plan.outputs;
  options.runNonce = plan.runNonce;
  return { options, rawActions };
}

function startChrome(profile) {
  return spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--enable-automation",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
}

async function writeEvidence(options, evidence) {
  const buffer = Buffer.from(JSON.stringify(evidence, null, 2));
  writeBrowserOutputFd(options.outputs, "cdp-evidence.json", buffer);
  process.stdout.write(
    `${JSON.stringify({ evidence: "cdp-evidence.json", sha256: sha256(buffer), runNonce: options.runNonce })}\n`,
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
