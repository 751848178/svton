import { Prisma } from "@prisma/client";
import type { ListDeploymentRunsQueryDto } from "./dto/deployment.dto";

export function buildDeploymentRunListQuery(
  teamId: string,
  query: ListDeploymentRunsQueryDto,
) {
  const where: Prisma.DeploymentRunWhereInput = { teamId };
  if (query.projectId) where.projectId = query.projectId;
  if (query.releaseOrderId) {
    where.OR = [
      { artifactManifest: { releaseOrderId: query.releaseOrderId } },
      {
        releaseStageAttempts: {
          some: {
            releaseStage: {
              releasePlan: { releaseOrderId: query.releaseOrderId },
            },
          },
        },
      },
    ];
  }
  if (query.applicationId) where.applicationId = query.applicationId;
  if (query.applicationServiceId) {
    where.applicationServiceId = query.applicationServiceId;
  }
  if (query.status) where.status = query.status;
  if (query.source) where.source = query.source;
  if (query.environmentId) where.environmentId = query.environmentId;
  if (query.startedFrom || query.startedTo) {
    where.startedAt = {
      ...(query.startedFrom ? { gte: new Date(query.startedFrom) } : {}),
      ...(query.startedTo ? { lte: new Date(query.startedTo) } : {}),
    };
  }
  return {
    where,
    skip: query.skip ?? 0,
    take: query.take ?? 30,
  };
}
