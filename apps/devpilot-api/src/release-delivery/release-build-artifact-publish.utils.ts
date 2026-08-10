import { createHash } from "node:crypto";
import { lstat, mkdir, open, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  hashReleaseBuildArtifact,
  writeReleaseBuildArchive,
} from "./release-build-artifact-io";
import { artifactFailure } from "./release-build-artifact-policy";

export async function writeReleaseBuildArtifact(
  root: string,
  entries: Array<{ path: string; sizeBytes: number }>,
  target: string,
  signal?: AbortSignal,
) {
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  await writeReleaseBuildArchive(root, entries, target, signal);
  const digest = `sha256:${await hashReleaseBuildArtifact(target, signal)}`;
  return { digest, sizeBytes: (await lstat(target)).size };
}

export function releaseBuildComponentFileKey(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function releaseBuildEnvironmentDescriptor(
  values: Record<string, string>,
) {
  if (Object.keys(values).length === 0) return { mode: "independent" as const };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(values))
    .digest("hex");
  return { mode: "baked" as const, fingerprint: `sha256:${fingerprint}` };
}

export async function resolveReleaseBuildBundlePath(
  orderRoot: string,
  buildRunId: string,
) {
  const current = join(orderRoot, buildRunId, "bundle.zip");
  try {
    await lstat(current);
    return current;
  } catch {
    return join(orderRoot, `${buildRunId}.zip`);
  }
}

export async function publishReleaseBuildDirectory(
  staged: string,
  target: string,
) {
  const lockPath = `${target}.publish-lock`;
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch {
    throw alreadyExists(target);
  }
  try {
    if (await pathExists(target)) throw alreadyExists(target);
    await rename(staged, target);
  } finally {
    await lock.close().catch(() => undefined);
    await rm(lockPath, { force: true }).catch(() => undefined);
  }
}

async function pathExists(path: string) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function alreadyExists(target: string) {
  return artifactFailure(
    "ARTIFACT_ALREADY_EXISTS",
    `BuildRun 制品已存在，拒绝替换：${target}`,
  );
}
