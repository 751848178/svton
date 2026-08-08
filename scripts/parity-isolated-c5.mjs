#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createIsolatedC5Context,
  loadRunningC5Manifest,
  markC5ManifestDestroyed,
  writeRunningC5Manifest,
} from "./lib/parity-isolated-c5-context.mjs";
import { runHistoryChain } from "./lib/parity-history-chain-launcher.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = join(
  await realpath(tmpdir()),
  "codex-tool-runs/svton/c5-runtime",
);
const command = process.argv[2] || "run";

if (command === "run") await runIsolatedAcceptance();
else if (command === "destroy") await destroyFromManifest(process.argv[3]);
else throw new Error(`unknown isolated C5 command: ${command}`);

async function runIsolatedAcceptance() {
  const context = await createIsolatedC5Context(root, runtimeRoot, process.env);
  const { environment, manifestPath, runDirectory } = context;
  let started = false;
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
    if (started) {
      try {
        destroyRuntime(environment);
      } catch (failure) {
        cleanupError = failure;
      }
    }
    await rm(runDirectory, { recursive: true, force: true });
    if (cleanupError) throw new AggregateError([error, cleanupError]);
    throw error;
  }
}

async function destroyFromManifest(manifestPath) {
  const loaded = await loadRunningC5Manifest(
    manifestPath,
    runtimeRoot,
    process.env,
  );
  destroyRuntime(loaded.environment);
  await rm(loaded.environment.PARITY_FIXTURE_GIT_ROOT, {
    recursive: true,
    force: true,
  });
  await markC5ManifestDestroyed(loaded);
  process.stdout.write(
    `${JSON.stringify({ status: "destroyed", manifestPath: loaded.manifestPath })}\n`,
  );
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
