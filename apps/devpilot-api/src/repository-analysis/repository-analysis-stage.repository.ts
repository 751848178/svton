import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { redactRepositoryText } from './repository-analysis-redact.utils';
import { repositorySafeJson } from './repository-analysis-storage.utils';

@Injectable()
export class RepositoryAnalysisStageRepository {
  constructor(private readonly prisma: PrismaService) {}

  start(runId: string, name: string) {
    const now = new Date();
    return this.prisma.$transaction([
      this.prisma.repositoryAnalysisRun.update({
        where: { id: runId },
        data: { currentStage: name },
      }),
      this.prisma.repositoryAnalysisStage.update({
        where: { runId_name: { runId, name } },
        data: {
          status: 'running',
          startedAt: now,
          finishedAt: null,
          durationMs: null,
          errorCode: null,
          errorMessage: null,
        },
      }),
    ]);
  }

  async succeed(
    runId: string,
    name: string,
    logs: unknown[],
    evidence: unknown[] = [],
  ) {
    const stage = await this.prisma.repositoryAnalysisStage.findUniqueOrThrow({
      where: { runId_name: { runId, name } },
    });
    const now = new Date();
    return this.prisma.repositoryAnalysisStage.update({
      where: { id: stage.id },
      data: {
        status: 'succeeded',
        logs: repositorySafeJson(logs),
        evidence: repositorySafeJson(evidence),
        finishedAt: now,
        durationMs: stage.startedAt ? now.getTime() - stage.startedAt.getTime() : 0,
      },
    });
  }

  async fail(
    runId: string,
    name: string,
    code: string,
    message: string,
    logs: unknown[] = [],
  ) {
    const stage = await this.prisma.repositoryAnalysisStage.findUniqueOrThrow({
      where: { runId_name: { runId, name } },
    });
    const now = new Date();
    return this.prisma.repositoryAnalysisStage.update({
      where: { id: stage.id },
      data: {
        status: 'failed',
        logs: repositorySafeJson(logs),
        errorCode: code,
        errorMessage: redactRepositoryText(message),
        finishedAt: now,
        durationMs: stage.startedAt ? now.getTime() - stage.startedAt.getTime() : 0,
      },
    });
  }

  cancelRemaining(runId: string) {
    return this.prisma.repositoryAnalysisStage.updateMany({
      where: { runId, status: { in: ['queued', 'running'] } },
      data: { status: 'cancelled', finishedAt: new Date() },
    });
  }
}
