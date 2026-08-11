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
  providerKey?: string;
  bindingId?: string;
  deploymentInputHash?: string;
  workloadInputHash?: string;
  workloadServiceCount?: number;
  workloadHealthConfigured?: boolean;
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
      idempotencyKey: context.idempotencyKey ?? null,
    },
    requestKey: `final:${context.releaseRunId}:${context.deploymentRunId}`,
  });
}

export function promoteEnvironmentVersionDecision(
  gates: ReleaseGateDecisionService,
  context: EnvironmentVersionGateContext & { deploymentRunId: string },
) {
  return gates.assertAllowed({
    ...scope(context),
    checkpoint: "production_promote",
    target: target(context),
    actionInput: {
      checkpoint: "promote",
      deploymentRunId: context.deploymentRunId,
      releaseRunId: context.releaseRunId ?? null,
      manifestId: context.manifestId,
      deploymentInputHash: context.deploymentInputHash ?? null,
    },
    requestKey: `promote:${context.releaseRunId}:${context.deploymentRunId}`,
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
    environmentId: context.environmentId,
    configRevisionId: context.configRevisionId,
    providerKey: context.providerKey,
    bindingId: context.bindingId,
    deploymentInputHash: context.deploymentInputHash,
    workloadInputHash: context.workloadInputHash,
    workloadServiceCount: context.workloadServiceCount,
    workloadHealthConfigured: context.workloadHealthConfigured,
  };
}
