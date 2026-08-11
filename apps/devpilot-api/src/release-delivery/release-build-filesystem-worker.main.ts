import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { ReleaseBuildFilesystemWorker } from "./release-build-filesystem-worker";
import { assertWorkerJobId } from "./release-build-worker-exchange";
import { readReleaseBuildWorkerSecret } from "./release-build-worker-secret";

async function main() {
  const config = {
    inputRoot: requiredPath("RELEASE_BUILD_WORKER_INPUT_ROOT"),
    outputRoot: requiredPath("RELEASE_BUILD_WORKER_OUTPUT_ROOT"),
    workRoot: requiredPath("RELEASE_BUILD_WORK_ROOT"),
    secretFile: requiredPath("RELEASE_BUILD_WORKER_HMAC_SECRET_FILE"),
    commandPath: process.env.RELEASE_BUILD_COMMAND_PATH ||
      "/pnpm:/usr/local/bin:/usr/bin:/bin",
    tarExecutable: process.env.RELEASE_BUILD_WORKER_TAR_EXECUTABLE || "/bin/tar",
    commandTimeoutMs: positive("RELEASE_BUILD_COMMAND_TIMEOUT_MS", 120_000),
    cancelGraceMs: positive("RELEASE_BUILD_CANCEL_GRACE_MS", 5_000),
    brokerUid: positive("RELEASE_BUILD_BROKER_UID", 3_000),
    brokerGid: positive("RELEASE_BUILD_BROKER_GID", 3_000),
  };
  if (process.getuid?.() !== 0 || config.brokerUid === 0 || config.brokerGid === 0) {
    throw new Error("release-build supervisor requires root and a non-root broker uid/gid");
  }
  await readReleaseBuildWorkerSecret(config.secretFile);
  const worker = new ReleaseBuildFilesystemWorker(config);
  let stopping = false;
  process.once("SIGTERM", () => { stopping = true; });
  process.once("SIGINT", () => { stopping = true; });
  while (!stopping) {
    for (const jobId of await jobs(config.inputRoot)) {
      try {
        await worker.runJob(jobId);
      } catch (error) {
        process.stderr.write(`release-build-worker ${jobId}: ${safe(error)}\n`);
      }
      if (stopping) break;
    }
    await delay(250);
  }
}

async function jobs(root: string) {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).flatMap((entry) => {
      try { return [assertWorkerJobId(entry.name)]; } catch { return []; }
    }).sort();
  } catch { return []; }
}

function requiredPath(key: string) {
  const value = process.env[key];
  if (!value || !value.startsWith("/")) throw new Error(`${key} must be absolute`);
  return resolve(value);
}
function positive(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
function safe(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "unknown failure";
}
function delay(ms: number) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }

void main();
