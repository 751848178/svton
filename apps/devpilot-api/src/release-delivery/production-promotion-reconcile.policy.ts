import { ConflictException } from "@nestjs/common";
import { parseFrozenProductionCandidate } from "./production-promotion-candidate.policy";
import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";
import type { ProductionPromotionReconcileInput } from "./production-promotion-reconcile.types";

export function productionPromotionReconcileInputHash(
  input: ProductionPromotionReconcileInput,
) {
  return hashCanonicalReleaseValue({ version: 1, ...input });
}

export function exactLegacyPromotionCandidate(
  command: {
    teamId: string; projectId: string; releaseRunId: string;
    deploymentRunId: string; candidateHash: string;
    deploymentRun: { environmentId: string | null; result: unknown };
  },
  input: Pick<ProductionPromotionReconcileInput,
    "teamId" | "projectId" | "environmentId">,
) {
  const candidate = parseFrozenProductionCandidate(
    record(command.deploymentRun.result).productionCandidate,
  );
  if (!candidate || command.teamId !== input.teamId ||
    command.projectId !== input.projectId ||
    command.deploymentRun.environmentId !== input.environmentId ||
    candidate.teamId !== input.teamId || candidate.projectId !== input.projectId ||
    candidate.environmentId !== input.environmentId ||
    candidate.releaseRunId !== command.releaseRunId ||
    candidate.deploymentRunId !== command.deploymentRunId ||
    candidate.candidateHash !== command.candidateHash) {
    throw new ConflictException("Legacy Production promotion 候选身份已漂移");
  }
  return candidate;
}

export function assertReconcileReplay(actual: string, expected: string) {
  if (actual !== expected) {
    throw new ConflictException("核对幂等键已用于不同的 Production promotion 输入");
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
