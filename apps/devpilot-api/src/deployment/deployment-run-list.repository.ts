import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DEPLOYMENT_RUN_INCLUDE } from "./deployment-run-include.constants";
import { buildDeploymentRunListQuery } from "./deployment-run-list-query";
import { DeploymentRunStatus } from "./deployment-run-status";
import type { ListDeploymentRunsQueryDto } from "./dto/deployment.dto";

export const ATTENTION_DEPLOYMENT_RUN_STATUSES = [
  DeploymentRunStatus.QUEUED,
  DeploymentRunStatus.RUNNING,
  DeploymentRunStatus.BLOCKED,
  DeploymentRunStatus.FAILED,
] as const;

export async function listDeploymentRuns(
  prisma: PrismaService,
  teamId: string,
  query: ListDeploymentRunsQueryDto,
) {
  const pagination = buildDeploymentRunListQuery(teamId, query);
  if (!query.attentionFirst || query.status) {
    return findRuns(prisma, pagination.where, pagination.skip, pagination.take);
  }

  const attentionWhere: Prisma.DeploymentRunWhereInput = {
    ...pagination.where,
    status: { in: [...ATTENTION_DEPLOYMENT_RUN_STATUSES] },
  };
  const otherWhere: Prisma.DeploymentRunWhereInput = {
    ...pagination.where,
    status: { notIn: [...ATTENTION_DEPLOYMENT_RUN_STATUSES] },
  };
  const attentionCount = await prisma.deploymentRun.count({
    where: attentionWhere,
  });
  if (pagination.skip >= attentionCount) {
    return findRuns(
      prisma,
      otherWhere,
      pagination.skip - attentionCount,
      pagination.take,
    );
  }

  const attention = await findRuns(
    prisma,
    attentionWhere,
    pagination.skip,
    Math.min(pagination.take, attentionCount - pagination.skip),
  );
  const remaining = pagination.take - attention.length;
  if (remaining === 0) return attention;
  const other = await findRuns(prisma, otherWhere, 0, remaining);
  return [...attention, ...other];
}

function findRuns(
  prisma: PrismaService,
  where: Prisma.DeploymentRunWhereInput,
  skip: number,
  take: number,
) {
  return prisma.deploymentRun.findMany({
    where,
    skip,
    take,
    orderBy: { startedAt: "desc" },
    include: DEPLOYMENT_RUN_INCLUDE,
  });
}
