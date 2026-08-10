import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { identityConflict } from "./repository-identity.errors";
import { assertIdentityCandidate } from "./repository-identity-policy.utils";
import type {
  RepositoryIdentityTransaction,
  RepositoryIdentityState,
  SaveFailedConnectionInput,
  SaveVerifiedConnectionInput,
} from "./repository-identity.types";
import { normalizeRepositoryIdentity } from "./repository-identity.utils";
import { RepositoryIdentityCoordinatorService } from "./repository-identity-coordinator.service";

@Injectable()
export class RepositoryIdentityConnectionRepository {
  constructor(private readonly coordinator: RepositoryIdentityCoordinatorService) {}

  saveVerified(
    input: SaveVerifiedConnectionInput,
    prepareCredentials?: (tx: RepositoryIdentityTransaction) => Promise<{
      source: string;
      gitConnectionId?: string;
      teamCredentialId?: string;
    }>,
  ) {
    return this.coordinator.run(input.teamId, input.projectId, async (tx) => {
      const project = await this.lockedProject(tx, input.teamId, input.projectId);
      await this.assertNoDuplicate(tx, input);
      if (project.repositoryAnalysisRuns.length) throw activeAnalysis();
      if (project.onboardingStatus === "ready" && !project.repositoryIdentity?.currentRevision) {
        throw identityConflict(
          "PROJECT_REPOSITORY_IDENTITY_MIGRATION_REQUIRED",
          "READY 项目缺少可验证的仓库身份修订",
          "请先完成仓库身份迁移，再修改连接。",
        );
      }
      if (project.repositoryIdentity) {
        assertIdentityCandidate(project.repositoryIdentity, {
          repositoryUrl: input.repositoryUrl,
          provider: input.provider,
          branch: input.selectedBranch,
        });
      }
      const existing = project.repositoryConnection;
      const sameSnapshot = existing?.repositoryUrl === input.repositoryUrl
        && existing.selectedBranch === input.selectedBranch
        && existing.commitSha === input.commitSha;
      const stored = prepareCredentials ? await prepareCredentials(tx) : {
        source: input.credentialSource,
        gitConnectionId: input.gitConnectionId,
        teamCredentialId: input.teamCredentialId,
      };
      const data: Prisma.RepositoryConnectionUncheckedCreateInput = {
        ...input,
        connectedById: input.userId,
        credentialSource: stored.source,
        gitConnectionId: stored.gitConnectionId ?? null,
        teamCredentialId: stored.teamCredentialId ?? null,
        branches: input.branches,
        status: "connected",
        verifiedAt: new Date(),
        lastAppliedRunId: sameSnapshot ? existing?.lastAppliedRunId : null,
        appliedAt: sameSnapshot ? existing?.appliedAt : null,
        errorCode: null,
        errorMessage: null,
      };
      delete (data as { userId?: string }).userId;
      return tx.repositoryConnection.upsert({
        where: { projectId: input.projectId },
        create: data,
        update: data,
      });
    });
  }

  saveFailureIfUnlocked(input: SaveFailedConnectionInput) {
    return this.coordinator.run(input.teamId, input.projectId, async (tx) => {
      const project = await this.lockedProject(tx, input.teamId, input.projectId);
      if (project.onboardingStatus === "ready"
        || project.repositoryIdentity
        || project.repositoryAnalysisRuns.length) return null;
      const data: Prisma.RepositoryConnectionUncheckedCreateInput = {
        teamId: input.teamId,
        projectId: input.projectId,
        connectedById: input.userId,
        repositoryUrl: input.repositoryUrl,
        provider: input.provider,
        visibility: input.visibility,
        credentialSource: input.credentialSource,
        gitConnectionId: input.gitConnectionId ?? null,
        teamCredentialId: input.teamCredentialId ?? null,
        selectedBranch: input.selectedBranch ?? null,
        status: "failed",
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      };
      return tx.repositoryConnection.upsert({
        where: { projectId: input.projectId },
        create: data,
        update: data,
      });
    });
  }

  private lockedProject(tx: Prisma.TransactionClient, teamId: string, projectId: string) {
    return tx.project.findFirstOrThrow({
      where: { id: projectId, teamId },
      select: {
        onboardingStatus: true,
        repositoryConnection: true,
        repositoryIdentity: {
          select: {
            id: true, projectId: true, provider: true, canonicalKey: true, canonicalUrl: true, lockedAt: true,
            currentRevision: {
              select: {
                id: true, revision: true, defaultBranch: true, reason: true, createdAt: true,
                identityId: true, projectId: true,
              },
            },
          },
        },
        repositoryAnalysisRuns: {
          where: { status: { in: ["queued", "running"] } },
          take: 1,
          select: { id: true },
        },
      },
    }) as Promise<{
      repositoryConnection: Prisma.RepositoryConnectionGetPayload<Record<string, never>> | null;
      onboardingStatus: string | null;
      repositoryIdentity: RepositoryIdentityState | null;
      repositoryAnalysisRuns: Array<{ id: string }>;
    }>;
  }

  private async assertNoDuplicate(
    tx: Prisma.TransactionClient,
    input: SaveVerifiedConnectionInput,
  ) {
    const normalized = normalizeRepositoryIdentity(input.repositoryUrl);
    if (!normalized) return;
    const identity = await tx.projectRepositoryIdentity.findFirst({
      where: { teamId: input.teamId, canonicalKey: normalized.canonicalKey, projectId: { not: input.projectId } },
      select: { id: true },
    });
    const connections = await tx.repositoryConnection.findMany({
      where: { teamId: input.teamId, projectId: { not: input.projectId } },
      select: { repositoryUrl: true },
    });
    if (identity || connections.some((item) =>
      normalizeRepositoryIdentity(item.repositoryUrl)?.canonicalKey === normalized.canonicalKey)) {
      throw identityConflict(
        "PROJECT_REPOSITORY_DUPLICATE",
        "该仓库已由当前团队的其他项目纳管",
        "请打开已有项目，或选择不同的仓库。",
      );
    }
  }
}

function activeAnalysis() {
  return identityConflict(
    "REPOSITORY_ANALYSIS_ACTIVE",
    "当前项目已有解析正在进行",
    "请等待当前运行结束或先取消，再修改仓库连接。",
  );
}
