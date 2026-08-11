import { cp, lstat, mkdir, mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { hashReleaseBuildArtifact } from "./release-build-artifact-io";
import { publishReleaseBuildDirectory } from "./release-build-artifact-publish.utils";
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
  await assertSafeTree(rawBuild);
  await assertResultDigests(rawBuild, input.result);
  const finalBuild = join(input.finalRoot, relativeBuild);
  await publishCopy(rawBuild, finalBuild);
  const evidencePath = join("evidence", relativeBuild);
  const trustedEvidence = join(input.trustedRoot, evidencePath);
  const rawEvidence = join(input.rawRoot, evidencePath);
  if (await directoryExists(trustedEvidence) || await directoryExists(rawEvidence)) {
    const temporary = await temporarySibling(join(input.finalRoot, evidencePath));
    try {
      if (await directoryExists(trustedEvidence)) {
        await assertSafeTree(trustedEvidence);
        await cp(trustedEvidence, temporary, { recursive: true, force: false });
      }
      if (await directoryExists(rawEvidence)) {
        await assertSafeTree(rawEvidence);
        await cp(rawEvidence, temporary, { recursive: true, force: false });
      }
      await publishReleaseBuildDirectory(temporary, join(input.finalRoot, evidencePath));
    } finally { await rm(temporary, { recursive: true, force: true }); }
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

async function publishCopy(source: string, target: string) {
  const temporary = await temporarySibling(target);
  try {
    await cp(source, temporary, { recursive: true, force: false, dereference: false });
    await publishReleaseBuildDirectory(temporary, target);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

async function temporarySibling(target: string) {
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  return mkdtemp(join(dirname(target), `.${basename(target)}-broker-`));
}

async function assertSafeTree(root: string) {
  let count = 0;
  const queue = [root];
  while (queue.length) {
    const current = queue.pop()!;
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
      throw new Error("broker output contains unsafe entry");
    }
    if (++count > 20_000) throw new Error("broker output entry limit exceeded");
    if (stat.isDirectory()) {
      for (const entry of await readdir(current)) queue.push(join(current, entry));
    }
  }
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
