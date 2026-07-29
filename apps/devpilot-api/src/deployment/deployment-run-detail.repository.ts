import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 精确读取单条 DeploymentRun 详情所需的持久化投影。 */
@Injectable()
export class DeploymentRunDetailRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(teamId: string, id: string) {
    return this.prisma.deploymentRun.findFirst({
      where: { id, teamId },
      include: {
        projectEnvironment: {
          select: { id: true, key: true, name: true, status: true },
        },
        application: { select: { id: true, name: true, status: true } },
        applicationService: {
          select: {
            id: true,
            name: true,
            kind: true,
            runtime: true,
            status: true,
          },
        },
        actor: { select: { id: true, name: true, email: true } },
        server: { select: { id: true, name: true, host: true } },
        operationApproval: {
          select: {
            id: true,
            status: true,
            risk: true,
            reviewedAt: true,
            consumedAt: true,
          },
        },
        serverExecutionJob: {
          select: {
            id: true,
            status: true,
            queueMode: true,
            attempt: true,
            maxAttempts: true,
            queuedAt: true,
            startedAt: true,
            finishedAt: true,
          },
        },
      },
    });
  }
}
