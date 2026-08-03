import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateEnvironmentConfigRevisionDto } from "./dto/environment-config-revision.dto";
import { EnvironmentConfigReferenceResolverService } from "./environment-config-reference-resolver.service";
import { hashEnvironmentConfigSnapshot } from "./environment-config-revision.utils";

const REVISION_SELECT = {
  id: true, revision: true, snapshotHash: true, plainVariables: true,
  secretReferences: true, resourceReferences: true, routeSnapshot: true,
  policyReferences: true, source: true, createdAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class EnvironmentConfigRevisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: EnvironmentConfigReferenceResolverService,
  ) {}

  async list(teamId: string, environmentId: string) {
    const environment = await this.prisma.projectEnvironment.findFirst({
      where: { id: environmentId, teamId },
      select: { id: true, currentConfigRevisionId: true },
    });
    if (!environment) throw new NotFoundException("项目环境不存在");
    const revisions = await this.prisma.environmentConfigRevision.findMany({
      where: { teamId, environmentId }, orderBy: { revision: "desc" },
      select: REVISION_SELECT,
    });
    return {
      environmentId,
      currentConfigRevisionId: environment.currentConfigRevisionId,
      revisions: revisions.map((revision) => ({
        ...revision,
        current: revision.id === environment.currentConfigRevisionId,
      })),
    };
  }

  create(
    teamId: string,
    actorId: string,
    environmentId: string,
    dto: CreateEnvironmentConfigRevisionDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM ProjectEnvironment
        WHERE id = ${environmentId} AND teamId = ${teamId}
        FOR UPDATE
      `);
      if (locked.length === 0) throw new NotFoundException("项目环境不存在");
      const environment = await tx.projectEnvironment.findUniqueOrThrow({
        where: { id: environmentId },
        select: {
          id: true, teamId: true, projectId: true, name: true, config: true,
          currentConfigRevisionId: true,
          currentConfigRevision: { select: REVISION_SELECT },
        },
      });
      if (
        dto.expectedCurrentRevisionId !== undefined &&
        dto.expectedCurrentRevisionId !== environment.currentConfigRevisionId
      ) {
        throw new ConflictException("环境配置已更新，请刷新后重试");
      }
      const snapshot = await this.resolver.resolve(
        tx, environment, dto, environment.currentConfigRevision,
      );
      const latest = await tx.environmentConfigRevision.findFirst({
        where: { environmentId }, orderBy: { revision: "desc" },
        select: { revision: true },
      });
      const revision = await tx.environmentConfigRevision.create({
        data: {
          teamId, projectId: environment.projectId, environmentId, createdById: actorId,
          revision: (latest?.revision ?? 0) + 1,
          snapshotHash: hashEnvironmentConfigSnapshot(snapshot),
          plainVariables: snapshot.plainVariables as Prisma.InputJsonValue,
          secretReferences: snapshot.secretReferences as Prisma.InputJsonValue,
          resourceReferences: snapshot.resourceReferences as Prisma.InputJsonValue,
          routeSnapshot: snapshot.routeSnapshot as Prisma.InputJsonValue,
          policyReferences: snapshot.policyReferences as Prisma.InputJsonValue,
          source: "project_management",
        },
        select: REVISION_SELECT,
      });
      const previousConfig = environment.config && typeof environment.config === "object"
        ? environment.config as Prisma.JsonObject
        : {};
      const updatedEnvironment = await tx.projectEnvironment.update({
        where: { id: environmentId },
        data: {
          currentConfigRevisionId: revision.id,
          config: { ...previousConfig, envVars: snapshot.plainVariables },
        },
        select: {
          id: true, key: true, name: true, status: true, config: true,
          identityLockedAt: true, currentConfigRevisionId: true,
        },
      });
      await tx.auditEvent.create({
        data: {
          teamId, actorId, projectId: environment.projectId, environmentId,
          category: "project_environment",
          action: "project_environment.config_revision.create",
          targetType: "environment_config_revision", targetId: revision.id,
          risk: snapshot.resourceReferences.some((item) => item.risk === "high") ? "high" : "medium",
          status: "completed",
          summary: dto.changeSummary?.trim() || `更新环境 ${environment.name} 的配置修订`,
          metadata: {
            revision: revision.revision, snapshotHash: revision.snapshotHash,
            plainVariableKeys: Object.keys(snapshot.plainVariables).sort(),
            secretReferenceIds: snapshot.secretReferences.map((item) => item.id),
            resourceReferences: snapshot.resourceReferences,
            routeSnapshot: snapshot.routeSnapshot,
            policyReferenceIds: snapshot.policyReferences.map((item) => item.id),
          } as Prisma.InputJsonValue,
        },
      });
      return { environment: updatedEnvironment, revision: { ...revision, current: true } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
