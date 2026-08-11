import { Injectable, NotFoundException } from "@nestjs/common";
import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { ReleaseGateCapabilityRegistryService } from "./release-gate-capability-registry.service";
import { ReleaseGateDeployEvidenceRepository } from "./release-gate-deploy-evidence.repository";
import { ReleaseGateEvidenceRepository } from "./release-gate-evidence.repository";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { ReleaseGatePromoteEvidenceRepository } from "./release-gate-promote-evidence.repository";
import type {
  ReleaseGateCheckpoint,
  ReleaseGateDecisionTarget,
} from "./release-gate-decision.types";
import type { ReleaseGateActionIdentity } from "./release-gate-action-identity.policy";
import { GateEvaluationRepository } from "./gate-evaluation.repository";

type EvaluationScope = {
  teamId: string;
  projectId: string;
  releaseOrderId: string;
  actorId: string;
};

@Injectable()
export class ReleaseGateEvaluationService {
  constructor(
    private readonly evidence: ReleaseGateEvidenceRepository,
    private readonly deployEvidence: ReleaseGateDeployEvidenceRepository,
    private readonly promoteEvidence: ReleaseGatePromoteEvidenceRepository,
    private readonly capabilities: ReleaseGateCapabilityRegistryService,
    private readonly evaluations: GateEvaluationRepository,
  ) {}

  async evaluate(
    scope: EvaluationScope,
    target?: ReleaseGateDecisionTarget,
    checkpoint?: ReleaseGateCheckpoint,
    actionIdentity?: ReleaseGateActionIdentity,
  ) {
    const order = await this.evidence.load(
      scope.teamId,
      scope.projectId,
      scope.releaseOrderId,
      target?.buildRunId,
    );
    if (!order) throw new NotFoundException("发布单不存在或不属于当前项目");
    const context: ReleaseGateEvidenceContext = {
      ...order,
      decisionTarget: target,
      decisionCheckpoint: checkpoint,
      deploy: await this.deployEvidence.load(
        scope.teamId,
        scope.projectId,
        scope.releaseOrderId,
        target?.manifestId,
        target?.environmentId,
        target?.configRevisionId,
        target?.deploymentRunId,
      ),
      promote: await this.promoteEvidence.load(
        scope.teamId,
        scope.projectId,
        scope.releaseOrderId,
        target?.releaseRunId,
      ),
    };
    const now = new Date();
    const evaluated = RELEASE_GATE_DEFINITIONS.map((definition) =>
      this.capabilities.evaluate(definition, context, now),
    );
    const checks = await this.evaluations.persist(
      {
        ...scope,
        buildRunId: target ? target.buildRunId : order.buildRuns[0]?.id,
        releaseRunId: target
          ? target.releaseRunId
          : context.promote?.releaseRun?.id,
        decisionIdentity: {
          checkpoint: checkpoint ?? null,
          deploymentRunId: target?.deploymentRunId ?? null,
          candidateHash: target?.candidateHash ?? null,
          approvalSubjectHash: actionIdentity?.approvalSubjectHash ?? "",
          actionInputHash: actionIdentity?.actionInputHash ?? "",
          requesterActorId: actionIdentity?.requesterActorId ?? scope.actorId,
        },
      },
      evaluated,
    );
    return {
      order,
      checks,
      capabilities: this.capabilities.list(context),
    };
  }
}
