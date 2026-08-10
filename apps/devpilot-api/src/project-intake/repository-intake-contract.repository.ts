import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RepositoryIntakeContractRepository {
  constructor(private readonly prisma: PrismaService) {}

  load(teamId: string, projectId: string, runId: string) {
    return this.prisma.repositoryAnalysisRun.findFirst({
      where: { id: runId, teamId, projectId },
      include: {
        connection: true,
        suggestions: { orderBy: { createdAt: 'asc' } },
        intakeReviewSnapshot: true,
      },
    });
  }

  findSnapshot(runId: string) {
    return this.prisma.repositoryIntakeReviewSnapshot.findUnique({ where: { runId } });
  }
}

export type RepositoryIntakeRunRecord = NonNullable<
  Awaited<ReturnType<RepositoryIntakeContractRepository['load']>>
>;
