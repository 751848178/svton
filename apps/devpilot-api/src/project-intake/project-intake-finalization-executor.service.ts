import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectGovernanceFinalizationService } from "../project/project-governance-finalization.service";
import { RepositoryIdentityFinalizerService } from "../repository-identity/repository-identity-finalizer.service";
import {
  intakeError,
  projectIntakeNotFoundError,
} from "./project-intake-errors.utils";
import type {
  FinalizeProjectIntakeInput,
  ProjectIntakeFinalizationResult,
} from "./project-intake.types";
import { RepositoryIntakeSnapshotIntegrityService } from "./repository-intake-snapshot-integrity.service";
import { assertProjectWritable } from "../project/project-archived-write.error";

@Injectable()
export class ProjectIntakeFinalizationExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly governance: ProjectGovernanceFinalizationService,
    private readonly identities: RepositoryIdentityFinalizerService,
    private readonly snapshotIntegrity: RepositoryIntakeSnapshotIntegrityService,
  ) {}

  execute(
    input: FinalizeProjectIntakeInput,
  ): Promise<ProjectIntakeFinalizationResult> {
    return this.prisma.$transaction(
      (tx) => this.executeTransaction(tx, input),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async executeTransaction(
    tx: Prisma.TransactionClient,
    input: FinalizeProjectIntakeInput,
  ): Promise<ProjectIntakeFinalizationResult> {
    await tx.$queryRaw`SELECT id FROM Project
      WHERE id = ${input.projectId} AND teamId = ${input.teamId} FOR UPDATE`;
    const project = await tx.project.findFirst({
      where: { id: input.projectId, teamId: input.teamId },
      include: { repositoryConnection: true, repositoryIdentity: true },
    });
    if (!project)
      throw new NotFoundException(projectIntakeNotFoundError());
    assertProjectWritable(project);
    if (
      project.onboardingStatus !== "review" ||
      project.onboardingRevision === null
    ) {
      throw new ConflictException(
        intakeError(
          "PROJECT_INTAKE_NOT_REVIEWED",
          "项目尚未完成仓库解析与逐项确认",
          "请先完成解析结果确认，再执行最终接入。",
        ),
      );
    }

    const connection = project.repositoryConnection;
    const run = await tx.repositoryAnalysisRun.findFirst({
      where: {
        id: input.analysisRunId,
        teamId: input.teamId,
        projectId: input.projectId,
        status: "succeeded",
      },
      include: { suggestions: true },
    });
    const reviewSnapshot = await tx.repositoryIntakeReviewSnapshot.findFirst({
      where: {
        id: input.reviewSnapshotId,
        snapshotHash: input.reviewSnapshotHash,
        runId: input.analysisRunId,
        teamId: input.teamId,
        projectId: input.projectId,
      },
    });
    if (
      !run ||
      !connection ||
      !reviewSnapshot ||
      connection.id !== run.connectionId ||
      connection.lastAppliedRunId !== run.id ||
      !connection.appliedAt
    ) {
      throw new BadRequestException(
        intakeError(
          "PROJECT_INTAKE_ANALYSIS_NOT_APPLIED",
          "最终接入必须引用已完整应用的成功解析运行",
          "请确认全部必需建议并重新应用解析结果。",
        ),
      );
    }
    this.snapshotIntegrity.assertMatches(
      run.suggestions,
      reviewSnapshot,
      connection,
    );

    const identity = await this.identities.lock(tx, {
      teamId: input.teamId,
      projectId: project.id,
      actorId: input.actorId,
      connectionId: connection.id,
      repositoryUrl: connection.repositoryUrl,
      providerRepositoryId: connection.externalRepositoryId,
      defaultBranch: connection.defaultBranch,
      commitSha: connection.commitSha,
      existing: project.repositoryIdentity,
    });
    const governance = await this.governance.finalizeTransaction(tx, {
      teamId: input.teamId,
      projectId: input.projectId,
      actorId: input.actorId,
      expectedStatus: "review",
      expectedRevision: project.onboardingRevision,
      auditAction: "project.intake.finalize",
      auditSummary: "项目接入已完成，Staging/Production 基线已锁定",
      auditMetadata: {
        repositoryIdentityId: identity.id,
        reviewSnapshotId: reviewSnapshot.id,
        reviewSnapshotHash: reviewSnapshot.snapshotHash,
      },
    });

    const result: ProjectIntakeFinalizationResult = {
      ...governance,
      repositoryIdentityId: identity.id,
      reviewSnapshotId: reviewSnapshot.id,
      reviewSnapshotHash: reviewSnapshot.snapshotHash,
    };
    await tx.projectIntakeFinalization.update({
      where: { id: input.finalizationId },
      data: {
        status: "succeeded",
        resultSnapshot: result as unknown as Prisma.InputJsonValue,
        errorCode: null,
        errorMessage: null,
        finishedAt: new Date(governance.finalizedAt),
      },
    });
    return result;
  }
}
