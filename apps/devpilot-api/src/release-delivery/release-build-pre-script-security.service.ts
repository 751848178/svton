import { Injectable } from "@nestjs/common";
import { mkdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { releaseBuildExecutionFailure } from "./release-build-execution-failure";
import { ReleaseBuildScannerEvidenceService } from "./release-build-scanner-evidence.service";
import { ReleaseBuildSourceSnapshotService } from "./release-build-source-snapshot.service";
import { createSeparatedBuildWorkspace } from "./release-build-workspace-copy";

@Injectable()
export class ReleaseBuildPreScriptSecurityService {
  constructor(
    private readonly snapshots: ReleaseBuildSourceSnapshotService,
    private readonly scanners: ReleaseBuildScannerEvidenceService,
  ) {}

  async prepare(input: {
    projectId: string;
    releaseOrderId: string;
    buildRunId: string;
    sourceCommitSha: string;
    sourceRoot: string;
    runtimeRoot: string;
    workRoot: string;
    profile: RegisteredReleaseBuildProfile;
    env: NodeJS.ProcessEnv;
    timeoutMs: number;
    cancelGraceMs: number;
    signal?: AbortSignal;
  }) {
    const before = await this.snapshots.verify({
      checkoutRoot: input.sourceRoot,
      sourceCommitSha: input.sourceCommitSha,
      env: input.env,
      timeoutMs: input.timeoutMs,
      cancelGraceMs: input.cancelGraceMs,
      signal: input.signal,
    });
    const reportRoot = join(input.runtimeRoot, "scanner-reports");
    await mkdir(reportRoot, { recursive: false, mode: 0o700 });
    const security = await this.scanners.execute({
      ...input,
      checkoutRoot: input.sourceRoot,
      reportRoot: await realpath(reportRoot),
      sourceSnapshotDigest: before.snapshotDigest,
    });
    const after = await this.snapshots.verify({
      checkoutRoot: input.sourceRoot,
      sourceCommitSha: input.sourceCommitSha,
      env: input.env,
      timeoutMs: input.timeoutMs,
      cancelGraceMs: input.cancelGraceMs,
      signal: input.signal,
    });
    if (before.snapshotDigest !== after.snapshotDigest) {
      throw securityFailure(security, "BUILD_SOURCE_CHANGED_DURING_SCAN");
    }
    if (Object.values(security).some((evidence) => evidence.status !== "passed")) {
      throw securityFailure(security, "BUILD_PRE_SCRIPT_SECURITY_BLOCKED");
    }
    const buildRoot = await createSeparatedBuildWorkspace({
      workRoot: input.workRoot,
      sourceRoot: input.sourceRoot,
      runtimeRoot: input.runtimeRoot,
    });
    return { security, sourceSnapshot: before, buildRoot };
  }
}

function securityFailure(security: unknown, code: string) {
  return releaseBuildExecutionFailure(
    code,
    "源码安全扫描未通过，未执行任何仓库脚本",
    [],
    "修复扫描结果或安装缺失的固定版本扫描器后重新构建。",
    "failed",
    { security },
  );
}
