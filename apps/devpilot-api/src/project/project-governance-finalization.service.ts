import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectGovernanceBaselineService } from "./project-governance-baseline.service";
import type {
  ProjectGovernanceFinalizationInput,
  ProjectGovernanceFinalizationResult,
} from "./project-governance-finalization.types";

@Injectable()
export class ProjectGovernanceFinalizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly baselines: ProjectGovernanceBaselineService,
  ) {}

  async finalize(
    input: ProjectGovernanceFinalizationInput,
  ): Promise<ProjectGovernanceFinalizationResult> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.finalizeTransaction(tx, input),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? (error as { code?: unknown }).code
            : undefined;
        if (code !== "P2034" || attempt === 3) throw error;
      }
    }
    throw new Error("unreachable project governance retry state");
  }

  async finalizeTransaction(
    tx: Prisma.TransactionClient,
    input: ProjectGovernanceFinalizationInput,
  ): Promise<ProjectGovernanceFinalizationResult> {
    const project = await tx.project.findFirst({
      where: { id: input.projectId, teamId: input.teamId },
      select: {
        id: true,
        onboardingStatus: true,
        onboardingRevision: true,
        onboardingFinalizedAt: true,
      },
    });
    if (!project) throw new NotFoundException("项目不存在");
    if (project.onboardingStatus === "ready" && input.allowAlreadyReady) {
      return this.readReadyResult(tx, project);
    }
    if (
      project.onboardingStatus !== input.expectedStatus ||
      project.onboardingRevision !== input.expectedRevision
    ) {
      throw new ConflictException({
        code: "PROJECT_GOVERNANCE_STATE_CONFLICT",
        message: "项目治理状态已被更新",
        remediation: "请刷新项目状态后重试。",
      });
    }

    const finalizedAt = new Date();
    const claimed = await tx.project.updateMany({
      where: {
        id: project.id,
        teamId: input.teamId,
        onboardingStatus: input.expectedStatus,
        onboardingRevision: input.expectedRevision,
      },
      data: {
        onboardingStatus: "ready",
        onboardingRevision: { increment: 1 },
        onboardingFinalizedAt: finalizedAt,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException({
        code: "PROJECT_GOVERNANCE_CONCURRENT_FINALIZE",
        message: "项目治理正在被并发完成",
        remediation: "请刷新项目状态；已完成时无需再次提交。",
      });
    }

    const environments = await this.baselines.ensure(tx, input);
    const result = {
      projectId: project.id,
      onboardingRevision: input.expectedRevision + 1,
      finalizedAt: finalizedAt.toISOString(),
      environments,
    };
    await tx.auditEvent.create({
      data: {
        teamId: input.teamId,
        actorId: input.actorId,
        projectId: project.id,
        category: "project",
        action: input.auditAction,
        targetType: "project",
        targetId: project.id,
        risk: "medium",
        status: "completed",
        summary: input.auditSummary,
        metadata: {
          ...input.auditMetadata,
          governance: result,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    return result;
  }

  private async readReadyResult(
    tx: Prisma.TransactionClient,
    project: {
      id: string;
      onboardingRevision: number | null;
      onboardingFinalizedAt: Date | null;
    },
  ): Promise<ProjectGovernanceFinalizationResult> {
    const environments = await tx.projectEnvironment.findMany({
      where: {
        projectId: project.id,
        status: "active",
        baselineRole: { in: ["staging", "production"] },
      },
      select: {
        id: true,
        key: true,
        baselineRole: true,
        currentConfigRevisionId: true,
      },
      orderBy: { sortOrder: "asc" },
    });
    if (
      environments.length !== 2 ||
      !project.onboardingRevision ||
      !project.onboardingFinalizedAt ||
      environments.some(({ currentConfigRevisionId }) => !currentConfigRevisionId)
    ) {
      throw new ConflictException({
        code: "PROJECT_GOVERNANCE_READY_INCOMPLETE",
        message: "READY 项目的治理基线不完整",
        remediation: "请修复项目治理数据后重试。",
      });
    }
    return {
      projectId: project.id,
      onboardingRevision: project.onboardingRevision,
      finalizedAt: project.onboardingFinalizedAt.toISOString(),
      environments: environments.map((environment) => ({
        id: environment.id,
        key: environment.key as "staging" | "production",
        baselineRole: environment.baselineRole as "staging" | "production",
        configRevisionId: environment.currentConfigRevisionId as string,
      })),
    };
  }
}
