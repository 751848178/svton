import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { assertStoredConnection } from "../repository-identity/repository-identity-policy.utils";
import { identityConflict } from "../repository-identity/repository-identity.errors";
import type { ReleaseBuildInputSnapshot } from "./release-build.types";
import { releaseBuildInclude } from "./release-build.prisma";
import { lockActionableReleaseOrder } from "./release-order-action-boundary";
import { claimReleaseGateDecision } from "./release-gate-decision.repository";
import { assertBuildGateDecisionCurrent } from "./release-build-gate-final-validation.repository";

@Injectable()
export class ReleaseBuildRepository {
  constructor(private readonly prisma: PrismaService) {}

  context(teamId: string, projectId: string, releaseOrderId: string) {
    return this.prisma.releaseOrder.findFirst({
      where: { id: releaseOrderId, teamId, projectId },
      select: {
        id: true,
        project: {
          select: {
            repositoryConnection: true,
            applications: {
              where: { status: "active" },
              orderBy: { id: "asc" },
              select: {
                id: true,
                name: true,
                repoPath: true,
                services: {
                  where: { status: "active" },
                  orderBy: { id: "asc" },
                  select: {
                    id: true,
                    releaseComponentKey: true,
                    name: true,
                    deployConfig: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async list(
    teamId: string,
    projectId: string,
    releaseOrderId: string,
    take?: number,
  ) {
    const where = { teamId, projectId, releaseOrderId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.buildRun.findMany({
        where,
        select: {
          id: true,
          releaseOrderId: true,
          revision: true,
          sourceBranch: true,
          sourceCommitSha: true,
          status: true,
          errorCode: true,
          errorMessage: true,
          startedAt: true,
          finishedAt: true,
          createdAt: true,
          manifest: { select: { id: true, digest: true } },
        },
        orderBy: [{ revision: "desc" }, { id: "desc" }],
        take,
      }),
      this.prisma.buildRun.count({ where }),
    ]);
    return { items, total };
  }

  get(
    teamId: string,
    projectId: string,
    releaseOrderId: string,
    buildRunId: string,
  ) {
    return this.prisma.buildRun.findFirst({
      where: { id: buildRunId, teamId, projectId, releaseOrderId },
      include: releaseBuildInclude,
    });
  }

  reserve(input: {
    teamId: string;
    projectId: string;
    releaseOrderId: string;
    actorId: string;
    snapshot: ReleaseBuildInputSnapshot;
    inputHash: string;
    expectedCanonicalKey: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await lockActionableReleaseOrder(tx, input);
      if (!input.snapshot.gateDecision) {
        throw new ConflictException("BuildRun 预留缺少已允许的门禁决定");
      }
      await tx.$queryRaw`SELECT id FROM Project WHERE id = ${input.projectId} FOR UPDATE`;
      const project = await tx.project.findUniqueOrThrow({
        where: { id: input.projectId },
        select: {
          repositoryIdentity: { include: { currentRevision: true } },
          repositoryConnection: true,
        },
      });
      const expected = input.snapshot.repositoryIdentity;
      if (
        !project.repositoryIdentity ||
        project.repositoryIdentity.id !== expected.id ||
        project.repositoryIdentity.currentRevisionId !== expected.revisionId ||
        project.repositoryIdentity.canonicalKey !==
          input.expectedCanonicalKey ||
        project.repositoryIdentity.provider !== expected.provider ||
        project.repositoryIdentity.canonicalUrl !== expected.canonicalUrl ||
        project.repositoryIdentity.currentRevision?.revision !==
          expected.revision ||
        project.repositoryIdentity.currentRevision?.defaultBranch !==
          input.snapshot.sourceBranch ||
        project.repositoryIdentity.currentRevision?.identityId !==
          expected.id ||
        project.repositoryIdentity.currentRevision?.projectId !==
          input.projectId
      ) {
        throw identityConflict(
          "PROJECT_REPOSITORY_BUILD_SOURCE_DRIFT",
          "构建来源在提交 BuildRun 前已发生变化",
          "请刷新发布单并基于当前仓库修订重新构建。",
        );
      }
      assertStoredConnection(
        project.repositoryIdentity,
        project.repositoryConnection,
      );
      await assertBuildGateDecisionCurrent(tx, input);
      const latest = await tx.buildRun.findFirst({
        where: { releaseOrderId: input.releaseOrderId },
        orderBy: { revision: "desc" },
        select: { revision: true },
      });
      const run = await tx.buildRun.create({
        data: {
          teamId: input.teamId,
          projectId: input.projectId,
          releaseOrderId: input.releaseOrderId,
          triggeredById: input.actorId,
          repositoryIdentityId: expected.id,
          repositoryIdentityRevisionId: expected.revisionId,
          revision: (latest?.revision || 0) + 1,
          sourceBranch: input.snapshot.sourceBranch,
          sourceCommitSha: input.snapshot.sourceCommitSha,
          inputSnapshot: input.snapshot as unknown as Prisma.InputJsonValue,
          inputHash: input.inputHash,
          status: "running",
          startedAt: new Date(),
        },
        include: releaseBuildInclude,
      });
      await claimReleaseGateDecision(tx, {
        teamId: input.teamId,
        projectId: input.projectId,
        releaseOrderId: input.releaseOrderId,
        actorId: input.actorId,
        decisionId: input.snapshot.gateDecision.id,
        stage: input.snapshot.gateDecision.stage,
        inputHash: input.snapshot.gateDecision.inputHash,
        actionRunType: "build_run",
        actionRunId: run.id,
        requireAllowed: true,
      });
      return run;
    });
  }
}
