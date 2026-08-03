import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectIntakeBaselineFinalizerService } from "./project-intake-baseline-finalizer.service";
import { intakeError } from "./project-intake-errors.utils";
import type {
  FinalizeProjectIntakeInput,
  ProjectIntakeFinalizationResult,
} from "./project-intake.types";
import { normalizeRepositoryIdentity } from "./project-repository-identity.utils";

@Injectable()
export class ProjectIntakeFinalizationExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly baselines: ProjectIntakeBaselineFinalizerService,
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
    const project = await tx.project.findFirst({
      where: { id: input.projectId, teamId: input.teamId },
      include: { repositoryConnection: true, repositoryIdentity: true },
    });
    if (!project)
      throw new NotFoundException(
        intakeError(
          "PROJECT_NOT_FOUND",
          "项目不存在",
          "请返回项目接入列表并重新选择。",
        ),
      );
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
    });
    if (
      !run ||
      !connection ||
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

    const normalized = normalizeRepositoryIdentity(connection.repositoryUrl);
    if (!normalized)
      throw new BadRequestException(
        intakeError(
          "PROJECT_REPOSITORY_IDENTITY_INVALID",
          "无法生成仓库规范身份",
          "请重新连接有效的 HTTPS、SSH 或本地 Git 仓库。",
        ),
      );
    if (
      project.repositoryIdentity &&
      project.repositoryIdentity.canonicalKey !== normalized.canonicalKey
    ) {
      throw new ConflictException(
        intakeError(
          "PROJECT_REPOSITORY_IDENTITY_LOCKED",
          "项目仓库身份已锁定为其他仓库",
          "请保留已锁定仓库，或创建新的项目。",
        ),
      );
    }

    const claimed = await tx.project.updateMany({
      where: {
        id: project.id,
        teamId: input.teamId,
        onboardingStatus: "review",
        onboardingRevision: project.onboardingRevision,
      },
      data: {
        onboardingStatus: "ready",
        onboardingRevision: { increment: 1 },
        onboardingFinalizedAt: new Date(),
      },
    });
    if (claimed.count !== 1)
      throw new ConflictException(
        intakeError(
          "PROJECT_INTAKE_CONCURRENT_FINALIZE",
          "项目接入状态已被并发请求更新",
          "请刷新状态；已完成时无需再次提交。",
        ),
      );

    const lockedAt = new Date();
    const identity =
      project.repositoryIdentity ??
      (await tx.projectRepositoryIdentity.create({
        data: {
          teamId: input.teamId,
          projectId: project.id,
          repositoryConnectionId: connection.id,
          provider: connection.provider,
          providerRepositoryId: connection.externalRepositoryId,
          canonicalKey: normalized.canonicalKey,
          canonicalUrl: normalized.canonicalUrl,
          defaultBranch: connection.defaultBranch,
          lockedAt,
        },
      }));
    const environments = await this.baselines.ensure(tx, input, lockedAt);

    const result: ProjectIntakeFinalizationResult = {
      projectId: project.id,
      repositoryIdentityId: identity.id,
      onboardingRevision: project.onboardingRevision + 1,
      finalizedAt: lockedAt.toISOString(),
      environments,
    };
    await tx.projectIntakeFinalization.update({
      where: { id: input.finalizationId },
      data: {
        status: "succeeded",
        resultSnapshot: result as unknown as Prisma.InputJsonValue,
        errorCode: null,
        errorMessage: null,
        finishedAt: lockedAt,
      },
    });
    await tx.auditEvent.create({
      data: {
        teamId: input.teamId,
        actorId: input.actorId,
        projectId: project.id,
        category: "project",
        action: "project.intake.finalize",
        targetType: "project",
        targetId: project.id,
        risk: "medium",
        status: "completed",
        summary: "项目接入已完成，Staging/Production 基线已锁定",
        metadata: result as unknown as Prisma.InputJsonValue,
      },
    });
    return result;
  }
}
