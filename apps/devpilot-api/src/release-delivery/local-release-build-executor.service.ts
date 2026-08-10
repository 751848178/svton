import { Injectable } from "@nestjs/common";
import { mkdir, realpath, rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import {
  assertControlledBuildCommand,
  controlledBuildEnvironment,
} from "./release-build-command-policy";
import { runControlledBuildCommand } from "./release-build-command-runner";
import { ReleaseBuildExecutionError } from "./release-build-execution.error";
import { sanitizeBuildLogs } from "./release-build-log.utils";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
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
  ) {
    super();
  }

  async execute(
    input: ReleaseBuildExecutionInput,
    signal?: AbortSignal,
  ): Promise<ReleaseBuildExecutionResult> {
    this.runtime.assertAvailable();
    if (input.components.length === 0) {
      throw failure(
        "BUILD_COMMAND_MISSING",
        "项目没有可执行的构建命令",
        [],
        "请在 Manage Project 中确认构建配置。",
      );
    }

    const logs: string[] = [];
    const root = await realpath(input.checkoutRoot);
    await assertConfinedRoot(this.runtime.workRoot, root);
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
      for (const component of input.components) {
        const cwd = await confinedDirectory(root, component.workingDirectory);
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
        throw failure(
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
          build: { status: "passed", components: input.components.length },
          artifact: {
            status: "passed",
            contractVersion: 1,
            collection: "declared-outputs-only",
            components: artifact.items.length,
            environmentBoundComponents: artifact.items.filter(
              (item) => item.environment.mode === "baked",
            ).length,
          },
          tests: { status: "not_configured", blocking: false },
          security: {
            executionControls: {
              status: "passed",
              profile: "controlled-local-v1",
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

async function assertConfinedRoot(parent: string, requested: string) {
  const root = await realpath(parent);
  const child = relative(root, requested);
  if (child === "" || child.startsWith("..") || child.startsWith("/")) {
    throw failure(
      "BUILD_WORKSPACE_OUTSIDE_ROOT",
      "构建检出目录不属于受控工作卷",
      [],
      "请检查验收 runtime profile 的工作目录配置。",
    );
  }
}

async function confinedDirectory(root: string, requested: string) {
  const candidate = await realpath(resolve(root, requested));
  const child = relative(root, candidate);
  if (child.startsWith("..") || child.startsWith("/")) {
    throw failure(
      "BUILD_WORKDIR_OUTSIDE_CHECKOUT",
      "构建工作目录越过隔离检出边界",
      [],
      "请将工作目录改为仓库内的相对路径。",
    );
  }
  return candidate;
}

function failure(
  code: string,
  message: string,
  logs: string[],
  action: string,
  status: "failed" | "canceled" = "failed",
) {
  return new ReleaseBuildExecutionError({
    code,
    message,
    logs: sanitizeBuildLogs([
      ...logs,
      `result ${status === "canceled" ? "canceled" : "failed"}: ${code} ${message}`,
    ]),
    gateSummary: { build: { status: "failed" }, action },
    status,
  });
}
