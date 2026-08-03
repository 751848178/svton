import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ReleaseGateEvaluation } from "./release-gate-catalog.types";
import {
  buildGateEvaluationRow,
  type GateEvaluationScope,
} from "./gate-evaluation-persistence.utils";

@Injectable()
export class GateEvaluationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async persist(scope: GateEvaluationScope, checks: ReleaseGateEvaluation[]) {
    const rows = checks.map((check) => buildGateEvaluationRow(scope, check));
    await this.prisma.gateEvaluation.createMany({ data: rows, skipDuplicates: true });
    const stored = await this.prisma.gateEvaluation.findMany({
      where: {
        releaseOrderId: scope.releaseOrderId,
        OR: rows.map((row) => ({ gateId: row.gateId, inputHash: row.inputHash })),
      },
      select: {
        id: true,
        gateId: true,
        inputHash: true,
        definitionVersion: true,
        status: true,
        createdAt: true,
      },
    });
    const byIdentity = new Map(
      stored.map((row) => [`${row.gateId}:${row.inputHash}`, row]),
    );
    return checks.map((check, index) => {
      const row = byIdentity.get(`${rows[index].gateId}:${rows[index].inputHash}`);
      if (!row) throw new Error(`GateEvaluation persistence failed for ${check.id}`);
      return {
        ...check,
        evaluationId: row.id,
        definitionVersion: row.definitionVersion,
        persistedStatus: row.status,
        persistedAt: row.createdAt.toISOString(),
      };
    });
  }
}
