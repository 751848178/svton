import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { RepositoryCredentialService } from "../repository-analysis/repository-credential.service";
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
import {
  ReleaseBuildExecutorPort,
  ReleaseBuildFailure,
  ReleaseBuildInputSnapshot,
} from "./release-build.types";

@Injectable()
export class ReleaseBuildService {
  constructor(
    private readonly repository: ReleaseBuildRepository,
    private readonly credentials: RepositoryCredentialService,
    private readonly git: RepositoryGitExecutorService,
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
    const context = await this.requireContext(teamId, projectId, releaseOrderId);
    const connection = context.project.repositoryConnection;
    if (!connection || connection.status !== "connected" || !connection.defaultBranch) {
      throw new UnprocessableEntityException("项目主分支仓库连接尚未就绪");
    }
    const credential = await this.credentials.resolveStored(connection);
    const ref = await this.git.resolveRef(
      connection.repositoryUrl,
      connection.defaultBranch,
      credential,
    );
    const snapshot: ReleaseBuildInputSnapshot = {
      version: 1,
      repositoryUrl: safeRepositoryUrl(connection.repositoryUrl),
      sourceBranch: ref.selectedBranch,
      sourceCommitSha: ref.commitSha,
      components: buildComponents(context.project.applications),
    };
    const buildRun = await this.repository.reserve({
      teamId,
      actorId,
      projectId,
      releaseOrderId,
      snapshot,
      inputHash: hashSnapshot(snapshot),
    });
    let checkout: { root: string; cleanup: () => Promise<void> } | undefined;
    try {
      checkout = await this.git.checkout(
        connection.repositoryUrl,
        ref.selectedBranch,
        ref.commitSha,
        credential,
      );
      const result = await this.executor.execute({
        buildRunId: buildRun.id,
        projectId,
        releaseOrderId,
        checkoutRoot: checkout.root,
        components: snapshot.components,
      });
      return presentBuild(await this.repository.succeed({
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
        logReference: buildLogReference(buildRun.id),
        logSummary: buildLogSummary(result.logs),
        gateSummary: result.gateSummary,
      }));
    } catch (error) {
      const detail = failureDetail(error);
      return presentBuild(await this.repository.fail({
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

interface BuildRecord {
  id: string;
  releaseOrderId: string;
  revision: number;
  sourceBranch: string;
  sourceCommitSha: string;
  status: string;
  inputHash: string;
  logReference: string | null;
  logSummary: unknown;
  gateSummary: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  manifest: unknown;
}

function presentBuild(run: BuildRecord) {
  return {
    id: run.id,
    releaseOrderId: run.releaseOrderId,
    revision: run.revision,
    sourceBranch: run.sourceBranch,
    sourceCommitSha: run.sourceCommitSha,
    status: run.status,
    inputHash: run.inputHash,
    logReference: run.logReference,
    logSummary: run.logSummary,
    gateSummary: run.gateSummary,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    createdAt: run.createdAt,
    manifest: run.manifest,
  };
}
