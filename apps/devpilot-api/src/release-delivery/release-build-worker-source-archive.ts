import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, open } from "node:fs/promises";
import { join } from "node:path";
import { runReleaseBuildArgv } from "./release-build-argv-command-runner";
import { publishImmutableWorkerFile } from "./release-build-worker-exchange";
import { createWorkerSourceManifest } from "./release-build-worker-source-manifest";

export async function createWorkerSourceArchive(input: {
  checkoutRoot: string;
  sourceCommitSha: string;
  jobDirectory: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  cancelGraceMs: number;
  sharedGid?: number;
  signal?: AbortSignal;
}) {
  const tree = await runReleaseBuildArgv({
    executable: "/usr/bin/git",
    args: ["ls-tree", "-r", "-z", input.sourceCommitSha],
    cwd: input.checkoutRoot,
    env: input.env,
    timeoutMs: input.timeoutMs,
    cancelGraceMs: input.cancelGraceMs,
    signal: input.signal,
    maxOutputBytes: 10 * 1024 * 1024,
  });
  if (tree.kind !== "completed" || tree.exitCode !== 0) {
    throw new Error("Release Build exact Git tree listing failed");
  }
  const manifest = await createWorkerSourceManifest(
    input.checkoutRoot,
    parseGitTree(tree.stdout),
  );
  const temporary = join(input.jobDirectory, `.source-${process.pid}.tar.tmp`);
  const target = join(input.jobDirectory, "source.tar");
  const outcome = await runReleaseBuildArgv({
    executable: "/usr/bin/git",
    args: [
      "archive",
      "--format=tar",
      `--output=${temporary}`,
      input.sourceCommitSha,
    ],
    cwd: input.checkoutRoot,
    env: input.env,
    timeoutMs: input.timeoutMs,
    cancelGraceMs: input.cancelGraceMs,
    signal: input.signal,
    maxOutputBytes: 1024 * 1024,
  });
  if (outcome.kind !== "completed" || outcome.exitCode !== 0) {
    throw new Error("Release Build exact source archive failed");
  }
  const stat = await lstat(temporary);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 512 * 1024 * 1024) {
    throw new Error("Release Build source archive is invalid or too large");
  }
  await chmod(temporary, 0o640);
  const digest = await hashFile(temporary);
  await publishImmutableWorkerFile(temporary, target, input.sharedGid);
  return { path: target, digest, sizeBytes: stat.size, manifest };
}

function parseGitTree(value: string) {
  return value.split("\0").filter(Boolean).map((entry) => {
    const matched = entry.match(/^([0-9]{6}) (blob|commit) [a-f0-9]+\t(.+)$/s);
    if (!matched || matched[2] !== "blob") {
      throw new Error("Release Build Git tree contains an unsupported entry");
    }
    return { mode: matched[1], path: matched[3] };
  });
}

export async function hashWorkerFile(path: string) {
  return hashFile(path);
}

async function hashFile(path: string) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  const hash = createHash("sha256");
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk);
    return hash.digest("hex");
  } finally {
    await handle.close().catch(() => undefined);
  }
}
