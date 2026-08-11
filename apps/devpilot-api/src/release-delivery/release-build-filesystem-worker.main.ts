import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { ReleaseBuildFilesystemWorker } from "./release-build-filesystem-worker";
import { assertWorkerJobId } from "./release-build-worker-exchange";
import { readReleaseBuildWorkerSecret } from "./release-build-worker-secret";
import { exactOciImage, launcherControlsDigest, signLauncherProof,
  writeLauncherProof } from "./release-build-launcher-proof.policy";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { verifyReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";
import { assertReleaseBuildLauncherHostContract } from "./release-build-launcher-host-contract";
import { cleanupExternalOciLauncherContainers } from "./release-build-external-oci-runner";
import { assertLauncherLabel } from "./release-build-external-oci.policy";

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
    externalOci: {
      image: requiredImage("RELEASE_BUILD_LAUNCHER_JOB_IMAGE"),
      dockerExecutable: requiredPath("RELEASE_BUILD_LAUNCHER_DOCKER_EXECUTABLE"),
      launcherLabel: assertLauncherLabel(required("RELEASE_BUILD_LAUNCHER_INSTANCE_LABEL")),
    },
    proofFile: requiredPath("RELEASE_BUILD_LAUNCHER_PROOF_FILE"),
    supplyProofFile: requiredPath("RELEASE_BUILD_SUPPLY_PROOF_FILE"),
  };
  if (process.getuid?.() !== 0 || config.brokerUid === 0 || config.brokerGid === 0) {
    throw new Error("release-build supervisor requires root and a non-root broker uid/gid");
  }
  const toolExecutables = assertToolchain(config.supplyProofFile);
  const hostPaths = await assertReleaseBuildLauncherHostContract({
    inputRoot: config.inputRoot, outputRoot: config.outputRoot,
    workRoot: config.workRoot, proofFile: config.proofFile,
    secretFile: config.secretFile, supplyProofFile: config.supplyProofFile,
    dockerExecutable: config.externalOci.dockerExecutable,
    toolExecutables,
  });
  Object.assign(config, hostPaths, { externalOci: {
    ...config.externalOci, dockerExecutable: hostPaths.dockerExecutable,
  } });
  const secret = await readReleaseBuildWorkerSecret(config.secretFile);
  const instance = config.externalOci.launcherLabel;
  const startedAt = new Date().toISOString();
  const heartbeat = () => writeLauncherProof(config.proofFile, signLauncherProof({
    schemaVersion: 1, provider: "external-oci-launcher-v1",
    profileId: "controlled-local-acceptance-v2",
    jobImage: config.externalOci.image, controlsDigest: launcherControlsDigest,
    launcherInstanceId: instance, startedAt, heartbeatAt: new Date().toISOString(),
  }, secret));
  await cleanupExternalOciLauncherContainers({
    dockerExecutable: config.externalOci.dockerExecutable,
    launcherLabel: config.externalOci.launcherLabel,
  });
  await heartbeat();
  const heartbeatTimer = setInterval(() => void heartbeat().catch((error) => {
    process.stderr.write(`release-build launcher heartbeat: ${safe(error)}\n`);
  }), 5_000);
  heartbeatTimer.unref();
  const worker = new ReleaseBuildFilesystemWorker(config);
  let stopping = false;
  const shutdown = new AbortController();
  const stop = () => { stopping = true; shutdown.abort(); };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  while (!stopping) {
    for (const jobId of await jobs(config.inputRoot)) {
      try {
        await worker.runJob(jobId, shutdown.signal);
      } catch (error) {
        process.stderr.write(`release-build-worker ${jobId}: ${safe(error)}\n`);
      }
      if (stopping) break;
    }
    await delay(250);
  }
  clearInterval(heartbeatTimer);
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
function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
}
function positive(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
function requiredImage(key: string) {
  const value = process.env[key];
  if (!exactOciImage(value)) throw new Error(`${key} must be an immutable OCI digest`);
  return value;
}
function safe(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "unknown failure";
}
function delay(ms: number) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }

function assertToolchain(supplyProofFile: string) {
  const profile = resolveRegisteredReleaseBuildProfile("controlled-local-acceptance-v2");
  if (!profile || !verifyReleaseBuildSupplyProof(supplyProofFile, profile))
    throw new Error("release-build launcher supply proof is invalid");
  return [...profile.scanners.map((value) => value.executable),
    ...Object.values(profile.packageManagers).map((value) => value!.executable),
    "/bin/tar"];
}

void main();
