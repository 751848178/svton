import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { redactRepositoryText } from './repository-analysis-redact.utils';
import { repositorySafeJson } from './repository-analysis-storage.utils';
import { lockWritableRunProject } from '../project/project-writable-lock.repository';

@Injectable()
export class RepositoryAnalysisStageRepository {
  constructor(private readonly prisma: PrismaService) {}

  start(runId: string, name: string, workerLeaseToken?: string) {
    const now = new Date();
    if (workerLeaseToken) return this.prisma.$transaction(async (tx) => {
      await this.lockWorker(tx, runId, workerLeaseToken);
      return this.startWith(tx, runId, name, now);
    });
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
    workerLeaseToken?: string,
  ) {
    if (workerLeaseToken) return this.prisma.$transaction(async (tx) => {
      await this.lockWorker(tx, runId, workerLeaseToken);
      return this.succeedWith(tx, runId, name, logs, evidence);
    });
    return this.succeedWith(this.prisma, runId, name, logs, evidence);
  }

  private startWith(
    tx: PrismaService | Prisma.TransactionClient,
    runId: string,
    name: string,
    now: Date,
  ) {
    return Promise.all([
      tx.repositoryAnalysisRun.update({
        where: { id: runId },
        data: { currentStage: name },
      }),
      tx.repositoryAnalysisStage.update({
        where: { runId_name: { runId, name } },
        data: {
          status: 'running', startedAt: now, finishedAt: null, durationMs: null,
          errorCode: null, errorMessage: null,
        },
      }),
    ]);
  }

  private async succeedWith(
    tx: PrismaService | Prisma.TransactionClient,
    runId: string,
    name: string,
    logs: unknown[],
    evidence: unknown[],
  ) {
    const stage = await tx.repositoryAnalysisStage.findUniqueOrThrow({
      where: { runId_name: { runId, name } },
    });
    const now = new Date();
    return tx.repositoryAnalysisStage.update({
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

  private async lockWorker(tx: Prisma.TransactionClient, runId: string, token: string) {
    await lockWritableRunProject(tx, runId);
    const run = await tx.repositoryAnalysisRun.findFirst({
      where: {
        id: runId,
        status: 'running',
        workerLeaseToken: token,
        workerLeaseExpiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!run) throw new Error('repository analysis worker lease lost');
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
