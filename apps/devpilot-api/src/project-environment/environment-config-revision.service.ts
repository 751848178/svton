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
  policyReferences: true, displayName: true, displayDescription: true,
  source: true, createdAt: true,
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
          id: true, teamId: true, projectId: true, name: true, description: true, config: true,
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
          displayName: environment.name,
          displayDescription: environment.description,
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
            displayName: environment.name, displayDescription: environment.description ?? null,
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

  /**
   * F444 AC-SET-014/015: display-name/description are revision-based identity
   * fields. An edit appends a new immutable revision that carries the identity
   * (previous config snapshot copied verbatim, CAS unchanged) and audits the
   * change in the same transaction.
   */
  updateIdentity(
    teamId: string,
    actorId: string,
    environmentId: string,
    input: {
      name?: string;
      description?: string | null;
      reason?: string;
      expectedCurrentRevisionId?: string;
    },
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
          id: true, teamId: true, projectId: true, key: true, name: true,
          description: true, currentConfigRevisionId: true,
          currentConfigRevision: {
            select: {
              plainVariables: true, secretReferences: true,
              resourceReferences: true, routeSnapshot: true,
              policyReferences: true, snapshotHash: true,
            },
          },
        },
      });
      if (
        input.expectedCurrentRevisionId !== undefined &&
        input.expectedCurrentRevisionId !== environment.currentConfigRevisionId
      ) {
        throw new ConflictException("环境配置已更新，请刷新后重试");
      }
      const previous = environment.currentConfigRevision;
      const latest = await tx.environmentConfigRevision.findFirst({
        where: { environmentId }, orderBy: { revision: "desc" },
        select: { revision: true },
      });
      const name = input.name?.trim() || environment.name;
      const description = input.description === undefined
        ? environment.description
        : (input.description?.trim() || null);
      const revision = await tx.environmentConfigRevision.create({
        data: {
          teamId, projectId: environment.projectId, environmentId, createdById: actorId,
          revision: (latest?.revision ?? 0) + 1,
          snapshotHash: previous?.snapshotHash ?? hashEnvironmentConfigSnapshot({
            plainVariables: {}, secretReferences: [], resourceReferences: [],
            routeSnapshot: {}, policyReferences: [],
          }),
          plainVariables: previous?.plainVariables as Prisma.InputJsonValue,
          secretReferences: previous?.secretReferences as Prisma.InputJsonValue,
          resourceReferences: previous?.resourceReferences as Prisma.InputJsonValue,
          routeSnapshot: previous?.routeSnapshot as Prisma.InputJsonValue,
          policyReferences: previous?.policyReferences as Prisma.InputJsonValue,
          displayName: name,
          displayDescription: description,
          source: "project_management",
        },
        select: REVISION_SELECT,
      });
      const updatedEnvironment = await tx.projectEnvironment.update({
        where: { id: environmentId },
        data: {
          name,
          description,
          currentConfigRevisionId: revision.id,
        },
        select: {
          id: true, teamId: true, projectId: true, key: true, name: true,
          description: true, status: true, sortOrder: true, baselineRole: true,
          identityLockedAt: true, currentConfigRevisionId: true,
          createdAt: true, updatedAt: true,
        },
      });
      await tx.auditEvent.create({
        data: {
          teamId, actorId, projectId: environment.projectId, environmentId,
          category: "project_environment",
          action: "project_environment.identity.update",
          targetType: "project_environment", targetId: environmentId,
          risk: "medium", status: "completed",
          summary: input.reason?.trim() || `更新环境 ${environment.name} 的显示名与描述`,
          metadata: {
            revision: revision.revision,
            previousName: environment.name,
            previousDescription: environment.description ?? null,
            name, description,
            reason: input.reason?.trim() ?? null,
          } as Prisma.InputJsonValue,
        },
      });
      return { environment: updatedEnvironment, revision: { ...revision, current: true } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
