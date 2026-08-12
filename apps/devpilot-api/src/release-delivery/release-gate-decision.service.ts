import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { buildReleaseGateDecision } from "./release-gate-decision.model";
import { buildReleaseGatePreviewDecision } from "./release-gate-preview.model";
import { defaultCheckpointForStage } from "./release-gate-checkpoint.policy";
import { ReleaseGateDecisionRepository } from "./release-gate-decision.repository";
import {
  RELEASE_GATE_DECISION_STAGES,
  type ReleaseGateCheckpoint,
  type ReleaseGateDecision,
  type ReleaseGateDecisionInput,
  type ReleaseGateDecisionTarget,
} from "./release-gate-decision.types";
import { ReleaseGateEvaluationService } from "./release-gate-evaluation.service";
import {
  releaseGateActionIdentity,
  type ReleaseGateActionIdentity,
} from "./release-gate-action-identity.policy";

type DecisionScope = {
  teamId: string;
  projectId: string;
  releaseOrderId: string;
  actorId: string;
};

export class ReleaseGateBlockedException extends UnprocessableEntityException {
  constructor(readonly decision: ReleaseGateDecision) {
    super({
      code: "RELEASE_GATE_BLOCKED",
      message: `${decision.stage} 门禁未满足，服务端已拒绝执行`,
      publicData: { decision },
    });
  }
}

@Injectable()
export class ReleaseGateDecisionService {
  constructor(
    private readonly evaluator: ReleaseGateEvaluationService,
    private readonly decisions: ReleaseGateDecisionRepository,
  ) {}

  async catalog(scope: DecisionScope, buildInput: ReleaseGateDecisionInput) {
    const buildCheckpoint = defaultCheckpointForStage("build");
    const buildIdentity = releaseGateActionIdentity({
      checkpoint: buildCheckpoint,
      actionInput: buildInput.actionInput,
      requesterActorId: scope.actorId,
    });
    const evaluation = await this.evaluator.evaluate(
      scope,
      buildInput.target,
      buildCheckpoint,
      buildIdentity,
    );
    const entries = await Promise.all(
      RELEASE_GATE_DECISION_STAGES.filter((stage) => stage !== "production").map(
        async (stage) => {
          const checkpoint = defaultCheckpointForStage(stage);
          const actionInput = stage === "build"
            ? buildInput.actionInput
            : { source: "catalog" };
          return [
            stage,
            await this.persist(
              scope,
              checkpoint,
              evaluation.checks,
              actionInput,
              releaseGateActionIdentity({
                checkpoint,
                actionInput,
                requesterActorId: scope.actorId,
              }),
            ),
          ] as const;
        },
      ),
    );
    return { evaluation, decisions: {
      ...Object.fromEntries(entries),
      production: null,
    } };
  }

  async preview(input: DecisionScope & {
    checkpoint: ReleaseGateCheckpoint;
    target?: ReleaseGateDecisionTarget;
    actionInput?: Record<string, string | null>;
    requestKey?: string;
  }) {
    const { checkpoint, target, actionInput, requestKey, ...scope } = input;
    const actionIdentity = releaseGateActionIdentity({ checkpoint, actionInput,
      requesterActorId: scope.actorId });
    void requestKey;
    const evaluation = await this.evaluator.evaluateTransient(
      scope,
      target,
      checkpoint,
    );
    const decision = buildReleaseGatePreviewDecision({
      checkpoint,
      checks: evaluation.evaluated,
      actionIdentity,
    });
    return { decision, checks: evaluation.evaluated };
  }

  async assertAllowed(
    input: DecisionScope & {
      checkpoint: ReleaseGateCheckpoint;
      target?: ReleaseGateDecisionTarget;
      actionInput?: Record<string, string | null>;
      requestKey?: string;
    },
  ) {
    const {
      checkpoint,
      target,
      actionInput,
      requestKey,
      ...scope
    } = input;
    const actionIdentity = releaseGateActionIdentity({
      checkpoint,
      actionInput,
      requesterActorId: scope.actorId,
    });
    const evaluation = await this.evaluator.evaluate(
      scope,
      target,
      checkpoint,
      actionIdentity,
    );
    const decision = await this.persist(
      scope,
      checkpoint,
      evaluation.checks,
      actionInput,
      actionIdentity,
      requestKey,
    );
    if (!decision.allowed) {
      throw new ReleaseGateBlockedException(decision);
    }
    return decision;
  }

  private persist(
    scope: DecisionScope,
    checkpoint: ReleaseGateCheckpoint,
    checks: Parameters<typeof buildReleaseGateDecision>[0]["checks"],
    actionInput?: Record<string, string | null>,
    actionIdentity?: ReleaseGateActionIdentity,
    requestKey?: string,
  ) {
    return this.decisions.persist(
      scope,
      buildReleaseGateDecision({
        checkpoint,
        checks,
        actionInput,
        actionIdentity: actionIdentity ?? releaseGateActionIdentity({
          checkpoint,
          actionInput,
          requesterActorId: scope.actorId,
        }),
      }),
      requestKey,
    );
  }
}
