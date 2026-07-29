import { Injectable } from '@nestjs/common';
import { Prisma, RepositoryAnalysisSuggestion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  RepositoryAppliedReference,
  RepositoryApplyInput,
  RepositoryDecision,
} from './repository-apply.types';
import { RepositoryPlatformApplyRepository } from './repository-platform-apply.repository';
import { json } from './repository-platform-apply.utils';

@Injectable()
export class RepositorySuggestionApplyRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platform: RepositoryPlatformApplyRepository,
  ) {}

  load(teamId: string, projectId: string, runId: string) {
    return this.prisma.repositoryAnalysisRun.findFirst({
      where: { id: runId, teamId, projectId },
      include: { connection: true, suggestions: { orderBy: { createdAt: 'asc' } } },
    });
  }

  apply(input: RepositoryApplyInput) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.repositoryAnalysisRun.findUniqueOrThrow({
        where: { id: input.runId },
        include: { connection: true, suggestions: true },
      });
      if (run.commitSha !== input.commitSha
        || run.connection.commitSha !== input.commitSha
        || run.status !== 'succeeded') {
        throw new Error('repository analysis snapshot changed');
      }
      const references: RepositoryAppliedReference[] = [];
      const ordered = orderDecisions(input.decisions);
      for (const decision of ordered) {
        const reference = await this.applyDecision(tx, input, decision);
        if (reference) references.push({ ...reference, suggestionId: decision.suggestion.id });
      }
      const now = new Date();
      if (input.markConnectionApplied) {
        await tx.repositoryConnection.update({
          where: { id: run.connectionId },
          data: { lastAppliedRunId: run.id, appliedAt: now },
        });
      }
      await tx.auditEvent.create({
        data: {
          teamId: input.teamId,
          actorId: input.userId,
          projectId: input.projectId,
          category: 'repository_analysis',
          action: 'repository.suggestions.apply',
          targetType: 'repository_analysis_run',
          targetId: run.id,
          risk: 'medium',
          status: 'completed',
          summary: `已处理 ${input.decisions.length} 条仓库解析建议`,
          metadata: json({
            runId: run.id,
            commitSha: run.commitSha,
            complete: input.markConnectionApplied,
            appliedSuggestionIds: references.map((item) => item.suggestionId),
          }),
        },
      });
      return {
        complete: input.markConnectionApplied,
        references,
        appliedAt: now,
      };
    });
  }

  private async applyDecision(
    tx: Prisma.TransactionClient,
    input: RepositoryApplyInput,
    decision: RepositoryDecision,
  ): Promise<RepositoryAppliedReference | undefined> {
    const suggestion = await tx.repositoryAnalysisSuggestion.findUniqueOrThrow({
      where: { id: decision.suggestion.id },
    });
    if (suggestion.runId !== input.runId) throw new Error('suggestion scope mismatch');
    const now = new Date();
    if (decision.status === 'rejected') {
      await tx.repositoryAnalysisSuggestion.update({
        where: { id: suggestion.id },
        data: {
          status: 'rejected',
          reviewDecision: 'reject',
          reviewedById: input.userId,
          reviewedAt: now,
          reviewedValue: Prisma.JsonNull,
        },
      });
      return undefined;
    }
    const value = decision.value || {};
    const reference = await this.applyValue(tx, input, suggestion, value);
    await tx.repositoryAnalysisSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: 'applied',
        reviewDecision: decision.status === 'edited' ? 'edit' : 'accept',
        reviewedById: input.userId,
        reviewedAt: now,
        reviewedValue: json(value),
        appliedRefs: json(reference),
        appliedAt: now,
      },
    });
    return reference;
  }

  private applyValue(
    tx: Prisma.TransactionClient,
    input: RepositoryApplyInput,
    suggestion: RepositoryAnalysisSuggestion,
    value: Record<string, unknown>,
  ): Promise<RepositoryAppliedReference> {
    switch (suggestion.kind) {
      case 'environment':
        return this.platform.applyEnvironment(tx, input.teamId, input.projectId, value);
      case 'project_repository':
        return this.platform.applyProject(tx, input.projectId, input.runId, value);
      case 'application_service':
        return this.platform.applyApplicationService(
          tx,
          input.teamId,
          input.projectId,
          input.runId,
          value,
        );
      case 'resource_requirement':
        return this.platform.applyResourceRequirements(tx, input.projectId, value);
      default:
        throw new Error(`unsupported suggestion kind ${suggestion.kind}`);
    }
  }
}

function orderDecisions(decisions: RepositoryDecision[]): RepositoryDecision[] {
  const order = ['environment', 'project_repository', 'application_service', 'resource_requirement'];
  return [...decisions].sort((left, right) =>
    order.indexOf(left.suggestion.kind) - order.indexOf(right.suggestion.kind),
  );
}
