import { frozenApprovedWorkload } from "./release-approved-workload.policy";
import type { ProductionReleaseSnapshot } from "./release-production.types";

export function releaseProductionPolicySnapshot(
  snapshot: ProductionReleaseSnapshot,
  providerKey?: string,
) {
  return {
    releasePolicy: snapshot.releasePolicy,
    environmentPolicyReferences: snapshot.config.policySnapshot,
    releaseProtection: releaseProtection(
      snapshot.config.policySnapshot,
      snapshot.releasePolicy.synthetic,
    ),
    approvedWorkload: frozenApprovedWorkload(snapshot.workload),
    acceptanceMode: providerKey === "local-filesystem-v1"
      ? "technical_acceptance"
      : "production",
    deploymentProviderKey: providerKey ?? null,
  };
}

function releaseProtection(value: unknown, synthetic: boolean) {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const candidate = record.releaseProtection;
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    const protection = candidate as Record<string, unknown>;
    return {
      changeWindowVerified: protection.changeWindowVerified === true,
      freezeVerified: protection.freezeVerified === true,
    };
  }
  return {
    changeWindowVerified: synthetic === true,
    freezeVerified: synthetic === true,
  };
}
