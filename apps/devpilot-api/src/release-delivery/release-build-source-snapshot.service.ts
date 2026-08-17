import { Injectable } from "@nestjs/common";
import { stableHash } from "../release-orchestration/utils/release-hash.utils";
import { runReleaseBuildArgv } from "./release-build-argv-command-runner";
import { releaseBuildExecutionFailure } from "./release-build-execution-failure";

export type ReleaseBuildSourceSnapshot = {
  sourceCommitSha: string;
  treeHash: string;
  snapshotDigest: string;
};

@Injectable()
export class ReleaseBuildSourceSnapshotService {
  async verify(input: {
    checkoutRoot: string;
    sourceCommitSha: string;
    env: NodeJS.ProcessEnv;
    timeoutMs: number;
    cancelGraceMs: number;
    signal?: AbortSignal;
  }): Promise<ReleaseBuildSourceSnapshot> {
    const run = (args: string[]) => runReleaseBuildArgv({
      executable: "/usr/bin/git",
      args,
      cwd: input.checkoutRoot,
      env: input.env,
      timeoutMs: input.timeoutMs,
      cancelGraceMs: input.cancelGraceMs,
      signal: input.signal,
      maxOutputBytes: 1024 * 1024,
    });
    const [head, tree, status] = await Promise.all([
      run(["rev-parse", "HEAD"]),
      run(["rev-parse", "HEAD^{tree}"]),
      run(["status", "--porcelain=v1", "--untracked-files=all"]),
    ]);
    const commit = head.stdout.trim().toLowerCase();
    const treeHash = tree.stdout.trim().toLowerCase();
    if (
      [head, tree, status].some((outcome) =>
        outcome.kind !== "completed" || outcome.exitCode !== 0) ||
      commit !== input.sourceCommitSha.toLowerCase() ||
      !/^[a-f0-9]{40,64}$/.test(treeHash) ||
      status.stdout.trim() !== ""
    ) {
      throw releaseBuildExecutionFailure(
        "BUILD_SOURCE_SNAPSHOT_DRIFT",
        "精确 Commit 扫描快照已变化或包含未跟踪文件",
        [head.stderr, tree.stderr, status.stdout, status.stderr],
        "重新检出精确 Commit 后再构建。",
      );
    }
    return {
      sourceCommitSha: commit,
      treeHash,
      snapshotDigest: stableHash({
        scope: "release-build-source-snapshot-v1",
        sourceCommitSha: commit,
        treeHash,
      }),
    };
  }
}
