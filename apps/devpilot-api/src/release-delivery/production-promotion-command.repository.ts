import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  assertPromotionCommandReplay,
  exactFrozenCandidate,
  promotionCommandInputHash,
} from "./production-promotion-command.policy";
import type {
  ProductionPromotionResumeInput,
  ReservedProductionPromotionCommand,
} from "./production-promotion-command.types";
import {
  assertPromotionApproval,
  assertPromotionCandidateState,
  loadPromotionDeployment,
  lockProductionPromotionRuns,
} from "./production-promotion-command-boundary";
import {
  createProductionPromotionLease,
  ProductionPromotionLeaseLostError,
  productionPromotionLeaseTokenHash,
  promotionLeaseIsActive,
  type ProductionPromotionLease,
} from "./production-promotion-lease.policy";

@Injectable()
export class ProductionPromotionCommandRepository {
  constructor(private readonly prisma: PrismaService) {}

  reserve(input: ProductionPromotionResumeInput) {
    return this.prisma.$transaction(async (tx) => {
      await lockProductionPromotionRuns(tx, input);
      await tx.$queryRaw`SELECT id FROM ProductionPromotionCommand
        WHERE deploymentRunId = ${input.deploymentRunId} FOR UPDATE`;
      const deployment = await loadPromotionDeployment(tx, input);
      const candidate = exactFrozenCandidate(deployment.result, input);
      const inputHash = promotionCommandInputHash(input);
      const existing = await tx.productionPromotionCommand.findUnique({
        where: { deploymentRunId_idempotencyKey: {
          deploymentRunId: input.deploymentRunId,
          idempotencyKey: input.idempotencyKey,
        } },
      });
      if (existing) {
        assertPromotionCommandReplay(existing, inputHash);
        if (existing.status !== "running" ||
          promotionLeaseIsActive(existing.leaseExpiresAt)) {
          return reserved(existing, deployment, candidate, false, undefined, false);
        }
        assertPromotionCandidateState(deployment, candidate);
        await assertPromotionApproval(tx, deployment.releaseRun, candidate);
        const lease = createProductionPromotionLease();
        const reclaimed = await tx.productionPromotionCommand.update({
          where: { id: existing.id },
          data: leaseData(lease, { attemptCount: { increment: 1 } }),
        });
        return reserved(reclaimed, deployment, candidate, true, lease, true);
      }
      assertPromotionCandidateState(deployment, candidate);
      await assertPromotionApproval(tx, deployment.releaseRun, candidate);
      const active = await tx.productionPromotionCommand.findFirst({
        where: { deploymentRunId: input.deploymentRunId, status: "running" },
        select: { id: true },
      });
      if (active) throw new ConflictException("Production promotion 已有待恢复命令");
      const lease = createProductionPromotionLease();
      const command = await tx.productionPromotionCommand.create({
        data: {
          teamId: input.teamId, projectId: input.projectId,
          releaseOrderId: candidate.releaseOrderId,
          releaseRunId: input.releaseRunId,
          deploymentRunId: input.deploymentRunId, actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          candidateHash: input.candidateHash, inputHash,
          attemptCount: 1, ...leaseData(lease),
        },
      });
      return reserved(command, deployment, candidate, true, lease, false);
    });
  }

  async heartbeat(commandId: string, lease: ProductionPromotionLease) {
    const renewed = createProductionPromotionLease(new Date());
    const result = await this.prisma.productionPromotionCommand.updateMany({
      where: leaseWhere(commandId, lease),
      data: {
        heartbeatAt: new Date(), leaseExpiresAt: renewed.expiresAt,
      },
    });
    if (result.count !== 1) throw new ProductionPromotionLeaseLostError();
    return { ...lease, expiresAt: renewed.expiresAt };
  }

  async advance(input: {
    commandId: string;
    lease: ProductionPromotionLease;
    from: string;
    to: string;
    data?: Prisma.ProductionPromotionCommandUpdateManyMutationInput;
  }) {
    const result = await this.prisma.productionPromotionCommand.updateMany({
      where: { ...leaseWhere(input.commandId, input.lease), phase: input.from },
      data: { ...input.data, phase: input.to, heartbeatAt: new Date() },
    });
    if (result.count !== 1) throw new ProductionPromotionLeaseLostError();
  }

  async finish(input: {
    commandId: string; lease: ProductionPromotionLease;
    status: "completed" | "failed" | "blocked";
    result?: Record<string, unknown>; errorCode?: string; errorMessage?: string;
  }) {
    const updated = await this.prisma.productionPromotionCommand.updateMany({
      where: leaseWhere(input.commandId, input.lease),
      data: {
        status: input.status,
        result: input.result as Prisma.InputJsonValue | undefined,
        errorCode: input.errorCode, errorMessage: input.errorMessage,
        leaseOwner: null, leaseTokenHash: null, leaseExpiresAt: null,
        finishedAt: new Date(),
      },
    });
    if (updated.count !== 1) throw new ProductionPromotionLeaseLostError();
  }
}

function leaseWhere(id: string, lease: ProductionPromotionLease) {
  return {
    id, status: "running",
    leaseOwner: lease.owner,
    leaseTokenHash: productionPromotionLeaseTokenHash(lease.token),
  };
}
function leaseData(lease: ProductionPromotionLease, extra = {}) {
  return {
    leaseOwner: lease.owner, leaseTokenHash: lease.tokenHash,
    leaseExpiresAt: lease.expiresAt, heartbeatAt: new Date(), ...extra,
  };
}
function reserved(
  command: any,
  deployment: Awaited<ReturnType<typeof loadPromotionDeployment>>,
  candidate: ReturnType<typeof exactFrozenCandidate>,
  shouldExecute: boolean,
  lease?: ProductionPromotionLease,
  recovered = false,
): ReservedProductionPromotionCommand {
  return { command, candidate, routeSnapshot: deployment.releaseRun.routeSnapshot,
    deploymentResult: deployment.result, deploymentLogs: deployment.logs,
    shouldExecute, lease, recovered };
}
