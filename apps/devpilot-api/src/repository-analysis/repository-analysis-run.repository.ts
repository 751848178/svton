import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { REPOSITORY_ANALYSIS_STAGES } from './repository-analysis.constants';
import { repositoryError } from './repository-analysis-validation.utils';
import {
  RepositoryAnalysisResult,
  RepositorySuggestionDraft,
} from './repository-parser.types';

export interface CreateRepositoryRunInput {
  teamId: string;
  projectId: string;
  connectionId: string;
  triggeredById: string;
  retryOfId?: string;
  repositoryUrl: string;
  branch: string;
  commitSha: string;
  idempotencyKey: string;
  parserVersion: string;
}

@Injectable()
export class RepositoryAnalysisRunRepository {
  constructor(private readonly prisma: PrismaService) {}
  findIdempotent(projectId: string, idempotencyKey: string) {
    return this.prisma.repositoryAnalysisRun.findUnique({
      where: { projectId_idempotencyKey: { projectId, idempotencyKey } },
      include: runInclude,
    });
  }
  findActive(teamId: string, projectId: string) {
    return this.prisma.repositoryAnalysisRun.findFirst({
      where: { teamId, projectId, status: { in: ['queued', 'running'] } },
      include: runInclude,
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
      include: runInclude,
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
      include: runInclude,
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
  start(runId: string) {
    return this.prisma.repositoryAnalysisRun.update({
      where: { id: runId },
      data: {
        status: 'running',
        startedAt: new Date(),
        errorCode: null,
        errorMessage: null,
        errorAction: null,
      },
    });
  }
  requestCancel(teamId: string, projectId: string, runId: string) {
    return this.prisma.repositoryAnalysisRun.updateMany({
      where: { id: runId, teamId, projectId, status: { in: ['queued', 'running'] } },
      data: { cancelRequestedAt: new Date() },
    });
  }
  async isCancelRequested(runId: string): Promise<boolean> {
    return Boolean((await this.prisma.repositoryAnalysisRun.findUnique({
      where: { id: runId },
      select: { cancelRequestedAt: true },
    }))?.cancelRequestedAt);
  }
  async succeed(
    runId: string,
    result: RepositoryAnalysisResult,
    drafts: RepositorySuggestionDraft[],
  ) {
    const now = new Date();
    const run = await this.prisma.repositoryAnalysisRun.findUniqueOrThrow({
      where: { id: runId },
      select: { startedAt: true },
    });
    return this.prisma.$transaction(async (tx) => {
      if (drafts.length) {
        await tx.repositoryAnalysisSuggestion.createMany({
          data: drafts.map((draft) => ({
            runId,
            key: draft.key,
            kind: draft.kind,
            confidence: draft.confidence,
            conflict: draft.conflict,
            impact: draft.impact,
            currentValue: optionalJson(draft.currentValue),
            proposedValue: json(draft.proposedValue),
            evidence: json(draft.evidence),
            warnings: json(draft.warnings),
          })),
        });
      }
      return tx.repositoryAnalysisRun.update({
        where: { id: runId },
        data: {
          status: 'succeeded',
          activeKey: null,
          summary: json({
            services: result.services.length,
            deployableServices: result.services.filter((item) => item.deployable).length,
            suggestions: drafts.length,
            warnings: result.warnings.length,
          }),
          result: json(result),
          warnings: json(result.warnings),
          finishedAt: now,
          durationMs: run.startedAt ? now.getTime() - run.startedAt.getTime() : 0,
        },
        include: runInclude,
      });
    });
  }

  async terminal(
    runId: string,
    status: 'failed' | 'cancelled',
    error?: { code: string; message: string; action: string },
  ) {
    const now = new Date();
    const run = await this.prisma.repositoryAnalysisRun.findUniqueOrThrow({
      where: { id: runId },
      select: { startedAt: true },
    });
    return this.prisma.repositoryAnalysisRun.update({
      where: { id: runId },
      data: {
        status,
        activeKey: null,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorAction: error?.action,
        finishedAt: now,
        durationMs: run.startedAt ? now.getTime() - run.startedAt.getTime() : 0,
      },
    });
  }

  recoverActiveIds() {
    return this.prisma.repositoryAnalysisRun.findMany({
      where: { status: { in: ['queued', 'running'] } },
      select: { id: true },
    });
  }
}

const runInclude = {
  stages: { orderBy: { ordinal: 'asc' as const } },
  suggestions: { orderBy: { createdAt: 'asc' as const } },
};

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function optionalJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : json(value);
}
