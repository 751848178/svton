import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sanitizeBuildLogs } from "./release-build-log.utils";
import { ReleaseArtifactArchivePort } from "./release-artifact-archive.service";
import {
  ExactManifestDeploymentInput,
  ReleaseDeploymentProviderError,
  ReleaseDeploymentProviderPort,
  releaseWorkloadCleanupWasAttempted,
} from "./release-deployment-provider.types";
import {
  assertLocalReleaseIdentifiers,
  isUnsafeReleaseArchiveEntry,
  localReleaseActivation,
  localReleaseFailure,
  releaseProviderErrorMessage,
} from "./local-filesystem-deployment-provider.utils";
import { executeLocalReleaseWorkloadCommand } from "./local-release-workload-command";
import { writeLocalComponentEnvironments } from "./local-release-component-environment";
import {
  cleanupReleaseWorkloads,
  runReleaseWorkloads,
} from "./release-workload-runtime";
import { probeReleaseWorkloads } from "./release-workload-probe-runtime";

@Injectable()
export class LocalFilesystemDeploymentProviderService extends ReleaseDeploymentProviderPort {
  readonly key = "local-filesystem-v1";
  readonly targetRef = "filesystem-release-target";
  private readonly root: string;
  private readonly timeoutMs: number;

  constructor(
    config: ConfigService,
    private readonly archive: ReleaseArtifactArchivePort,
  ) {
    super();
    this.root = resolve(
      config.get<string>("RELEASE_STAGING_DEPLOYMENT_ROOT") ||
        join(process.cwd(), "storage", "release-deployments"),
    );
    this.timeoutMs =
      Number(config.get("RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS")) || 120_000;
  }
  refreshExactCandidate(input: {
    projectId: string; environmentId: string; deploymentRunId: string;
    workload: NonNullable<ExactManifestDeploymentInput["workload"]>;
  }) {
    const releaseRoot = join(this.root, input.projectId, input.environmentId,
      "releases", input.deploymentRunId);
    return probeReleaseWorkloads({
      snapshot: input.workload, releaseRoot, execute: executeLocalReleaseWorkloadCommand,
    });
  }
  async deployExactManifest(input: ExactManifestDeploymentInput) {
    if (input.targetRef !== this.targetRef) {
      throw localReleaseFailure(
        "DEPLOYMENT_TARGET_MISMATCH",
        "Deployment Provider 目标引用不匹配",
        [],
      );
    }
    assertLocalReleaseIdentifiers(input);
    const environmentRoot = join(
      this.root,
      input.projectId,
      input.environmentId,
    );
    const releaseRoot = join(
      environmentRoot,
      "releases",
      input.deploymentRunId,
    );
    const temporary = `${releaseRoot}.tmp`;
    const active = join(environmentRoot, "active.json");
    const pending = `${active}.${input.deploymentRunId}.tmp`;
    const entries = await this.archive.list(
      input.artifact.path,
      this.timeoutMs,
    );
    if (entries.some(isUnsafeReleaseArchiveEntry)) {
      throw localReleaseFailure(
        "ARTIFACT_ARCHIVE_UNSAFE",
        "制品归档包含越界路径",
        entries,
      );
    }
    let runtimeEvidence: {
      logs: string[];
      evidence: Record<string, unknown>;
    } = {
      logs: [],
      evidence: {},
    };
    await mkdir(join(environmentRoot, "releases"), { recursive: true });
    await rm(temporary, { recursive: true, force: true });
    try {
      await mkdir(temporary, { recursive: true });
      await this.archive.extract(
        input.artifact.path,
        temporary,
        this.timeoutMs,
      );
      const runtimePaths = await writeLocalComponentEnvironments(
        input,
        temporary,
        releaseRoot,
      );
      await rename(temporary, releaseRoot);
      if (input.workload) {
        runtimeEvidence = await runReleaseWorkloads({
          snapshot: input.workload,
          releaseRoot,
          runtimePaths,
          globalEnvironment: input.globalEnvironment || {},
          componentEnvironments: input.componentEnvironments || {},
          execute: executeLocalReleaseWorkloadCommand,
        });
      }
      const activatedAt = new Date().toISOString();
      await writeFile(
        pending,
        `${JSON.stringify(localReleaseActivation(input, activatedAt), null, 2)}\n`,
        {
          mode: 0o600,
        },
      );
      await rename(pending, active);
      return {
        providerKey: this.key,
        providerDeploymentId: input.deploymentRunId,
        targetRef: this.targetRef,
        deploymentUri: `release-target://${input.projectId}/${input.environmentId}/releases/${input.deploymentRunId}`,
        manifestId: input.manifest.id,
        manifestDigest: input.manifest.digest,
        activatedAt,
        logs: sanitizeBuildLogs([
          `provider ${this.key} activated ${input.manifest.digest}`,
          `target ${this.targetRef} received ${entries.length} entries`,
          ...runtimeEvidence.logs,
        ]),
        evidence: {
          providerActivated: true,
          targetType: "filesystem-environment",
          materializedEntries: entries.length,
          artifactSizeBytes: input.artifact.sizeBytes,
          runtimeEnvironmentFileMode: "0600",
          globalEnvironmentKeys: Object.keys(input.globalEnvironment || {}).sort(),
          componentEnvironmentKeys: Object.fromEntries(
            Object.entries(input.componentEnvironments || {}).map(([key, value]) => [
              key,
              Object.keys(value).sort(),
            ]),
          ),
          ...runtimeEvidence.evidence,
          checkoutInvoked: false,
          pullInvoked: false,
          buildInvoked: false,
          gitInvoked: false,
        },
      };
    } catch (error) {
      let cleanupLogs: string[] = [];
      if (input.workload && !releaseWorkloadCleanupWasAttempted(error)) {
        cleanupLogs = await cleanupReleaseWorkloads({
          snapshot: input.workload,
          releaseRoot,
          runtimePaths: Object.fromEntries(
            (input.workload?.services ?? []).map((service) => [
              service.componentKey,
              join(releaseRoot, ".devpilot", "env", `${service.componentKey}.env`),
            ]),
          ),
          globalEnvironment: input.globalEnvironment || {},
          componentEnvironments: input.componentEnvironments || {},
          execute: executeLocalReleaseWorkloadCommand,
        });
      }
      await Promise.all([
        rm(temporary, { recursive: true, force: true }),
        rm(pending, { force: true }),
        rm(releaseRoot, { recursive: true, force: true }),
      ]);
      if (error instanceof ReleaseDeploymentProviderError) {
        if (cleanupLogs.length === 0) throw error;
        throw localReleaseFailure(error.detail.code, error.detail.message, [
          ...error.detail.logs,
          ...cleanupLogs,
        ]);
      }
      throw localReleaseFailure(
        "DEPLOYMENT_PROVIDER_FAILED",
        "制品交付到目标环境失败",
        [releaseProviderErrorMessage(error), ...cleanupLogs],
      );
    }
  }
}
