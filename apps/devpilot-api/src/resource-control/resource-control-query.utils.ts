import { Prisma } from '@prisma/client';
import type {
  ListManagedResourcesQueryDto,
  ListResourceActionRunsQueryDto,
  ListResourceConnectionRunsQueryDto,
  ListResourceMetricSeriesQueryDto,
  ListResourceMetricSnapshotsQueryDto,
  ListResourceMetricTrendsQueryDto,
  ListResourceQueryRunsQueryDto,
} from './dto/resource-control.dto';

type ResourceScopeQuery = {
  projectId?: string;
  environmentId?: string;
  resourceId?: string;
};

export function buildManagedResourceWhere(
  teamId: string,
  query: ListManagedResourcesQueryDto,
): Prisma.ManagedResourceWhereInput {
  const where: Prisma.ManagedResourceWhereInput = { teamId };
  const resourceId = query.resourceId || query.id;

  if (resourceId) where.id = resourceId;
  if (query.sourceType) where.sourceType = query.sourceType;
  if (query.serverId) where.serverId = query.serverId;
  if (query.projectId) where.projectId = query.projectId;
  if (query.environmentId) where.environmentId = query.environmentId;
  if (query.provider) where.provider = query.provider;
  if (query.kind) where.kind = query.kind;
  if (query.status) where.status = query.status;

  return where;
}

export function buildResourceActionRunWhere(
  teamId: string,
  query: ListResourceActionRunsQueryDto,
): Prisma.ResourceActionRunWhereInput {
  const where: Prisma.ResourceActionRunWhereInput = { teamId };

  if (query.resourceId) where.resourceId = query.resourceId;
  if (query.action) where.action = query.action;
  if (query.status) where.status = query.status;
  applyResourceRelationScope(where, query);

  return where;
}

export function buildResourceMetricSnapshotWhere(
  teamId: string,
  query:
    | ListResourceMetricSnapshotsQueryDto
    | ListResourceMetricTrendsQueryDto
    | ListResourceMetricSeriesQueryDto,
  sampledAfter?: Date,
): Prisma.ResourceMetricSnapshotWhereInput {
  const where: Prisma.ResourceMetricSnapshotWhereInput = { teamId };

  if (sampledAfter) where.sampledAt = { gte: sampledAfter };
  applyDirectResourceScope(where, query);
  if (query.status) where.status = query.status;
  if (query.provider) where.provider = query.provider;
  if (query.kind) where.kind = query.kind;
  if (query.metricSource) where.metricSource = query.metricSource;

  return where;
}

export function buildResourceConnectionRunWhere(
  teamId: string,
  query: ListResourceConnectionRunsQueryDto,
): Prisma.ResourceConnectionRunWhereInput {
  const where: Prisma.ResourceConnectionRunWhereInput = { teamId };

  applyDirectResourceScope(where, query);
  if (query.status) where.status = query.status;
  if (query.provider) where.provider = query.provider;
  if (query.kind) where.kind = query.kind;

  return where;
}

export function buildResourceQueryRunWhere(
  teamId: string,
  query: ListResourceQueryRunsQueryDto,
): Prisma.ResourceQueryRunWhereInput {
  const where: Prisma.ResourceQueryRunWhereInput = { teamId };

  applyDirectResourceScope(where, query);
  if (query.status) where.status = query.status;
  if (query.provider) where.provider = query.provider;
  if (query.kind) where.kind = query.kind;
  if (query.queryType) where.queryType = query.queryType;

  return where;
}

function applyDirectResourceScope(
  where:
    | Prisma.ResourceMetricSnapshotWhereInput
    | Prisma.ResourceConnectionRunWhereInput
    | Prisma.ResourceQueryRunWhereInput,
  query: ResourceScopeQuery,
) {
  if (query.resourceId) where.resourceId = query.resourceId;
  if (query.projectId) where.projectId = query.projectId;
  if (query.environmentId) where.environmentId = query.environmentId;
}

function applyResourceRelationScope(
  where: Prisma.ResourceActionRunWhereInput,
  query: ResourceScopeQuery,
) {
  const resourceScope: Prisma.ManagedResourceWhereInput = {};
  if (query.projectId) resourceScope.projectId = query.projectId;
  if (query.environmentId) resourceScope.environmentId = query.environmentId;
  if (Object.keys(resourceScope).length > 0) where.resource = { is: resourceScope };
}
