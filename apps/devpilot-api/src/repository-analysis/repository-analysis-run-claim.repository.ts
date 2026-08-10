import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { RepositoryIdentityCoordinatorService } from "../repository-identity/repository-identity-coordinator.service";
import {
  assertIdentityCandidate,
  assertStoredConnection,
} from "../repository-identity/repository-identity-policy.utils";
import { normalizeRepositoryIdentity } from "../repository-identity/repository-identity.utils";
import { REPOSITORY_ANALYSIS_STAGES } from "./repository-analysis.constants";
import { repositoryError } from "./repository-analysis-validation.utils";

interface StartClaimInput {
  teamId: string;
  projectId: string;
  triggeredById: string;
  branch?: string;
  idempotencyKey: string;
  parserVersion: string;
}

interface RetryClaimInput {
  teamId: string;
  projectId: string;
  triggeredById: string;
  retryOfId: string;
  connectionId: string;
  repositoryUrl: string;
  branch: string;
  commitSha: string;
  idempotencyKey: string;
  parserVersion: string;
}

const runInclude = {
  stages: { orderBy: { ordinal: "asc" as const } },
  suggestions: { orderBy: { createdAt: "asc" as const } },
};

@Injectable()
export class RepositoryAnalysisRunClaimRepository {
  constructor(private readonly coordinator: RepositoryIdentityCoordinatorService) {}

  start(input: StartClaimInput) {
    return this.coordinator.run(input.teamId, input.projectId, async (tx) => {
      const replay = await tx.repositoryAnalysisRun.findUnique({
        where: {
          projectId_idempotencyKey: {
            projectId: input.projectId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: runInclude,
      });
      if (replay) return { run: replay, replayed: true };
      const project = await tx.project.findFirstOrThrow({
        where: { id: input.projectId, teamId: input.teamId },
        select: {
          onboardingStatus: true,
          repositoryConnection: true,
          repositoryIdentity: { include: { currentRevision: true } },
          repositoryAnalysisRuns: {
            where: { status: { in: ["queued", "running"] } },
            take: 1,
            select: { id: true },
          },
        },
      });
      const connection = project.repositoryConnection;
      if (project.onboardingStatus === "ready"
        && !project.repositoryIdentity?.currentRevision) throw migrationRequired();
      if (!connection || !connection.selectedBranch || !connection.commitSha) {
        throw notConnected();
      }
      if (project.repositoryIdentity) {
        assertStoredConnection(project.repositoryIdentity, connection);
      }
      if (input.branch && input.branch !== connection.selectedBranch) {
        throw new BadRequestException(repositoryError(
          "REPOSITORY_BRANCH_NOT_CONNECTED",
          "所选分支尚未验证",
          "请重新连接仓库并选择该真实分支。",
        ));
      }
      if (project.repositoryAnalysisRuns.length) throw activeAnalysis();
      const run = await tx.repositoryAnalysisRun.create({
        data: {
          teamId: input.teamId,
          projectId: input.projectId,
          connectionId: connection.id,
          triggeredById: input.triggeredById,
          repositoryUrl: connection.repositoryUrl,
          branch: connection.selectedBranch,
          commitSha: connection.commitSha,
          idempotencyKey: input.idempotencyKey,
          parserVersion: input.parserVersion,
          status: "queued",
          activeKey: "active",
          stages: { create: stageRows() },
        },
        include: runInclude,
      });
      return { run, replayed: false };
    });
  }

  retry(input: RetryClaimInput) {
    return this.coordinator.run(input.teamId, input.projectId, async (tx) => {
      const project = await tx.project.findFirstOrThrow({
        where: { id: input.projectId, teamId: input.teamId },
        select: {
          onboardingStatus: true,
          repositoryConnection: true,
          repositoryIdentity: { include: { currentRevision: true } },
        },
      });
      if (project.onboardingStatus === "ready"
        && !project.repositoryIdentity?.currentRevision) throw migrationRequired();
      if (project.repositoryIdentity) {
        const normalized = normalizeRepositoryIdentity(input.repositoryUrl);
        assertStoredConnection(project.repositoryIdentity, project.repositoryConnection);
        if (!normalized || project.repositoryConnection?.id !== input.connectionId) {
          throw retryDrift();
        }
        assertIdentityCandidate(project.repositoryIdentity, {
          repositoryUrl: input.repositoryUrl,
          provider: normalized.provider,
          branch: input.branch,
        });
      }
      const active = await tx.repositoryAnalysisRun.findFirst({
        where: {
          teamId: input.teamId,
          projectId: input.projectId,
          status: { in: ["queued", "running"] },
        },
        select: { id: true },
      });
      if (active) throw activeAnalysis();
      return tx.repositoryAnalysisRun.create({
        data: {
          ...input,
          status: "queued",
          activeKey: "active",
          stages: { create: stageRows() },
        },
        include: runInclude,
      });
    });
  }
}

function stageRows() {
  return REPOSITORY_ANALYSIS_STAGES.map((name, ordinal) => ({
    name,
    ordinal,
    status: "queued",
  }));
}

function notConnected() {
  return new BadRequestException(repositoryError(
    "REPOSITORY_NOT_CONNECTED",
    "项目尚未连接并验证仓库",
    "请先完成“连接并解析仓库”中的仓库连接步骤。",
  ));
}

function activeAnalysis() {
  return new ConflictException(repositoryError(
    "REPOSITORY_ANALYSIS_ACTIVE",
    "当前项目已有解析正在进行",
    "请查看当前运行，避免重复点击；需要时可先取消。",
  ));
}

function retryDrift() {
  return new ConflictException(repositoryError(
    "REPOSITORY_RETRY_SOURCE_DRIFT",
    "原解析运行不再属于当前生效仓库身份",
    "请基于当前规范仓库和分支发起新的解析。",
  ));
}

function migrationRequired() {
  return new ConflictException(repositoryError(
    "PROJECT_REPOSITORY_IDENTITY_MIGRATION_REQUIRED",
    "READY 项目缺少可验证的仓库身份修订",
    "请先完成仓库身份迁移，再发起解析。",
  ));
}
