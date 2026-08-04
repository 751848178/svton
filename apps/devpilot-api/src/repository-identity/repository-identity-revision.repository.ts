import { Injectable } from "@nestjs/common";
import { identityConflict, identityUnavailable } from "./repository-identity.errors";
import {
  assertIdentityCandidate,
  assertStoredConnection,
} from "./repository-identity-policy.utils";
import { RepositoryIdentityCoordinatorService } from "./repository-identity-coordinator.service";

interface AppendRevisionInput {
  teamId: string;
  projectId: string;
  actorId: string;
  branch: string;
  commitSha: string;
  reason: string;
  expectedRevision: number;
  idempotencyKey: string;
  repositoryUrl: string;
  provider: string;
}

@Injectable()
export class RepositoryIdentityRevisionRepository {
  constructor(private readonly coordinator: RepositoryIdentityCoordinatorService) {}

  async findReplay(input: Pick<
    AppendRevisionInput,
    "teamId" | "projectId" | "branch" | "reason" | "expectedRevision" | "idempotencyKey"
  >) {
    const replay = await this.coordinator.run(input.teamId, input.projectId, (tx) =>
      tx.projectRepositoryIdentityRevision.findFirst({
        where: {
          teamId: input.teamId,
          projectId: input.projectId,
          idempotencyKey: input.idempotencyKey,
        },
        include: { identity: { include: { currentRevision: true } } },
      }));
    return replay ? this.replay(replay, input, replay.identity) : null;
  }

  append(input: AppendRevisionInput) {
    return this.coordinator.run(input.teamId, input.projectId, async (tx) => {
      const project = await tx.project.findFirstOrThrow({
        where: { id: input.projectId, teamId: input.teamId },
        select: {
          repositoryIdentity: {
            include: { currentRevision: true },
          },
          repositoryConnection: true,
          repositoryAnalysisRuns: {
            where: { status: { in: ["queued", "running"] } },
            take: 1,
            select: { id: true },
          },
        },
      });
      const identity = project.repositoryIdentity;
      if (!identity || !identity.currentRevision) throw identityUnavailable(
        "PROJECT_REPOSITORY_IDENTITY_NOT_READY",
        "项目规范仓库身份尚未准备完成",
        "请完成仓库接入或处理身份迁移后重试。",
      );
      const replay = await tx.projectRepositoryIdentityRevision.findUnique({
        where: {
          projectId_idempotencyKey: {
            projectId: input.projectId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (replay) return this.replay(replay, input, identity);
      if (project.repositoryAnalysisRuns.length) throw identityConflict(
        "REPOSITORY_ANALYSIS_ACTIVE",
        "活跃仓库解析期间不能修订默认分支",
        "请等待解析结束或取消运行后重试。",
      );
      assertStoredConnection(identity, project.repositoryConnection);
      assertIdentityCandidate(identity, input, true);
      if (identity.currentRevision.revision !== input.expectedRevision) {
        throw staleRevision(identity.currentRevision.revision);
      }
      const revision = await tx.projectRepositoryIdentityRevision.create({
        data: {
          teamId: input.teamId,
          projectId: input.projectId,
          identityId: identity.id,
          createdById: input.actorId,
          revision: input.expectedRevision + 1,
          expectedRevision: input.expectedRevision,
          defaultBranch: input.branch,
          verifiedCommitSha: input.commitSha,
          reason: input.reason,
          idempotencyKey: input.idempotencyKey,
        },
      });
      const advanced = await tx.projectRepositoryIdentity.updateMany({
        where: { id: identity.id, currentRevisionId: identity.currentRevision.id },
        data: { currentRevisionId: revision.id },
      });
      if (advanced.count !== 1) throw staleRevision(input.expectedRevision);
      await tx.repositoryConnection.update({
        where: { projectId: input.projectId },
        data: {
          defaultBranch: input.branch,
          selectedBranch: input.branch,
          commitSha: input.commitSha,
          verifiedAt: new Date(),
          lastAppliedRunId: null,
          appliedAt: null,
        },
      });
      await tx.auditEvent.create({
        data: {
          teamId: input.teamId,
          actorId: input.actorId,
          projectId: input.projectId,
          category: "repository_analysis",
          action: "project.repository_identity.branch.revise",
          targetType: "repository_identity",
          targetId: identity.id,
          risk: "high",
          status: "completed",
          summary: `仓库默认分支已修订为 ${revision.defaultBranch}`,
          metadata: {
            identityId: identity.id,
            canonicalKey: identity.canonicalKey,
            previousRevisionId: identity.currentRevision.id,
            revisionId: revision.id,
            revision: revision.revision,
            branch: revision.defaultBranch,
            commitSha: input.commitSha,
          },
        },
      });
      return { identity, previousRevision: identity.currentRevision, revision, replayed: false };
    });
  }

  private replay<T extends {
    expectedRevision: number;
    defaultBranch: string;
    reason: string;
    verifiedCommitSha: string;
  }>(
    replay: T,
    input: Pick<AppendRevisionInput, "expectedRevision" | "branch" | "reason">,
    identity: { id: string; currentRevision: unknown },
  ) {
    if (
      replay.expectedRevision !== input.expectedRevision
      || replay.defaultBranch !== input.branch
      || replay.reason !== input.reason
    ) {
      throw identityConflict(
        "PROJECT_REPOSITORY_REVISION_IDEMPOTENCY_CONFLICT",
        "该幂等键已用于不同的分支修订请求",
        "请恢复原请求，或使用新的幂等键。",
      );
    }
    return { identity, previousRevision: null, revision: replay, replayed: true };
  }
}

function staleRevision(current: number) {
  return identityConflict(
    "PROJECT_REPOSITORY_REVISION_STALE",
    `仓库分支修订已更新，当前版本为 R${current}`,
    "请刷新设置页，基于最新修订重新提交。",
  );
}
