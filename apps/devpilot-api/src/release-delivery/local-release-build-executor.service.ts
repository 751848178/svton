import { Injectable } from "@nestjs/common";
import { mkdir, realpath, rm } from "node:fs/promises";
import { join } from "node:path";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import {
  assertControlledBuildCommand,
  controlledBuildEnvironment,
} from "./release-build-command-policy";
import { runControlledBuildCommand } from "./release-build-command-runner";
import { releaseBuildExecutionFailure } from "./release-build-execution-failure";
import { sanitizeBuildLogs } from "./release-build-log.utils";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import { ReleaseBuildPackageEvidenceService } from "./release-build-package-evidence.service";
import { ReleaseBuildPreScriptSecurityService } from "./release-build-pre-script-security.service";
import { releaseBuildGateSummary } from "./release-build-gate-summary";
import {
  assertReleaseBuildCheckoutRoot,
  confinedReleaseBuildDirectory,
} from "./release-build-workspace.policy";
import {
  ReleaseBuildExecutionInput,
  ReleaseBuildExecutionResult,
  ReleaseBuildExecutorPort,
} from "./release-build.types";

@Injectable()
export class LocalReleaseBuildExecutorService extends ReleaseBuildExecutorPort {
  constructor(
    private readonly runtime: ReleaseBuildRuntimeProfileService,
    private readonly artifacts: ReleaseBuildArtifactService,
    private readonly packages: ReleaseBuildPackageEvidenceService,
    private readonly preScript: ReleaseBuildPreScriptSecurityService,
  ) {
    super();
  }

  async execute(
    input: ReleaseBuildExecutionInput,
    signal?: AbortSignal,
  ): Promise<ReleaseBuildExecutionResult> {
    this.runtime.assertAvailable();
    if (input.components.length === 0) {
      throw releaseBuildExecutionFailure(
        "BUILD_COMMAND_MISSING",
        "项目没有可执行的构建命令",
        [],
        "请在 Manage Project 中确认构建配置。",
      );
    }

    const logs: string[] = [];
    const sourceRoot = await realpath(input.checkoutRoot);
    await assertReleaseBuildCheckoutRoot(this.runtime.workRoot, sourceRoot);
    const runtimeRoot = join(
      this.runtime.workRoot,
      "runtime",
      input.buildRunId,
    );
    const home = join(runtimeRoot, "home");
    const temporary = join(runtimeRoot, "tmp");
    await mkdir(home, { recursive: true, mode: 0o700 });
    await mkdir(temporary, { recursive: true, mode: 0o700 });
    try {
      const profile = this.runtime.registeredProfile;
      if (!profile) {
        throw releaseBuildExecutionFailure(
          "BUILD_PROFILE_NOT_REGISTERED",
          "构建 profile 未注册",
          logs,
          "选择服务端注册的 controlled-local-acceptance-v2 profile。",
        );
      }
      const environment = controlledBuildEnvironment(
        this.runtime.commandPath,
        home,
        temporary,
      );
      const prepared = await this.preScript.prepare({
        projectId: input.projectId,
        releaseOrderId: input.releaseOrderId,
        buildRunId: input.buildRunId,
        sourceCommitSha: input.sourceCommitSha,
        sourceRoot,
        runtimeRoot,
        workRoot: this.runtime.workRoot,
        profile,
        env: environment,
        timeoutMs: this.runtime.commandTimeoutMs,
        cancelGraceMs: this.runtime.cancelGraceMs,
        signal,
      });
      const root = prepared.buildRoot;
      const packageEvidence = await this.packages.execute({
        projectId: input.projectId,
        releaseOrderId: input.releaseOrderId,
        buildRunId: input.buildRunId,
        sourceCommitSha: input.sourceCommitSha,
        sourceSnapshotDigest: prepared.sourceSnapshot.snapshotDigest,
        checkoutRoot: root,
        components: input.components,
        profile,
        env: environment,
        timeoutMs: this.runtime.commandTimeoutMs,
        cancelGraceMs: this.runtime.cancelGraceMs,
        signal,
      });
      logs.push(...packageEvidence.logs);
      for (const component of input.components) {
        const cwd = await confinedReleaseBuildDirectory(
          root,
          component.workingDirectory,
        );
        logs.push(`[${component.name}] $ ${component.buildCommand}`);
        const result = await runControlledBuildCommand({
          command: component.buildCommand,
          cwd,
          env: controlledBuildEnvironment(
            this.runtime.commandPath,
            home,
            temporary,
            component.buildEnvironment,
          ),
          timeoutMs: this.runtime.commandTimeoutMs,
          cancelGraceMs: this.runtime.cancelGraceMs,
          signal,
        });
        logs.push(result.stdout, result.stderr);
        assertControlledBuildCommand(component.name, result, logs);
      }
      if (signal?.aborted) {
        throw releaseBuildExecutionFailure(
          "BUILD_COMMAND_CANCELED",
          "构建已取消",
          logs,
          "可重新创建 BuildRun。",
          "canceled",
        );
      }

      const artifact = await this.artifacts.package(
        {
          checkoutRoot: root,
          projectId: input.projectId,
          releaseOrderId: input.releaseOrderId,
          buildRunId: input.buildRunId,
          components: input.components,
        },
        signal,
      );
      logs.push(
        `result succeeded: artifact ${artifact.digest} (${artifact.sizeBytes} bytes)`,
      );
      return {
        artifact,
        logs: sanitizeBuildLogs(logs),
        gateSummary: releaseBuildGateSummary({
          profile,
          packageEvidence,
          prepared,
          artifact,
          componentCount: input.components.length,
        }),
      };
    } finally {
      await rm(runtimeRoot, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }

  discardArtifact(input: {
    projectId: string;
    releaseOrderId: string;
    buildRunId: string;
  }) {
    return this.artifacts.discard(input);
  }
}
