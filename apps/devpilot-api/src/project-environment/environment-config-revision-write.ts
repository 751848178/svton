import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateEnvironmentConfigRevisionDto } from "./dto/environment-config-revision.dto";
import { EnvironmentConfigReferenceResolverService } from "./environment-config-reference-resolver.service";
import {
  ENVIRONMENT_CONFIG_REVISION_AUDIT_SELECT,
  ENVIRONMENT_CONFIG_REVISION_SELECT,
} from "./environment-config-revision-selects";
import { hashEnvironmentConfigSnapshot } from "./environment-config-revision.utils";

export async function writeEnvironmentConfigRevision(
  tx: Prisma.TransactionClient,
  resolver: EnvironmentConfigReferenceResolverService,
  teamId: string,
  actorId: string,
  environmentId: string,
  dto: CreateEnvironmentConfigRevisionDto,
) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM ProjectEnvironment
    WHERE id = ${environmentId} AND teamId = ${teamId}
    FOR UPDATE
  `);
  if (locked.length === 0) throw new NotFoundException("项目环境不存在");
  const environment = await tx.projectEnvironment.findUniqueOrThrow({
    where: { id: environmentId },
    select: {
      id: true,
      teamId: true,
      projectId: true,
      name: true,
      description: true,
      config: true,
      baselineRole: true,
      currentConfigRevisionId: true,
      currentConfigRevision: { select: ENVIRONMENT_CONFIG_REVISION_SELECT },
    },
  });
  if (
    dto.expectedCurrentRevisionId !== undefined &&
    dto.expectedCurrentRevisionId !== environment.currentConfigRevisionId
  ) {
    throw new ConflictException("环境配置已更新，请刷新后重试");
  }
  const snapshot = await resolver.resolve(
    tx,
    environment,
    dto,
    environment.currentConfigRevision,
  );
  const latest = await tx.environmentConfigRevision.findFirst({
    where: { environmentId },
    orderBy: { revision: "desc" },
    select: { revision: true },
  });
  const revision = await tx.environmentConfigRevision.create({
    data: {
      teamId,
      projectId: environment.projectId,
      environmentId,
      createdById: actorId,
      revision: (latest?.revision ?? 0) + 1,
      snapshotHash: hashEnvironmentConfigSnapshot(snapshot),
      plainVariables: snapshot.plainVariables as Prisma.InputJsonValue,
      secretReferences: snapshot.secretReferences as Prisma.InputJsonValue,
      resourceReferences: snapshot.resourceReferences as Prisma.InputJsonValue,
      routeSnapshot: snapshot.routeSnapshot as Prisma.InputJsonValue,
      policyReferences: snapshot.policyReferences as Prisma.InputJsonValue,
      observabilitySnapshot:
        snapshot.observabilitySnapshot as Prisma.InputJsonValue,
      displayName: environment.name,
      displayDescription: environment.description,
      changeSummary: dto.changeSummary?.trim() || null,
      source: "project_management",
    },
    select: ENVIRONMENT_CONFIG_REVISION_SELECT,
  });
  const previousConfig =
    environment.config && typeof environment.config === "object"
      ? (environment.config as Prisma.JsonObject)
      : {};
  const updatedEnvironment = await tx.projectEnvironment.update({
    where: { id: environmentId },
    data: {
      currentConfigRevisionId: revision.id,
      config: { ...previousConfig, envVars: snapshot.plainVariables },
    },
    select: {
      id: true,
      key: true,
      name: true,
      status: true,
      config: true,
      identityLockedAt: true,
      currentConfigRevisionId: true,
    },
  });
  const auditEvent = await tx.auditEvent.create({
    data: {
      teamId,
      actorId,
      projectId: environment.projectId,
      environmentId,
      category: "project_environment",
      action: "project_environment.config_revision.create",
      targetType: "environment_config_revision",
      targetId: revision.id,
      risk: snapshot.resourceReferences.some((item) => item.risk === "high")
        ? "high"
        : "medium",
      status: "completed",
      summary:
        dto.changeSummary?.trim() || `更新环境 ${environment.name} 的配置修订`,
      metadata: {
        revision: revision.revision,
        snapshotHash: revision.snapshotHash,
        displayName: environment.name,
        displayDescription: environment.description ?? null,
        plainVariableKeys: Object.keys(snapshot.plainVariables).sort(),
        secretReferenceIds: snapshot.secretReferences.map((item) => item.id),
        resourceReferences: snapshot.resourceReferences,
        routeSnapshot: snapshot.routeSnapshot,
        policyReferenceIds: snapshot.policyReferences.map((item) => item.id),
        observabilitySnapshot: snapshot.observabilitySnapshot,
      } as Prisma.InputJsonValue,
    },
    select: ENVIRONMENT_CONFIG_REVISION_AUDIT_SELECT,
  });
  return {
    environment: updatedEnvironment,
    revision: { ...revision, current: true },
    auditEvent,
  };
}
