import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { sanitizeBuildLogs } from "./release-build-log.utils";
import { ReleaseStagingRepository } from "./release-staging.repository";
import {
  ReleaseStagingExecutionError,
  ReleaseStagingExecutorPort,
} from "./release-staging.types";

@Injectable()
export class ReleaseStagingService {
  constructor(
    private readonly repository: ReleaseStagingRepository,
    private readonly executor: ReleaseStagingExecutorPort,
  ) {}

  async list(teamId: string, projectId: string, releaseOrderId: string) {
    await this.requireContext(teamId, projectId, releaseOrderId);
    const items = await this.repository.list(teamId, projectId, releaseOrderId);
    return { items, total: items.length };
  }

  async deploy(input: {
    teamId: string;
    actorId: string;
    projectId: string;
    releaseOrderId: string;
    manifestId: string;
  }) {
    const context = await this.requireContext(
      input.teamId,
      input.projectId,
      input.releaseOrderId,
    );
    if (context.project.environments.length !== 1) {
      throw new UnprocessableEntityException(
        "项目必须有且仅有一个活动 Staging 基线",
      );
    }
    const manifest = await this.repository.manifest(
      input.teamId,
      input.projectId,
      input.releaseOrderId,
      input.manifestId,
    );
    if (!manifest)
      throw new NotFoundException("Manifest 不存在或不属于当前发布单");
    if (manifest.buildRun.status !== "succeeded") {
      throw new UnprocessableEntityException(
        "只有成功 BuildRun 的 Manifest 可以部署",
      );
    }
    const item = manifest.items.find(
      (candidate) => candidate.componentKey === "project-bundle",
    );
    if (!item || item.digest !== manifest.digest) {
      throw new UnprocessableEntityException("Manifest 缺少可验证的项目制品");
    }
    const environment = context.project.environments[0];
    const run = await this.repository.create({
      teamId: input.teamId,
      actorId: input.actorId,
      projectId: input.projectId,
      releaseOrderId: input.releaseOrderId,
      environmentId: environment.id,
      manifestId: manifest.id,
      sourceBranch: manifest.buildRun.sourceBranch,
      sourceCommitSha: manifest.buildRun.sourceCommitSha,
      params: {
        version: 1,
        releaseOrderId: input.releaseOrderId,
        manifestId: manifest.id,
        manifestDigest: manifest.digest,
        buildRunId: manifest.buildRun.id,
        environmentId: environment.id,
      },
    });
    try {
      const result = await this.executor.deploy({
        deploymentRunId: run.id,
        projectId: input.projectId,
        releaseOrderId: input.releaseOrderId,
        environmentId: environment.id,
        buildRunId: manifest.buildRun.id,
        uri: item.uri,
        digest: manifest.digest,
      });
      return this.repository.finish({
        deploymentRunId: run.id,
        status: "completed",
        logs: sanitizeBuildLogs(result.logs),
        result: {
          ...result.evidence,
          deploymentUri: result.deploymentUri,
          manifestId: manifest.id,
          manifestDigest: manifest.digest,
        },
      });
    } catch (error) {
      const detail = failureDetail(error);
      return this.repository.finish({
        deploymentRunId: run.id,
        status: "failed",
        logs: detail.logs,
        error: `${detail.code}: ${detail.message}`,
        result: { manifestId: manifest.id, manifestDigest: manifest.digest },
      });
    }
  }

  private async requireContext(
    teamId: string,
    projectId: string,
    releaseOrderId: string,
  ) {
    const context = await this.repository.context(
      teamId,
      projectId,
      releaseOrderId,
    );
    if (!context) throw new NotFoundException("发布单不存在或不属于当前项目");
    return context;
  }
}

function failureDetail(error: unknown) {
  if (error instanceof ReleaseStagingExecutionError) return error.detail;
  return {
    code: "STAGING_DEPLOYMENT_FAILED",
    message: "Staging 制品部署失败",
    logs: sanitizeBuildLogs([
      error instanceof Error ? error.message : String(error),
    ]),
  };
}
