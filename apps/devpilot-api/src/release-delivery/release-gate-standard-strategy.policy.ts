import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { record } from "./release-gate-provider.types";

export type StandardStrategyFact = {
  evidenceRef: string;
  checkedAt: Date;
  identity: Record<string, string | null>;
};

export function exactStandardStrategyFact(
  context: ReleaseGateEvidenceContext,
): StandardStrategyFact | null {
  const run = context.promote?.releaseRun;
  const target = context.decisionTarget;
  if (run && target?.releaseRunId === run.id) {
    const policy = record(record(run.policySnapshot).releasePolicy);
    if (
      policy.strategy !== "standard" ||
      policy.requireProductionApproval !== true
    ) return null;
    return {
      evidenceRef: `release-run:${run.id}#standard-strategy`,
      checkedAt: run.createdAt,
      identity: {
        releaseRunId: run.id,
        previewInputHash: null,
        providerKey: context.decisionTarget?.providerKey ?? null,
        bindingId: context.decisionTarget?.bindingId ?? null,
      },
    };
  }
  const deployEnvironment = context.deploy?.environment;
  const productionEnvironment = context.promote?.environment;
  if (
    context.decisionCheckpoint !== "production_pre_execution" ||
    target?.releaseRunId != null ||
    !target?.previewInputHash ||
    target.releaseStrategy !== "standard" ||
    target.requireProductionApproval !== true ||
    !target.environmentId ||
    target.environmentId !== deployEnvironment?.id ||
    target.environmentId !== productionEnvironment?.id
  ) return null;
  const binding = deployEnvironment.serverBindings.find((item) =>
    item.id === target.bindingId,
  );
  if (
    !binding ||
    !target.providerKey ||
    !["ssh-v1", "local-filesystem-v1"].includes(target.providerKey)
  ) return null;
  return {
    evidenceRef: `production-preview:${target.previewInputHash}#standard-strategy`,
    checkedAt: binding.updatedAt,
    identity: {
      releaseRunId: null,
      previewInputHash: target.previewInputHash,
      environmentId: target.environmentId,
      providerKey: target.providerKey,
      bindingId: binding.id,
    },
  };
}
