import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { stableHash } from "../release-orchestration/utils/release-hash.utils";
import type { CreateReleasePolicyRevisionDto } from "./dto/release-policy.dto";

export const RELEASE_POLICY_SELECT = {
  id: true,
  revision: true,
  strategy: true,
  requireProductionApproval: true,
  changeWindow: true,
  freezePolicy: true,
  snapshotHash: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class ReleasePolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(teamId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId, archivedAt: null },
      select: {
        id: true,
        currentReleasePolicyRevisionId: true,
        currentReleasePolicyRevision: { select: RELEASE_POLICY_SELECT },
      },
    });
    if (!project) throw new NotFoundException("项目不存在");
    return project.currentReleasePolicyRevision;
  }

  create(
    teamId: string,
    projectId: string,
    actorId: string,
    dto: CreateReleasePolicyRevisionDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM Project
        WHERE id = ${projectId} AND teamId = ${teamId} AND archivedAt IS NULL
        FOR UPDATE
      `);
      if (locked.length === 0) throw new NotFoundException("项目不存在");
      const project = await tx.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { currentReleasePolicyRevisionId: true },
      });
      if (
        dto.expectedCurrentRevisionId !== undefined &&
        dto.expectedCurrentRevisionId !== project.currentReleasePolicyRevisionId
      ) {
        throw new ConflictException("发布策略已更新，请刷新后重试");
      }
      const latest = await tx.releasePolicyRevision.findFirst({
        where: { projectId },
        orderBy: { revision: "desc" },
        select: { revision: true },
      });
      const snapshot = {
        version: 1,
        strategy: dto.strategy,
        requireProductionApproval: dto.requireProductionApproval ?? true,
        changeWindow: null,
        freezePolicy: null,
      };
      const revision = await tx.releasePolicyRevision.create({
        data: {
          teamId,
          projectId,
          createdById: actorId,
          revision: (latest?.revision ?? 0) + 1,
          strategy: snapshot.strategy,
          requireProductionApproval: snapshot.requireProductionApproval,
          snapshotHash: stableHash({ scope: "release-policy", snapshot }),
        },
        select: RELEASE_POLICY_SELECT,
      });
      await tx.project.update({
        where: { id: projectId },
        data: { currentReleasePolicyRevisionId: revision.id },
      });
      await tx.auditEvent.create({
        data: {
          teamId,
          actorId,
          projectId,
          category: "release",
          action: "project.release_policy.revision.create",
          targetType: "release_policy_revision",
          targetId: revision.id,
          risk: "medium",
          status: "completed",
          summary: `发布策略修订 R${revision.revision}：${revision.strategy}`,
          metadata: {
            immutable: true,
            snapshotHash: revision.snapshotHash,
            strategy: revision.strategy,
            requireProductionApproval: revision.requireProductionApproval,
          } as Prisma.InputJsonValue,
        },
      });
      return revision;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

