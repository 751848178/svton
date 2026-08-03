import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { execFile } from "node:child_process";
import { mkdir, rename, rm } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import { sanitizeBuildLogs } from "./release-build-log.utils";
import {
  ReleaseStagingExecutionError,
  ReleaseStagingExecutorPort,
  StagingArtifactInput,
} from "./release-staging.types";

@Injectable()
export class LocalReleaseStagingExecutorService extends ReleaseStagingExecutorPort {
  private readonly enabled: boolean;
  private readonly root: string;
  private readonly timeoutMs: number;

  constructor(
    config: ConfigService,
    private readonly artifacts: ReleaseBuildArtifactService,
  ) {
    super();
    this.enabled = config.get<boolean>("RELEASE_STAGING_DEPLOYMENT_ENABLED") === true;
    this.root = resolve(
      config.get<string>("RELEASE_STAGING_DEPLOYMENT_ROOT")
        || join(process.cwd(), "storage", "release-deployments"),
    );
    this.timeoutMs = Number(config.get("RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS")) || 120_000;
  }

  async deploy(input: StagingArtifactInput) {
    if (!this.enabled) {
      throw failure("STAGING_EXECUTOR_DISABLED", "Staging 制品部署执行器未启用", []);
    }
    const artifact = await this.artifacts.resolveAndVerify({
      projectId: input.projectId,
      releaseOrderId: input.releaseOrderId,
      buildRunId: input.buildRunId,
      uri: input.uri,
      digest: input.digest,
    });
    const entries = await zipEntries(artifact.path, this.timeoutMs);
    if (entries.some(unsafeEntry)) {
      throw failure("ARTIFACT_ARCHIVE_UNSAFE", "制品归档包含越界路径", entries);
    }
    const directory = join(
      this.root,
      input.projectId,
      input.environmentId,
      input.deploymentRunId,
    );
    const temporary = `${directory}.tmp`;
    await mkdir(join(this.root, input.projectId, input.environmentId), { recursive: true });
    await rm(temporary, { recursive: true, force: true });
    try {
      await mkdir(temporary, { recursive: true });
      await execute("unzip", ["-qq", artifact.path, "-d", temporary], this.timeoutMs);
      await rename(temporary, directory);
    } catch (error) {
      await rm(temporary, { recursive: true, force: true });
      throw failure(
        "ARTIFACT_MATERIALIZATION_FAILED",
        "制品部署到 Staging 失败",
        [error instanceof Error ? error.message : String(error)],
      );
    }
    return {
      deploymentUri: `release-deployment://${input.deploymentRunId}`,
      logs: sanitizeBuildLogs([
        `verified ${input.digest}`,
        `materialized ${entries.length} entries from ${input.uri}`,
      ]),
      evidence: {
        artifactVerified: true,
        immutableInput: true,
        materializedEntries: entries.length,
        buildInvoked: false,
        gitInvoked: false,
      },
    };
  }
}

async function zipEntries(path: string, timeoutMs: number) {
  const output = await execute("unzip", ["-Z1", path], timeoutMs);
  return output.stdout.split(/\r?\n/).filter(Boolean);
}

function unsafeEntry(entry: string) {
  const value = normalize(entry.replaceAll("\\", "/"));
  return value.startsWith("/") || value === ".." || value.startsWith("../");
}

function execute(command: string, args: string[], timeout: number) {
  return new Promise<{ stdout: string; stderr: string }>((resolvePromise, reject) => {
    execFile(command, args, { timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolvePromise({ stdout, stderr });
    });
  });
}

function failure(code: string, message: string, logs: string[]) {
  return new ReleaseStagingExecutionError({
    code,
    message,
    logs: sanitizeBuildLogs(logs),
  });
}
