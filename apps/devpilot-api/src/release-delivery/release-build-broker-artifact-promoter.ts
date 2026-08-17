import { cp, lstat, mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { hashReleaseBuildArtifact } from "./release-build-artifact-io";
import { publishReleaseBuildArtifactSet } from "./release-build-artifact-set-publisher";
import { assertSafeArtifactTree, mergeArtifactTree,
} from "./release-build-artifact-tree.policy";
import type { ReleaseBuildExecutionResult } from "./release-build.types";

export async function promoteBrokerArtifacts(input: {
  rawRoot: string;
  trustedRoot: string;
  finalRoot: string;
  projectId: string;
  releaseOrderId: string;
  buildRunId: string;
  result: ReleaseBuildExecutionResult;
}) {
  const relativeBuild = join(input.projectId, input.releaseOrderId, input.buildRunId);
  const rawBuild = await confined(input.rawRoot, relativeBuild);
  await assertSafeArtifactTree(rawBuild);
  await assertResultDigests(rawBuild, input.result);
  const finalBuild = join(input.finalRoot, relativeBuild);
  const stagedBuild = await stagedCopy(rawBuild, finalBuild);
  const evidencePath = join("evidence", relativeBuild);
  const trustedEvidence = join(input.trustedRoot, evidencePath);
  const rawEvidence = join(input.rawRoot, evidencePath);
  const finalEvidence = join(input.finalRoot, evidencePath);
  let stagedEvidence: string | undefined;
  try {
    if (await directoryExists(trustedEvidence) || await directoryExists(rawEvidence)) {
      stagedEvidence = await temporarySibling(finalEvidence);
      if (await directoryExists(trustedEvidence))
        await mergeArtifactTree(trustedEvidence, stagedEvidence);
      if (await directoryExists(rawEvidence))
        await mergeArtifactTree(rawEvidence, stagedEvidence);
    }
    await publishReleaseBuildArtifactSet({ stagedBuild, stagedEvidence,
      finalBuild, finalEvidence,
      lockTarget: join(dirname(input.finalRoot), ".publish-locks", relativeBuild) });
  } finally {
    await rm(stagedBuild, { recursive: true, force: true });
    if (stagedEvidence) await rm(stagedEvidence, { recursive: true, force: true });
  }
}

async function assertResultDigests(root: string, result: ReleaseBuildExecutionResult) {
  const bundle = join(root, "bundle.zip");
  if (`sha256:${await hashReleaseBuildArtifact(bundle)}` !== result.artifact.digest) {
    throw new Error("broker bundle digest mismatch");
  }
  for (const item of result.artifact.items) {
    const filename = basename(item.uri);
    if (!filename.endsWith(".zip") ||
      `sha256:${await hashReleaseBuildArtifact(join(root, "components", filename))}` !==
        item.digest) throw new Error("broker component digest mismatch");
  }
}

async function stagedCopy(source: string, target: string) {
  const temporary = await temporarySibling(target);
  await cp(source, temporary, { recursive: true, force: false, dereference: false });
  return temporary;
}

async function temporarySibling(target: string) {
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  return mkdtemp(join(dirname(target), `.${basename(target)}-broker-`));
}

async function confined(root: string, path: string) {
  const resolvedRoot = await realpath(root);
  const target = await realpath(join(root, path));
  const child = relative(resolvedRoot, target);
  if (child.startsWith("..") || isAbsolute(child)) throw new Error("broker output escaped root");
  return target;
}

async function directoryExists(path: string) {
  try { return (await lstat(path)).isDirectory(); } catch { return false; }
}
