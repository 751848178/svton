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
import { ReleaseBuildScannerEvidenceService } from "./release-build-scanner-evidence.service";
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
    private readonly scanners: ReleaseBuildScannerEvidenceService,
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
    const root = await realpath(input.checkoutRoot);
    await assertReleaseBuildCheckoutRoot(this.runtime.workRoot, root);
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
      const packageEvidence = await this.packages.execute({
        projectId: input.projectId,
        releaseOrderId: input.releaseOrderId,
        buildRunId: input.buildRunId,
        sourceCommitSha: input.sourceCommitSha,
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
      const security = await this.scanners.execute({
        projectId: input.projectId,
        releaseOrderId: input.releaseOrderId,
        buildRunId: input.buildRunId,
        sourceCommitSha: input.sourceCommitSha,
        checkoutRoot: root,
        temporaryRoot: temporary,
        profile,
        env: environment,
        timeoutMs: this.runtime.commandTimeoutMs,
        cancelGraceMs: this.runtime.cancelGraceMs,
        signal,
      });
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
        gateSummary: {
          source: { status: "passed", checkout: "exact_commit" },
          install: packageEvidence.install,
          build: { status: "passed", components: input.components.length },
          tests: packageEvidence.tests,
          quality: packageEvidence.quality,
          artifact: {
            status: "passed",
            contractVersion: 1,
            collection: "declared-outputs-only",
            components: artifact.items.length,
            environmentBoundComponents: artifact.items.filter(
              (item) => item.environment.mode === "baked",
            ).length,
          },
          security: {
            secretScan: security.secretScan,
            sast: security.sast,
            vulnerabilities: security.vulnerabilities,
            executionControls: {
              status: "passed",
              profile: profile.id,
              trustBoundary: "disposable-api-container",
              untrustedSandbox: false,
              controls: [
                "minimal_environment",
                "working_directory_confinement",
                "bounded_process_group",
              ],
              limitations: ["shared_api_process", "shared_container_network"],
            },
          },
        },
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
