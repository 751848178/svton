import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { GateEvaluationRepository } from "./gate-evaluation.repository";

@Injectable()
export class ReleaseGateManualConfirmationService {
  constructor(private readonly evaluations: GateEvaluationRepository) {}

  confirm(input: {
    teamId: string;
    projectId: string;
    releaseOrderId: string;
    evaluationId: string;
    actorId: string;
    reason: string;
    gateId: string;
  }) {
    const definition = RELEASE_GATE_DEFINITIONS.find(
      (candidate) => candidate.id === input.gateId,
    );
    if (!definition?.dispositions.includes("manual")) {
      throw new UnprocessableEntityException("该门禁未定义人工确认处置");
    }
    return this.evaluations.confirmManual(input);
  }
}
