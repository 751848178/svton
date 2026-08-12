import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { runReleaseBuildArgv } from "./release-build-argv-command-runner";
import type { ReleaseBuildWorkerRequest } from "./release-build-worker-envelope.policy";
import { hashWorkerFile } from "./release-build-worker-source-archive";
import { verifyExtractedWorkerSource } from "./release-build-worker-source-manifest";

export async function extractAndVerifyWorkerSource(input: {
  directory: string;
  root: string;
  request: ReleaseBuildWorkerRequest;
  tarExecutable: string;
  commandPath: string;
  timeoutMs: number;
  cancelGraceMs: number;
}) {
  const archive = join(input.directory, "source.tar");
  if (await hashWorkerFile(archive) !== input.request.identity.sourceArchiveDigest)
    throw new Error("Release Build source archive digest mismatch");
  const source = join(input.root, "source");
  await mkdir(source, { mode: 0o700 });
  const outcome = await runReleaseBuildArgv({ executable: input.tarExecutable,
    args: ["-xf", archive, "-C", source, "--no-same-owner", "--no-same-permissions"],
    cwd: input.root, env: { PATH: input.commandPath, HOME: input.root, TMPDIR: input.root },
    timeoutMs: input.timeoutMs, cancelGraceMs: input.cancelGraceMs });
  if (outcome.kind !== "completed" || outcome.exitCode !== 0)
    throw new Error("Release Build source archive extraction failed");
  await verifyExtractedWorkerSource(source, input.request.sourceManifest);
  return source;
}
