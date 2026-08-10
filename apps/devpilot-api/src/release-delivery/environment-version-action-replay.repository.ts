import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

export async function replayEnvironmentVersionAction(
  database: Pick<Prisma.TransactionClient, "deploymentRun">,
  input: {
    teamId: string;
    projectId: string;
    actorId: string;
    environmentId: string;
    idempotencyKey: string;
    requestHash: string;
  },
) {
  const existing = await database.deploymentRun.findUnique({
    where: {
      projectId_idempotencyKey: {
        projectId: input.projectId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    include: { environmentVersion: true },
  });
  if (!existing) return null;
  if (
    existing.teamId !== input.teamId ||
    existing.actorId !== input.actorId ||
    existing.environmentId !== input.environmentId ||
    existing.requestHash !== input.requestHash
  ) {
    throw new ConflictException("幂等键已用于不同的环境版本动作请求");
  }
  return { ...existing, idempotentReplay: true as const };
}
