import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { hashEnvironmentConfigSnapshot } from "./environment-config-revision.utils";

const IDENTITY_REVISION_SELECT = {
  id: true, revision: true, snapshotHash: true, plainVariables: true,
  secretReferences: true, resourceReferences: true, routeSnapshot: true,
  policyReferences: true, observabilitySnapshot: true, displayName: true,
  displayDescription: true, changeSummary: true, source: true, createdAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class EnvironmentConfigIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  update(teamId: string, actorId: string, environmentId: string, input: {
    name?: string; description?: string | null; reason?: string;
    expectedCurrentRevisionId?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM ProjectEnvironment
        WHERE id = ${environmentId} AND teamId = ${teamId} FOR UPDATE`);
      if (locked.length === 0) throw new NotFoundException("项目环境不存在");
      const environment = await tx.projectEnvironment.findUniqueOrThrow({
        where: { id: environmentId }, select: {
          id: true, projectId: true, key: true, name: true, description: true,
          currentConfigRevisionId: true,
          currentConfigRevision: { select: {
            plainVariables: true, secretReferences: true, resourceReferences: true,
            routeSnapshot: true, policyReferences: true, snapshotHash: true,
            observabilitySnapshot: true,
          } },
        },
      });
      if (input.expectedCurrentRevisionId !== undefined &&
        input.expectedCurrentRevisionId !== environment.currentConfigRevisionId) {
        throw new ConflictException("环境配置已更新，请刷新后重试");
      }
      const latest = await tx.environmentConfigRevision.findFirst({
        where: { environmentId }, orderBy: { revision: "desc" },
        select: { revision: true },
      });
      const name = input.name?.trim() || environment.name;
      const description = input.description === undefined
        ? environment.description : input.description?.trim() || null;
      const previous = environment.currentConfigRevision;
      const revision = await tx.environmentConfigRevision.create({
        data: {
          teamId, projectId: environment.projectId, environmentId, createdById: actorId,
          revision: (latest?.revision ?? 0) + 1,
          snapshotHash: previous?.snapshotHash ?? emptySnapshotHash(),
          plainVariables: json(previous?.plainVariables),
          secretReferences: json(previous?.secretReferences),
          resourceReferences: json(previous?.resourceReferences),
          routeSnapshot: json(previous?.routeSnapshot),
          policyReferences: json(previous?.policyReferences),
          observabilitySnapshot: json(previous?.observabilitySnapshot),
          displayName: name, displayDescription: description,
          changeSummary: input.reason?.trim() || null, source: "project_management",
        }, select: IDENTITY_REVISION_SELECT,
      });
      const updatedEnvironment = await tx.projectEnvironment.update({
        where: { id: environmentId },
        data: { name, description, currentConfigRevisionId: revision.id },
        select: {
          id: true, teamId: true, projectId: true, key: true, name: true,
          description: true, status: true, sortOrder: true, baselineRole: true,
          identityLockedAt: true, currentConfigRevisionId: true,
          createdAt: true, updatedAt: true,
        },
      });
      await tx.auditEvent.create({ data: {
        teamId, actorId, projectId: environment.projectId, environmentId,
        category: "project_environment", action: "project_environment.identity.update",
        targetType: "project_environment", targetId: environmentId,
        risk: "medium", status: "completed",
        summary: input.reason?.trim() || `更新环境 ${environment.name} 的显示名与描述`,
        metadata: { revision: revision.revision, previousName: environment.name,
          previousDescription: environment.description ?? null, name, description,
          reason: input.reason?.trim() ?? null } as Prisma.InputJsonValue,
      } });
      return { environment: updatedEnvironment, revision: { ...revision, current: true } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

function json(value: Prisma.JsonValue | null | undefined) {
  return (value ?? {}) as Prisma.InputJsonValue;
}

function emptySnapshotHash() {
  return hashEnvironmentConfigSnapshot({ plainVariables: {}, secretReferences: [],
    resourceReferences: [], routeSnapshot: {}, policyReferences: [],
    observabilitySnapshot: {} });
}
