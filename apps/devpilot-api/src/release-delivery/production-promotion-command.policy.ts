import { ConflictException } from "@nestjs/common";
import type { ProductionPromotionCommand } from "@prisma/client";
import { parseFrozenProductionCandidate } from "./production-promotion-candidate.policy";
import type { ProductionPromotionResumeInput } from "./production-promotion-command.types";
import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";

export function promotionCommandInputHash(
  input: ProductionPromotionResumeInput,
) {
  return hashCanonicalReleaseValue({
    version: 1,
    ...input,
  });
}

export function assertPromotionCommandReplay(
  command: ProductionPromotionCommand,
  inputHash: string,
) {
  if (command.inputHash !== inputHash) {
    throw new ConflictException("幂等键已用于不同的 Production promotion 输入");
  }
}

export function assertPromotionCommandReconciled(
  command: Pick<ProductionPromotionCommand, "legacyReconcileRequired">,
) {
  if (command.legacyReconcileRequired) {
    throw new ConflictException({
      code: "LEGACY_PROMOTION_RECONCILE_REQUIRED",
      message: "历史 Production promotion 阶段无法证明，必须先核对 route/provider 状态",
    });
  }
}

export function exactFrozenCandidate(
  result: unknown,
  input: ProductionPromotionResumeInput,
) {
  const candidate = parseFrozenProductionCandidate(record(result).productionCandidate);
  if (
    !candidate ||
    candidate.candidateHash !== input.candidateHash ||
    candidate.teamId !== input.teamId ||
    candidate.projectId !== input.projectId ||
    candidate.environmentId !== input.environmentId ||
    candidate.releaseRunId !== input.releaseRunId ||
    candidate.deploymentRunId !== input.deploymentRunId
  ) {
    throw new ConflictException("Production promotion 候选已漂移或不完整");
  }
  return candidate;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
