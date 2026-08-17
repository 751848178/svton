import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import type { FinalizeProjectIntakeDto } from "./dto/project-intake.dto";
import { ProjectIntakeFinalizationExecutorService } from "./project-intake-finalization-executor.service";
import { ProjectIntakeFinalizationRecordRepository } from "./project-intake-finalization-record.repository";
import {
  duplicateRepositoryError,
  intakeError,
  intakeErrorCode,
  isPrismaTransactionRetryable,
  isPrismaUniqueError,
  isRepositoryIdentityUniqueError,
  projectIntakeNotFoundError,
} from "./project-intake-errors.utils";
import type { ProjectIntakeFinalizationResult } from "./project-intake.types";
import { PrismaService } from "../prisma/prisma.service";
import { assertProjectWritable } from "../project/project-archived-write.error";

@Injectable()
export class ProjectIntakeFinalizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly records: ProjectIntakeFinalizationRecordRepository,
    private readonly executor: ProjectIntakeFinalizationExecutorService,
  ) {}

  async finalize(
    teamId: string,
    actorId: string,
    projectId: string,
    dto: FinalizeProjectIntakeDto,
  ): Promise<ProjectIntakeFinalizationResult> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId },
      select: { archivedAt: true, onboardingStatus: true },
    });
    if (!project) throw new NotFoundException(projectIntakeNotFoundError());
    assertProjectWritable(project);
    const inputHash = createHash("sha256")
      .update(
        JSON.stringify({
          projectId,
          analysisRunId: dto.analysisRunId,
          reviewSnapshotId: dto.reviewSnapshotId!,
          reviewSnapshotHash: dto.reviewSnapshotHash!,
        }),
      )
      .digest("hex");
    const record = await this.records.prepare({
      teamId,
      projectId,
      analysisRunId: dto.analysisRunId,
      actorId,
      idempotencyKey: dto.idempotencyKey,
      inputHash,
    });
    if (record.status === "succeeded")
      return this.readResult(record.resultSnapshot);

    try {
      return await this.executeWithRetry({
        teamId,
        projectId,
        analysisRunId: dto.analysisRunId,
        reviewSnapshotId: dto.reviewSnapshotId!,
        reviewSnapshotHash: dto.reviewSnapshotHash!,
        actorId,
        idempotencyKey: dto.idempotencyKey,
        inputHash,
        finalizationId: record.id,
      });
    } catch (error) {
      const completed = await this.records.find(projectId, dto.idempotencyKey);
      if (completed?.status === "succeeded")
        return this.readResult(completed.resultSnapshot);
      await this.records.markFailed(record.id, intakeErrorCode(error));
      if (isRepositoryIdentityUniqueError(error))
        throw duplicateRepositoryError();
      if (isPrismaUniqueError(error))
        throw new ConflictException(
          intakeError(
            "PROJECT_INTAKE_BASELINE_CONFLICT",
            "项目环境基线与现有配置冲突",
            "请修复重复的环境角色后重试最终接入。",
          ),
        );
      throw error;
    }
  }

  private readResult(value: unknown): ProjectIntakeFinalizationResult {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("succeeded finalization is missing its result snapshot");
    }
    return value as unknown as ProjectIntakeFinalizationResult;
  }

  private async executeWithRetry(
    input: Parameters<ProjectIntakeFinalizationExecutorService["execute"]>[0],
  ): Promise<ProjectIntakeFinalizationResult> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.executor.execute(input);
      } catch (error) {
        if (!isPrismaTransactionRetryable(error) || attempt === 3) throw error;
      }
    }
    throw new Error("unreachable project intake retry state");
  }
}
