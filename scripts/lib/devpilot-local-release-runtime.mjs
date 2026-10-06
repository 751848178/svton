import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { relative, resolve } from "node:path";
import { createOwnedBuildxBuilder } from "./parity-runtime-builder.mjs";
import { parityRuntimeConfig } from "./parity-runtime-config.mjs";

export function assertLocalReleaseRuntimeRoot(root, runtimeRoot) {
  const storage = resolve(root, "storage");
  const child = relative(storage, runtimeRoot);
  if (!child || child.startsWith("..") || child.startsWith("/")) {
    throw new Error("PARITY_WORKER_ROOT_INVALID");
  }
}

export function createLocalReleaseRuntime(
  root,
  runtimeRoot,
  baseEnv = process.env,
) {
  const revision = git(root, "rev-parse", "HEAD");
  const treeSha256 = worktreeSha256(root, revision);
  const goalId = baseEnv.PARITY_GOAL_ID || "devpilot-local-release-rehearsal";
  const nonce = createHash("sha256")
    .update(`devpilot-local-release-rehearsal-v2\0${goalId}\0${treeSha256}`)
    .digest("hex")
    .slice(0, 8);
  const runtimeId = `c5-${revision.slice(0, 8)}-${nonce}`;
  const suffix = runtimeId.slice(3);
  const runDirectory = resolve(runtimeRoot, runtimeId);
  const manifestPath = resolve(runDirectory, "runtime.json");
  const image = (service) => `devpilot-parity-${service}:${suffix}`;
  const environment = {
    ...baseEnv,
    PARITY_COMPOSE_PROJECT: `devpilot-parity-${runtimeId}`,
    PARITY_DATABASE_NAME: `devpilot_parity_${suffix.replace("-", "_")}`,
    PARITY_API_IMAGE: image("api"),
    PARITY_WEB_IMAGE: image("web"),
    PARITY_ROUTE_CONTROL_IMAGE: image("route-control"),
    PARITY_DEPLOY_TARGET_IMAGE: image("deploy-target"),
    PARITY_TARGET_WORKLOAD_IMAGE: image("target-workload"),
    PARITY_BUILD_LAUNCHER_IMAGE: image("build-launcher"),
    PARITY_SOURCE_REVISION: revision,
    PARITY_SOURCE_TREE_SHA256: treeSha256,
    PARITY_RUNTIME_ID: runtimeId,
    PARITY_GOAL_ID: goalId,
    PARITY_CLEANUP_OWNER_TOKEN: createHash("sha256")
      .update(`local-release-owner:${runtimeId}`)
      .digest("hex"),
    PARITY_BUILDX_BUILDER: `devpilot-builder-${runtimeId}`,
    PARITY_REQUIRE_VERIFIED_RUNTIME: "1",
    PARITY_LOCAL_ACCEPTANCE_PROFILE: "parity-hosts-v1",
    PARITY_LOCAL_ACCEPTANCE_HOSTNAME: "parity.example.test",
    DEVPILOT_PARITY_ROUTE_PROVIDER_KEY: "http-route-control-v1",
    PARITY_FIXTURE_GIT_ROOT: resolve(runDirectory, "fixture-repo"),
    PARITY_WEB_DIST_ROOT: resolve(runDirectory, "web-image-dist"),
    PARITY_C5_MANIFEST_PATH: manifestPath,
    NEXT_PUBLIC_API_URL: "http://localhost:4132",
  };
  return Object.freeze({
    environment: Object.freeze(environment),
    revision,
    treeSha256,
    cleanupOwnerToken: environment.PARITY_CLEANUP_OWNER_TOKEN,
    runDirectory,
    manifestPath,
    runtimeId,
    composeProject: environment.PARITY_COMPOSE_PROJECT,
  });
}

export function publicLocalReleaseRuntime(runtime) {
  return {
    web: "http://localhost:4131",
    api: "http://127.0.0.1:4132/api",
    target: "http://127.0.0.1:43992",
    routeControl: "http://127.0.0.1:43993",
    runtimeId: runtime.runtimeId,
    buildMode: "current-worktree",
  };
}

export function ensureLocalReleaseBuilder(root, environment) {
  const name = environment.PARITY_BUILDX_BUILDER;
  const existing = spawnSync("docker", ["buildx", "inspect", name], {
    cwd: root,
    env: environment,
    stdio: "ignore",
  });
  if (existing.status === 0) return;
  createOwnedBuildxBuilder(parityRuntimeConfig(environment));
}

export function localReleaseApiDigest(root, environment) {
  const result = spawnSync(
    "docker",
    [
      "image",
      "inspect",
      environment.PARITY_API_IMAGE,
      "--format",
      "{{index .RepoDigests 0}}",
    ],
    { cwd: root, env: environment, encoding: "utf8" },
  );
  const digest = result.stdout?.trim();
  if (
    result.status !== 0 ||
    !/^[a-z0-9][a-z0-9./_-]*@sha256:[a-f0-9]{64}$/.test(digest || "")
  ) {
    throw new Error("PARITY_API_IMMUTABLE_DIGEST_MISSING");
  }
  return digest;
}

function worktreeSha256(root, revision) {
  const hash = createHash("sha256");
  hash.update(`${revision}\0`);
  hash.update(git(root, "diff", "--no-ext-diff", "--binary", "HEAD"));
  const untracked = git(
    root,
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  )
    .split("\0")
    .filter(Boolean)
    .sort();
  for (const path of untracked) {
    const absolute = resolve(root, path);
    const stat = lstatSync(absolute);
    hash.update(`\0${path}\0${stat.mode}\0`);
    hash.update(
      stat.isSymbolicLink() ? readlinkSync(absolute) : readFileSync(absolute),
    );
  }
  return hash.digest("hex");
}

function git(root, ...args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || "git failed");
  }
  return result.stdout.trim();
}
