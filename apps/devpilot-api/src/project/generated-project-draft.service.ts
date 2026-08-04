import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

interface GeneratedProjectDraftInput {
  teamId: string;
  actorId: string;
  name: string;
  description?: string;
  config: object;
  idempotencyKey: string;
}

export interface GeneratedProjectDraftResult {
  id: string;
  name: string;
  config: unknown;
  onboardingStatus: string | null;
  onboardingRevision: number | null;
  idempotencyKey: string;
  inputHash: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function isUniqueError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

@Injectable()
export class GeneratedProjectDraftService {
  constructor(private readonly prisma: PrismaService) {}

  async prepare(
    input: GeneratedProjectDraftInput,
  ): Promise<GeneratedProjectDraftResult> {
    const idempotencyKey = input.idempotencyKey.trim();
    const inputHash = createHash("sha256")
      .update(JSON.stringify(input.config))
      .digest("hex");
    const id = `generated-${createHash("sha256")
      .update(`${input.teamId}\0${idempotencyKey}`)
      .digest("hex")
      .slice(0, 32)}`;
    const generationRequest = { idempotencyKey, inputHash };

    try {
      return {
        ...(await this.prisma.project.create({
          data: {
            id,
            teamId: input.teamId,
            createdById: input.actorId,
            name: input.name,
            description: input.description,
            config: {
              ...input.config,
              origin: "generated",
              generationRequest,
            } as Prisma.InputJsonObject,
            onboardingStatus: "draft",
            onboardingRevision: 1,
          },
          select: {
            id: true,
            name: true,
            config: true,
            onboardingStatus: true,
            onboardingRevision: true,
          },
        })),
        idempotencyKey,
        inputHash,
      };
    } catch (error) {
      if (!isUniqueError(error)) throw error;
    }

    const existing = await this.prisma.project.findFirstOrThrow({
      where: { id, teamId: input.teamId },
      select: {
        id: true,
        name: true,
        config: true,
        onboardingStatus: true,
        onboardingRevision: true,
      },
    });
    const request = asRecord(asRecord(existing.config)?.generationRequest);
    if (
      request?.idempotencyKey !== idempotencyKey ||
      request.inputHash !== inputHash
    ) {
      throw new ConflictException({
        code: "GENERATED_PROJECT_IDEMPOTENCY_MISMATCH",
        message: "幂等键已用于不同的项目生成输入",
        remediation: "请恢复原输入，或使用新的幂等键。",
      });
    }
    return { ...existing, idempotencyKey, inputHash };
  }
}
