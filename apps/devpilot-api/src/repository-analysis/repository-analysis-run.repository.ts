import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  lockWritableRunProject,
  lockWritableScopedRun,
} from '../project/project-writable-lock.repository';
import {
  REPOSITORY_ANALYSIS_STAGES,
  REPOSITORY_ANALYSIS_WORKER_LEASE_MS,
} from './repository-analysis.constants';
import {
  CreateRepositoryRunInput,
  REPOSITORY_ANALYSIS_RUN_INCLUDE,
} from './repository-analysis-run.data';
import { repositoryError } from './repository-analysis-validation.utils';

@Injectable()
export class RepositoryAnalysisRunRepository {
  constructor(private readonly prisma: PrismaService) {}
  findIdempotent(projectId: string, idempotencyKey: string) {
    return this.prisma.repositoryAnalysisRun.findUnique({
      where: { projectId_idempotencyKey: { projectId, idempotencyKey } },
      include: REPOSITORY_ANALYSIS_RUN_INCLUDE,
    });
  }
  findActive(teamId: string, projectId: string) {
    return this.prisma.repositoryAnalysisRun.findFirst({
      where: { teamId, projectId, status: { in: ['queued', 'running'] } },
      include: REPOSITORY_ANALYSIS_RUN_INCLUDE,
    });
  }
  create(input: CreateRepositoryRunInput) {
    return this.prisma.repositoryAnalysisRun.create({
      data: {
        ...input,
        status: 'queued',
        activeKey: 'active',
        stages: {
          create: REPOSITORY_ANALYSIS_STAGES.map((name, ordinal) => ({
            name,
            ordinal,
            status: 'queued',
          })),
        },
      },
      include: REPOSITORY_ANALYSIS_RUN_INCLUDE,
    });
  }
  list(teamId: string, projectId: string) {
    return this.prisma.repositoryAnalysisRun.findMany({
      where: { teamId, projectId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        stages: { orderBy: { ordinal: 'asc' } },
        _count: { select: { suggestions: true } },
      },
    });
  }
  async findScoped(teamId: string, projectId: string, runId: string) {
    const run = await this.prisma.repositoryAnalysisRun.findFirst({
      where: { id: runId, teamId, projectId },
      include: REPOSITORY_ANALYSIS_RUN_INCLUDE,
    });
    if (!run) throw new NotFoundException(repositoryError(
      'REPOSITORY_ANALYSIS_NOT_FOUND',
      '解析运行不存在',
      '请从当前项目的解析历史重新选择。',
    ));
    return run;
  }
  findWorkerRun(runId: string) {
    return this.prisma.repositoryAnalysisRun.findUnique({
      where: { id: runId },
      include: { connection: true },
    });
  }
  start(runId: string, workerLeaseToken: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await lockWritableRunProject(tx, runId);
      const now = new Date();
      const current = await tx.repositoryAnalysisRun.findUniqueOrThrow({
        where: { id: runId },
        select: { status: true, workerLeaseToken: true, workerLeaseExpiresAt: true },
      });
      const recoverable = current.status === 'running'
        && current.workerLeaseExpiresAt !== null
        && current.workerLeaseExpiresAt.getTime() <= now.getTime();
      if (run.status !== 'queued' && !recoverable) {
        return current.status === 'running' && current.workerLeaseExpiresAt
          ? { state: 'leased' as const, retryAt: current.workerLeaseExpiresAt }
          : { state: 'terminal' as const };
      }
      const claimed = await tx.repositoryAnalysisRun.updateMany({
        where: {
          id: runId,
          OR: [
            { status: 'queued', workerLeaseToken: null },
            { status: 'running', workerLeaseExpiresAt: { lte: now } },
          ],
        },
        data: {
          status: 'running',
          startedAt: current.status === 'queued' ? now : undefined,
          workerLeaseToken,
          workerLeaseExpiresAt: new Date(now.getTime() + REPOSITORY_ANALYSIS_WORKER_LEASE_MS),
          errorCode: null,
          errorMessage: null,
          errorAction: null,
        },
      });
      if (claimed.count !== 1) {
        const latest = await tx.repositoryAnalysisRun.findUniqueOrThrow({
          where: { id: runId },
          select: { status: true, workerLeaseExpiresAt: true },
        });
        return latest.status === 'running' && latest.workerLeaseExpiresAt
          ? { state: 'leased' as const, retryAt: latest.workerLeaseExpiresAt }
          : { state: 'terminal' as const };
      }
      return { state: 'claimed' as const };
    }, { isolationLevel: 'Serializable' });
  }

  extendWorkerLease(runId: string, workerLeaseToken: string) {
    return this.prisma.repositoryAnalysisRun.updateMany({
      where: { id: runId, status: 'running', workerLeaseToken },
      data: {
        workerLeaseExpiresAt: new Date(Date.now() + REPOSITORY_ANALYSIS_WORKER_LEASE_MS),
      },
    });
  }
  requestCancel(teamId: string, projectId: string, runId: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await lockWritableScopedRun(tx, teamId, projectId, runId);
      if (!['queued', 'running'].includes(run.status)) return { count: 0 };
      return tx.repositoryAnalysisRun.updateMany({
        where: { id: runId, status: { in: ['queued', 'running'] } },
        data: { cancelRequestedAt: new Date() },
      });
    }, { isolationLevel: 'Serializable' });
  }
  async isCancelRequested(runId: string): Promise<boolean> {
    return Boolean((await this.prisma.repositoryAnalysisRun.findUnique({
      where: { id: runId },
      select: { cancelRequestedAt: true },
    }))?.cancelRequestedAt);
  }
  recoverActiveIds() {
    return this.prisma.repositoryAnalysisRun.findMany({
      where: { status: { in: ['queued', 'running'] } },
      select: { id: true },
    });
  }
}
