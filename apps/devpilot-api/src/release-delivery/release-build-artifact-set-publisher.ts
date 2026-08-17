import { lstat, mkdir, open, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { artifactFailure } from "./release-build-artifact-policy";
import { artifactTreeDigest } from "./release-build-artifact-tree.policy";

export async function publishReleaseBuildArtifactSet(input: {
  stagedBuild: string;
  stagedEvidence?: string;
  finalBuild: string;
  finalEvidence: string;
  lockTarget: string;
}) {
  return withReleaseBuildPublicationLock(input.lockTarget, async () => {
    const buildState = await publicationState(input.stagedBuild, input.finalBuild);
    const evidenceState = input.stagedEvidence
      ? await publicationState(input.stagedEvidence, input.finalEvidence)
      : "same";
    if (buildState === "conflict") throw existing(input.finalBuild);
    if (evidenceState === "conflict") throw existing(input.finalEvidence);
    if (buildState === "missing") await rename(input.stagedBuild, input.finalBuild);
    if (input.stagedEvidence && evidenceState === "missing") {
      await mkdir(dirname(input.finalEvidence), { recursive: true, mode: 0o700 });
      await rename(input.stagedEvidence, input.finalEvidence);
    }
  });
}

export async function withReleaseBuildPublicationLock<T>(
  buildTarget: string, publish: () => Promise<T>,
) {
  await mkdir(dirname(buildTarget), { recursive: true, mode: 0o700 });
  const lockPath = `${buildTarget}.publish-lock`;
  const lock = await acquireLock(lockPath);
  try { return await publish(); }
  finally {
    await lock.close().catch(() => undefined);
    await rm(lockPath, { force: true }).catch(() => undefined);
  }
}

async function acquireLock(path: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try { return await open(path, "wx", 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  throw existing(path);
}

async function publicationState(staged: string, target: string) {
  try {
    const metadata = await lstat(target);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return "conflict" as const;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing" as const;
    throw error;
  }
  return await artifactTreeDigest(staged) === await artifactTreeDigest(target)
    ? "same" as const : "conflict" as const;
}

function existing(target: string) {
  return artifactFailure("ARTIFACT_ALREADY_EXISTS",
    `BuildRun 制品已存在且内容不一致，拒绝替换：${target}`);
}
