import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ProjectIntakeFinalization } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  intakeError,
  isPrismaUniqueError,
} from "./project-intake-errors.utils";

export interface PrepareFinalizationRecordInput {
  teamId: string;
  projectId: string;
  analysisRunId: string;
  actorId: string;
  idempotencyKey: string;
  inputHash: string;
}

@Injectable()
export class ProjectIntakeFinalizationRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  async prepare(
    input: PrepareFinalizationRecordInput,
  ): Promise<ProjectIntakeFinalization> {
    const project = await this.prisma.project.findFirst({
      where: { id: input.projectId, teamId: input.teamId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(
        intakeError(
          "PROJECT_NOT_FOUND",
          "项目不存在",
          "请返回项目接入列表并重新选择。",
        ),
      );
    }
    let record = await this.find(input.projectId, input.idempotencyKey);
    if (!record) {
      try {
        record = await this.prisma.projectIntakeFinalization.create({
          data: {
            teamId: input.teamId,
            projectId: input.projectId,
            analysisRunId: input.analysisRunId,
            actorId: input.actorId,
            idempotencyKey: input.idempotencyKey,
            inputHash: input.inputHash,
            status: "pending",
            startedAt: new Date(),
          },
        });
      } catch (error) {
        if (!isPrismaUniqueError(error)) throw error;
        record = await this.find(input.projectId, input.idempotencyKey);
      }
    }
    if (!record) throw new Error("finalization record disappeared");
    this.assertSameInput(record, input);
    if (record.status !== "succeeded") {
      await this.prisma.projectIntakeFinalization.updateMany({
        where: { id: record.id, status: { in: ["pending", "failed"] } },
        data: {
          status: "pending",
          errorCode: null,
          errorMessage: null,
          startedAt: new Date(),
          finishedAt: null,
        },
      });
      record = await this.prisma.projectIntakeFinalization.findUniqueOrThrow({
        where: { id: record.id },
      });
    }
    return record;
  }

  async markFailed(id: string, code: string): Promise<void> {
    await this.prisma.projectIntakeFinalization.updateMany({
      where: { id, status: { not: "succeeded" } },
      data: { status: "failed", errorCode: code, finishedAt: new Date() },
    });
  }

  find(projectId: string, idempotencyKey: string) {
    return this.prisma.projectIntakeFinalization.findUnique({
      where: { projectId_idempotencyKey: { projectId, idempotencyKey } },
    });
  }

  private assertSameInput(
    record: ProjectIntakeFinalization,
    input: PrepareFinalizationRecordInput,
  ): void {
    if (
      record.teamId === input.teamId &&
      record.analysisRunId === input.analysisRunId &&
      record.inputHash === input.inputHash
    )
      return;
    throw new ConflictException(
      intakeError(
        "PROJECT_INTAKE_IDEMPOTENCY_MISMATCH",
        "幂等键已用于不同的接入确认输入",
        "请恢复原输入，或使用新的幂等键。",
      ),
    );
  }
}
