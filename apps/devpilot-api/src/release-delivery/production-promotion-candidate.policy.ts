import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";

export type ProductionPromotionCandidate = {
  version: 1;
  teamId: string;
  projectId: string;
  releaseOrderId: string;
  environmentId: string;
  releaseRunId: string;
  deploymentRunId: string;
  configRevisionId: string | null;
  manifestId: string;
  manifestDigest: string;
  buildRunId: string;
  providerKey: string;
  bindingId: string | null;
  deploymentInputHash: string;
  workloadInputHash: string;
  workloadServiceCount: number;
  workloadHealthConfigured: boolean;
  targetRef: string;
  kind: "upgrade" | "recovery";
};

export type FrozenProductionCandidate = ProductionPromotionCandidate & {
  candidateHash: string;
};

export function freezeProductionPromotionCandidate(
  candidate: ProductionPromotionCandidate,
): FrozenProductionCandidate {
  return {
    ...candidate,
    candidateHash: hashCanonicalReleaseValue(candidate),
  };
}

export function parseFrozenProductionCandidate(
  value: unknown,
): FrozenProductionCandidate | null {
  const item = record(value);
  if (
    item.version !== 1 ||
    !strings(item, REQUIRED_STRINGS) ||
    !(item.configRevisionId === null || typeof item.configRevisionId === "string") ||
    !(item.bindingId === null || typeof item.bindingId === "string") ||
    typeof item.workloadServiceCount !== "number" ||
    !Number.isInteger(item.workloadServiceCount) ||
    item.workloadServiceCount < 1 ||
    typeof item.workloadHealthConfigured !== "boolean"
    || !["upgrade", "recovery"].includes(String(item.kind))
  ) return null;
  const frozen = item as FrozenProductionCandidate;
  const { candidateHash, ...candidate } = frozen;
  return candidateHash === hashCanonicalReleaseValue(candidate) ? frozen : null;
}

const REQUIRED_STRINGS = [
  "teamId", "projectId", "releaseOrderId", "environmentId", "releaseRunId",
  "deploymentRunId", "manifestId", "manifestDigest", "buildRunId",
  "providerKey", "deploymentInputHash", "workloadInputHash", "targetRef",
  "candidateHash",
  "kind",
] as const;

function strings(
  value: Record<string, unknown>,
  keys: readonly string[],
) {
  return keys.every((key) => typeof value[key] === "string" && value[key]);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
