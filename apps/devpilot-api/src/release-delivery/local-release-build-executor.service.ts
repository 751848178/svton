import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { execFile } from "node:child_process";
import { mkdir, realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import { ReleaseBuildExecutionError } from "./release-build-execution.error";
import { sanitizeBuildLogs } from "./release-build-log.utils";
import {
  ReleaseBuildExecutionInput,
  ReleaseBuildExecutionResult,
  ReleaseBuildExecutorPort,
} from "./release-build.types";

@Injectable()
export class LocalReleaseBuildExecutorService extends ReleaseBuildExecutorPort {
  private readonly enabled: boolean;
  private readonly timeoutMs: number;

  constructor(
    config: ConfigService,
    private readonly artifacts: ReleaseBuildArtifactService,
  ) {
    super();
    this.enabled = config.get<boolean>("RELEASE_BUILD_EXECUTION_ENABLED") === true;
    this.timeoutMs = Number(config.get("RELEASE_BUILD_COMMAND_TIMEOUT_MS")) || 600_000;
  }

  async execute(
    input: ReleaseBuildExecutionInput,
  ): Promise<ReleaseBuildExecutionResult> {
    if (!this.enabled) {
      throw failure(
        "BUILD_EXECUTOR_DISABLED",
        "本地构建执行器未启用",
        [],
        "请配置隔离构建执行器，或显式启用受控本地执行器。",
      );
    }
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
    const home = resolve(root, ".devpilot-build-home");
    await mkdir(home, { recursive: true });
    for (const component of input.components) {
      const cwd = await confinedDirectory(root, component.workingDirectory);
      logs.push(`[${component.name}] $ ${component.buildCommand}`);
      const result = await runCommand(component.buildCommand, cwd, home, this.timeoutMs);
      logs.push(result.stdout, result.stderr);
      if (result.exitCode !== 0) {
        throw failure(
          "BUILD_COMMAND_FAILED",
          `${component.name} 构建失败（exit ${result.exitCode}）`,
          logs,
          "修复构建命令后重新创建 BuildRun；失败运行不会产生 Manifest。",
        );
      }
    }

    const artifact = await this.artifacts.package({
      checkoutRoot: root,
      projectId: input.projectId,
      releaseOrderId: input.releaseOrderId,
      buildRunId: input.buildRunId,
    });
    logs.push(`artifact ${artifact.digest} (${artifact.sizeBytes} bytes)`);
    return {
      artifact,
      logs: sanitizeBuildLogs(logs),
      gateSummary: {
        source: { status: "passed", checkout: "exact_commit" },
        build: { status: "passed", components: input.components.length },
        tests: { status: "not_configured", blocking: false },
        security: {
          status: "passed",
          controls: ["minimal_environment", "path_confinement", "log_redaction"],
        },
      },
    };
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

function runCommand(command: string, cwd: string, home: string, timeout: number) {
  return new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolvePromise) => {
    execFile(
      "/bin/sh",
      ["-lc", command],
      {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024,
        env: {
          PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
          LANG: "C.UTF-8",
          CI: "true",
          HOME: home,
        },
      },
      (error, stdout, stderr) => resolvePromise({
        exitCode: typeof error?.code === "number" ? error.code : error ? 1 : 0,
        stdout,
        stderr: error && !stderr ? error.message : stderr,
      }),
    );
  });
}

function failure(
  code: string,
  message: string,
  logs: string[],
  action: string,
) {
  return new ReleaseBuildExecutionError({
    code,
    message,
    logs: sanitizeBuildLogs(logs),
    gateSummary: { build: { status: "failed" }, action },
  });
}
