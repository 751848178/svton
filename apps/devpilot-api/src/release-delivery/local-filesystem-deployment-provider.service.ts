import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import { sanitizeBuildLogs } from "./release-build-log.utils";
import { ReleaseArtifactArchivePort } from "./release-artifact-archive.service";
import {
  ExactManifestDeploymentInput,
  ReleaseDeploymentProviderError,
  ReleaseDeploymentProviderPort,
} from "./release-deployment-provider.types";

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

  async deployExactManifest(input: ExactManifestDeploymentInput) {
    if (input.targetRef !== this.targetRef) {
      throw failure(
        "DEPLOYMENT_TARGET_MISMATCH",
        "Deployment Provider 目标引用不匹配",
        [],
      );
    }
    assertIdentifiers(input);
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
    if (entries.some(unsafeEntry)) {
      throw failure("ARTIFACT_ARCHIVE_UNSAFE", "制品归档包含越界路径", entries);
    }
    const activatedAt = new Date().toISOString();
    await mkdir(join(environmentRoot, "releases"), { recursive: true });
    await rm(temporary, { recursive: true, force: true });
    try {
      await mkdir(temporary, { recursive: true });
      await this.archive.extract(
        input.artifact.path,
        temporary,
        this.timeoutMs,
      );
      await rename(temporary, releaseRoot);
      await writeFile(
        pending,
        `${JSON.stringify(activation(input, activatedAt), null, 2)}\n`,
        {
          mode: 0o600,
        },
      );
      await rename(pending, active);
    } catch (error) {
      await Promise.all([
        rm(temporary, { recursive: true, force: true }),
        rm(pending, { force: true }),
        rm(releaseRoot, { recursive: true, force: true }),
      ]);
      throw failure("DEPLOYMENT_PROVIDER_FAILED", "制品交付到目标环境失败", [
        message(error),
      ]);
    }
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
      ]),
      evidence: {
        providerActivated: true,
        targetType: "filesystem-environment",
        materializedEntries: entries.length,
        artifactSizeBytes: input.artifact.sizeBytes,
        checkoutInvoked: false,
        pullInvoked: false,
        buildInvoked: false,
        gitInvoked: false,
      },
    };
  }
}

function activation(input: ExactManifestDeploymentInput, activatedAt: string) {
  return {
    version: 1,
    providerKey: "local-filesystem-v1",
    targetRef: input.targetRef,
    providerDeploymentId: input.deploymentRunId,
    stage: input.stage,
    projectId: input.projectId,
    releaseOrderId: input.releaseOrderId,
    environmentId: input.environmentId,
    manifestId: input.manifest.id,
    manifestDigest: input.manifest.digest,
    buildRunId: input.manifest.buildRunId,
    activatedAt,
  };
}

function assertIdentifiers(input: ExactManifestDeploymentInput) {
  for (const value of [
    input.deploymentRunId,
    input.projectId,
    input.environmentId,
  ]) {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      throw failure(
        "DEPLOYMENT_TARGET_INVALID",
        "Deployment Provider 目标标识无效",
        [],
      );
    }
  }
}

function unsafeEntry(entry: string) {
  const value = normalize(entry.replaceAll("\\", "/"));
  return value.startsWith("/") || value === ".." || value.startsWith("../");
}

function failure(code: string, messageText: string, logs: string[]) {
  return new ReleaseDeploymentProviderError({
    code,
    message: messageText,
    logs: sanitizeBuildLogs(logs),
  });
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
