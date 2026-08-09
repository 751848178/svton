#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createIsolatedC5Context,
  loadC5BuiltImageIds,
  loadDestroyableC5Manifest,
  markC5ManifestDestroyed,
  markC5ManifestFailed,
  readC5BuiltImageIds,
  writePreparedC5Manifest,
  writeRunningC5Manifest,
} from "./lib/parity-isolated-c5-context.mjs";
import { runHistoryChain } from "./lib/parity-history-chain-launcher.mjs";
import { captureIsolatedC5RouteAudit } from "./lib/parity-isolated-c5-route-audit.mjs";
import { cleanupFailedIsolatedAcceptance } from "./lib/parity-isolated-c5-failure.mjs";
import { runOwnedBuilderLifecycle } from "./lib/parity-isolated-c5-builder-lifecycle.mjs";
import { buildC5WorkspaceClosures } from "./lib/parity-isolated-c5-workspace-builds.mjs";
import { cleanupPreparedC5Runtime } from "./lib/parity-isolated-c5-cleanup-runtime.mjs";
import {
  cleanupReceiptFor,
  publicRuntime,
} from "./lib/parity-isolated-c5-receipts.mjs";
import { parityRuntimeConfig } from "./lib/parity-runtime-config.mjs";

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
    const history = await runHistoryChain({
      args: [],
      env: environment,
      parentDirectory: context.runDirectory,
    });
    routeAudit = await captureIsolatedC5RouteAudit(
      root,
      context,
      history.finalProductionIdentity,
    );
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
    const runtime = parityRuntimeConfig(context.environment);
    await runOwnedBuilderLifecycle({
      context,
      runtime,
      action: async () => {
        buildC5WorkspaceClosures(run, context.environment);
        run(
          process.execPath,
          ["scripts/parity-seed.mjs", "reset"],
          context.environment,
        );
      },
    });
    return context;
  } catch (error) {
    await failAndCleanup(context, error);
    throw error;
  }
}

async function failAndCleanup(context, error, routeAudit) {
  let cleanupError;
  let cleanupReceipt;
  try {
    const runtime = parityRuntimeConfig(context.environment);
    const expectedImageIds = await loadC5BuiltImageIds(
      context.manifestPath,
      runtime,
    ).catch(() => undefined);
    const cleanup = await cleanupPreparedC5Runtime({
      runtime,
      environment: context.environment,
      expectedImageIds,
      destroyRuntime,
    });
    cleanupReceipt = cleanupReceiptFor(
      runtime,
      cleanup.residualResources,
      cleanup.builderReceipt,
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
  const runtime = parityRuntimeConfig(loaded.environment);
  const expectedImageIds = readC5BuiltImageIds(loaded.manifest, runtime);
  const cleanup = await cleanupPreparedC5Runtime({
    runtime,
    environment: loaded.environment,
    expectedImageIds,
    destroyRuntime,
  });
  await markC5ManifestDestroyed(
    loaded,
    cleanupReceiptFor(
      runtime,
      cleanup.residualResources,
      cleanup.builderReceipt,
    ),
  );
  process.stdout.write(
    `${JSON.stringify({ status: "destroyed", manifestPath: loaded.manifestPath })}\n`,
  );
}

function destroyRuntime(environment) {
  run(process.execPath, ["scripts/parity-seed.mjs", "destroy"], environment);
}

function run(commandName, args, env, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: root,
    env,
    stdio: "inherit",
    timeout: options.timeoutMs,
    killSignal: "SIGTERM",
  });
  if (result.status !== 0) {
    const failure = result.error?.code || result.signal || result.status;
    throw new Error(
      `${commandName} ${args.join(" ")} failed (${failure})`,
    );
  }
}
