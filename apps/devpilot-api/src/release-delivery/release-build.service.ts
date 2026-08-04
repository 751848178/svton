import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { RepositoryGitError } from "../repository-analysis/repository-git-error.utils";
import { RepositoryGitExecutorService } from "../repository-analysis/repository-git-executor.service";
import { redactRepositoryText } from "../repository-analysis/repository-analysis-redact.utils";
import { buildComponents } from "./release-build-config.utils";
import { ReleaseBuildExecutionError } from "./release-build-execution.error";
import {
  buildLogReference,
  buildLogSummary,
  sanitizeBuildLogs,
} from "./release-build-log.utils";
import { ReleaseBuildRepository } from "./release-build.repository";
import { ReleaseBuildResultRepository } from "./release-build-result.repository";
import { presentBuild } from "./release-build.presenter";
import { ReleaseBuildSourceResolverService } from "./release-build-source-resolver.service";
import {
  ReleaseBuildExecutorPort,
  ReleaseBuildFailure,
  ReleaseBuildInputSnapshot,
} from "./release-build.types";

@Injectable()
export class ReleaseBuildService {
  constructor(
    private readonly repository: ReleaseBuildRepository,
    private readonly results: ReleaseBuildResultRepository,
    private readonly git: RepositoryGitExecutorService,
    private readonly sources: ReleaseBuildSourceResolverService,
    private readonly executor: ReleaseBuildExecutorPort,
  ) {}

  async list(teamId: string, projectId: string, releaseOrderId: string) {
    await this.requireContext(teamId, projectId, releaseOrderId);
    const items = await this.repository.list(teamId, projectId, releaseOrderId);
    return { items: items.map(presentBuild), total: items.length };
  }

  async build(
    teamId: string,
    actorId: string,
    projectId: string,
    releaseOrderId: string,
  ) {
    const source = await this.sources.resolve(teamId, projectId, releaseOrderId);
    const snapshot: ReleaseBuildInputSnapshot = {
      version: 2,
      repositoryUrl: safeRepositoryUrl(source.connection.repositoryUrl),
      repositoryIdentity: {
        id: source.identity.id,
        revisionId: source.identity.revisionId,
        revision: source.identity.revision,
        provider: source.identity.provider,
        canonicalUrl: source.identity.canonicalUrl,
      },
      sourceBranch: source.identity.branch,
      sourceCommitSha: source.commitSha,
      components: buildComponents(source.context.project.applications),
    };
    const buildRun = await this.repository.reserve({
      teamId,
      actorId,
      projectId,
      releaseOrderId,
      snapshot,
      inputHash: hashSnapshot(snapshot),
      expectedCanonicalKey: source.identity.canonicalKey,
    });
    let checkout: { root: string; cleanup: () => Promise<void> } | undefined;
    try {
      checkout = await this.git.checkout(
        source.connection.repositoryUrl,
        source.identity.branch,
        source.commitSha,
        source.credential,
      );
      const result = await this.executor.execute({
        buildRunId: buildRun.id,
        projectId,
        releaseOrderId,
        checkoutRoot: checkout.root,
        components: snapshot.components,
      });
      return presentBuild(await this.results.succeed({
        buildRunId: buildRun.id,
        teamId,
        projectId,
        releaseOrderId,
        digest: result.artifact.digest,
        uri: result.artifact.uri,
        sizeBytes: result.artifact.sizeBytes,
        sourceBranch: buildRun.sourceBranch,
        sourceCommitSha: buildRun.sourceCommitSha,
        inputHash: buildRun.inputHash,
        repositoryIdentityId: source.identity.id,
        repositoryIdentityRevisionId: source.identity.revisionId,
        repositoryProvider: source.identity.provider,
        canonicalRepositoryUrl: source.identity.canonicalUrl,
        logReference: buildLogReference(buildRun.id),
        logSummary: buildLogSummary(result.logs),
        gateSummary: result.gateSummary,
      }));
    } catch (error) {
      const detail = failureDetail(error);
      return presentBuild(await this.results.fail({
        buildRunId: buildRun.id,
        code: detail.code,
        message: detail.message,
        logReference: buildLogReference(buildRun.id),
        logSummary: buildLogSummary(detail.logs),
        gateSummary: detail.gateSummary,
      }));
    } finally {
      if (checkout) await checkout.cleanup();
    }
  }

  private async requireContext(
    teamId: string,
    projectId: string,
    releaseOrderId: string,
  ) {
    const context = await this.repository.context(teamId, projectId, releaseOrderId);
    if (!context) throw new NotFoundException("发布单不存在或不属于当前项目");
    return context;
  }
}

function hashSnapshot(snapshot: ReleaseBuildInputSnapshot) {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

function safeRepositoryUrl(value: string) {
  return redactRepositoryText(value);
}

function failureDetail(error: unknown): ReleaseBuildFailure {
  if (error instanceof ReleaseBuildExecutionError) return error.detail;
  if (error instanceof RepositoryGitError) {
    return {
      code: error.detail.code,
      message: error.detail.message,
      logs: [],
      gateSummary: { source: { status: "failed" }, action: error.detail.action },
    };
  }
  return {
    code: "BUILD_EXECUTION_FAILED",
    message: "构建执行失败",
    logs: sanitizeBuildLogs([error instanceof Error ? error.message : String(error)]),
    gateSummary: { build: { status: "failed" }, action: "请检查运行证据后重试。" },
  };
}
