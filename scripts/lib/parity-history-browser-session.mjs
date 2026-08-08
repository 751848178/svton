import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { readBackBrowserArtifacts } from "./parity-history-browser-artifacts.mjs";
import {
  cleanupBrowserOutputCapability,
  createBrowserOutputCapability,
  readBrowserOutputCapability,
} from "./parity-history-browser-output-capability.mjs";
import {
  createPinnedBrowserRunDirectory,
  removePinnedBrowserRunDirectory,
} from "./parity-history-browser-run-directory.mjs";
import {
  assertPinnedBrowserOutputDirectory,
  closePinnedBrowserOutputDirectory,
} from "./parity-history-safe-directory.mjs";
import { assertEvidenceReceiptMatches } from "./parity-history-driver-evidence-receipt.mjs";
import { parseDriverStdout } from "./parity-history-driver-stdout-parser.mjs";
import { summarizeBrowserFailures } from "./parity-history-cdp-capture.mjs";

export async function runHistoryBrowserSession(options) {
  const { pin, outputNames } = await createPinnedBrowserRunDirectory(
    options.trustedRoot,
    options.actions,
  );
  let capability;
  try {
    capability = await createBrowserOutputCapability(pin, outputNames);
    return await captureSession(options, pin, outputNames, capability);
  } finally {
    await cleanupSession(pin, capability);
  }
}

async function captureSession(options, pin, outputNames, capability) {
  const spawn = options.runtime?.spawnSync || spawnSync;
  const writeLog = options.runtime?.writeFile || writeFile;
  await assertPinnedBrowserOutputDirectory(pin);
  const proc = spawn(
    process.execPath,
    [
      options.driver,
      "--output-plan",
      capability.encodedPlan,
      "--width",
      String(options.width),
      "--height",
      String(options.height),
      ...options.actions,
    ],
    {
      encoding: "utf8",
      timeout: options.timeout,
      stdio: capability.stdio,
    },
  );
  await assertPinnedBrowserOutputDirectory(pin);
  const stdout = proc.stdout || "";
  const stderr = proc.stderr || "";
  await writeLog(options.logPath, `${stdout}\n--- STDERR ---\n${stderr}`);
  if (proc.status !== 0) {
    throw new Error(
      `browser pass failed (${proc.status}): ${stderr.slice(0, 2000)}`,
    );
  }
  const parsed = parseDriverStdout(stdout, {
    artifactNames: outputNames,
    runNonce: capability.runNonce,
  });
  const { artifacts, contents } = await readBackBrowserArtifacts(
    parsed.artifacts,
    pin,
    {
      readSnapshot: (name) => readBrowserOutputCapability(capability, name),
    },
  );
  const cdpSnapshot = await readBrowserOutputCapability(
    capability,
    "cdp-evidence.json",
  );
  assertEvidenceReceiptMatches(parsed.evidenceReceipt, cdpSnapshot.buffer);
  const cdpEvidence = JSON.parse(cdpSnapshot.buffer.toString("utf8"));
  return Object.freeze({
    artifacts,
    contents,
    cdpEvidence,
    browserFailures: summarizeBrowserFailures(cdpEvidence),
    outputNames,
    driverExit: proc.status,
  });
}

async function cleanupSession(pin, capability) {
  let failure;
  try {
    if (capability) await cleanupBrowserOutputCapability(capability);
  } catch (error) {
    failure = error;
  }
  if (!failure) {
    try {
      await removePinnedBrowserRunDirectory(pin);
    } catch (error) {
      failure = error;
    }
  }
  try {
    await closePinnedBrowserOutputDirectory(pin);
  } catch (error) {
    failure ||= error;
  }
  if (failure) throw failure;
}
