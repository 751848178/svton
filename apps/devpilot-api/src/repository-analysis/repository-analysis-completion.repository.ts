import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { lockWritableRunProject } from "../project/project-writable-lock.repository";
import { redactRepositoryText } from "./repository-analysis-redact.utils";
import { optionalRepositorySafeJson, repositorySafeJson } from "./repository-analysis-storage.utils";
import type {
  RepositoryCompletionAudit,
  RepositoryFailureCompletion,
  RepositorySuccessCompletion,
} from "./repository-analysis-completion.types";

@Injectable()
export class RepositoryAnalysisCompletionRepository {
  constructor(private readonly prisma: PrismaService) {}

  succeed(input: RepositorySuccessCompletion) {
    return this.prisma.$transaction(async (tx) => {
      const run = await this.lockActive(tx, input.runId, input.workerLeaseToken);
      await this.lockStages(tx, input.runId);
      const now = new Date();
      await this.finishStage(tx, input.runId, "cleanup", now);
      if (input.drafts.length) {
        await tx.repositoryAnalysisSuggestion.createMany({
          data: input.drafts.map((draft) => ({
            runId: input.runId,
            key: draft.key,
            kind: draft.kind,
            confidence: draft.confidence,
            conflict: draft.conflict,
            impact: draft.impact,
            currentValue: optionalRepositorySafeJson(draft.currentValue),
            proposedValue: repositorySafeJson(draft.proposedValue),
            evidence: repositorySafeJson(draft.evidence),
            warnings: repositorySafeJson(draft.warnings),
          })),
        });
      }
      const updated = await tx.repositoryAnalysisRun.update({
        where: { id: input.runId },
        data: {
          status: "succeeded",
          activeKey: null,
          workerLeaseToken: null,
          workerLeaseExpiresAt: null,
          summary: repositorySafeJson({
            services: input.result.services.length,
            deployableServices: input.result.services.filter((item) => item.deployable).length,
            suggestions: input.drafts.length,
            warnings: input.result.warnings.length,
          }),
          result: repositorySafeJson(input.result),
          warnings: repositorySafeJson(input.result.warnings),
          finishedAt: now,
          durationMs: run.startedAt ? now.getTime() - run.startedAt.getTime() : 0,
        },
      });
      await this.audit(tx, input.audit);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  fail(input: RepositoryFailureCompletion) {
    return this.prisma.$transaction(async (tx) => {
      const run = await this.lockActive(tx, input.runId, input.workerLeaseToken);
      await this.lockStages(tx, input.runId);
      const now = new Date();
      await tx.repositoryAnalysisStage.updateMany({
        where: { runId: input.runId, name: input.currentStage, status: { in: ["queued", "running"] } },
        data: {
          status: "failed",
          errorCode: input.detail.code,
          errorMessage: redactRepositoryText(input.detail.message),
          finishedAt: now,
        },
      });
      await tx.repositoryAnalysisStage.updateMany({
        where: { runId: input.runId, status: { in: ["queued", "running"] } },
        data: { status: "cancelled", finishedAt: now },
      });
      const updated = await tx.repositoryAnalysisRun.update({
        where: { id: input.runId },
        data: {
          status: input.status,
          activeKey: null,
          workerLeaseToken: null,
          workerLeaseExpiresAt: null,
          errorCode: input.detail.code,
          errorMessage: input.detail.message,
          errorAction: input.detail.action,
          finishedAt: now,
          durationMs: run.startedAt ? now.getTime() - run.startedAt.getTime() : 0,
        },
      });
      await this.audit(tx, input.audit);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async lockActive(
    tx: Prisma.TransactionClient,
    runId: string,
    workerLeaseToken: string,
  ) {
    await lockWritableRunProject(tx, runId);
    const run = await tx.repositoryAnalysisRun.findUniqueOrThrow({
      where: { id: runId },
      select: { status: true, startedAt: true },
    });
    const owned = await tx.repositoryAnalysisRun.findFirst({
      where: {
        id: runId,
        status: "running",
        workerLeaseToken,
        workerLeaseExpiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!owned || run.status !== "running") {
      throw new Error("repository analysis run is already terminal");
    }
    return run;
  }

  private async lockStages(tx: Prisma.TransactionClient, runId: string) {
    await tx.$queryRaw`SELECT id FROM RepositoryAnalysisStage
      WHERE runId = ${runId} ORDER BY ordinal FOR UPDATE`;
  }

  private async finishStage(
    tx: Prisma.TransactionClient,
    runId: string,
    name: string,
    now: Date,
  ) {
    const stage = await tx.repositoryAnalysisStage.findUniqueOrThrow({
      where: { runId_name: { runId, name } },
    });
    await tx.repositoryAnalysisStage.update({
      where: { id: stage.id },
      data: {
        status: "succeeded",
        logs: repositorySafeJson(["隔离临时目录已清理。"]),
        finishedAt: now,
        durationMs: stage.startedAt ? now.getTime() - stage.startedAt.getTime() : 0,
      },
    });
  }

  private audit(tx: Prisma.TransactionClient, input: RepositoryCompletionAudit) {
    return tx.auditEvent.create({
      data: {
        teamId: input.teamId,
        actorId: input.userId ?? undefined,
        projectId: input.projectId,
        category: "repository_analysis",
        action: input.action,
        targetType: "repository_analysis_run",
        targetId: input.metadata.runId as string,
        risk: "low",
        status: input.status ?? "completed",
        summary: input.summary,
        metadata: repositorySafeJson(input.metadata),
      },
    });
  }
}
