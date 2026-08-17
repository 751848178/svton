import { assertApprovedWorkload } from "./release-approved-workload.policy";
import { ConflictException } from "@nestjs/common";
import type { EnvironmentVersionExecutionContext } from "./environment-version-execution.types";

export function assertEnvironmentVersionApprovedWorkload(
  productionRun: { policySnapshot: unknown } | undefined,
  frozenInput: EnvironmentVersionExecutionContext["frozenInput"],
  providerKey: string,
) {
  if (productionRun) {
    assertApprovedWorkload(productionRun.policySnapshot, frozenInput.workload);
    const policy = record(productionRun.policySnapshot);
    if (policy.deploymentProviderKey !== providerKey) {
      throw new ConflictException(
        "Production Deployment Provider 已在审批后漂移，请重新申请审批",
      );
    }
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
