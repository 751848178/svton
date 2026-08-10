import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const RUNTIME_PATTERN = /^c5-[a-f0-9]{8}-[a-f0-9]{32}$/;
const CONTROL_FILES = Object.freeze([
  "apps/devpilot-web/next-env.d.ts",
  "apps/devpilot-web/tsconfig.json",
]);

export function prepareC5WebBuildCache(
  environment,
  workspaceRoot = process.cwd(),
) {
  const owner = cacheOwner(environment);
  const root = realpathSync(workspaceRoot);
  const nextRoot = resolve(root, "apps/devpilot-web/.next");
  mkdirSync(nextRoot, { recursive: true });
  requireOwnedDirectory(nextRoot);
  const controlFiles = captureControlFiles(root);
  const buildRoot = join(nextRoot, owner.runtimeId);
  mkdirSync(buildRoot, { recursive: false, mode: 0o700 });
  const owned = {
    ...owner,
    controlFiles: controlFiles.map(({ relativePath, sha256 }) => ({
      relativePath,
      sha256,
    })),
  };
  writeFileSync(join(buildRoot, "owner.json"), `${JSON.stringify(owned)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return Object.freeze({
    root: buildRoot,
    distDir: `.next/${owner.runtimeId}/dist`,
    owner: owned,
    controlFiles,
  });
}

export function cleanupC5WebBuildCache(cache, environment) {
  const expected = {
    ...cacheOwner(environment),
    controlFiles: cache.controlFiles.map(({ relativePath, sha256 }) => ({
      relativePath,
      sha256,
    })),
  };
  if (
    cache?.root !== resolve(cache.root) ||
    !cache.root.endsWith(`/apps/devpilot-web/.next/${expected.runtimeId}`)
  ) {
    throw cacheError("cleanup-path");
  }
  requireOwnedDirectory(cache.root);
  const actual = JSON.parse(
    readFileSync(join(cache.root, "owner.json"), "utf8"),
  );
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw cacheError("cleanup-owner");
  }
  restoreControlFiles(cache);
  rmSync(cache.root, { recursive: true, force: false });
  if (existsSync(cache.root)) throw cacheError("cleanup-residual");
}

function captureControlFiles(root) {
  return CONTROL_FILES.map((relativePath) => {
    const path = resolve(root, relativePath);
    requireOwnedFile(path);
    const content = readFileSync(path);
    return {
      path,
      relativePath,
      content,
      mode: Number(lstatSync(path, { bigint: true }).mode & 0o777n),
      sha256: digest(content),
    };
  });
}

function restoreControlFiles(cache) {
  for (const control of cache.controlFiles) {
    requireOwnedFile(control.path);
    const current = readFileSync(control.path);
    if (digest(current) === control.sha256) continue;
    if (
      !expectedGeneratedControl(control.relativePath, current, cache.distDir)
    ) {
      throw cacheError(`control-file-drift:${control.relativePath}`);
    }
    writeFileSync(control.path, control.content, { mode: control.mode });
    if (digest(readFileSync(control.path)) !== control.sha256) {
      throw cacheError(`control-file-restore:${control.relativePath}`);
    }
  }
}

function expectedGeneratedControl(relativePath, content, distDir) {
  const text = content.toString("utf8");
  if (relativePath.endsWith("next-env.d.ts")) {
    return text.includes(`./${distDir}/types/routes.d.ts`);
  }
  try {
    return (
      JSON.parse(text).include?.includes(`${distDir}/types/**/*.ts`) === true
    );
  } catch {
    return false;
  }
}

function cacheOwner(environment) {
  const runtimeId = environment.PARITY_RUNTIME_ID;
  const goalId = environment.PARITY_GOAL_ID;
  const sourceRevision = environment.PARITY_SOURCE_REVISION;
  const token = environment.PARITY_CLEANUP_OWNER_TOKEN;
  if (!RUNTIME_PATTERN.test(runtimeId || "")) throw cacheError("runtime-id");
  if (goalId !== "devpilot-v13-opencode-acceptance") {
    throw cacheError("goal-id");
  }
  if (!/^[a-f0-9]{40}$/.test(sourceRevision || "")) {
    throw cacheError("source-revision");
  }
  if (!/^[a-f0-9]{64}$/.test(token || "")) throw cacheError("owner-token");
  return {
    schemaVersion: 1,
    runtimeId,
    goalId,
    sourceRevision,
    cleanupOwnerFingerprint: createHash("sha256").update(token).digest("hex"),
  };
}

function requireOwnedDirectory(path) {
  const stats = lstatSync(path, { bigint: true });
  if (
    !stats.isDirectory() ||
    stats.isSymbolicLink() ||
    stats.uid !== BigInt(process.geteuid()) ||
    realpathSync(path) !== path
  ) {
    throw cacheError("directory-identity");
  }
}

function requireOwnedFile(path) {
  const stats = lstatSync(path, { bigint: true });
  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    stats.uid !== BigInt(process.geteuid())
  ) {
    throw cacheError("control-file-identity");
  }
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function cacheError(reason) {
  return new Error(`PARITY_C5_WEB_BUILD_CACHE_INVALID: ${reason}`);
}
