import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ProductionPromotionLease } from "./production-promotion-lease.policy";
import { productionPromotionLeaseTokenHash } from "./production-promotion-lease.policy";

export async function completeProductionPromotionCommand(
  tx: Prisma.TransactionClient,
  input: {
    commandId: string;
    deploymentRunId: string;
    candidateHash: string;
    status: "completed" | "failed" | "blocked";
    result?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
    lease?: ProductionPromotionLease;
  },
) {
  const transitioned = await tx.productionPromotionCommand.updateMany({
    where: {
      id: input.commandId,
      deploymentRunId: input.deploymentRunId,
      candidateHash: input.candidateHash,
      status: "running",
      ...(input.lease ? {
        leaseOwner: input.lease.owner,
        leaseTokenHash: productionPromotionLeaseTokenHash(input.lease.token),
      } : {}),
      ...(input.status === "completed" ? { phase: "committing" } : {}),
    },
    data: {
      status: input.status,
      result: input.result as Prisma.InputJsonValue | undefined,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      finishedAt: new Date(),
      leaseOwner: null,
      leaseTokenHash: null,
      leaseExpiresAt: null,
    },
  });
  if (transitioned.count === 1) return;
  const current = await tx.productionPromotionCommand.findUnique({
    where: { id: input.commandId },
    select: {
      deploymentRunId: true,
      candidateHash: true,
      status: true,
    },
  });
  if (
    !current ||
    current.deploymentRunId !== input.deploymentRunId ||
    current.candidateHash !== input.candidateHash ||
    current.status !== input.status
  ) throw new ConflictException("Production promotion command 完成状态冲突");
}
