import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DEPLOYMENT_RUN_INCLUDE } from "./deployment-run-include.constants";

/** 精确读取单条 DeploymentRun 详情所需的持久化投影。 */
@Injectable()
export class DeploymentRunDetailRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(teamId: string, id: string, projectId?: string) {
    return this.prisma.deploymentRun.findFirst({
      where: { id, teamId, ...(projectId ? { projectId } : {}) },
      include: {
        ...DEPLOYMENT_RUN_INCLUDE,
        releaseRun: {
          select: {
            id: true,
            status: true,
            operationApproval: {
              select: {
                id: true,
                status: true,
                risk: true,
                reviewedAt: true,
                consumedAt: true,
              },
            },
          },
        },
      },
    });
  }
}
