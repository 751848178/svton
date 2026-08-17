import { ConflictException } from "@nestjs/common";
import { extractSiteEvidence } from "../site/site-probe-policy";
import type { EnvironmentVersionCompletionRepository } from "./environment-version-completion.repository";
import { environmentDeploymentFailureDetail } from "./environment-version-failure.utils";
import type { EnvironmentVersionExecutionContext } from "./environment-version-execution.types";
import {
  type EnvironmentVersionProductionGateService,
  gateDecisionReference,
} from "./environment-version-production-gate.service";
import {
  freezeProductionPromotionCandidate,
  type FrozenProductionCandidate,
} from "./production-promotion-candidate.policy";
import type { ProductionPromotionAwaitingRepository } from "./production-promotion-awaiting.repository";

export interface EnvironmentVersionFinalizationDependencies {
  completion: EnvironmentVersionCompletionRepository;
  productionGates: EnvironmentVersionProductionGateService;
  promotionAwaiting: ProductionPromotionAwaitingRepository;
}

export async function finalizeDeployedEnvironment(
  deps: EnvironmentVersionFinalizationDependencies,
  context: EnvironmentVersionExecutionContext,
  logs: string[],
  deploymentEvidence: Record<string, unknown>,
) {
  try {
    const candidate = productionCandidate(context);
    const postDecision = await deps.productionGates.finalize({
      ...context.gateContext,
      deploymentRunId: context.run.id,
      candidateHash: candidate.candidateHash,
    });
    const reference = gateDecisionReference(postDecision);
    if (!reference) throw new ConflictException("Production 缺少发布后门禁决定");
    const run = await deps.promotionAwaiting.wait({
      candidate,
      actorId: context.input.actorId,
      logs,
      result: deploymentEvidence,
      postDecision: reference,
    });
    return { run, version: null, candidate };
  } catch (error) {
    return completeFailedEnvironment(deps, context, error);
  }
}

export async function completeFailedEnvironment(
  deps: Pick<EnvironmentVersionFinalizationDependencies, "completion" | "productionGates">,
  context: EnvironmentVersionExecutionContext,
  error: unknown,
  status: "failed" | "blocked" = "failed",
) {
  const detail = environmentDeploymentFailureDetail(error);
  const denied = await deps.productionGates.denied(error, {
    ...context.gateContext,
    deploymentRunId: context.run.id,
  });
  return deps.completion.complete({
    ...completionIdentity(context),
    status,
    logs: detail.logs,
    error: `${detail.code}: ${detail.message}`,
    result: {
      manifestId: context.manifest.id,
      manifestDigest: context.manifest.digest,
      ...extractSiteEvidence(error),
      gateDecision: gateDecisionReference(denied),
    },
    gateDecision: gateDecisionReference(denied),
  });
}

function productionCandidate(
  context: EnvironmentVersionExecutionContext,
): FrozenProductionCandidate {
  const releaseRunId = context.releaseRunId;
  const providerKey = context.gateContext.providerKey;
  if (!releaseRunId || !providerKey) {
    throw new ConflictException("Production 候选缺少 ReleaseRun 或 Provider");
  }
  return freezeProductionPromotionCandidate({
    version: 1,
    teamId: context.input.teamId,
    projectId: context.input.projectId,
    releaseOrderId: context.manifest.releaseOrderId,
    environmentId: context.environment.id,
    releaseRunId,
    deploymentRunId: context.run.id,
    configRevisionId: context.frozenConfigRevisionId,
    manifestId: context.manifest.id,
    manifestDigest: context.manifest.digest,
    buildRunId: context.manifest.buildRun.id,
    providerKey,
    bindingId: context.gateContext.bindingId ?? null,
    deploymentInputHash: context.frozenInput.deploymentInput.snapshot.inputHash,
    workloadInputHash: context.frozenInput.workload.inputHash,
    workloadServiceCount: context.frozenInput.workload.services.length,
    workloadHealthConfigured: context.gateContext.workloadHealthConfigured === true,
    targetRef: context.frozenInput.deploymentInput.snapshot.target.targetRef,
    kind: context.input.kind,
  });
}

function completionIdentity(context: EnvironmentVersionExecutionContext) {
  return {
    deploymentRunId: context.run.id,
    kind: context.input.kind,
    teamId: context.input.teamId,
    actorId: context.input.actorId,
    projectId: context.input.projectId,
    releaseOrderId: context.manifest.releaseOrderId,
  };
}
