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
import { captureIsolatedC5RouteAudit } from "./lib/parity-isolated-c5-route-audit.mjs";
import { cleanupFailedIsolatedAcceptance } from "./lib/parity-isolated-c5-failure.mjs";
import { parityRuntimeConfig } from "./lib/parity-runtime-config.mjs";
import { assertNoRuntimeResources } from "./lib/parity-runtime-resource-ownership.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = join(
  await realpath("/tmp"),
  "codex-tool-runs/svton/long-goals/devpilot-v13-opencode-acceptance/final-runtime-acceptance/runs",
);
const command = process.argv[2] || "run";

if (command === "run") await runIsolatedAcceptance();
else if (command === "prepare") await prepareBrowserRuntime();
else if (command === "destroy") await destroyFromManifest(process.argv[3]);
else throw new Error(`unknown isolated C5 command: ${command}`);

async function runIsolatedAcceptance() {
  const context = await createPreparedRuntime();
  const { environment, manifestPath } = context;
  let routeAudit;
  try {
    const history = await runHistoryChain({ args: [], env: environment });
    routeAudit = await captureIsolatedC5RouteAudit(root, context);
    if (routeAudit.receipt.status !== "verified") {
      throw new Error("isolated C5 route-control audit was not verified");
    }
    await writeRunningC5Manifest(context, history, routeAudit);
    process.stdout.write(
      `${JSON.stringify({ status: "passed", manifestPath, history, routeAudit })}\n`,
    );
  } catch (error) {
    await cleanupFailedIsolatedAcceptance({
      captureRouteAudit: captureIsolatedC5RouteAudit,
      cleanup: failAndCleanup,
      root,
      context,
      error,
      routeAudit,
    });
    throw error;
  }
}

async function prepareBrowserRuntime() {
  const context = await createPreparedRuntime();
  try {
    const prepared = {
      status: "prepared_browser_acceptance",
      preparedAt: new Date().toISOString(),
    };
    await writeRunningC5Manifest(context, prepared, null);
    const runtime = parityRuntimeConfig(context.environment);
    process.stdout.write(
      `${JSON.stringify({ status: "prepared", manifestPath: context.manifestPath, runtime: publicRuntime(runtime) })}\n`,
    );
  } catch (error) {
    await failAndCleanup(context, error);
    throw error;
  }
}

async function createPreparedRuntime() {
  const context = await createIsolatedC5Context(root, runtimeRoot, process.env);
  await writePreparedC5Manifest(context);
  try {
    build("@svton/devpilot-api", context.environment);
    build("@svton/devpilot-web", context.environment);
    run(
      process.execPath,
      ["scripts/parity-seed.mjs", "reset"],
      context.environment,
    );
    return context;
  } catch (error) {
    await failAndCleanup(context, error);
    throw error;
  }
}

function build(project, environment) {
  run("corepack", ["pnpm", "--filter", project, "build"], environment);
}

async function failAndCleanup(context, error, routeAudit) {
  let cleanupError;
  let cleanupReceipt;
  try {
    destroyRuntime(context.environment);
    await rm(context.environment.PARITY_FIXTURE_GIT_ROOT, {
      recursive: true,
      force: true,
    });
    const runtime = parityRuntimeConfig(context.environment);
    cleanupReceipt = cleanupReceiptFor(
      runtime,
      assertNoRuntimeResources(runtime),
    );
  } catch (failure) {
    cleanupError = failure;
    cleanupReceipt = {
      status: "cleanup_failed",
      verifiedAt: new Date().toISOString(),
      error: failure instanceof Error ? failure.message : String(failure),
    };
  }
  await markC5ManifestFailed(context, error, cleanupReceipt, routeAudit);
  if (cleanupError) throw new AggregateError([error, cleanupError]);
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

function publicRuntime(runtime) {
  return {
    composeProject: runtime.composeProject,
    databaseName: runtime.databaseName,
    ports: runtime.ports,
    apiImage: runtime.apiImage,
    webImage: runtime.webImage,
    routeControlImage: runtime.routeControlImage,
    apiBase: runtime.apiBase,
    webOrigin: runtime.webOrigin,
    targetOrigin: runtime.targetOrigin,
    routeControlOrigin: runtime.routeControlOrigin,
    sourceRevision: runtime.sourceRevision,
    sourceTreeSha256: runtime.sourceTreeSha256,
    runtimeId: runtime.runtimeId,
    goalId: runtime.goalId,
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
