import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ReleaseGateEvaluation } from "./release-gate-catalog.types";
import {
  buildGateEvaluationRow,
  type GateEvaluationScope,
  type PersistedGateStatus,
} from "./gate-evaluation-persistence.utils";
import { persistGateManualApproval } from "./gate-manual-approval.repository";

@Injectable()
export class GateEvaluationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async persist(scope: GateEvaluationScope, checks: ReleaseGateEvaluation[]) {
    const rows = checks.map((check) => buildGateEvaluationRow(scope, check));
    await this.prisma.gateEvaluation.createMany({
      data: rows,
      skipDuplicates: true,
    });
    const stored = await this.prisma.gateEvaluation.findMany({
      where: {
        releaseOrderId: scope.releaseOrderId,
        OR: rows.map((row) => ({
          gateId: row.gateId,
          inputHash: row.inputHash,
        })),
      },
      select: {
        id: true,
        gateId: true,
        inputHash: true,
        definitionVersion: true,
        status: true,
        providerKey: true,
        checkedAt: true,
        expiresAt: true,
        waiver: true,
        waiverExpiresAt: true,
        manualApprovals: {
          orderBy: [{ confirmedAt: "asc" as const }, { id: "asc" as const }],
          select: {
            id: true,
            evaluationInputHash: true,
            actionInputHash: true,
            requesterActorId: true,
            reviewerActorId: true,
            sourcePolicyRevisionId: true,
            sourcePolicySnapshotHash: true,
            sourceCommitSha: true,
            confirmedAt: true,
            expiresAt: true,
          },
        },
        createdAt: true,
      },
    });
    const byIdentity = new Map(
      stored.map((row) => [`${row.gateId}:${row.inputHash}`, row]),
    );
    return checks.map((check, index) => {
      const row = byIdentity.get(
        `${rows[index].gateId}:${rows[index].inputHash}`,
      );
      if (!row)
        throw new Error(`GateEvaluation persistence failed for ${check.id}`);
      return {
        ...check,
        evaluationId: row.id,
        evaluationInputHash: row.inputHash,
        definitionVersion: row.definitionVersion,
        persistedStatus: row.status as PersistedGateStatus,
        persistedAt: row.createdAt.toISOString(),
        waiver: row.waiver,
        waiverExpiresAt: row.waiverExpiresAt?.toISOString() ?? null,
        manualApprovals: row.manualApprovals.map((approval) => ({
          ...approval,
          confirmedAt: approval.confirmedAt.toISOString(),
          expiresAt: approval.expiresAt?.toISOString() ?? null,
        })),
      };
    });
  }

  async confirmManual(input: {
    teamId: string;
    projectId: string;
    releaseOrderId: string;
    evaluationId: string;
    gateId: string;
    actorId: string;
    reason: string;
  }) {
    const row = await this.prisma.gateEvaluation.findFirst({
      where: {
        id: input.evaluationId,
        teamId: input.teamId,
        projectId: input.projectId,
        releaseOrderId: input.releaseOrderId,
        gateId: input.gateId,
      },
    });
    if (!row) throw new NotFoundException("门禁结论不存在或不属于当前发布单");
    if (row.status !== "needs_human" || !row.providerKey) {
      throw new UnprocessableEntityException(
        "只有真实 Provider 的人工门禁可以确认",
      );
    }
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      throw new UnprocessableEntityException("门禁证据已过期，必须重新检查");
    }
    await persistGateManualApproval(this.prisma, row, input);
    return this.prisma.gateEvaluation.findUniqueOrThrow({
      where: { id: row.id },
      include: { manualApprovals: true },
    });
  }

  manualConfirmationTarget(input: {
    teamId: string;
    projectId: string;
    releaseOrderId: string;
    evaluationId: string;
  }) {
    return this.prisma.gateEvaluation.findFirst({
      where: {
        id: input.evaluationId,
        teamId: input.teamId,
        projectId: input.projectId,
        releaseOrderId: input.releaseOrderId,
      },
      select: {
        id: true,
        gateId: true,
        status: true,
        providerKey: true,
        releaseRunId: true,
        buildRunId: true,
        summary: true,
      },
    });
  }

}
