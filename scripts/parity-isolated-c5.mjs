#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { realpath, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createIsolatedC5Context,
  loadDestroyableC5Manifest,
  markC5ManifestDestroyed,
  markC5ManifestFailed,
  writePreparedC5Manifest,
  writeRunningC5Manifest,
} from "./lib/parity-isolated-c5-context.mjs";
import { runHistoryChain } from "./lib/parity-history-chain-launcher.mjs";
import { parityRuntimeConfig } from "./lib/parity-runtime-config.mjs";
import { assertNoRuntimeResources } from "./lib/parity-runtime-resource-ownership.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = join(
  await realpath("/tmp"),
  "codex-tool-runs/svton/long-goals/devpilot-v13-opencode-acceptance/final-runtime-acceptance/runs",
);
const command = process.argv[2] || "run";

if (command === "run") await runIsolatedAcceptance();
else if (command === "destroy") await destroyFromManifest(process.argv[3]);
else throw new Error(`unknown isolated C5 command: ${command}`);

async function runIsolatedAcceptance() {
  const context = await createIsolatedC5Context(root, runtimeRoot, process.env);
  const { environment, manifestPath } = context;
  let started = false;
  await writePreparedC5Manifest(context);
  try {
    run(
      "corepack",
      ["pnpm", "--filter", "@svton/devpilot-api", "build"],
      environment,
    );
    run(
      "corepack",
      ["pnpm", "--filter", "@svton/devpilot-web", "build"],
      environment,
    );
    started = true;
    run(process.execPath, ["scripts/parity-seed.mjs", "reset"], environment);
    const history = await runHistoryChain({ args: [], env: environment });
    await writeRunningC5Manifest(context, history);
    process.stdout.write(
      `${JSON.stringify({ status: "passed", manifestPath, history })}\n`,
    );
  } catch (error) {
    let cleanupError;
    let cleanupReceipt;
    try {
      if (started) destroyRuntime(environment);
      await rm(environment.PARITY_FIXTURE_GIT_ROOT, {
        recursive: true,
        force: true,
      });
      const runtime = parityRuntimeConfig(environment);
      const residualResources = assertNoRuntimeResources(runtime);
      cleanupReceipt = cleanupReceiptFor(runtime, residualResources);
    } catch (failure) {
      cleanupError = failure;
      cleanupReceipt = {
        status: "cleanup_failed",
        verifiedAt: new Date().toISOString(),
        error: failure instanceof Error ? failure.message : String(failure),
      };
    }
    await markC5ManifestFailed(context, error, cleanupReceipt);
    if (cleanupError) throw new AggregateError([error, cleanupError]);
    throw error;
  }
}

async function destroyFromManifest(manifestPath) {
  const loaded = await loadDestroyableC5Manifest(
    manifestPath,
    runtimeRoot,
    process.env,
  );
  destroyRuntime(loaded.environment);
  await rm(loaded.environment.PARITY_FIXTURE_GIT_ROOT, {
    recursive: true,
    force: true,
  });
  const runtime = parityRuntimeConfig(loaded.environment);
  const residualResources = assertNoRuntimeResources(runtime);
  await markC5ManifestDestroyed(
    loaded,
    cleanupReceiptFor(runtime, residualResources),
  );
  process.stdout.write(
    `${JSON.stringify({ status: "destroyed", manifestPath: loaded.manifestPath })}\n`,
  );
}

function cleanupReceiptFor(runtime, residualResources) {
  return {
    status: "verified_zero_residuals",
    verifiedAt: new Date().toISOString(),
    runtimeId: runtime.runtimeId,
    goalId: runtime.goalId,
    cleanupOwnerToken: runtime.cleanupOwnerToken,
    residualResources,
  };
}

function destroyRuntime(environment) {
  run(process.execPath, ["scripts/parity-seed.mjs", "destroy"], environment);
}

function run(commandName, args, env) {
  const result = spawnSync(commandName, args, {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(
      `${commandName} ${args.join(" ")} failed (${result.status})`,
    );
  }
}
