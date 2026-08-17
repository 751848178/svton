import type { ReleaseGateDecisionService } from "./release-gate-decision.service";

export type EnvironmentVersionGateContext = {
  teamId: string;
  actorId: string;
  projectId: string;
  releaseOrderId: string;
  environmentId: string;
  configRevisionId: string | null;
  manifestId: string;
  buildRunId: string;
  releaseRunId?: string;
  deploymentRunId?: string;
  candidateHash?: string;
  providerKey?: string;
  bindingId?: string;
  deploymentInputHash?: string;
  workloadInputHash?: string;
  workloadServiceCount?: number;
  workloadHealthConfigured?: boolean;
  capacitySnapshotId?: string;
  capacitySnapshotHash?: string;
  dnsProbeReceiptId?: string;
  dnsProbeResultHash?: string;
  idempotencyKey?: string;
};

export function admitEnvironmentVersion(
  gates: ReleaseGateDecisionService,
  context: EnvironmentVersionGateContext,
  stage: "staging" | "production",
) {
  return gates.assertAllowed({
    ...scope(context),
    checkpoint:
      stage === "staging"
        ? "staging_pre_execution"
        : "production_pre_execution",
    target: target(context),
    actionInput: {
      checkpoint: "pre_execution",
      environmentId: context.environmentId,
      configRevisionId: context.configRevisionId,
      manifestId: context.manifestId,
      buildRunId: context.buildRunId,
      releaseRunId: context.releaseRunId ?? null,
      providerKey: context.providerKey ?? null,
      bindingId: context.bindingId ?? null,
      deploymentInputHash: context.deploymentInputHash ?? null,
      workloadInputHash: context.workloadInputHash ?? null,
      workloadServiceCount: context.workloadServiceCount === undefined
        ? null
        : String(context.workloadServiceCount),
      workloadHealthConfigured: context.workloadHealthConfigured === undefined
        ? null
        : String(context.workloadHealthConfigured),
      capacitySnapshotId: context.capacitySnapshotId ?? null,
      capacitySnapshotHash: context.capacitySnapshotHash ?? null,
      dnsProbeReceiptId: context.dnsProbeReceiptId ?? null,
      dnsProbeResultHash: context.dnsProbeResultHash ?? null,
      idempotencyKey: context.idempotencyKey ?? null,
    },
    requestKey: `pre:${stage}:${context.idempotencyKey ?? context.releaseRunId ?? context.manifestId}`,
  });
}

export function finalEnvironmentVersionDecision(
  gates: ReleaseGateDecisionService,
  context: EnvironmentVersionGateContext & { deploymentRunId: string },
) {
  return gates.assertAllowed({
    ...scope(context),
    checkpoint: "production_post_deploy",
    target: target(context),
    actionInput: {
      checkpoint: "post_deploy",
      deploymentRunId: context.deploymentRunId,
      environmentId: context.environmentId,
      configRevisionId: context.configRevisionId,
      buildRunId: context.buildRunId,
      manifestId: context.manifestId,
      releaseRunId: context.releaseRunId ?? null,
      providerKey: context.providerKey ?? null,
      bindingId: context.bindingId ?? null,
      deploymentInputHash: context.deploymentInputHash ?? null,
      workloadInputHash: context.workloadInputHash ?? null,
      workloadServiceCount: context.workloadServiceCount === undefined
        ? null
        : String(context.workloadServiceCount),
      workloadHealthConfigured: context.workloadHealthConfigured === undefined
        ? null
        : String(context.workloadHealthConfigured),
      candidateHash: context.candidateHash ?? null,
      idempotencyKey: context.idempotencyKey ?? null,
    },
    requestKey: `final:${context.releaseRunId}:${context.deploymentRunId}`,
  });
}

export function promoteEnvironmentVersionDecision(
  gates: ReleaseGateDecisionService,
  context: EnvironmentVersionGateContext & {
    deploymentRunId: string;
    candidateHash: string;
    promotionCommandId?: string;
  },
) {
  return gates.assertAllowed({
    ...scope(context),
    checkpoint: "production_promote_pre_route",
    target: target(context),
    actionInput: {
      checkpoint: "promote_pre_route",
      deploymentRunId: context.deploymentRunId,
      releaseRunId: context.releaseRunId ?? null,
      manifestId: context.manifestId,
      deploymentInputHash: context.deploymentInputHash ?? null,
      candidateHash: context.candidateHash,
      promotionCommandId: context.promotionCommandId ?? null,
    },
  });
}

export function postRouteEnvironmentVersionDecision(
  gates: ReleaseGateDecisionService,
  context: EnvironmentVersionGateContext & {
    deploymentRunId: string;
    candidateHash: string;
    promotionCommandId: string;
    routeSwitchOperationId: string;
  },
) {
  return gates.assertAllowed({
    ...scope(context),
    checkpoint: "production_post_route",
    target: target(context),
    actionInput: {
      checkpoint: "post_route",
      deploymentRunId: context.deploymentRunId,
      releaseRunId: context.releaseRunId ?? null,
      candidateHash: context.candidateHash,
      promotionCommandId: context.promotionCommandId,
      routeSwitchOperationId: context.routeSwitchOperationId,
    },
  });
}

function scope(context: EnvironmentVersionGateContext) {
  return {
    teamId: context.teamId,
    actorId: context.actorId,
    projectId: context.projectId,
    releaseOrderId: context.releaseOrderId,
  };
}

function target(context: EnvironmentVersionGateContext) {
  return {
    buildRunId: context.buildRunId,
    manifestId: context.manifestId,
    releaseRunId: context.releaseRunId,
    deploymentRunId: context.deploymentRunId,
    candidateHash: context.candidateHash,
    environmentId: context.environmentId,
    configRevisionId: context.configRevisionId,
    providerKey: context.providerKey,
    bindingId: context.bindingId,
    deploymentInputHash: context.deploymentInputHash,
    workloadInputHash: context.workloadInputHash,
    workloadServiceCount: context.workloadServiceCount,
    workloadHealthConfigured: context.workloadHealthConfigured,
    capacitySnapshotId: context.capacitySnapshotId,
    capacitySnapshotHash: context.capacitySnapshotHash,
    dnsProbeReceiptId: context.dnsProbeReceiptId,
    dnsProbeResultHash: context.dnsProbeResultHash,
  };
}
