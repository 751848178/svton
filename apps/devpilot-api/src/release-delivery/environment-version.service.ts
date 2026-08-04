import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { sanitizeBuildLogs } from "./release-build-log.utils";
import { EnvironmentVersionRepository } from "./environment-version.repository";
import { EnvironmentVersionReadRepository } from "./environment-version-read.repository";
import { EnvironmentVersionPolicyService } from "./environment-version-policy.service";
import {
  ReleaseStagingExecutionError,
  ReleaseStagingExecutorPort,
} from "./release-staging.types";

@Injectable()
export class EnvironmentVersionService {
  constructor(
    private readonly repository: EnvironmentVersionRepository,
    private readonly readRepository: EnvironmentVersionReadRepository,
    private readonly policy: EnvironmentVersionPolicyService,
    private readonly executor: ReleaseStagingExecutorPort,
  ) {}

  async list(teamId: string, projectId: string) {
    const [environments, candidates] = await Promise.all([
      this.readRepository.environments(teamId, projectId),
      this.readRepository.candidates(teamId, projectId),
    ]);
    return { environments, candidates };
  }

  async execute(input: {
    teamId: string;
    actorId: string;
    projectId: string;
    environmentId: string;
    kind: "upgrade" | "recovery";
    manifestId?: string;
    sourceVersionId?: string;
    releaseRunId?: string;
  }) {
    const environment = await this.repository.environment(
      input.teamId,
      input.projectId,
      input.environmentId,
    );
    if (!environment)
      throw new NotFoundException("目标环境不存在或不属于当前项目");
    const selection = await this.policy.resolveSelection(
      input,
      environment.currentEnvironmentVersionId,
    );
    const manifest = await this.repository.manifest(
      input.teamId,
      input.projectId,
      selection.manifestId,
    );
    if (!manifest)
      throw new NotFoundException("Manifest 不存在或不属于当前项目");
    const bundle = manifest.items.find(
      (item) => item.componentKey === "project-bundle",
    );
    if (
      manifest.buildRun.status !== "succeeded" ||
      !bundle ||
      bundle.digest !== manifest.digest
    ) {
      throw new UnprocessableEntityException(
        "只能部署成功且 Digest 可验证的项目制品",
      );
    }
    const releaseRunId = await this.policy.validateProduction(
      input,
      environment,
      manifest,
    );
    const run = await this.repository.reserve({
      teamId: input.teamId,
      projectId: input.projectId,
      actorId: input.actorId,
      environmentId: environment.id,
      manifestId: manifest.id,
      releaseOrderId: manifest.releaseOrderId,
      releaseRunId,
      mode: input.kind === "recovery" ? "rollback" : "deploy",
      branch: manifest.buildRun.sourceBranch,
      commitSha: manifest.buildRun.sourceCommitSha,
      params: {
        version: 1,
        environmentVersionKind: input.kind,
        sourceVersionId: selection.sourceVersionId,
        manifestId: manifest.id,
        manifestDigest: manifest.digest,
        releaseRunId,
      },
    });
    try {
      const result = await this.executor.deploy({
        deploymentRunId: run.id,
        projectId: input.projectId,
        releaseOrderId: manifest.releaseOrderId,
        environmentId: environment.id,
        buildRunId: manifest.buildRun.id,
        uri: bundle.uri,
        digest: manifest.digest,
      });
      return this.repository.complete({
        deploymentRunId: run.id,
        status: "completed",
        kind: input.kind,
        logs: sanitizeBuildLogs(result.logs),
        result: {
          ...result.evidence,
          deploymentUri: result.deploymentUri,
          manifestId: manifest.id,
          manifestDigest: manifest.digest,
          sourceVersionId: selection.sourceVersionId,
        },
      });
    } catch (error) {
      const detail = failureDetail(error);
      return this.repository.complete({
        deploymentRunId: run.id,
        status: "failed",
        kind: input.kind,
        logs: detail.logs,
        error: `${detail.code}: ${detail.message}`,
        result: { manifestId: manifest.id, manifestDigest: manifest.digest },
      });
    }
  }
}

function failureDetail(error: unknown) {
  if (error instanceof ReleaseStagingExecutionError) return error.detail;
  return {
    code: "ENVIRONMENT_DEPLOYMENT_FAILED",
    message: "环境制品部署失败",
    logs: sanitizeBuildLogs([
      error instanceof Error ? error.message : String(error),
    ]),
  };
}
