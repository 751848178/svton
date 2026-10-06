#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertLocalReleaseRuntimeRoot,
  createLocalReleaseRuntime,
  ensureLocalReleaseBuilder,
  localReleaseApiDigest,
  publicLocalReleaseRuntime,
} from "./lib/devpilot-local-release-runtime.mjs";
import * as localCleanup from "./lib/devpilot-local-release-cleanup.mjs";
import { writePreparedC5Manifest } from "./lib/parity-isolated-c5-manifest.mjs";
import { buildC5WorkspaceClosures } from "./lib/parity-isolated-c5-workspace-builds.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseCompose = resolve(root, "docker-compose.devpilot-parity.yml");
const workerCompose = resolve(
  root,
  "docker-compose.devpilot-parity-worker.yml",
);
const runtimeRoot = resolve(
  process.env.PARITY_WORKER_ROOT ||
    resolve(root, "storage/devpilot-parity-worker"),
);
const command = process.argv[2] || "run";
const localRuntime = createLocalReleaseRuntime(root, runtimeRoot);
const releaseCleanup = localCleanup.createLocalReleaseCleanup(
  root,
  runtimeRoot,
);
if (command === "run") await upWithCleanup(true);
else if (command === "up") await upWithCleanup(false);
else if (command === "verify") await verify();
else if (command === "status") status();
else if (command === "down") down();
else if (command === "destroy") await destroy(process.argv[3]);
else throw new Error(`unknown command: ${command}`);

async function upWithCleanup(runVerification) {
  try {
    await up(runVerification);
  } catch (error) {
    let cleanupError;
    try {
      await destroy(localRuntime.manifestPath, false);
    } catch (failure) {
      cleanupError = failure;
    }
    if (cleanupError) throw new AggregateError([error, cleanupError]);
    throw error;
  }
}

async function up(runVerification) {
  assertLocalReleaseRuntimeRoot(root, runtimeRoot);
  await releaseCleanup.destroyIfPresent(localRuntime.manifestPath);
  const environment = localRuntime.environment;
  run(
    "docker",
    baseArgs("down", "--volumes", "--remove-orphans"),
    environment,
    false,
  );
  run(
    "docker",
    [
      "compose",
      "-p",
      "devpilot-parity",
      "-f",
      baseCompose,
      "down",
      "--remove-orphans",
    ],
    process.env,
    false,
  );
  await prepareRuntime();
  buildC5WorkspaceClosures(
    (executable, args, env) => run(executable, args, env),
    environment,
  );
  ensureLocalReleaseBuilder(root, environment);
  run(process.execPath, ["scripts/parity-seed.mjs", "build"], environment);
  const worker = workerEnvironment({
    ...environment,
    PARITY_USE_PREBUILT_RUNTIME_IMAGES: "1",
  });
  run("docker", composeArgs("build", "build-launcher"), worker);
  run(process.execPath, ["scripts/parity-seed.mjs", "reset"], worker);
  if (runVerification) await verify(worker);
  process.stdout.write(
    `${JSON.stringify({ status: "running", ...publicRuntime() })}\n`,
  );
}

async function verify(environment = workerEnvironment()) {
  run(process.execPath, ["scripts/parity-positive-e2e.mjs"], environment);
  process.stdout.write(
    `${JSON.stringify({ status: "verified", ...publicRuntime() })}\n`,
  );
}

function status() {
  run("docker", composeArgs("ps"), workerEnvironment());
}

function down() {
  run(
    process.execPath,
    ["scripts/parity-seed.mjs", "down"],
    workerEnvironment(),
  );
}

async function destroy(manifestPath = localRuntime.manifestPath, print = true) {
  const receipt = await releaseCleanup.destroy(manifestPath);
  if (print) process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

async function prepareRuntime() {
  await mkdir(runtimeRoot, { recursive: true, mode: 0o700 });
  const directories = ["input", "output/artifacts", "work", "proof"];
  for (const path of directories) {
    const absolute = resolve(runtimeRoot, path);
    await rm(absolute, { recursive: true, force: true });
    await mkdir(absolute, { recursive: true, mode: 0o700 });
    await chmod(absolute, 0o700);
  }
  await mkdir(localRuntime.runDirectory, { recursive: false, mode: 0o700 });
  await writePreparedC5Manifest(localRuntime);
  const secret = resolve(runtimeRoot, "worker-hmac.secret");
  const proof = resolve(runtimeRoot, "proof/release-build-proof.json");
  await writeFile(secret, randomBytes(32).toString("hex"), { mode: 0o600 });
  await writeFile(proof, "{}", { mode: 0o600 });
  await chmod(secret, 0o600);
  await chmod(proof, 0o600);
}

function workerEnvironment(environment = localRuntime.environment) {
  return {
    ...environment,
    PARITY_COMPOSE_OVERLAY: workerCompose,
    PARITY_WORKER_INPUT_ROOT_HOST: resolve(runtimeRoot, "input"),
    PARITY_WORKER_OUTPUT_ROOT_HOST: resolve(runtimeRoot, "output"),
    PARITY_WORKER_WORK_ROOT_HOST: resolve(runtimeRoot, "work"),
    PARITY_WORKER_PROOF_ROOT_HOST: resolve(runtimeRoot, "proof"),
    PARITY_WORKER_HMAC_SECRET_FILE: resolve(runtimeRoot, "worker-hmac.secret"),
    RELEASE_BUILD_LAUNCHER_JOB_IMAGE: localReleaseApiDigest(root, environment),
  };
}

function composeArgs(...args) {
  return [
    "compose",
    "-p",
    localRuntime.composeProject,
    "-f",
    baseCompose,
    "-f",
    workerCompose,
    ...args,
  ];
}

function baseArgs(...args) {
  return [
    "compose",
    "-p",
    localRuntime.composeProject,
    "-f",
    baseCompose,
    ...args,
  ];
}

function run(executable, args, env = process.env, check = true) {
  const result = spawnSync(executable, args, {
    cwd: root,
    env,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: check ? ["ignore", "pipe", "pipe"] : "ignore",
  });
  if (check && result.status !== 0) {
    throw new Error(
      `${executable} ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }
  if (check && result.stdout) process.stdout.write(result.stdout);
  if (check && result.stderr) process.stderr.write(result.stderr);
  return result.stdout || "";
}

function publicRuntime() {
  return publicLocalReleaseRuntime(localRuntime);
}
